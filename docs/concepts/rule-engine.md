# Rule Engine

The core of AgentBreaker is a composable rule engine. Instead of hardcoded limits, you configure a collection of independent `Rule` objects that analyze the agent's running telemetry after each iteration.

---

## Severity Levels

Each rule has an associated severity level that determines what action is taken when the rule is violated:

| Severity | Description | Action |
|---|---|---|
| `STOP` | High-risk violation representing a runaway loop, budget breach, or anomaly. | Trips the circuit breaker immediately and raises a `RuntimeError` to halt the agent loop. |
| `WARN` | Low-risk indicator representing suboptimal behavior, potential loops, or excessive output size. | Logs a warning, highlights it on the dashboard, but allows the agent to continue executing. |

---

## Built-In Rules Reference

AgentBreaker ships with seven built-in rules designed to catch common agent failure modes:

### 1. Stuck Loop Detector (`repeated_tool_calls`)
* **Severity**: `STOP`
* **Trigger**: The same tool is invoked with **identical arguments** $N$ times in a row.
* **Why it matters**: Catching infinite loops (e.g. searching the exact same query repeatedly). Because it is argument-aware, paging queries or switching search terms will *not* trip it.
* **Config keys**: `max_repeated_tool_calls` (default: `4`)

### 2. Total Cost Limit (`cost_exceeded`)
* **Severity**: `STOP`
* **Trigger**: Cumulative API cost exceeds the dollar limit.
* **Config keys**: `max_cost_usd` (default: `2.00`)

### 3. Max Iterations (`iterations_exceeded`)
* **Severity**: `STOP`
* **Trigger**: The total number of LLM invocations exceeds the cap.
* **Config keys**: `max_iterations` (default: `10`)

### 4. Spend Velocity (`velocity_exceeded`)
* **Severity**: `STOP`
* **Trigger**: Spend over a rolling window exceeds the velocity threshold.
* **Why it matters**: Prevents "fast burn" scenarios where a parallelized agent makes dozens of high-cost calls in seconds.
* **Config keys**: `velocity_window_seconds` (default: `10.0`), `max_velocity_per_10s` (default: `0.50`)

### 5. Cost Anomaly Spike (`cost_spike`)
* **Severity**: `STOP`
* **Trigger**: A single iteration costs significantly more than the session average.
* **Why it matters**: Catches situations where the agent unexpectedly injects a massive document or history payload into the context window.
* **Config keys**: `spike_multiplier` (default: `5.0`)

### 6. Circling Loop Warning (`circling_loop`)
* **Severity**: `WARN`
* **Trigger**: The same tool is invoked $N$ times, even with different arguments.
* **Why it matters**: Alerts you when the agent is "searching in circles" (e.g. running search queries endlessly without resolving the task).
* **Config keys**: `max_same_tool_calls` (default: `8`)

### 7. Output Bloat Warning (`output_bloat`)
* **Severity**: `WARN`
* **Trigger**: A single LLM response exceeds the maximum token count.
* **Why it matters**: Flags agents that are returning essays instead of concise responses.
* **Config keys**: `output_bloat_detection` (default: `False`), `max_output_tokens_per_call` (default: `300`)

---

## Configuring Rules in Code

To customize rules when using the SDK, pass a `config` dictionary to the `CircuitBreaker` constructor:

```python
config = {
    # Rule parameters
    "max_cost_usd": 0.10,
    "max_iterations": 8,
    "max_repeated_tool_calls": 3,
    "output_bloat_detection": True,
    "max_output_tokens_per_call": 150,
}

breaker = CircuitBreaker(run_id="custom-run", config=config)
```
