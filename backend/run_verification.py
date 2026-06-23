"""
run_verification.py
Automated benchmark and verification suite runner for AgentBreaker v2.1.
Runs scenarios under unguarded and guarded conditions, persists them to the database,
retrieves historical comparison runs from the database, and compiles validation_report.md.
Supports --real mode for live LLM and real tool execution.
"""

import os
import sys
import time
import uuid
import argparse
from datetime import datetime
from unittest.mock import patch

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from circuit_breaker import CircuitBreaker
from rules import build_default_engine, build_engine_from_ids
from agent import run_agent
from scenarios import SCENARIOS, SCENARIO_MOCKS, MockLLMResponse
from database import init_db, SessionLocal, AgentRun, CompareRun

# ── Mock LLM for LangChain and Legacy agent mode ──────────────────────────────
class MockChatGroq:
    def __init__(self, scenario_name: str, callbacks=None):
        self.scenario_name = scenario_name
        self.callbacks = callbacks or []
        self.iteration = 0

    def invoke(self, messages):
        responses = SCENARIO_MOCKS.get(self.scenario_name, [])
        if self.scenario_name == "infinite_loop":
            resp = responses[0]
        else:
            if self.iteration < len(responses):
                resp = responses[self.iteration]
            else:
                resp = MockLLMResponse(
                    content="FINDING: No further information.\nNEXT_QUESTION: DONE",
                    input_tokens=100,
                    output_tokens=50
                )
        
        self.iteration += 1
        
        # Construct AIMessage for return type
        from langchain_core.messages import AIMessage
        msg = AIMessage(
            content=resp.content,
            response_metadata={"token_usage": resp.response_metadata["token_usage"]}
        )
        
        # Fire callback if available
        for cb in self.callbacks:
            if hasattr(cb, "on_llm_end"):
                from langchain_core.outputs import LLMResult, Generation
                result = LLMResult(
                    generations=[[Generation(text=resp.content, message=msg)]],
                    llm_output={"token_usage": resp.response_metadata["token_usage"]}
                )
                cb.on_llm_end(result)
                
        return msg

def save_run_to_db(db, run_id: str, topic: str, status: str, breaker: CircuitBreaker, config: dict):
    summary = breaker.get_summary()
    run = db.query(AgentRun).filter(AgentRun.run_id == run_id).first()
    if not run:
        run = AgentRun(
            run_id=run_id,
            topic=topic,
            started_at=datetime.utcnow(),
            config=config,
            iterations=[]
        )
        db.add(run)
    
    run.status = status
    run.is_tripped = breaker.state.is_tripped
    run.trip_reason = breaker.state.trip_reason
    run.trip_message = breaker.state.trip_message
    run.total_input_tokens = breaker.state.total_input_tokens
    run.total_output_tokens = breaker.state.total_output_tokens
    run.total_tokens = summary["total_tokens"]
    run.total_cost_usd = breaker.state.total_cost_usd
    run.iteration_count = breaker.state.iteration_count
    run.tool_calls = summary["tool_calls"]
    run.elapsed_seconds = summary["elapsed_seconds"]
    run.ended_at = datetime.utcnow()
    db.commit()

def save_compare_to_db(db, compare_id: str, topic: str, config: dict, ung_run_id: str, grd_run_id: str, ung_res: dict, grd_res: dict, tokens_saved: int, cost_saved_pct: float):
    cr = db.query(CompareRun).filter(CompareRun.compare_id == compare_id).first()
    if not cr:
        cr = CompareRun(
            compare_id=compare_id,
            topic=topic,
            started_at=datetime.utcnow(),
            config=config
        )
        db.add(cr)
        
    cr.status = "done"
    cr.unguarded_run_id = ung_run_id
    cr.guarded_run_id = grd_run_id
    cr.unguarded_iterations = ung_res["iterations"]
    cr.unguarded_tokens = ung_res["tokens"]
    cr.unguarded_cost_usd = ung_res["cost"]
    cr.unguarded_status = ung_res["status"]
    
    cr.guarded_iterations = grd_res["iterations"]
    cr.guarded_tokens = grd_res["tokens"]
    cr.guarded_cost_usd = grd_res["cost"]
    cr.guarded_status = grd_res["status"]
    cr.guarded_trip_reason = grd_res["trip_reason"]
    cr.guarded_trip_message = grd_res["trip_message"]
    
    cr.tokens_saved = tokens_saved
    cr.cost_saved_pct = cost_saved_pct
    cr.ended_at = datetime.utcnow()
    db.commit()

def run_scenario(db, scenario_key: str, guarded: bool, real: bool = False) -> tuple[str, dict]:
    scenario = SCENARIOS[scenario_key]
    topic = scenario["topic"]
    
    run_id = f"{'grd' if guarded else 'ung'}_{scenario_key}_{str(uuid.uuid4())[:4]}"
    
    # Configure limits
    if guarded:
        config = {
            "max_iterations": 8,
            "max_cost_usd": 2.00,
            "max_time_seconds": 120.0,
            "max_velocity_per_10s": 0.50,
            "max_repeated_tool_calls": 4,
        }
        rule_engine = build_default_engine(config)
    else:
        config = {
            "max_iterations": 15,
            "max_cost_usd": 2.00,
            "max_time_seconds": 120.0,
            "max_velocity_per_10s": 0.50,
        }
        rule_engine = build_engine_from_ids(["cost_exceeded", "iterations_exceeded"], config)
        
    breaker = CircuitBreaker(run_id=run_id, config=config, rule_engine=rule_engine)
    status = "completed"
    
    if real:
        from realistic_agent import run_realistic_agent
        try:
            run_realistic_agent(topic, breaker)
        except RuntimeError as e:
            if "tripped" in str(e):
                status = "tripped"
            else:
                status = "error"
        except Exception:
            status = "error"
    else:
        # Create the mock model generator
        def mock_create_llm(callbacks=None):
            return MockChatGroq(scenario_key, callbacks)
            
        # Run the agent with patched LLM and sleep
        with patch("agent.create_llm", mock_create_llm), patch("time.sleep", return_value=None):
            try:
                run_agent(topic, breaker)
            except RuntimeError as e:
                if "tripped" in str(e):
                    status = "tripped"
                else:
                    status = "error"
            except Exception:
                status = "error"
            
    # Persist agent run state
    save_run_to_db(db, run_id, topic, status, breaker, config)
    
    summary = breaker.get_summary()
    
    # Print tool call logs to confirm captures
    if summary["tool_calls"]:
        print("  [Verification] Captured Tool Call Log:")
        for tc in summary["tool_calls"]:
            result_snippet = str(tc['result'])[:80] + "..." if tc['result'] else "None"
            print(f"    - Name: {tc['name']}, Args: {tc['args']}, Result: {result_snippet}")
            
    return run_id, {
        "status": status,
        "iterations": summary["iteration_count"],
        "tokens": summary["total_tokens"],
        "cost": summary["total_cost_usd"],
        "trip_reason": summary["trip_reason"],
        "trip_message": summary["trip_message"]
    }

def main():
    parser = argparse.ArgumentParser(description="AgentBreaker Verification Suite")
    parser.add_argument("--real", action="store_true", help="Run with real agents and live API calls")
    args = parser.parse_args()

    mode_label = "REAL AGENT MODE (LIVE LLM)" if args.real else "MOCK SIMULATOR MODE (OFFLINE)"
    print("=" * 60)
    print(f"RUNNING AGENTBREAKER v2.1 AUTOMATED VERIFICATION BENCHMARK SUITE")
    print(f"Mode: {mode_label}")
    print("=" * 60)
    
    # Initialize DB schema
    init_db()
    db = SessionLocal()
    
    results = {}
    
    try:
        for key, scenario in SCENARIOS.items():
            print(f"\nScenario: {key} - '{scenario['topic']}'")
            
            # 1. Run Unguarded
            print("  Running Unguarded...")
            ung_run_id, ung_res = run_scenario(db, key, guarded=False, real=args.real)
            print(f"    -> Status: {ung_res['status']}, Iterations: {ung_res['iterations']}, Cost: ${ung_res['cost']:.5f}")
            
            # 2. Run Guarded
            print("  Running Guarded...")
            grd_run_id, grd_res = run_scenario(db, key, guarded=True, real=args.real)
            print(f"    -> Status: {grd_res['status']}, Iterations: {grd_res['iterations']}, Cost: ${grd_res['cost']:.5f}")
            
            # Calculate Savings
            tokens_saved = max(0, ung_res["tokens"] - grd_res["tokens"])
            cost_saved = max(0.0, ung_res["cost"] - grd_res["cost"])
            cost_saved_pct = (cost_saved / ung_res["cost"] * 100) if ung_res["cost"] > 0 else 0.0
            
            # Persist comparison run
            compare_id = f"comp_{key}_{str(uuid.uuid4())[:4]}"
            save_compare_to_db(
                db, compare_id, scenario["topic"], 
                {"rule_ids": ["cost_exceeded", "iterations_exceeded", "repeated_tool_calls"]},
                ung_run_id, grd_run_id, ung_res, grd_res, tokens_saved, cost_saved_pct
            )
            
            # Evaluate Correctness
            expected = scenario["expected_status"]
            actual = grd_res["status"]
            is_correct = (actual == expected)
            
            if key == "infinite_loop" and actual == "tripped" and grd_res["trip_reason"] != "repeated_tool_calls":
                is_correct = False
                
            conclusion = "PASS" if is_correct else "FAIL"
            
            results[key] = {
                "scenario": scenario,
                "unguarded": ung_res,
                "guarded": grd_res,
                "tokens_saved": tokens_saved,
                "cost_saved": cost_saved,
                "cost_saved_pct": cost_saved_pct,
                "conclusion": conclusion
            }
            
        # Fetch all historical comparison runs from DB
        historical_comparisons = db.query(CompareRun).order_by(CompareRun.started_at.desc()).all()
        
    finally:
        db.close()
        
    # Generate validation_report.md
    report_content = f"""# AgentBreaker v2.1 Verification Suite Validation Report

This report summarizes the automated benchmark suite verification for AgentBreaker v2.1.
Each scenario was executed in both **Unguarded** (standard safety ceilings only) and **Guarded** (policies enabled, including loop detection) modes, and persisted to the database.

## Current Verification Suite Results

| Scenario | Expected Outcome | Unguarded Iters/Cost | Guarded Iters/Cost | Tokens Saved | Cost Saved (%) | Trip Reason | Conclusion Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
"""

    all_pass = True
    for key, res in results.items():
        ung = res["unguarded"]
        grd = res["guarded"]
        scen = res["scenario"]
        
        trip_reason = grd["trip_reason"] if grd["trip_reason"] else "-"
        conclusion_emoji = "✅ PASS" if res["conclusion"] == "PASS" else "❌ FAIL"
        if res["conclusion"] != "PASS":
            all_pass = False
            
        report_content += (
            f"| **{key}**<br>*{scen['desc']}* | `{scen['expected_status']}` | "
            f"{ung['iterations']} / ${ung['cost']:.5f} | "
            f"{grd['iterations']} / ${grd['cost']:.5f} | "
            f"{res['tokens_saved']:,} | "
            f"${res['cost_saved']:.5f} ({res['cost_saved_pct']:.1f}%) | "
            f"`{trip_reason}` | "
            f"**{conclusion_emoji}** |\n"
        )
        
    report_content += "\n## System Verdict\n\n"
    if all_pass:
        report_content += "> [!NOTE]\n"
        report_content += "> **OVERALL SYSTEM STATUS: VERIFIED (PASS)**\n"
        report_content += "> All breaker rules, loop detectors, and adapters are functioning exactly as designed under the v2.1 specifications.\n"
    else:
        report_content += "> [!CAUTION]\n"
        report_content += "> **OVERALL SYSTEM STATUS: FAILED**\n"
        report_content += "> One or more verification scenarios did not behave as expected. Please check rules configurations.\n"
        
    # Historical Comparisons Table
    report_content += "\n## Historical Comparisons Log (from Database)\n\n"
    if historical_comparisons:
        report_content += "| Compare ID | Topic | Guarded Status | Savings (%) | Tokens Saved | Started At |\n"
        report_content += "| :--- | :--- | :--- | :--- | :--- | :--- |\n"
        for cr in historical_comparisons:
            topic_truncated = cr.topic[:50] + "..." if len(cr.topic) > 53 else cr.topic
            started_str = cr.started_at.strftime("%Y-%m-%d %H:%M") if cr.started_at else "-"
            report_content += (
                f"| `{cr.compare_id}` | {topic_truncated} | `{cr.guarded_status or cr.status}` | "
                f"{cr.cost_saved_pct:.1f}% | {cr.tokens_saved or 0:,} | {started_str} |\n"
            )
    else:
        report_content += "*No historical comparisons found in the database.*\n"
        
    report_content += f"\n*Report generated on: {time.strftime('%Y-%m-%d %H:%M:%S')}*\n"
    
    # Save report to root
    root_report_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "validation_report.md")
    with open(root_report_path, "w", encoding="utf-8") as f:
        f.write(report_content)
        
    print(f"\n[Verification] Validation report written to {root_report_path}")
    print(f"Overall status: {'PASS' if all_pass else 'FAIL'}")
    
if __name__ == "__main__":
    main()
