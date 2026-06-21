# OpenAI Agents SDK Integration

!!! warning "Empirical verification required"
    Before building on top of `RunHooks`, verify that `on_llm_end` fires reliably
    in your pinned version of the OpenAI Agents SDK. Some versions have reported
    gaps — print a debug line inside the hook first.

!!! note "Coming soon"
    Full integration guide being written once hooks are validated.

## Basic Sketch

```python
from agentbreaker.openai_agents import AgentBreakerRunHooks

hooks = AgentBreakerRunHooks(
    run_id="my-run-001",
    config={"max_cost_usd": 0.50}
)

# Pass hooks into your Runner
result = await Runner.run(agent, query, hooks=hooks)
```
