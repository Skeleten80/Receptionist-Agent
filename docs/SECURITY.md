# LocalAgent — Security

## Trust boundaries

| Zone | Allowed secrets | Notes |
|------|-----------------|-------|
| Browser | Supabase anon key, Stripe publishable key, public app URL | No service role, no provider private keys |
| Next.js server | All `*_SECRET` / service keys | Via environment only |
| Supabase RLS | JWT from Auth | Tenant isolation |
| Webhooks | Provider signing secrets | Verify before any side effect |

## Secret management

- Store secrets in Vercel/Supabase env; never commit `.env`.
- Integration OAuth tokens: server-only table or encrypted column referenced by `integrations.encrypted_credentials_reference`. Never readable with the anon key.
- Application encryption key: `CREDENTIALS_ENCRYPTION_KEY` (32-byte base64) for AES-GCM at rest when storing refresh tokens.

## Tenant isolation

1. Every query that returns tenant data filters by `organization_id`.
2. Membership verified server-side before mutations.
3. RLS policies mirror application checks (defense in depth).
4. Platform admin is an explicit separate path (`profiles.is_platform_admin`), not a membership role.
5. Do not accept `organization_id` from the client without membership verification.

## Webhook verification

- **Stripe**: `stripe.webhooks.constructEvent` with raw body + signing secret.
- **Vapi**: HMAC/signature header verification per current Vapi docs; reject if missing/invalid.
- **Twilio**: validate `X-Twilio-Signature` when Twilio webhooks are enabled.
- Persist `webhook_events` with unique `(provider, provider_event_id)` before side effects.

## Recording access

- Prefer Supabase Storage private buckets.
- Serve via short-lived signed URLs or authenticated streaming route.
- Never permanently public recording URLs for production tenants.
- Members need org membership + `recording_enabled` policy checks.

## Authentication

- Supabase Auth email/password; optional magic link.
- Server Components / middleware check session for `/app/**`.
- Password reset via Supabase flows.
- CSRF-aware mutations via Server Actions / same-origin cookies.

## Authorization matrix

| Action | Owner | Member | Platform admin |
|--------|-------|--------|----------------|
| Billing | ✓ | ✗ | read orgs |
| Secrets / integrations write | ✓ | ✗ | ✗ |
| Invite members | ✓ | ✗ | ✗ |
| View calls/leads | ✓ | ✓ | ✓ (support) |
| Update lead status | ✓ | ✓ | ✗ |
| Suspend org | ✗ | ✗ | ✓ |

## Logging

- Structured JSON logs with correlation IDs.
- Redact tokens, passwords, Authorization headers, raw provider credentials, full card data.
- Do not log full transcripts to third-party debug tools in production without DPA review.

## Headers

- Security headers middleware: `X-Content-Type-Options`, `Referrer-Policy`, `Frame-Options`/`frame-ancestors`, HSTS in production.
- CSP tightened iteratively; document known exceptions for Stripe.js / Vapi if embedded.

## Known limitations

- Local mock webhooks use a shared dev secret — never reuse in production.
- Google Calendar requires completed OAuth consent screen for live booking.
- Rate limiting is application-level (in-memory/edge); production should add edge WAF/rate limits.

## Incident response (basics)

1. Rotate compromised secrets immediately.
2. Suspend affected organizations if tenant data leaked.
3. Preserve `audit_logs` and `webhook_events`.
4. Notify affected customers per legal counsel guidance.
5. Patch RLS/authz bugs before re-enabling.

## Legal notice

Operators must obtain qualified Canadian legal advice (privacy, call recording, emergency handling) before production launch. This document is engineering guidance, not legal advice.
