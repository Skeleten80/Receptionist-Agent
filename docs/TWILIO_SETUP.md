# Twilio setup (Canadian numbers)

1. Set `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`.
2. Point voice webhooks to `/api/webhooks/twilio` (signature validated).
3. Register or provision numbers in Settings → Phone number.
4. Associate the number with the active AI agent.
5. Without credentials, the UI still stores number metadata as `pending` and shows setup instructions — it does not pretend provisioning succeeded.
