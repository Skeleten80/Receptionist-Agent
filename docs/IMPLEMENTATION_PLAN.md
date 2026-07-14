# LocalAgent — Implementation Plan

## Product

LocalAgent is a multi-tenant SaaS AI phone receptionist and lead-management platform for Ontario local-service businesses (HVAC, plumbing, electrical, roofing, landscaping, auto repair, etc.).

## Approach

1. Document architecture, security, and checklist (this phase).
2. Scaffold Next.js App Router + TypeScript + Tailwind + tooling.
3. Create Supabase SQL migrations with RLS and constraints.
4. Deliver the **vertical slice** end-to-end before polish.
5. Expand dashboard, integrations, marketing, and tests.
6. After each phase: format, lint, typecheck, test — fix before continuing.

## Vertical slice (must ship first)

A developer must be able to:

1. Register (email/password)
2. Create an organization
3. Complete basic onboarding (profile → hours → services → FAQs → receptionist)
4. Configure AI receptionist (prompt generation + Vapi sync when credentials present)
5. Receive a **verified simulated** Vapi end-of-call webhook
6. Persist call + customer + lead
7. View call and lead in dashboard
8. Create a manual appointment request
9. Start Stripe Checkout
10. Synchronize subscription via verified Stripe webhook
11. Confirm org B cannot access org A data

## Phases

### Phase 0 — Docs & env template
- `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/BUILD_CHECKLIST.md`
- `.env.example`, security/privacy stubs

### Phase 1 — App scaffold
- Next.js 15 App Router, TypeScript strict, Tailwind, ESLint, Prettier, Vitest, Playwright
- App shell (marketing + authenticated layout)
- Shared UI primitives (shadcn-style)
- Error taxonomy, logging helpers, Zod patterns

### Phase 2 — Database
- Versioned SQL migrations under `supabase/migrations/`
- All required tables + indexes + constraints
- RLS policies for tenant isolation
- Platform-admin path via `profiles.is_platform_admin`
- Seed script (fictional HVAC org)

### Phase 3 — Auth & tenancy
- Supabase Auth (email/password; magic link when configured)
- Session helpers (server)
- Organization create/select
- Memberships (owner/member)
- Invitation stubs
- Onboarding progress persistence

### Phase 4 — Business configuration
- Business profile, hours, services, FAQs
- AI agent config + prompt builder
- Plan definitions (centralized)

### Phase 5 — Voice vertical slice
- Vapi provider abstraction
- Webhook verification + idempotent `webhook_events`
- Tool handlers (subset for slice: create customer/lead, business hours, transfer mark)
- Call normalizer → calls/leads/customers
- Calls & leads UI (list + detail)

### Phase 6 — Appointments & billing slice
- Manual appointment request mode
- Google Calendar adapter (OAuth-ready; mock without credentials)
- Stripe Checkout + Customer Portal + webhook sync
- Subscription enforcement helpers

### Phase 7 — Product surface
- Owner dashboard metrics (real aggregations, empty states)
- Settings pages
- Marketing site
- Notifications (Resend adapter + dry-run)
- Admin integration-events page
- Playwright e2e for critical paths
- Full documentation set

## Assumptions (documented)

- Supabase is the system of record; local development may use Supabase CLI or a linked project.
- When provider credentials are absent, adapters run in **mock/dev mode** with the same routes and validation — never inert UI buttons that pretend success without writing state.
- Webhook async processing on Vercel: persist event → process inline when fast; for longer work use `waitUntil` / queued follow-up documented in ARCHITECTURE.
- Platform admin is a boolean on `profiles`, not a tenant role.
- Recording storage uses Supabase Storage with signed URLs; disabled by default for tenants.

## Out of scope for v1 polish (still scaffolded)

- Full multi-calendar routing UI
- Live voice streaming UI
- SMS channel
- Mobile native apps
- Automatic legal compliance claims
