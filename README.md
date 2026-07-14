# Local AI Business Agent

After-hours / missed-call AI receptionist for Stratford-area home-service businesses.

Deterministic call workflow with guardrails—not a multi-agent system. Reliability over autonomy.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for file tree, schema, routes, and plan.  
Privacy notes: [docs/PRIVACY_AND_RETENTION.md](docs/PRIVACY_AND_RETENTION.md).  
Provider setup: [docs/PROVIDER_SETUP.md](docs/PROVIDER_SETUP.md).

## Stack

- Python 3.12, FastAPI, PostgreSQL, SQLAlchemy, Alembic
- Voice: Retell / Vapi / Mock (adapter interface)
- Calendar: Google Calendar / Mock
- LLM: hosted OpenAI-compatible (optional; mock for tests)
- Docker Compose for local development

## Quick start (mock voice + mock calendar)

```bash
cp .env.example .env
docker compose up --build -d
# wait for API
curl http://localhost:8000/health

# seed demo business (also runs on startup if SEED_DEMO=true)
docker compose exec api python -m app.seed.demo_business

# admin API (demo key printed by seed / in .env.example)
curl -H "X-API-Key: demo-api-key-stratford-comfort" http://localhost:8000/admin/business

# simulate a scripted call without a phone provider
curl -X POST http://localhost:8000/simulate/call \
  -H "X-API-Key: demo-api-key-stratford-comfort" \
  -H "Content-Type: application/json" \
  -d '{"script":"booking_success"}'

# or CLI
docker compose exec api python -m app.cli simulate --script booking_success
```

API docs: http://localhost:8000/docs

## Tests

```bash
# from host with deps, or inside the api container
cd backend
pip install -r requirements.txt
pytest -q ../tests
```

With Docker Postgres:

```bash
docker compose up -d db
export DATABASE_URL=postgresql+psycopg://agent:agent@localhost:5432/agent
export ADMIN_API_KEY_BOOTSTRAP=demo-api-key-stratford-comfort
cd backend && alembic upgrade head && python -m app.seed.demo_business
pytest -q ../tests
```

## Connect a real Retell or Vapi webhook

1. Set `VOICE_PROVIDER=retell` or `vapi` and provider secrets in `.env`.
2. Point the provider webhook to `POST https://<your-host>/webhooks/voice/retell` (or `/vapi`).
3. Keep calendar in mock mode until Google OAuth is configured (`CALENDAR_PROVIDER=google`).

Details: [docs/PROVIDER_SETUP.md](docs/PROVIDER_SETUP.md).

## Demo business

**Stratford Comfort Heating & Air** — HVAC repair, AC repair, furnace repair, maintenance; Stratford & Perth County; Mon–Fri 8:00–17:00; emergencies (gas smell, CO, fire, no heat in extreme cold) escalate immediately.

## Legacy Python FastAPI MVP

An earlier deterministic FastAPI MVP lives under `backend/` (Docker Compose + pytest).
Architecture notes: [docs/python-mvp/ARCHITECTURE.md](docs/python-mvp/ARCHITECTURE.md).
Env template: [backend/.env.example](backend/.env.example).
Provider notes: [docs/PROVIDER_SETUP.md](docs/PROVIDER_SETUP.md).

```bash
cp backend/.env.example .env   # or keep separate
docker compose up --build
pytest -q
```
