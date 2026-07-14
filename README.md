# LocalAgent

AI phone receptionist and lead-management SaaS for Ontario local service businesses.

**Positioning:** Never miss another customer call.  
**Supporting:** LocalAgent answers calls, qualifies leads and books appointments while your team is busy doing the work.

## Architecture summary

Next.js App Router (TypeScript) + Supabase (Postgres, Auth, Storage, RLS) + Vapi + Stripe + Twilio-compatible telephony + Google Calendar + Resend.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Prerequisites

- Node.js 20+
- Supabase project (or local Supabase CLI)
- Optional for full integrations: Stripe, Vapi, Twilio, Google OAuth, Resend credentials

## Installation

```bash
cp .env.example .env.local
npm install
# Apply SQL in supabase/migrations/ via Supabase SQL editor or CLI
npx supabase db push   # if using Supabase CLI
npm run db:seed         # fictional demo data (never in production)
npm run dev
```

Open http://localhost:3000

## Environment variables

See [.env.example](.env.example). Server-only secrets must never be prefixed with `NEXT_PUBLIC_`.

## Database migrations

Versioned SQL lives in `supabase/migrations/`. Apply with Supabase CLI or paste into the SQL editor. RLS is enabled for tenant tables; `integration_secrets` is service-role only.

## Local development

See [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md).

With `VAPI_MOCK_MODE=true`, use **AI Receptionist → Simulate verified end-of-call webhook** to exercise call → customer → lead persistence without a live phone provider.

## Provider setup

- [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)
- [docs/VAPI_SETUP.md](docs/VAPI_SETUP.md)
- [docs/TWILIO_SETUP.md](docs/TWILIO_SETUP.md)
- [docs/GOOGLE_CALENDAR_SETUP.md](docs/GOOGLE_CALENDAR_SETUP.md)
- [docs/STRIPE_SETUP.md](docs/STRIPE_SETUP.md)

## Testing

```bash
npm run test          # Vitest unit tests
npm run typecheck
npm run lint
npm run test:e2e      # Playwright (app should be running or use config webServer)
```

See [docs/TESTING.md](docs/TESTING.md).

## Deployment

Vercel-compatible. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Security warnings

- Never commit service-role keys, Stripe secrets, Vapi private keys, Twilio auth tokens, or Google client secrets.
- Do not trust client-supplied `organization_id` without membership checks.
- Webhooks must be signature-verified before side effects.
- Obtain Canadian legal advice before production (privacy / call recording). See [docs/SECURITY.md](docs/SECURITY.md) and [docs/PRIVACY_AND_RETENTION.md](docs/PRIVACY_AND_RETENTION.md).

## Known limitations

- Google Calendar live booking requires completed OAuth setup.
- Twilio auto-provisioning is credential-dependent; manual number registration is supported.
- Privacy Policy / Terms are placeholders.
- In-memory rate limiting is per-instance; use edge WAF in production.
- Previous Python FastAPI MVP (if present on another branch) is superseded by this Next.js SaaS.
