# Local AI Business Agent — Architecture

Production-minded MVP for Stratford-area home-service businesses. Controlled, deterministic call workflow with clear guardrails—not a multi-agent system.

---

## 1. Proposed file tree

```
/
├── .env.example
├── .gitignore
├── README.md
├── docker-compose.yml
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PRIVACY_AND_RETENTION.md
│   └── PROVIDER_SETUP.md
├── backend/
│   ├── Dockerfile
│   ├── alembic.ini
│   ├── pyproject.toml
│   ├── requirements.txt
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   │       └── 001_initial_schema.py
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── logging_config.py
│   │   ├── dependencies.py
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   ├── session.py
│   │   │   └── models.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── business.py
│   │   │   ├── call.py
│   │   │   ├── lead.py
│   │   │   ├── appointment.py
│   │   │   ├── notification.py
│   │   │   └── simulation.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── admin.py
│   │   │   ├── webhooks.py
│   │   │   ├── simulation.py
│   │   │   └── privacy.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── call_workflow.py      # deterministic state machine
│   │   │   ├── intent.py
│   │   │   ├── lead_qualification.py
│   │   │   ├── business_rules.py
│   │   │   ├── booking.py
│   │   │   ├── escalation.py
│   │   │   ├── notification_service.py
│   │   │   ├── audit.py
│   │   │   ├── prompt_builder.py
│   │   │   └── retention.py
│   │   ├── providers/
│   │   │   ├── __init__.py
│   │   │   ├── voice/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── base.py
│   │   │   │   ├── mock.py
│   │   │   │   ├── retell.py
│   │   │   │   └── vapi.py
│   │   │   ├── calendar/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── base.py
│   │   │   │   ├── mock.py
│   │   │   │   └── google.py
│   │   │   ├── llm/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── base.py
│   │   │   │   ├── mock.py
│   │   │   │   └── openai_compat.py
│   │   │   └── notify/
│   │   │       ├── __init__.py
│   │   │       ├── base.py
│   │   │       ├── email.py
│   │   │       └── sms_stub.py
│   │   ├── seed/
│   │   │   ├── __init__.py
│   │   │   └── demo_business.py
│   │   └── cli.py
│   └── scripts/
│       └── simulate_call.py
└── tests/
    ├── conftest.py
    ├── test_booking_success.py
    ├── test_price_quote.py
    ├── test_emergency_escalation.py
    ├── test_human_request.py
    ├── test_no_availability.py
    ├── test_duplicate_webhook.py
    ├── test_calendar_failure.py
    ├── test_unknown_question.py
    ├── test_recording_refusal.py
    └── test_notification_failure.py
```

---

## 2. Architecture summary

### Design principles

- **Deterministic workflow**: A single state machine (`CallWorkflow`) drives the call. LLM (when used) only classifies intent / extracts fields; it never chooses business outcomes freely.
- **Provider adapters**: Voice (Retell/Vapi/Mock), Calendar (Google/Mock), LLM (OpenAI-compat/Mock), Notify (Email + SMS interface stub) are swappable via DI.
- **Tenant isolation**: Every row has `business_id`. Admin API scopes by API key → business.
- **Fail safe**: Integration failures capture the lead, promise follow-up, notify owner immediately, audit the error.
- **Privacy by default**: Recordings off; transcripts retained N days; delete-call-data endpoint; disclosure configurable per business.

### Call flow (state machine)

```
INBOUND_WEBHOOK
  → DISCLOSURE (intro + recording notice)
  → INTENT_DETECTION
  → [EMERGENCY | SPEAK_TO_HUMAN | OUT_OF_SCOPE] → ESCALATE/TRANSFER
  → [PRICE_QUOTE] → REFUSE_QUOTE → offer booking or escalate
  → [EXISTING_BOOKING | GENERAL_QUESTION] → KB answer or escalate if unknown
  → [NEW_SERVICE] → COLLECT_LEAD_FIELDS
  → CHECK_BUSINESS_RULES
  → CHECK_AVAILABILITY (calendar adapter)
  → CONFIRM_ALOUD
  → CREATE_APPOINTMENT (idempotent)
  → NOTIFY_OWNER
  → END + PERSIST AUDIT
```

On any tool/integration failure at booking/notify: `CAPTURE_LEAD` → `PROMISE_FOLLOWUP` → `NOTIFY_OWNER_URGENT` → `END`.

### Reliability controls

- Idempotency keys on webhook events and appointment creation.
- Structured JSON logging (no secrets).
- AuditEvent for every state transition and tool error.
- Mock providers for local/dev and pytest.

---

## 3. Database schema

### `businesses`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| name | VARCHAR | |
| service_area | TEXT | |
| timezone | VARCHAR | default America/Toronto |
| disclosure_message | TEXT | configurable recording notice |
| owner_email | VARCHAR | |
| owner_phone | VARCHAR nullable | future SMS |
| notification_email_enabled | BOOL | |
| notification_sms_enabled | BOOL | default false |
| recording_storage_enabled | BOOL | default false |
| api_key_hash | VARCHAR | never return raw key |
| voice_provider | VARCHAR | mock\|retell\|vapi |
| calendar_provider | VARCHAR | mock\|google |
| created_at / updated_at | TIMESTAMPTZ | |

### `business_hours`
| Column | Type |
|--------|------|
| id | UUID PK |
| business_id | UUID FK |
| day_of_week | INT 0–6 (Mon=0) |
| open_time | TIME |
| close_time | TIME |
| is_closed | BOOL |

### `service_types`
| Column | Type |
|--------|------|
| id | UUID PK |
| business_id | UUID FK |
| name | VARCHAR |
| slug | VARCHAR |
| description | TEXT |
| duration_minutes | INT |
| bookable | BOOL |
| active | BOOL |

### `knowledge_base_entries`
| Column | Type |
|--------|------|
| id | UUID PK |
| business_id | UUID FK |
| question | TEXT |
| answer | TEXT |
| category | VARCHAR |
| active | BOOL |

### `escalation_rules`
| Column | Type |
|--------|------|
| id | UUID PK |
| business_id | UUID FK |
| name | VARCHAR |
| trigger_keywords | JSONB | list of keywords/phrases |
| intent_match | VARCHAR nullable | e.g. emergency |
| action | VARCHAR | transfer\|notify_only |
| priority | INT |
| active | BOOL |

### `calls`
| Column | Type |
|--------|------|
| id | UUID PK |
| business_id | UUID FK |
| provider | VARCHAR |
| provider_call_id | VARCHAR | unique with business_id |
| idempotency_key | VARCHAR | unique with business_id |
| from_number | VARCHAR |
| to_number | VARCHAR |
| status | VARCHAR | in_progress\|completed\|failed\|escalated |
| outcome | VARCHAR | booked\|escalated\|lead_captured\|abandoned\|refused_consent\|unknown |
| intent | VARCHAR nullable |
| recording_consent | BOOL nullable |
| transcript_consent | BOOL nullable |
| recording_url | VARCHAR nullable | unused when storage disabled |
| started_at / ended_at | TIMESTAMPTZ |
| summary | TEXT |
| error_detail | TEXT nullable | sanitized |

### `call_transcripts`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | separate table from recordings |
| business_id | UUID FK | |
| call_id | UUID FK | |
| turns | JSONB | [{role, text, at}] |
| created_at | TIMESTAMPTZ | |

### `leads`
| Column | Type |
|--------|------|
| id | UUID PK |
| business_id | UUID FK |
| call_id | UUID FK nullable |
| name | VARCHAR |
| callback_number | VARCHAR |
| service_address | TEXT |
| city | VARCHAR |
| service_type_slug | VARCHAR |
| description | TEXT |
| preferred_window_start | TIMESTAMPTZ nullable |
| preferred_window_end | TIMESTAMPTZ nullable |
| status | VARCHAR | new\|qualified\|booked\|follow_up |

### `appointments`
| Column | Type |
|--------|------|
| id | UUID PK |
| business_id | UUID FK |
| call_id | UUID FK |
| lead_id | UUID FK |
| service_type_id | UUID FK |
| idempotency_key | VARCHAR | unique with business_id |
| starts_at / ends_at | TIMESTAMPTZ |
| status | VARCHAR | confirmed\|cancelled\|failed |
| calendar_event_id | VARCHAR nullable |
| confirmation_spoken | BOOL |
| error_detail | TEXT nullable |

### `notifications`
| Column | Type |
|--------|------|
| id | UUID PK |
| business_id | UUID FK |
| call_id | UUID FK nullable |
| channel | VARCHAR | email\|sms |
| recipient | VARCHAR |
| subject | VARCHAR |
| body | TEXT |
| status | VARCHAR | pending\|sent\|failed |
| error_detail | TEXT nullable |
| sent_at | TIMESTAMPTZ nullable |

### `audit_events`
| Column | Type |
|--------|------|
| id | UUID PK |
| business_id | UUID FK |
| call_id | UUID FK nullable |
| event_type | VARCHAR |
| detail | JSONB | no secrets |
| created_at | TIMESTAMPTZ |

Unique constraints: `(business_id, provider_call_id)`, `(business_id, idempotency_key)` on calls; `(business_id, idempotency_key)` on appointments.

---

## 4. API routes

### Auth
- Header: `X-API-Key: <key>`
- Resolves to a `Business`; all admin routes scoped to that tenant.

### Health
- `GET /health` — liveness

### Admin CRUD (`/admin/...`)
- `GET/POST /admin/business` — get/update profile (no secret fields)
- `GET/PUT /admin/business/hours`
- `GET/POST/PATCH/DELETE /admin/service-types`
- `GET/POST/PATCH/DELETE /admin/knowledge-base`
- `GET/POST/PATCH/DELETE /admin/escalation-rules`
- `GET/PUT /admin/notification-settings`

### Ops views
- `GET /admin/calls` — list (filter status/outcome)
- `GET /admin/calls/{call_id}` — detail + transcript meta
- `GET /admin/leads`
- `GET /admin/appointments`
- `GET /admin/escalations` — calls with outcome escalated
- `GET /admin/failed-calls`

### Privacy
- `DELETE /admin/calls/{call_id}/data` — delete transcript (+ recording ref if any)

### Webhooks
- `POST /webhooks/voice/{provider}` — Retell/Vapi/mock inbound events
  - Body includes `idempotency_key` / provider call id
  - Returns agent instructions / next actions for mock; ack for real providers

### Simulation
- `POST /simulate/call` — run a scripted fake call end-to-end (no phone provider)
- CLI: `python -m app.cli simulate --script booking_success`

---

## 5. Implementation plan

### Step 1 — Scaffold
Project config, Docker, settings, logging, DB session, empty FastAPI app, health check.

### Step 2 — Models + Alembic
SQLAlchemy models, initial migration, seed for Stratford Comfort Heating & Air.

### Step 3 — Provider interfaces + mocks
Voice, calendar, LLM, notify adapters; DI wiring.

### Step 4 — Core call workflow
Intent, rules, lead collection, booking with idempotency, escalation, audit, notifications.

### Step 5 — Admin + webhook + simulation APIs
Auth, CRUD, ops views, privacy delete, webhooks, simulate endpoint + CLI.

### Step 6 — Tests
Ten required scenarios; run and fix after each major step.

### Step 7 — Docs polish
README, provider setup, privacy/legal note for Ontario/Canada.

Demo seed: **Stratford Comfort Heating & Air** — HVAC/AC/furnace/maintenance; Stratford & Perth County; Mon–Fri 8–5; emergency gas/CO/fire/no-heat-extreme-cold escalate immediately.
EOF