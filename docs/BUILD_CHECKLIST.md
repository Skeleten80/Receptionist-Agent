# LocalAgent — Build Checklist

## Phase 0 — Planning
- [x] Inspect repository
- [x] IMPLEMENTATION_PLAN.md
- [x] ARCHITECTURE.md
- [x] SECURITY.md
- [x] PRIVACY_AND_RETENTION.md
- [x] .env.example
- [x] BUILD_CHECKLIST.md

## Phase 1 — Scaffold
- [x] Next.js App Router + TS strict + Tailwind
- [x] ESLint + Prettier
- [x] Vitest + Playwright config
- [x] Shared UI primitives
- [x] Error taxonomy + logging
- [x] Typecheck / unit tests / build green

## Phase 2 — Database
- [x] Migrations for all core tables
- [x] Indexes + uniqueness constraints
- [x] RLS policies (tenant + platform admin path)
- [x] Seed script (fictional HVAC)
- [x] Migrations ready to apply via Supabase

## Phase 3 — Auth & orgs
- [x] Register / login / password reset
- [x] Protected routes (middleware)
- [x] Org create + onboarding
- [x] Memberships (owner/member)
- [x] Onboarding progress persistence fields

## Phase 4 — Configuration
- [x] Business profile
- [x] Business hours
- [x] Services CRUD
- [x] FAQs CRUD
- [x] AI receptionist config + prompt builder
- [x] Centralized plan definitions

## Phase 5 — Voice / calls / leads
- [x] Vapi adapter + mock mode
- [x] Webhook verification + idempotency
- [x] End-of-call → call + customer + lead
- [x] Calls list/detail
- [x] Leads list/detail + status update
- [x] Simulated verified webhook path

## Phase 6 — Appointments & billing
- [x] Manual appointment requests
- [x] Google Calendar adapter (credential-gated)
- [x] Stripe Checkout + portal
- [x] Stripe webhook sync
- [x] Subscription helpers / plan catalog

## Phase 7 — Product surface
- [x] Owner dashboard (real metrics / empty states)
- [x] Settings pages
- [x] Marketing site
- [x] Notifications abstraction (Resend / dry-run)
- [x] Admin integration events
- [x] Documentation set
- [x] Playwright smoke tests
- [x] No secrets committed

## Vertical slice acceptance
- [x] Register → create org → onboard basics (code paths)
- [x] Configure receptionist (+ mock/Vapi sync)
- [x] Simulated verified Vapi end-of-call webhook
- [x] Call + lead persistence pipeline
- [x] Manual appointment request
- [x] Stripe Checkout + webhook handlers
- [x] Tenant isolation via RLS + server membership checks
