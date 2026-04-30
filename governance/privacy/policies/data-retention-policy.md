# Data Retention Policy

**Doc ID:** DRP-2026-001
**Version:** 1.0
**Owner:** Privacy Lead
**Status:** ACTIVE
**Next review:** 2027-04-28

## 1. Purpose

Ensure personal data is kept only as long as necessary for the purpose it was
collected, in accordance with GDPR Art. 5(1)(e) (storage limitation), PIPEDA
Principle 5, and CCPA §1798.100.

## 2. Principles

1. **Minimization** — collect the least personal data needed for the purpose.
2. **Purpose limitation** — retention period derives from the lawful purpose.
3. **Storage limitation** — once purpose is fulfilled, data is deleted or anonymized.
4. **Defensible deletion** — retention/deletion must be logged and auditable.
5. **Legal hold override** — when a legal hold applies, deletion is suspended for the holding period.

## 3. Retention determination

For each data class the schedule documents:

- Lawful basis (GDPR Art. 6) and purpose
- Retention period
- Trigger event (e.g., account closed, contract ended)
- Disposal method per [classification standard](data-classification-standard.md)
- Override conditions (legal hold, regulatory minimum)

See: [Data Retention Schedule](data-retention-schedule.md)

## 4. Implementation

- Each Postgres table containing personal data MUST have either:
  - a `deleted_at` column with a scheduled hard-delete job, OR
  - a documented external retention worker.
- Backups follow their own retention (max 90 days) and are subject to deletion
  upon purge of the source.
- Logs containing personal data are subject to a 30-day hard cap.
- Anonymization (k-anonymity ≥ 5 on quasi-identifiers) is an acceptable
  alternative to deletion for analytics purposes.

## 5. Roles

- Surface Owner — defines retention per data class in their app.
- Platform Lead — implements scheduled purge jobs.
- Privacy Lead — approves the schedule and exceptions.

## 6. Exceptions

Recorded in `governance/exceptions/` with justification, expiry, approver.
