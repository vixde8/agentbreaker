# Changelog

All notable changes to AgentBreaker are documented here.

---

## v2.1.0 — In Progress

### Added
- Argument-aware loop detection (`stuck_loop` rule checks tool args, not just names)
- `output_bloat` rule — warns on excessively verbose single responses (opt-in)
- `LangChainCircuitBreakerCallback` — native LangChain integration via callback API
- `AgentBreakerRunHooks` — OpenAI Agents SDK integration via RunHooks
- Side-by-side comparison mode (`POST /runs/compare`)
- Per-call output token bar chart in dashboard
- `output_tokens_per_call` field on RunState

### Changed
- `tool_calls` now stores `ToolCall` objects (name + args + timestamp) instead of plain strings
- Removed monkey-patch decorator approach in favour of explicit adapters

### Removed
- `@guard` generic decorator (replaced by framework-specific adapters)

---

## v2.0.0

### Added
- Composable rule engine — configurable per run from the UI
- Named rules: `cost_exceeded`, `iterations_exceeded`, `time_exceeded`, `velocity_exceeded`, `repeated_tool_calls`, `cost_spike`, `no_progress_warning`
- Run history with trip reason and cost trajectory

---

## v1.0.0 — Initial Release

### Added
- Core circuit breaker with hardcoded thresholds
- FastAPI backend + SQLite persistence
- React dashboard with cost chart
- Docker Compose setup
- Demo runaway research agent
