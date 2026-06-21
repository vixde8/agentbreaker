# How It Works

!!! note "Coming soon"
    This page is being written. Check back soon.

AgentBreaker sits inside your agent's LLM call loop. After each call it:

1. Updates cumulative metrics (tokens, cost, iterations)
2. Runs every active rule against the current state
3. Returns a verdict — **PASS**, **WARN**, or **KILL**

On **KILL**, it raises a `RuntimeError` that immediately stops the agent loop.
