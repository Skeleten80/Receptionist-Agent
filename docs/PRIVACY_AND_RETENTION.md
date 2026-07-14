# Privacy and Retention

## Market context

LocalAgent / Local AI Business Agent initially targets businesses in **Ontario, Canada**. This software provides **configurable privacy features**. It does **not** assert automatic compliance with PIPEDA or any provincial law.

**The operator must obtain qualified Canadian legal advice** concerning privacy, call recording, telemarketing, emergency handling, and industry-specific obligations before production launch.

## Built-in controls

- AI disclosure in receptionist prompts / call greeting
- Configurable call-recording disclosure text (per organization/business)
- Recording enable/disable (off by default)
- Consent tracking on calls (`consent_recorded` / recording & transcript consent flags)
- Retention settings for transcripts and recordings via org configuration / environment defaults (`TRANSCRIPT_RETENTION_DAYS`, `RECORDING_RETENTION_DAYS`)
- Transcripts stored separately from binary recordings / recording URL references
- Data export (owner)
- Data deletion / anonymization workflows for authorized admins (e.g. delete-call-data)
- Privacy policy, Terms, and Subprocessor placeholders
- Audit trail for administrative actions (without logging secrets or full sensitive call contents by default)

## Defaults

- Recording storage **off** until an owner enables it
- Transcripts stored separately from recordings
- Transcript retention default: 90 days (configurable)
- Recording retention default: 30 days where applicable (configurable)

## Secrets

API keys, SMTP passwords, provider secrets, and service-role keys must never appear in API responses, client bundles, or structured logs. Logging must redact common secret field names.

## Placeholders

- `/privacy` — Privacy Policy placeholder
- `/terms` — Terms of Service placeholder
- `/subprocessors` — Subprocessor list placeholder

## Legal checklist before production

This is an engineering scaffold and does **not** constitute legal advice. Before handling real caller personal information you must:

1. Determine obligations under applicable privacy law (e.g. PIPEDA and, where applicable, Ontario guidance).
2. Provide appropriate notice/consent for call recording and transcription.
3. Establish retention, access, correction, and deletion procedures.
4. Execute contracts with voice/LLM/calendar/email subprocessors as required.
5. Confirm CASL and telemarketing rules if outbound messaging is added later.

Engage qualified Canadian privacy counsel before go-live.
