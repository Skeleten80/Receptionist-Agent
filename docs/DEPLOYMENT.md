# Deployment (Vercel)

1. Create a Vercel project from this repo.
2. Set all server env vars from `.env.example` (Production + Preview as appropriate).
3. Set `NEXT_PUBLIC_APP_URL` to the deployment URL.
4. Point Stripe / Vapi / Twilio webhooks to `https://<domain>/api/webhooks/*`.
5. Apply Supabase migrations to the production project.
6. Do **not** run the demo seed against production.
7. Verify `/api/health` returns `status: ok`.
