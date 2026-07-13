# Provider setup

## Local mock mode (default)

```bash
VOICE_PROVIDER=mock
CALENDAR_PROVIDER=mock
LLM_PROVIDER=mock
NOTIFY_EMAIL_DRY_RUN=true
```

No external accounts required. Use `/simulate/call` or `python -m app.cli simulate --script booking_success`.

## Retell AI

1. Create a Retell agent / phone number.
2. Set webhook URL to `https://<host>/webhooks/voice/retell`.
3. Configure:

```bash
VOICE_PROVIDER=retell
RETELL_API_KEY=...
RETELL_WEBHOOK_SECRET=...
```

4. Map Retell tool/function callbacks to your booking APIs as needed. The adapter parses inbound webhook payloads into a normalized `VoiceWebhookEvent` and returns a provider-shaped response envelope.

## Vapi

1. Create a Vapi assistant and phone number.
2. Set server URL to `https://<host>/webhooks/voice/vapi`.
3. Configure:

```bash
VOICE_PROVIDER=vapi
VAPI_API_KEY=...
VAPI_WEBHOOK_SECRET=...
```

## Google Calendar

When `CALENDAR_PROVIDER=google` but OAuth credentials are absent, the app **falls back to mock calendar** and logs a warning.

```bash
CALENDAR_PROVIDER=google
GOOGLE_CALENDAR_CREDENTIALS_JSON={"type":"service_account",...}
GOOGLE_CALENDAR_ID=primary
```

Wire `google-api-python-client` in the Google adapter for production; the interface (`find_availability` / `create_event`) stays stable.

## Hosted LLM (optional)

```bash
LLM_PROVIDER=openai_compat
LLM_API_KEY=...
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
```

Ollama is intentionally **not** required for the MVP. If the hosted call fails, the mock rule-based classifier is used as a safe fallback so the call path continues.
