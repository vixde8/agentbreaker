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
from database import AgentRun, CompareRun, get_db, init_db
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


class CompareRequest(BaseModel):
    topic: str
    max_iterations: int = 6
    max_cost_usd: float = 2.00
    max_time_seconds: float = 120.0
    max_velocity_per_10s: float = 0.50
    rule_ids: Optional[list[str]] = None



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


def compare_to_response(cr: CompareRun) -> dict:
    """Convert a CompareRun DB row to a clean API response dict."""
    return {
        "compare_id": cr.compare_id,
        "topic": cr.topic,
        "status": cr.status,
        "unguarded_run_id": cr.unguarded_run_id,
        "guarded_run_id": cr.guarded_run_id,
        "unguarded_iterations": cr.unguarded_iterations,
        "unguarded_tokens": cr.unguarded_tokens,
        "unguarded_cost_usd": cr.unguarded_cost_usd,
        "unguarded_status": cr.unguarded_status,
        "guarded_iterations": cr.guarded_iterations,
        "guarded_tokens": cr.guarded_tokens,
        "guarded_cost_usd": cr.guarded_cost_usd,
        "guarded_status": cr.guarded_status,
        "guarded_trip_reason": cr.guarded_trip_reason,
        "guarded_trip_message": cr.guarded_trip_message,
        "cost_saved_pct": cr.cost_saved_pct,
        "tokens_saved": cr.tokens_saved,
        "started_at": cr.started_at.isoformat() if cr.started_at else None,
        "ended_at": cr.ended_at.isoformat() if cr.ended_at else None,
        "config": cr.config or {},
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
        # Rate limit safety delay
        time.sleep(2.0)

    breaker.record_llm_call = record_and_persist

    try:
        from realistic_agent import run_realistic_agent
        run_realistic_agent(topic=topic, breaker=breaker)
        _persist_state(db, run_id, breaker, topic, status="completed")
    except RuntimeError:
        pass  # Already persisted in wrapper above
    except Exception as e:
        breaker.state.trip_message = str(e)
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
    # Use serialised tool_calls from summary (handles ToolCall objects & legacy strings)
    run.tool_calls          = summary["tool_calls"]
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


def run_comparison_thread(compare_id: str, topic: str, config: dict, rule_ids: list[str]):
    """Background task running unguarded and guarded runs sequentially."""
    from database import SessionLocal, AgentRun, CompareRun
    from rules import build_engine_from_ids, build_default_engine
    import uuid

    # 1. RUN UNGUARDED
    unguarded_run_id = f"ung_{str(uuid.uuid4())[:5]}"
    unguarded_config = {
        "max_iterations": 20,
        "max_cost_usd": 2.00,
        "max_time_seconds": 120.0,
        "max_velocity_per_10s": 0.50,
        "rule_ids": []
    }
    
    db = SessionLocal()
    try:
        u_run = AgentRun(
            run_id=unguarded_run_id,
            topic=topic,
            status="running",
            started_at=datetime.utcnow(),
            config=unguarded_config,
            iterations=[],
        )
        db.add(u_run)
        cr = db.query(CompareRun).filter(CompareRun.compare_id == compare_id).first()
        if cr:
            cr.unguarded_run_id = unguarded_run_id
        db.commit()
    except Exception as e:
        print(f"Error starting unguarded in compare run {compare_id}: {e}")
    finally:
        db.close()

    # Run unguarded sequentially
    try:
        u_engine = build_engine_from_ids([], unguarded_config)
        execute_run(unguarded_run_id, topic, u_engine)
    except Exception as e:
        print(f"Error executing unguarded in compare run {compare_id}: {e}")

    # Snapshot unguarded stats
    db = SessionLocal()
    try:
        u_run = db.query(AgentRun).filter(AgentRun.run_id == unguarded_run_id).first()
        cr = db.query(CompareRun).filter(CompareRun.compare_id == compare_id).first()
        if u_run and cr:
            cr.unguarded_iterations = u_run.iteration_count
            cr.unguarded_tokens = u_run.total_tokens
            cr.unguarded_cost_usd = u_run.total_cost_usd
            cr.unguarded_status = u_run.status
        db.commit()
    except Exception as e:
        print(f"Error updating unguarded stats in compare run {compare_id}: {e}")
    finally:
        db.close()

    # 2. RUN GUARDED
    guarded_run_id = f"grd_{str(uuid.uuid4())[:5]}"
    db = SessionLocal()
    try:
        g_run = AgentRun(
            run_id=guarded_run_id,
            topic=topic,
            status="running",
            started_at=datetime.utcnow(),
            config=config,
            iterations=[],
        )
        db.add(g_run)
        cr = db.query(CompareRun).filter(CompareRun.compare_id == compare_id).first()
        if cr:
            cr.guarded_run_id = guarded_run_id
        db.commit()
    except Exception as e:
        print(f"Error starting guarded in compare run {compare_id}: {e}")
    finally:
        db.close()

    # Run guarded sequentially
    try:
        if rule_ids is not None:
            g_engine = build_engine_from_ids(rule_ids, config)
        else:
            g_engine = build_default_engine(config)
        execute_run(guarded_run_id, topic, g_engine)
    except Exception as e:
        print(f"Error executing guarded in compare run {compare_id}: {e}")

    # Final stats, savings, and update CompareRun
    db = SessionLocal()
    try:
        g_run = db.query(AgentRun).filter(AgentRun.run_id == guarded_run_id).first()
        u_run = db.query(AgentRun).filter(AgentRun.run_id == unguarded_run_id).first()
        cr = db.query(CompareRun).filter(CompareRun.compare_id == compare_id).first()
        if cr:
            if g_run:
                cr.guarded_iterations = g_run.iteration_count
                cr.guarded_tokens = g_run.total_tokens
                cr.guarded_cost_usd = g_run.total_cost_usd
                cr.guarded_status = g_run.status
                cr.guarded_trip_reason = g_run.trip_reason
                cr.guarded_trip_message = g_run.trip_message

            if u_run and g_run:
                # Compute savings
                u_cost = u_run.total_cost_usd
                g_cost = g_run.total_cost_usd
                if u_cost > 0:
                    saved_pct = ((u_cost - g_cost) / u_cost) * 100
                    cr.cost_saved_pct = round(max(0.0, saved_pct), 1)
                else:
                    cr.cost_saved_pct = 0.0
                
                cr.tokens_saved = max(0, u_run.total_tokens - g_run.total_tokens)
            
            cr.status = "done"
            cr.ended_at = datetime.utcnow()
        db.commit()
    except Exception as e:
        print(f"Error finishing compare run {compare_id}: {e}")
        try:
            cr = db.query(CompareRun).filter(CompareRun.compare_id == compare_id).first()
            if cr:
                cr.status = "error"
            db.commit()
        except Exception:
            pass
    finally:
        db.close()


@app.post("/compare")
def start_compare(request: CompareRequest, db: Session = Depends(get_db)):
    """
    Start a side-by-side comparison.
    Runs one unguarded run first, then one guarded run in a background thread.
    """
    compare_id = "comp_" + str(uuid.uuid4())[:8]

    config = {
        "max_iterations": request.max_iterations,
        "max_cost_usd": request.max_cost_usd,
        "max_time_seconds": request.max_time_seconds,
        "max_velocity_per_10s": request.max_velocity_per_10s,
    }

    if request.rule_ids is not None:
        rule_ids = request.rule_ids
    else:
        rule_ids = [r.id for r in build_default_engine(config).rules]

    compare_run = CompareRun(
        compare_id=compare_id,
        topic=request.topic,
        status="running",
        started_at=datetime.utcnow(),
        config={**config, "rule_ids": rule_ids},
    )
    db.add(compare_run)
    db.commit()

    thread = threading.Thread(
        target=run_comparison_thread,
        args=(compare_id, request.topic, config, rule_ids),
        daemon=True
    )
    thread.start()

    return {"compare_id": compare_id, "status": "started"}


@app.get("/compare/{compare_id}")
def get_compare(compare_id: str, db: Session = Depends(get_db)):
    """Fetch status of a comparison run."""
    cr = db.query(CompareRun).filter(CompareRun.compare_id == compare_id).first()
    if not cr:
        raise HTTPException(status_code=404, detail="Comparison run not found")
    return compare_to_response(cr)


@app.get("/compare")
def list_comparisons(db: Session = Depends(get_db)):
    """List all comparisons, most recent first."""
    runs = db.query(CompareRun).order_by(CompareRun.started_at.desc()).all()
    return [compare_to_response(r) for r in runs]

