# AgentBreaker v2.1 Verification Suite Validation Report

This report summarizes the automated benchmark suite verification for AgentBreaker v2.1.
Each scenario was executed in both **Unguarded** (standard safety ceilings only) and **Guarded** (policies enabled, including loop detection) modes, and persisted to the database.

## Current Verification Suite Results

| Scenario | Expected Outcome | Unguarded Iters/Cost | Guarded Iters/Cost | Tokens Saved | Cost Saved (%) | Trip Reason | Conclusion Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **simple_info**<br>*Resolves in 2 iterations; verifies no false positives on short successful runs.* | `completed` | 2 / $0.00025 | 2 / $0.00025 | 0 | $0.00000 (0.0%) | `-` | **✅ PASS** |
| **deep_research**<br>*Performs progressive research; verifies normal execution is allowed up to iteration limits.* | `completed` | 4 / $0.00075 | 4 / $0.00075 | 0 | $0.00000 (0.0%) | `-` | **✅ PASS** |
| **infinite_loop**<br>*Repeatedly calls the exact same tool and args; verifies loop trip detection at iteration 4.* | `tripped` | 15 / $0.00228 | 5 / $0.00076 | 2,300 | $0.00152 (66.7%) | `repeated_tool_calls` | **✅ PASS** |

## System Verdict

> [!NOTE]
> **OVERALL SYSTEM STATUS: VERIFIED (PASS)**
> All breaker rules, loop detectors, and adapters are functioning exactly as designed under the v2.1 specifications.

## Historical Comparisons Log (from Database)

| Compare ID | Topic | Guarded Status | Savings (%) | Tokens Saved | Started At |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `comp_infinite_loop_9930` | Search for the latest stock price of XYZCorp and r... | `tripped` | 66.7% | 2,300 | 2026-06-23 18:22 |
| `comp_deep_research_6c75` | Analyze the differences in token pricing and conte... | `completed` | 0.0% | 0 | 2026-06-23 18:22 |
| `comp_simple_info_cfec` | Find the capital of France and its current population | `completed` | 0.0% | 0 | 2026-06-23 18:22 |
| `comp_3a6c14aa` | what is 2 +2  | `error` | 100.0% | 218 | 2026-06-23 18:20 |
| `comp_e6339513` | hello | `error` | 100.0% | 526 | 2026-06-23 18:14 |
| `comp_67c55721` | hello | `error` | 100.0% | 212 | 2026-06-23 17:57 |
| `comp_4556d522` | hello | `error` | 0.0% | 0 | 2026-06-23 17:50 |
| `comp_a40eb228` | hello | `error` | 100.0% | 222 | 2026-06-23 17:47 |
| `comp_b856c846` | What is 2+2 | `error` | 96.4% | 6,566 | 2026-06-23 17:41 |
| `comp_16ecc1ea` | What is 2 + 2? | `running` | 0.0% | 0 | 2026-06-23 17:37 |
| `comp_9dc7e2f5` | What is 2+2 | `error` | 51.0% | 971 | 2026-06-23 17:36 |
| `comp_e87a7461` | Why is AGI hard toAGI loop test achieve? | `error` | 95.1% | 27,429 | 2026-06-23 17:33 |
| `comp_d047ed02` | Why is AGI hard to achieve? | `tripped` | 83.3% | 11,753 | 2026-06-23 17:32 |

*Report generated on: 2026-06-23 23:52:50*
