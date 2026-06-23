Get started with AgentBreaker using either the Python SDK library or the full-stack Docker demo.

---

## Option A: Python SDK (Recommended)

To protect your own LLM agents, install `agentbreaker-sdk` from PyPI:

```bash
pip install agentbreaker-sdk
```

Or install with extras depending on your framework:
```bash
# For LangChain callback handler
pip install agentbreaker-sdk[langchain]

# For OpenAI Agents SDK hooks
pip install agentbreaker-sdk[openai-agents]
```

### Basic Example

Wrap your agent loop or LLM invocations using the core `CircuitBreaker`:

```python
from agentbreaker import CircuitBreaker

# 1. Initialize the breaker with rules
breaker = CircuitBreaker(
    run_id="run-123",
    config={
        "max_cost_usd": 0.05,       # Hard budget limit
        "max_iterations": 10,       # Stop if agent loops too many times
    }
)

# 2. Wrap your LLM invocation loop
for i in range(15):
    # (Optional) Record tool calls for stuck loop detection
    # breaker.record_tool_call(name="search", args={"query": "quantum computing"})
    
    # ... call your LLM ...
    input_tokens = 500
    output_tokens = 250
    
    # 3. Record LLM stats to evaluate rules. 
    # Raises RuntimeError immediately if a STOP rule trips!
    breaker.record_llm_call(
        input_tokens=input_tokens,
        output_tokens=output_tokens
    )
    
    # (Optional) Record tool results
    # breaker.record_tool_result(name="search", result="...")
```

For plug-and-play integrations with agent frameworks, see the [LangChain Integration](integrations/langchain.md) or [OpenAI Agents SDK Integration](integrations/openai-agents.md) guides.

---

## Option B: Full Stack Demo (Docker)

Get the complete AgentBreaker stack (FastAPI backend + React Dashboard) running locally in under 5 minutes.

## Prerequisites

You need two things installed on your machine:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- A free [Groq API key](https://groq.com) — no credit card required

!!! tip "Why Groq?"
    Groq gives you blazing-fast Llama 3.3 70B inference for free. AgentBreaker
    uses it to run the demo research agent. You can swap this out for OpenAI,
    Anthropic, or Ollama later.

---

## Step 1 — Clone the repo

```bash
git clone https://github.com/vixde8/agentbreaker.git
cd agentbreaker
```

---

## Step 2 — Get your Groq API key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up (free, no credit card)
3. Click **API Keys** → **Create API Key**
4. Copy the key

---

## Step 3 — Create your `.env` file

In the root of the `agentbreaker/` folder, create a file named `.env`:

```bash
echo "GROQ_API_KEY=gsk_your_key_here" > .env
```

Or create it manually — it should look like this:

```bash title=".env"
GROQ_API_KEY=gsk_your_key_here
```

!!! warning "Never commit this file"
    The `.env` file is already in `.gitignore`. Don't push your API key to GitHub.

---

## Step 4 — Start the stack

```bash
docker compose up --build
```

This builds and starts two containers:

| Container | Port | What it does |
|---|---|---|
| `agentbreaker-backend` | `8000` | FastAPI server + rule engine + SQLite database |
| `agentbreaker-frontend` | `3000` | React dashboard |

The first build takes ~2-3 minutes (downloading layers). Subsequent starts are instant.

---

## Step 5 — Open the dashboard

Once you see this in the logs:

```
agentbreaker-backend   | INFO:     Application startup complete.
agentbreaker-frontend  | ... ready
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Step 6 — Run your first agent

1. In the dashboard, click **New Run**
2. Enter a research topic (e.g. *"Explain quantum computing"*)
3. Set your cost limit (e.g. `$0.05`) and max iterations (e.g. `8`)
4. Click **Start**

Watch the cost chart update live. If the agent hits a limit, you'll see the breaker trip in real time.

---

## Stopping and restarting

```bash
# Stop all containers
docker compose down

# Start again (fast — no rebuild needed)
docker compose up

# Rebuild after code changes
docker compose up --build
```

---

## Troubleshooting

### SQLite permission error on startup

**Symptom:**

```
sqlalchemy.exc.OperationalError: (sqlite3.OperationalError) unable to open database file
```
or
```
PermissionError: [Errno 13] Permission denied: '/app/agentbreaker.db'
```

**Why it happens:**

The `docker-compose.yml` mounts `./backend/agentbreaker.db` from your host machine into the container. If the file doesn't exist yet when Docker starts, Docker creates it as a **directory** instead of a file — and then SQLite can't write to it.

**Fix — Option A (recommended):**

Create the file manually before running Docker:

```bash
# On Mac/Linux
touch backend/agentbreaker.db

# On Windows (PowerShell)
New-Item -ItemType File -Path backend\agentbreaker.db -Force
```

Then restart:

```bash
docker compose down
docker compose up --build
```

**Fix — Option B:**

If the directory was already created by mistake, remove it first:

```bash
# On Mac/Linux
rm -rf backend/agentbreaker.db
touch backend/agentbreaker.db

# On Windows (PowerShell)
Remove-Item -Recurse -Force backend\agentbreaker.db
New-Item -ItemType File -Path backend\agentbreaker.db -Force
```

---

### Backend won't start — port 8000 already in use

```bash
# Find what's using port 8000
# Mac/Linux:
lsof -i :8000

# Windows (PowerShell):
netstat -ano | findstr :8000
```

Kill the conflicting process, or change the port in `docker-compose.yml`:

```yaml title="docker-compose.yml" hl_lines="3"
    ports:
      - "8001:8000"   # Change 8000 to 8001 (left side = host port)
```

Then update the API URL in `frontend/src/App.js`:

```js title="frontend/src/App.js" hl_lines="1"
const API = "http://127.0.0.1:8001";  // Match new port
```

Rebuild:

```bash
docker compose up --build
```

---

### Frontend shows "Cannot connect to backend"

Make sure both containers are running:

```bash
docker compose ps
```

Both `agentbreaker-backend` and `agentbreaker-frontend` should show `Up`.

If only the frontend is up, check backend logs:

```bash
docker compose logs backend
```

---

### Docker not found / compose command not recognized

Make sure Docker Desktop is running (check your system tray). If you see:

```
docker: command not found
```

Download Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop/) and restart your terminal after installing.

!!! note "Docker Compose v1 vs v2"
    Older Docker versions use `docker-compose` (with a hyphen).
    Newer versions use `docker compose` (with a space).
    Both work — just use whichever your system has.

---

### Groq API key not working

**"Invalid API key" error in backend logs:**

- Double-check your `.env` file is in the project **root** (next to `docker-compose.yml`), not inside `backend/`
- Make sure there are no spaces around the `=`: `GROQ_API_KEY=gsk_...` ✅
- Try regenerating the key at [console.groq.com](https://console.groq.com)

---

## What's next?

<div class="grid cards" markdown>

- **[How It Works](concepts/how-it-works.md)**
  Learn how the rule engine evaluates runs in real time.

- **[Rule Engine](concepts/rule-engine.md)**
  Understand and configure the built-in rules.

- **[LangChain Integration](integrations/langchain.md)**
  Add `LangChainCircuitBreakerCallback` to your own agent.

- **[API Reference](api.md)**
  Full REST API docs for programmatic control.

</div>
