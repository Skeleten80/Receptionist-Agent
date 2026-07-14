# Local development

1. Copy `.env.example` → `.env.local` and fill Supabase URL + anon + service role.
2. Apply `supabase/migrations/20260314000000_initial_schema.sql`.
3. `npm install && npm run dev`
4. Register at `/register`, create an organization in onboarding.
5. Add services/FAQs, configure receptionist (syncs mock or Vapi assistant).
6. Simulate end-of-call from `/app/receptionist`.
7. Confirm call + lead on dashboard.
8. Create a manual appointment request.
9. Configure Stripe test keys and run Checkout + `stripe listen` for webhooks.

## Async webhook processing (Vercel)

Webhook routes persist `webhook_events` first, then process inline when fast. Non-critical email uses fire-and-forget after the response path; retries can be driven by scanning `processing_status=failed` via cron.
