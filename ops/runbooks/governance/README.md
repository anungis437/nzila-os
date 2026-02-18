# Runbooks — Governance

**Owner:** Legal / Platform Engineering  
**Review Cadence:** Semi-annually

## Purpose

Governance runbooks for corporate actions, board resolutions, shareholder management,
and regulatory filings within the MinuteBookOS module.

## Available Runbooks

| Runbook | Description | Module |
|---|---|---|
| Board Resolution Workflow | Draft → approve → sign → file board resolutions | MinuteBookOS |
| Shareholder Resolution Workflow | Draft → vote → record shareholder resolutions | MinuteBookOS |
| Share Issuance | Issue new shares via EquityOS governance action | EquityOS |
| Share Transfer | Transfer shares between shareholders | EquityOS |
| Annual Return Filing | Prepare and submit annual return | YearEndOS |
| Meeting Minutes Recording | Record and store meeting minutes | MinuteBookOS |

## Evidence to Capture

Governance actions produce evidence stored in the `minutebook` container:

| Artifact | Format | Storage Path | Retention |
|---|---|---|---|
| Board resolution (signed) | PDF | `minutebook/{entity_id}/resolutions/{YYYY}/{doc_id}/resolution.pdf` | PERMANENT |
| Meeting minutes | PDF | `minutebook/{entity_id}/meetings/{YYYY}/{meeting_id}/minutes.pdf` | PERMANENT |
| Share certificate | PDF | `minutebook/{entity_id}/certificates/{YYYY}/{cert_id}/certificate.pdf` | PERMANENT |
| Shareholder register export | CSV/PDF | `exports/{entity_id}/register/{YYYY}/{MM}/register.csv` | 7_YEARS |

### Required Metadata Fields

- `entity_id`, `doc_id` (FK → `documents.id`), `sha256`, `created_by`, `retention_class = 'PERMANENT'`

### Hashing Expectation

All governance documents uploaded via `@nzila/blob` → SHA-256 → `documents.sha256` → `audit_event` with `action = 'governance_document_uploaded'`.

The `share_ledger_entries` table maintains its own hash chain (`hash`, `previous_hash`) for all equity transactions.

## References

- [Required Evidence Map](../../compliance/Required-Evidence-Map.md) — IC-02, IC-05
- [DB Schema — equity](../../packages/db/src/schema/equity.ts)
- [DB Schema — governance](../../packages/db/src/schema/governance.ts)
