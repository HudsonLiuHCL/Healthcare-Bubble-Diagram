# HealthArch — Healthcare Facility Bubble Diagram

Web app for planning healthcare facilities: site intelligence, an interactive
bubble diagram, and a "Send to Revit" publish handoff. Mapbox for maps, OpenAI
for the AI assists, and Google Sign-In to authenticate the publish flow.

- **Frontend** — React + Vite + TypeScript → `http://localhost:5173`
- **Backend** — FastAPI (Python) → `http://localhost:7000` (see port note below)
- **Database** — PostgreSQL + PostGIS, run in Docker → host port **5433**

---

## ⚠️ Ports — read this first

Three rules, because they're easy to get wrong:

| Service  | Port | Hard rule |
|----------|------|-----------|
| Frontend | **5173** | **Must be exactly 5173.** This origin (`http://localhost:5173`) is the registered Google OAuth *Authorized JavaScript origin* **and** the backend's CORS allow-list. If Vite falls back to another port (e.g. 5174 because 5173 was busy), Google sign-in fails with `Error 401: invalid_client` / "no registered origin". |
| Backend  | 7000 | Any free port is fine, **but it must match** the proxy target in `frontend/vite.config.ts` (`server.proxy['/api'].target`). They are currently both `7000`. Change one → change the other. **macOS:** the proxy target must be `http://127.0.0.1:7000` (not `localhost`) — macOS resolves `localhost` to IPv6 `::1`, which hits AirPlay/AirTunes instead of the backend. |
| Postgres | 5433 | Mapped in `docker-compose.yml` as `5433:5432`. Port 5432 is taken by a host-installed PostgreSQL on the dev machine; the Docker DB uses 5433 to avoid a clash. `.env`'s `DATABASE_URL` points here. |

If you ever change the frontend port, you must also add the new origin to the
Google OAuth client (Cloud Console) and to `allow_origins` in
`backend/app/main.py` — so just keep it on 5173.

---

## Prerequisites

- **Node** 18+ (tested on v20)
- **Python** 3.9+
- **Docker Desktop** (for the PostGIS database)

---

## Environment variables

Copy the template and fill in your own values:

```bash
cp .env.example .env
```

`.env` lives at the **repo root**, is **gitignored**, and is read by both the
backend (`pydantic-settings`) and the frontend (Vite, via `envDir: '..'`).

| Variable | Used by | Required for | Notes |
|----------|---------|--------------|-------|
| `DATABASE_URL` | backend | everything | Defaults to the 5433 Docker DB. |
| `OPENAI_API_KEY` | backend | AI bubble / site-intelligence features | App still boots without it; AI calls just fail. |
| `OPENAI_MODEL` | backend | — | Any tool-calling chat model. Default `gpt-4o-mini`. |
| `VITE_MAPBOX_TOKEN` | frontend | the map | Public token from https://account.mapbox.com/ |
| `VITE_GOOGLE_CLIENT_ID` | frontend | Google sign-in | **Web application** OAuth client id (see below). |
| `GOOGLE_CLIENT_ID` | backend | verifying the Google token on `/publish` | Same value as `VITE_GOOGLE_CLIENT_ID`. |

> Vite reads env only at **startup** — after changing any `VITE_*` value you
> must restart `npm run dev`.

---

## First-time setup

```powershell
# 1. Database (Docker)
docker compose up -d

# 2. Backend deps  (Windows PowerShell)
cd backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install --upgrade pip
.\venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..

# 3. Frontend deps
cd frontend
npm install
cd ..

# 4. Config
copy .env.example .env   # then edit .env
```

On macOS/Linux the venv path is `backend/venv/bin/` instead of
`backend\venv\Scripts\`.

---

## Running

**macOS/Linux** — the bundled script starts all three for you:

```bash
./start.sh
```

**Windows** (or to run pieces individually) — three terminals:

```powershell
# Terminal 1 — database
docker compose up -d

# Terminal 2 — backend (must match the Vite proxy port)
cd backend
# macOS/Linux:
source venv/bin/activate && uvicorn app.main:app --reload --port 7000
# Windows:
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 7000

# Terminal 3 — frontend (must be 5173)
cd frontend
npm run dev
```

Then open:

- App: **http://localhost:5173**
- API: **http://localhost:7000**
- API docs (Swagger): **http://localhost:7000/docs**

The frontend talks to the backend through Vite's `/api` proxy, so the browser
only ever sees `localhost:5173`.

---

## Google Sign-In setup

Sign-in gates only the **"Send to Revit" / publish** flow; the rest of the app
works signed-out.

1. Google Cloud Console → **APIs & Services → Credentials**.
2. Create an **OAuth 2.0 Client ID** of type **Web application**
   (*not* "Desktop app" — a browser app needs a Web client with JS origins).
3. Under **Authorized JavaScript origins** add exactly: `http://localhost:5173`
4. Put the client id into **both** `VITE_GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_ID` in `.env`, then restart the frontend (and backend).

---

## Troubleshooting

- **`password authentication failed for user "healtharch"`** — the backend is
  hitting a host PostgreSQL on 5432 instead of the Docker container. Confirm the
  container maps `5433:5432` and `DATABASE_URL` uses port **5433**.
- **Google `Error 401: invalid_client` / "no registered origin"** — the page
  origin isn't on the OAuth client's Authorized JavaScript origins. Add
  `http://localhost:5173` and make sure the frontend is actually on 5173.
- **Vite started on 5174** — something else is using 5173; Vite silently moved.
  Free 5173 (`netstat -ano | findstr :5173`, then `taskkill /PID <pid> /F`) and
  restart, or set `strictPort: true` in `vite.config.ts` so it fails loudly
  instead of breaking OAuth.
- **Frontend can't reach the API (404s on `/api/...`)** — the Vite proxy target
  and the uvicorn `--port` don't match. Align them.
