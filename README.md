# ⚡ AgentBreaker

**A real-time circuit breaker for AI agent loops.**

AgentBreaker monitors token spend, iteration count, and cost velocity across multi-step LLM orchestration — and hard-stops runaway agents before they burn through budget or get stuck in infinite loops.

Most teams only set `max_tokens` on a single LLM call. AgentBreaker works at the **orchestration layer** — across multiple LLM calls, tool invocations, and sub-agent spawns. Observability tools tell you an agent went wrong *after the fact*. AgentBreaker stops it *while it's happening*.

---

## The Problem

AI agents that loop, retry, or spawn sub-tasks can silently burn through API budgets in minutes. A `max_tokens` cap on one call doesn't catch an agent that makes 50 calls in a row. Teams find out when the bill arrives.

## What AgentBreaker Does

- Tracks cost, token usage, iteration count, and elapsed time live, per agent run
- Evaluates every LLM call against a configurable rule engine
- Hard-stops the agent the instant a rule fires — not after the fact
- Surfaces exactly which rule fired and why, with full run history and cost trajectory

---

## Features

- **Composable rule engine** — not hardcoded thresholds. Pick which rules apply per run:
  - Total Cost Limit
  - Max Iterations
  - Max Run Time
  - Spend Velocity (catches fast burns)
  - Stuck Loop Detector (same tool called repeatedly)
  - Cost Anomaly Spike (single call costs way more than average)
  - Long Run Warning (soft warning, doesn't stop execution)
- **Live dashboard** — real-time cost trajectory chart, run history, trip alerts with estimated savings
- **REST API** — start runs, poll status, fetch aggregate metrics
- **Fully containerized** — `docker compose up` and you have a working demo

---

## Tech Stack

| Layer | Tech |
|---|---|
| LLM Provider | Groq (Llama 3.3 70B) |
| Agent Framework | LangChain |
| Backend | FastAPI + SQLAlchemy + SQLite |
| Frontend | React + Recharts |
| Infra | Docker + Docker Compose |
| CI | GitHub Actions |

---

## Architecture
agentbreaker/

backend/
agent.py             # Demo "runaway" research agent
circuit_breaker.py   # Core breaker — tracks state, evaluates rules
rules.py             # Rule engine + built-in rule library
database.py           # SQLAlchemy models, SQLite setup
main.py               # FastAPI app — endpoints + background run execution
frontend/
src/App.js            # Dashboard — run form, history, live detail view
docker-compose.yml

---

## Quick Start (Docker — recommended)

1. Clone the repo:
```bash
   git clone https://github.com/YOUR_USERNAME/agentbreaker.git
   cd agentbreaker
```

2. Get a free Groq API key at [groq.com](https://groq.com) (no credit card required).

3. Create a `.env` file in the project root:
```bash
   echo "GROQ_API_KEY=your_key_here" > .env
```

4. Run it:
```bash
   docker compose up --build
```

5. Open **http://localhost:3000**

---

## Local Development (without Docker)

**Backend:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend** (separate terminal):
```bash
cd frontend
npm install
npm start
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/runs` | Start a new agent run |
| `GET` | `/runs` | List all runs |
| `GET` | `/runs/{run_id}` | Get a single run's live status |
| `GET` | `/rules` | List all available rules |
| `GET` | `/metrics` | Aggregate stats across all runs |
| `DELETE` | `/runs` | Clear all run history |

---

## Roadmap

- [x] Phase 1 — Core breaker logic, demo agent, FastAPI backend, React dashboard
- [x] Phase 2 — Composable rule engine, per-run rule configuration
- [ ] Phase 3 — Semantic loop detection, goal drift detection, anomaly baselines
- [ ] Phase 4 — LangChain callback handler for zero-friction integration, PyPI package

---

## License

MIT