# AgentBreaker v2.1 Verification Suite Validation Report

This report summarizes the automated benchmark suite verification for AgentBreaker v2.1.
Each scenario was executed in both **Unguarded** (standard safety ceilings only) and **Guarded** (policies enabled, including loop detection) modes.

## Summary Table

| Scenario | Expected Outcome | Unguarded Iters/Cost | Guarded Iters/Cost | Tokens Saved | Cost Saved (%) | Trip Reason | Conclusion Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **simple_info**<br>*Resolves in 2 iterations; verifies no false positives on short successful runs.* | `completed` | 2 / $0.00025 | 2 / $0.00025 | 0 | $0.00000 (0.0%) | `-` | **✅ PASS** |
| **deep_research**<br>*Performs progressive research; verifies normal execution is allowed up to iteration limits.* | `completed` | 4 / $0.00075 | 4 / $0.00075 | 0 | $0.00000 (0.0%) | `-` | **✅ PASS** |
| **infinite_loop**<br>*Repeatedly calls the exact same tool and args; verifies loop trip detection at iteration 4.* | `tripped` | 15 / $0.00228 | 5 / $0.00076 | 2,300 | $0.00152 (66.7%) | `repeated_tool_calls` | **✅ PASS** |

## System Verdict

> [!NOTE]
> **OVERALL SYSTEM STATUS: VERIFIED (PASS)**
> All breaker rules, loop detectors, and adapters are functioning exactly as designed under the v2.1 specifications.

*Report generated on: 2026-06-23 23:39:14*
