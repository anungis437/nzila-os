# Data Classification Standard — Control Matrix

**Doc ID:** DCS-2026-001
**Version:** 1.0
**Authority:** [Data Classification Policy](data-classification-policy.md) §3

For each tier the following controls are MANDATORY unless an exception is
recorded in `governance/exceptions/`.

| Control | Public (1) | Internal (2) | Confidential (3) | Restricted (4) |
|---------|:----------:|:------------:|:----------------:|:--------------:|
| Encryption at rest | optional | required | required (AES-256) | required (AES-256, customer-managed key) |
| Encryption in transit | required | required (TLS 1.2+) | required (TLS 1.3) | required (TLS 1.3, mTLS where supported) |
| Access control | open | authenticated | authenticated + RBAC + org-scope | authenticated + RBAC + org-scope + just-in-time elevation |
| MFA for human access | n/a | recommended | required | required |
| Audit logging | optional | basic | full read/write with actor | full read/write + content hash + tamper-evident |
| Region | any | any | Canada Central | Canada Central; cross-border only with DPIA + lawful basis |
| Backup encryption | optional | required | required | required + offsite + tested restore quarterly |
| Retention default | indefinite | 1 year | per [retention schedule](data-retention-schedule.md) | per [retention schedule](data-retention-schedule.md), shortest practical |
| Disposal | overwrite | overwrite | cryptographic erase | cryptographic erase + certificate of destruction |
| Allowed in non-prod | yes | yes | synthetic only | NEVER |
| AI model exposure | allowed | allowed with notice | allowed only with PIA | only with PIA + zero-retention contract + minimization |
| DSAR scope | n/a | metadata only | full | full + special-category procedures |

## Implementation notes for Nzila OS

- **Postgres (canada-central):** server-side encryption is on by default; tier-3+ tables MUST also enable column-level encryption for PII columns where supported (e.g., contact info, government IDs).
- **Azure Blob:** `media`, `documents`, `evidence` containers default to **Confidential**; `evidence` may contain **Restricted** content — apply customer-managed keys.
- **Azure OpenAI:** Whisper/`gpt-4.1-mini` calls cross-border; only **Internal/Confidential** content allowed without per-flow DPIA. **Restricted** content (PHI) requires explicit PIA approval (see [`../ai-pia/surfaces/union-eyes-cognition.md`](../ai-pia/surfaces/union-eyes-cognition.md) R1).
- **Logs:** Application logs must NEVER contain Restricted data. Confidential data must be redacted; the platform observability layer provides redaction utilities.

## Verification

A scheduled CI job (TODO) will diff `governance/privacy/data-inventory.json`
against actual Postgres schemas and Blob containers and fail when an
unclassified store is found.
