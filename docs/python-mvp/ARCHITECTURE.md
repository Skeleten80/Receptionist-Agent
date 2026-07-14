# LocalAgent — System Architecture

## Overview

LocalAgent is a Vercel-deployable Next.js application with Supabase (Postgres + Auth + Storage + RLS) as the data and identity plane. External providers (Vapi, Stripe, Twilio-compatible telephony, Google Calendar, Resend) are accessed only from server-side code through typed adapter interfaces.

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js App Router                        │
│  Marketing │ Auth │ App (dashboard) │ API routes / webhooks   │
└───────────────┬─────────────────────────────┬─────────────────┘
                │                             │
        Server Components /            Route Handlers
        Server Actions                 (webhooks, signed media)
                │                             │
                ▼                             ▼
        ┌───────────────┐            ┌──────────────────┐
        │ Service layer │◄───────────│ Provider adapters │
        │ auth/orgs/…   │            │ vapi/stripe/…     │
        └───────┬───────┘            └────────┬─────────┘
                │                             │
                ▼                             ▼
        ┌──────────────────────────────────────────────┐
        │         Supabase Postgres + RLS + Auth         │
        └──────────────────────────────────────────────┘
```

## Roles

| Role | Scope | Capabilities |
|------|-------|----------------|
| Platform admin | Global | Orgs, usage, suspend, plan limits, integration failures (non-secret audit) |
| Organization owner | Tenant | Full org config, billing, invites, integrations |
| Organization member | Tenant | Calls/leads/appointments (scoped); no billing/secrets/ownership |

Authorization is enforced in **server** code and **RLS**. UI hiding is never sufficient.

## Multi-tenancy

- Every tenant row includes `organization_id` (UUID).
- Membership via `organization_memberships` (`owner` | `member`).
- RLS: `auth.uid()` must be an active member of `organization_id`.
- Platform admin uses explicit `profiles.is_platform_admin` checks in policies/functions — separate path.
- **Never trust** a client-supplied `organization_id` without membership verification.

## Trust boundaries

1. **Browser** — public anon key only; no service role, Stripe secret, Vapi private key, Twilio auth, Google secrets.
2. **Next.js server** — service role / secrets via env; validates session and membership before mutations.
3. **Webhooks** — signature verification required before processing; events persisted for idempotency first.
4. **Providers** — credentials stored server-side (encrypted reference / vault table not readable via anon key).

## Data model (summary)

See SQL migrations for full DDL. Core entities:

`profiles` → `organization_memberships` → `organizations`  
Tenant config: `business_hours`, `services`, `faqs`, `ai_agents`, `phone_numbers`  
Ops: `customers`, `calls`, `leads`, `appointments`  
Platform: `integrations`, `subscriptions`, `usage_records`, `webhook_events`, `notifications`, `audit_logs`

### Key invariants (DB-enforced)

- Unique `(organization_id, user_id)` memberships
- Unique `(organization_id, day_of_week)` hours
- At most one **active** primary `ai_agents` row per org (partial unique index)
- Unique phone provider IDs; unique call `provider` + `provider_call_id`
- Unique webhook `provider` + `provider_event_id`
- Unique Stripe customer/subscription IDs
- Customer phone/email dedupe per organization (unique indexes where not null)

## Request flows

### Authenticated mutation
1. Resolve session user
2. Resolve active organization from cookie/header **and** verify membership
3. Zod-validate input
4. Service function with explicit `organizationId`
5. Audit log (no secrets)
6. Typed result / AppError

### Vapi webhook
1. Verify signature
2. Upsert `webhook_events` (idempotent)
3. Normalize payload → call / customer / lead / usage
4. Ack quickly; use `waitUntil` for non-critical email

### Stripe webhook
1. Verify signature
2. Persist event
3. Upsert `subscriptions` + org `subscription_status`
4. Never trust client-reported plan status

## Voice provider abstraction

```
lib/voice/
  types.ts
  provider.ts          # interface
  vapi-provider.ts
  mock-provider.ts
  prompt-builder.ts
  tool-definitions.ts
  webhook-verification.ts
  call-normalizer.ts
```

Tools (server-executed): get_business_hours, get_service_information, check_appointment_availability, book_appointment, create_or_update_customer, create_lead, transfer_call, send_follow_up_message, mark_call_urgent.

## Calendar abstraction

```
lib/calendar/
  types.ts
  provider.ts
  google-provider.ts
  manual-provider.ts
```

Manual mode creates **pending** appointment requests and notifies the business — never claims confirmed booking.

## Billing

Centralized plan catalog in `lib/billing/plans.ts`. Stripe Checkout + Customer Portal + webhooks are the source of truth.

## Async on Vercel

- Prefer short webhook handlers.
- Persist event row first.
- Process synchronously when < ~5s.
- For email/notifications: fire-and-forget with `waitUntil` (Next.js) so the HTTP response is not blocked.
- Documented alternative: Supabase queue / cron for retries on `webhook_events.processing_status = 'failed'`.

## App structure

```
/
  app/                    # App Router
    (marketing)/
    (auth)/
    (app)/                # authenticated shell
    api/webhooks/
    api/health/
  components/
  lib/
  supabase/migrations/
  tests/                  # vitest
  e2e/                    # playwright
  docs/
```

## Security (see docs/SECURITY.md)

RLS + server authz, Zod validation, webhook verification, signed recording URLs, CSP/security headers, redacted logs, rate limits on public auth/webhook-adjacent routes.

## Privacy (Ontario / Canada)

Configurable recording disclosure, consent flags, retention settings, export/delete workflows. **Not** automatic PIPEDA compliance — operator must obtain qualified legal advice before production.
