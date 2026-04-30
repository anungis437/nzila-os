# Data Retention Schedule (GDPR-aligned)

**Doc ID:** DRS-2026-001
**Authority:** [Data Retention Policy](data-retention-policy.md)
**Version:** 1.0 (initial — to be expanded as data inventory matures)

Periods are MAXIMUMS unless a regulatory minimum is noted.

| Data class | Surface(s) | Tier | Lawful basis (GDPR Art. 6) | Retention | Trigger | Disposal |
|-----------|-----------|------|---------------------------|-----------|---------|----------|
| Authentication sessions | `auth_user_sessions` (all apps) | Confidential (3) | Contract | 30 days idle, 90 days max | Last activity | Hard delete |
| Account / profile | `auth_users`, organization members | Confidential (3) | Contract | Account life + 30 days | Account deletion | Hard delete; ID hashed in audit |
| Audit logs (security events) | platform observability | Confidential (3) | Legal obligation | 1 year hot, 6 years cold | Event date | Cryptographic erase |
| Application logs | log analytics | Internal (2) | Legitimate interest | 30 days | Ingest date | Hard delete |
| Voice uploads (raw audio) | `apps/zonga` (Whisper) | Restricted (4) | Contract + consent | 30 days | Upload date | Hard delete + blob purge |
| Voice transcripts | `apps/zonga` `voice_transcripts` | Confidential (3) (potentially Restricted) | Contract | 1 year | Transcript creation | Hard delete |
| Union member case data | `apps/union-eyes` cases.* | Restricted (4) | Contract + legal | 7 years post-closure (CA labour relations practice) | Case closure | Cryptographic erase |
| Union member health context (PHI) | `apps/union-eyes` PHI columns | Restricted (4) | Consent | Per case retention; minimization at intake | Case closure | Cryptographic erase + cert |
| AI cognition outputs + reasoning envelope | `apps/union-eyes`, `apps/console` | Confidential (3) | Linked to source | Linked to source data | Source deletion | Cascade delete |
| Financial records (cfo) | `apps/cfo` | Restricted (4) | Legal obligation (tax) | 7 years (CA CRA) | Fiscal year end | Cryptographic erase |
| Commercial / partner records | `apps/partners` | Confidential (3) | Contract | Contract life + 7 years | Contract end | Cryptographic erase |
| Marketing / analytics | website | Internal (2), pseudonymous | Consent | 26 months (GA4 default) or per consent | Last activity | Hard delete |
| Backups (Postgres) | Azure backup | Mirror source | Operational | 90 days max | Backup date | Crypto-shred |
| Support correspondence | helpdesk | Confidential (3) | Legitimate interest | 3 years | Last contact | Hard delete |

**Legal-hold override:** retention is suspended when written legal-hold is
issued by counsel; the hold is recorded in `governance/privacy/legal-holds/`
(to be created on first hold).

## Verification

- Each row above MUST be backed by a scheduled job or documented manual process.
- Privacy Lead reviews the schedule annually and on any new app launch.
