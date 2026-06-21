# API Reference

The AgentBreaker backend exposes a REST API on port `8000`.

## Endpoints

### Runs

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/runs` | Start a new agent run |
| `GET` | `/runs` | List all runs |
| `GET` | `/runs/{run_id}` | Get run detail and live status |
| `DELETE` | `/runs` | Clear all run history |
| `POST` | `/runs/compare` | Start a side-by-side comparison run |

### Rules

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/rules` | List all available rules |

### Metrics

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/metrics` | Aggregate stats across all runs |

---

## POST /runs

Start a new agent run.

**Body:**

```json
{
  "topic": "quantum computing applications",
  "config": {
    "max_cost_usd": 0.05,
    "max_iterations": 8,
    "rules": ["cost_exceeded", "iterations_exceeded", "stuck_loop"]
  }
}
```

**Response:**

```json
{
  "run_id": "a1b2c3d4",
  "status": "running"
}
```

---

## GET /runs/{run_id}

Poll a run for live status.

**Response:**

```json
{
  "run_id": "a1b2c3d4",
  "is_tripped": false,
  "trip_reason": null,
  "total_cost_usd": 0.012,
  "iteration_count": 3,
  "total_tokens": 2100,
  "elapsed_seconds": 14.2,
  "active_rules": ["cost_exceeded", "iterations_exceeded", "stuck_loop"]
}
```

---

## GET /metrics

Aggregate stats across all runs.

**Response:**

```json
{
  "total_runs": 24,
  "tripped_runs": 8,
  "total_cost_usd": 1.24,
  "estimated_savings_usd": 0.87,
  "avg_iterations": 5.3
}
```
