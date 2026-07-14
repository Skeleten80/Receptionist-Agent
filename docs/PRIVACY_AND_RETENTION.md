# Privacy and Retention

## Market context

LocalAgent initially targets businesses in **Ontario, Canada**. This software provides **configurable privacy features**. It does **not** assert automatic compliance with PIPEDA or any provincial law.

**The operator must obtain qualified Canadian legal advice** concerning privacy, call recording, telemarketing, emergency handling, and industry-specific obligations before production launch.

## Built-in controls

- AI disclosure in receptionist prompts
- Configurable call-recording disclosure text
- Per-organization recording enable/disable
- `consent_recorded` on calls
- Retention settings (transcript/recording days) via org configuration / env defaults
- Data export (owner)
- Data deletion / anonymization request workflow (admin/owner)
- Privacy policy, Terms, Subprocessor placeholders
- Audit trail for administrative actions (without logging secrets or full sensitive call contents by default)

## Defaults

- Recording storage **off** until the owner enables it
- Transcripts stored separately from binary recordings
- Retention periods configurable (`TRANSCRIPT_RETENTION_DAYS`, `RECORDING_RETENTION_DAYS`)

## Placeholders

- `/privacy` — Privacy Policy placeholder
- `/terms` — Terms of Service placeholder
- `/subprocessors` — Subprocessor list placeholder
