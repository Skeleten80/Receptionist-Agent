# Google Calendar setup

1. Create OAuth client credentials.
2. Set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`.
3. Store refresh tokens in `integration_secrets` (service-role only) referenced by `integrations.encrypted_credentials_reference`.
4. Until connected, LocalAgent uses **manual appointment request** mode.
5. Adapter: `src/lib/calendar/provider.ts`.
