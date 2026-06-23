"""
main.py
FastAPI backend for AgentBreaker.
Endpoints to start runs, stream live updates, fetch history.
"""

import uuid
import time
import threading
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from rules import build_default_engine, build_engine_from_ids, BUILTIN_RULES
from database import AgentRun, get_db, init_db
from circuit_breaker import CircuitBreaker
from agent import run_agent

app = FastAPI(title="AgentBreaker API", version="1.0.0")

# Allow React frontend to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store of active breakers for live status polling
active_breakers: dict[str, CircuitBreaker] = {}


# ── Request / Response Models ──────────────────────────────────────────────

class StartRunRequest(BaseModel):
    topic: str
    max_iterations: int = 6
    max_cost_usd: float = 2.00
    max_time_seconds: float = 120.0
    max_velocity_per_10s: float = 0.50
    rule_ids: Optional[list[str]] = None   # if None, uses default rule set


class RunResponse(BaseModel):
    run_id: str
    status: str
    topic: str
    is_tripped: bool
    trip_reason: Optional[str]
    trip_message: Optional[str]
    total_tokens: int
    total_cost_usd: float
    iteration_count: int
    elapsed_seconds: float
    started_at: str
    config: dict
    iterations: list


# ── Helpers ────────────────────────────────────────────────────────────────

def run_to_response(run: AgentRun) -> dict:
    """Convert a DB row to a clean API response dict."""
    return {
        "run_id": run.run_id,
        "status": run.status,
        "topic": run.topic,
        "is_tripped": run.is_tripped,
        "trip_reason": run.trip_reason,
        "trip_message": run.trip_message,
        "total_input_tokens": run.total_input_tokens,
        "total_output_tokens": run.total_output_tokens,
        "total_tokens": run.total_tokens,
        "total_cost_usd": run.total_cost_usd,
        "iteration_count": run.iteration_count,
        "tool_calls": run.tool_calls,
        "elapsed_seconds": run.elapsed_seconds,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "ended_at": run.ended_at.isoformat() if run.ended_at else None,
        "config": run.config,
        "iterations": run.iterations or [],
        "is_hidden": run.is_hidden or False,
    }


def execute_run(run_id: str, topic: str, rule_engine):
    """
    Runs the agent in a background thread.
    Updates the DB record in real time after each iteration.
    """
    from database import SessionLocal
    from circuit_breaker import RunState
    import time

    db = SessionLocal()

    # Patch circuit breaker to write to DB after every iteration
    breaker = CircuitBreaker(run_id=run_id, rule_engine=rule_engine)
    active_breakers[run_id] = breaker

    # Store original record_llm_call
    original_record = breaker.record_llm_call

    def record_and_persist(input_tokens, output_tokens, tool_name=None):
        """Wrap record_llm_call to persist state after every call."""
        try:
            original_record(input_tokens, output_tokens, tool_name)
        except RuntimeError:
            # Breaker tripped — persist final state then re-raise
            _persist_state(db, run_id, breaker, topic, status="tripped")
            raise
        # Still running — persist live state
        _persist_state(db, run_id, breaker, topic, status="running")

    breaker.record_llm_call = record_and_persist

    try:
        run_agent(topic=topic, breaker=breaker)
        _persist_state(db, run_id, breaker, topic, status="completed")
    except RuntimeError:
        pass  # Already persisted in wrapper above
    except Exception as e:
        _persist_state(db, run_id, breaker, topic, status="error")
        print(f"Unexpected error in run {run_id}: {e}")
    finally:
        active_breakers.pop(run_id, None)
        db.close()


def _persist_state(db: Session, run_id: str, breaker: CircuitBreaker,
                   topic: str, status: str):
    """Write current breaker state to the database."""
    state = breaker.state
    summary = breaker.get_summary()

    run = db.query(AgentRun).filter(AgentRun.run_id == run_id).first()
    if not run:
        return

    run.status              = status
    run.is_tripped          = state.is_tripped
    run.trip_reason         = state.trip_reason if state.trip_reason else None
    run.trip_message        = state.trip_message
    run.total_input_tokens  = state.total_input_tokens
    run.total_output_tokens = state.total_output_tokens
    run.total_tokens        = summary["total_tokens"]
    run.total_cost_usd      = state.total_cost_usd
    run.iteration_count     = state.iteration_count
    run.tool_calls          = state.tool_calls
    run.elapsed_seconds     = summary["elapsed_seconds"]

    if status in ("tripped", "completed", "error"):
        run.ended_at = datetime.utcnow()

    # Append this iteration to history for the timeline chart
    current_iterations = list(run.iterations or [])
    current_iterations.append({
        "iteration": state.iteration_count,
        "tokens": summary["total_tokens"],
        "cost": round(state.total_cost_usd, 6),
        "timestamp": time.time(),
    })
    run.iterations = current_iterations
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(run, "iterations")

    db.commit()


# ── Endpoints ──────────────────────────────────────────────────────────────

@app.on_event("startup")
def startup():
    """Initialize DB on startup."""
    init_db()
    print("✅ AgentBreaker API started")


@app.get("/rules")
def list_rules():
    """List all available rules for the dashboard's config panel."""
    return [
        {
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "severity": r.severity.value,
        }
        for r in BUILTIN_RULES.values()
    ]


@app.post("/runs")
def start_run(request: StartRunRequest, db: Session = Depends(get_db)):
    """Start a new agent run. Returns run_id immediately, runs in background."""
    run_id = str(uuid.uuid4())[:8]

    config = {
        "max_iterations": request.max_iterations,
        "max_cost_usd": request.max_cost_usd,
        "max_time_seconds": request.max_time_seconds,
        "max_velocity_per_10s": request.max_velocity_per_10s,
    }

    if request.rule_ids:
        rule_engine = build_engine_from_ids(request.rule_ids, config)
    else:
        rule_engine = build_default_engine(config)

    active_rule_ids = [r.id for r in rule_engine.rules]

    run = AgentRun(
        run_id=run_id,
        topic=request.topic,
        status="running",
        started_at=datetime.utcnow(),
        config={**config, "rule_ids": active_rule_ids},
        iterations=[],
    )
    db.add(run)
    db.commit()

    thread = threading.Thread(
        target=execute_run,
        args=(run_id, request.topic, rule_engine),
        daemon=True
    )
    thread.start()

    return {"run_id": run_id, "status": "started", "active_rules": active_rule_ids}


@app.get("/runs")
def list_runs(db: Session = Depends(get_db)):
    """List non-hidden runs, most recent first."""
    runs = db.query(AgentRun).filter(AgentRun.is_hidden == False).order_by(AgentRun.started_at.desc()).all()
    return [run_to_response(r) for r in runs]


@app.get("/runs/{run_id}")
def get_run(run_id: str, db: Session = Depends(get_db)):
    """Get a single run by ID. Poll this for live updates."""
    run = db.query(AgentRun).filter(AgentRun.run_id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run_to_response(run)


@app.get("/metrics")
def get_metrics(db: Session = Depends(get_db)):
    """Aggregate stats across non-hidden runs."""
    runs = db.query(AgentRun).filter(AgentRun.is_hidden == False).all()
    total_runs = len(runs)
    tripped = [r for r in runs if r.is_tripped]
    total_cost = sum(r.total_cost_usd for r in runs)

    # Estimate cost saved — assume each tripped run would have
    # done 3x more iterations if not stopped
    cost_saved = sum(
        r.total_cost_usd * 2
        for r in tripped
    )

    return {
        "total_runs": total_runs,
        "total_tripped": len(tripped),
        "total_cost_usd": round(total_cost, 4),
        "estimated_cost_saved_usd": round(cost_saved, 4),
        "trip_rate_pct": round(len(tripped) / total_runs * 100, 1) if total_runs else 0,
    }


@app.delete("/runs")
def clear_runs(db: Session = Depends(get_db)):
    """Clear all runs by marking them hidden (soft-delete)."""
    # Soft delete: update is_hidden to True
    db.query(AgentRun).update({AgentRun.is_hidden: True})
    db.commit()
    return {"message": "All runs cleared"}