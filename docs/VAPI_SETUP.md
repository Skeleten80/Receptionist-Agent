# Vapi setup

1. Create a Vapi account and API key (`VAPI_API_KEY`).
2. Set webhook URL to `https://<host>/api/webhooks/vapi`.
3. Configure `VAPI_WEBHOOK_SECRET` and sign requests per Vapi docs (HMAC SHA-256 of raw body).
4. Saving the receptionist upserts/patches an assistant via the Vapi API and stores `provider_assistant_id`.
5. For local development without Vapi, set `VAPI_MOCK_MODE=true` and use the simulate endpoint (signature `mock-dev-signature` or HMAC with your secret).
