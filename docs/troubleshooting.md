# Troubleshooting

Common errors and how to fix them. Can't find your issue? [Open a GitHub issue](https://github.com/vixde8/agentbreaker/issues).

---

## SQLite permission errors

### `unable to open database file`

```
sqlalchemy.exc.OperationalError: (sqlite3.OperationalError) unable to open database file
```

**Fix:** Create the database file before starting Docker:

=== "Mac / Linux"
    ```bash
    touch backend/agentbreaker.db
    docker compose down && docker compose up --build
    ```

=== "Windows (PowerShell)"
    ```powershell
    New-Item -ItemType File -Path backend\agentbreaker.db -Force
    docker compose down; docker compose up --build
    ```

---

### `Permission denied: '/app/agentbreaker.db'`

Docker created `agentbreaker.db` as a **directory** instead of a file. Remove it and recreate:

=== "Mac / Linux"
    ```bash
    rm -rf backend/agentbreaker.db
    touch backend/agentbreaker.db
    docker compose up --build
    ```

=== "Windows (PowerShell)"
    ```powershell
    Remove-Item -Recurse -Force backend\agentbreaker.db
    New-Item -ItemType File -Path backend\agentbreaker.db -Force
    docker compose up --build
    ```

---

## Port conflicts

### `Bind for 0.0.0.0:8000 failed: port is already allocated`

Something else is using port 8000. Find and kill it, or change the port:

=== "Mac / Linux"
    ```bash
    lsof -i :8000
    kill -9 <PID>
    ```

=== "Windows (PowerShell)"
    ```powershell
    netstat -ano | findstr :8000
    taskkill /PID <PID> /F
    ```

Or change the port in `docker-compose.yml`:

```yaml
ports:
  - "8001:8000"   # 8001 = host port (change this)
```

Then update `frontend/src/App.js`:

```js
const API = "http://127.0.0.1:8001";
```

---

## API / connection errors

### Dashboard shows "Cannot connect to backend"

1. Check both containers are running: `docker compose ps`
2. Check backend logs: `docker compose logs backend`
3. Make sure your `.env` file is in the project root (not inside `backend/`)

---

## Groq API errors

### `Invalid API Key` in backend logs

- `.env` file must be in the **project root** (same folder as `docker-compose.yml`)
- No spaces around `=`: `GROQ_API_KEY=gsk_abc123` ✅ not `GROQ_API_KEY = gsk_abc123` ❌
- Regenerate your key at [console.groq.com](https://console.groq.com) if it's still failing

---

## Still stuck?

[Open a GitHub issue](https://github.com/vixde8/agentbreaker/issues/new) with:

1. Your OS and Docker version (`docker --version`)
2. The exact error message from `docker compose logs backend`
3. Your `.env` file (with the API key redacted)
