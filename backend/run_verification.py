"""
run_verification.py
Automated benchmark and verification suite runner for AgentBreaker v2.1.
Runs scenarios under unguarded and guarded conditions, evaluates breaker correctness,
and generates validation_report.md.
"""

import os
import sys
import time
from unittest.mock import patch

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from circuit_breaker import CircuitBreaker
from rules import build_default_engine, build_engine_from_ids
from agent import run_agent
from scenarios import SCENARIOS, SCENARIO_MOCKS, MockLLMResponse

# ── Mock LLM for LangChain and Legacy agent mode ──────────────────────────────
class MockChatGroq:
    def __init__(self, scenario_name: str, callbacks=None):
        self.scenario_name = scenario_name
        self.callbacks = callbacks or []
        self.iteration = 0

    def invoke(self, messages):
        responses = SCENARIO_MOCKS.get(self.scenario_name, [])
        if self.scenario_name == "infinite_loop":
            # Infinite loop always returns the same prompt-query response
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

def run_scenario(scenario_key: str, guarded: bool) -> dict:
    scenario = SCENARIOS[scenario_key]
    topic = scenario["topic"]
    
    # Configure limits
    if guarded:
        config = {
            "max_iterations": 6,
            "max_cost_usd": 2.00,
            "max_time_seconds": 120.0,
            "max_velocity_per_10s": 0.50,
            "max_repeated_tool_calls": 4,
        }
        # Guarded runs with all default rules (including stuck loop detection)
        rule_engine = build_default_engine(config)
    else:
        config = {
            "max_iterations": 15,
            "max_cost_usd": 2.00,
            "max_time_seconds": 120.0,
            "max_velocity_per_10s": 0.50,
        }
        # Unguarded runs only check hard safety limits (cost and iterations exceeded)
        rule_engine = build_engine_from_ids(["cost_exceeded", "iterations_exceeded"], config)
        
    breaker = CircuitBreaker(run_id=f"test_{scenario_key}_{'g' if guarded else 'u'}", config=config, rule_engine=rule_engine)
    
    # Create the mock model generator
    def mock_create_llm(callbacks=None):
        return MockChatGroq(scenario_key, callbacks)
        
    status = "completed"
    
    # Run the agent with patched LLM and sleep
    with patch("agent.create_llm", mock_create_llm), patch("time.sleep", return_value=None):
        try:
            run_agent(topic, breaker)
        except RuntimeError as e:
            if "tripped" in str(e):
                status = "tripped"
            else:
                status = "error"
                import traceback
                traceback.print_exc()
        except Exception as e:
            status = "error"
            import traceback
            traceback.print_exc()
            
    summary = breaker.get_summary()
    return {
        "status": status,
        "iterations": summary["iteration_count"],
        "tokens": summary["total_tokens"],
        "cost": summary["total_cost_usd"],
        "trip_reason": summary["trip_reason"],
        "trip_message": summary["trip_message"]
    }

def main():
    print("=" * 60)
    print("RUNNING AGENTBREAKER v2.1 AUTOMATED VERIFICATION BENCHMARK SUITE")
    print("=" * 60)
    
    results = {}
    
    for key, scenario in SCENARIOS.items():
        print(f"\nScenario: {key} - '{scenario['topic']}'")
        
        # 1. Run Unguarded
        print("  Running Unguarded...")
        ung_res = run_scenario(key, guarded=False)
        print(f"    -> Status: {ung_res['status']}, Iterations: {ung_res['iterations']}, Cost: ${ung_res['cost']:.5f}")
        
        # 2. Run Guarded
        print("  Running Guarded...")
        grd_res = run_scenario(key, guarded=True)
        print(f"    -> Status: {grd_res['status']}, Iterations: {grd_res['iterations']}, Cost: ${grd_res['cost']:.5f}")
        if grd_res['trip_reason']:
            print(f"       Trip Reason: {grd_res['trip_reason']} - {grd_res['trip_message']}")
            
        # Calculate Savings
        tokens_saved = max(0, ung_res["tokens"] - grd_res["tokens"])
        cost_saved = max(0.0, ung_res["cost"] - grd_res["cost"])
        cost_saved_pct = (cost_saved / ung_res["cost"] * 100) if ung_res["cost"] > 0 else 0.0
        
        # Evaluate Correctness
        expected = scenario["expected_status"]
        actual = grd_res["status"]
        is_correct = (actual == expected)
        
        # Loop detector check: infinite_loop must trip on repeated_tool_calls
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
        
    # Generate validation_report.md
    report_content = f"""# AgentBreaker v2.1 Verification Suite Validation Report

This report summarizes the automated benchmark suite verification for AgentBreaker v2.1.
Each scenario was executed in both **Unguarded** (standard safety ceilings only) and **Guarded** (policies enabled, including loop detection) modes.

## Summary Table

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
        
    report_content += f"\n*Report generated on: {time.strftime('%Y-%m-%d %H:%M:%S')}*\n"
    
    # Save report to root
    root_report_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "validation_report.md")
    with open(root_report_path, "w", encoding="utf-8") as f:
        f.write(report_content)
        
    print(f"\n[Verification] Validation report written to {root_report_path}")
    print(f"Overall status: {'PASS' if all_pass else 'FAIL'}")
    
if __name__ == "__main__":
    main()
