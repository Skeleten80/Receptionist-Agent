# Privacy and Retention

## Defaults

- **Recording storage is disabled by default** (`RECORDING_STORAGE_ENABLED=false`). The MVP does not store audio blobs.
- **Transcripts are stored separately** from any recording reference (`call_transcripts` table vs `calls.recording_url`).
- **Transcript retention** is controlled by `TRANSCRIPT_RETENTION_DAYS` (default 90). Use the retention purge helper / scheduled job in production.
- **Configurable disclosure** is stored per business (`disclosure_message`) and spoken at call start.
- **Delete endpoint**: `DELETE /admin/calls/{call_id}/data` removes transcript turns and recording references for authorized admins (API key). Call metadata and audit events are retained for operational accountability.

## Secrets

API keys, SMTP passwords, and provider secrets must never appear in API responses or structured logs. Logging redacts common secret field names.

## Legal notice (Ontario / Canada)

**Legal and privacy review is required before production use in Ontario/Canada.**

This software is an MVP engineering scaffold. It does **not** constitute legal advice. Before handling real caller personal information (phone numbers, addresses, voice/transcripts), you must:

1. Determine whether you are a service provider under applicable privacy law (e.g. PIPEDA and, where applicable, Ontario guidance).
2. Provide appropriate notice/consent for call recording and transcription.
3. Establish retention, access, correction, and deletion procedures.
4. Execute contracts with voice/LLM/calendar subprocessors as required.
5. Confirm CASL and telemarketing rules if outbound messaging is added later.

Engage qualified Canadian privacy counsel before go-live.
