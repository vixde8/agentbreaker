# Rule Engine

!!! note "Coming soon"
    Full rule engine documentation is being written.

## Available Rules

| Rule ID | Trigger | Action |
|---|---|---|
| `cost_exceeded` | Total cost ≥ budget | 🔴 Kill |
| `iterations_exceeded` | Iteration count ≥ limit | 🔴 Kill |
| `time_exceeded` | Elapsed time ≥ limit | 🔴 Kill |
| `velocity_exceeded` | Spend rate spikes | 🔴 Kill |
| `stuck_loop` | Same tool + same args N times | 🔴 Kill |
| `cost_spike` | Single call costs 5× average | 🔴 Kill |
| `output_bloat` | Single response too verbose | ⚠️ Warn |
| `no_progress_warning` | Long run, no trip yet | ⚠️ Warn |
