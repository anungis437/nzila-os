# Runbooks — Finance Close

**Owner:** Finance / Platform Engineering  
**Review Cadence:** Monthly (after each close)

## Purpose

Finance close runbooks for month-end and year-end procedures within YearEndOS,
including reconciliation, reporting, and compliance evidence generation.

## Available Runbooks

| Runbook | Description | Frequency |
|---|---|---|
| Monthly Close | Standard month-end close procedure | Monthly |
| Quarterly Close | Quarterly financial reporting + control tests | Quarterly |
| Year-End Close | Annual close, audit prep, regulatory filings | Annual |
| Cap Table Snapshot | Generate point-in-time cap table snapshot | Per event / Monthly |

## Monthly Close Procedure

See `TEMPLATE_SCHEMA.md` for the full YAML template (`fc-001`). Summary:

1. Lock accounting period
2. Reconcile bank accounts
3. Accrue expenses
4. Generate financial reports (P&L, Balance Sheet, Cash Flow)
5. Management review and approval
6. Generate compliance evidence

## Evidence to Capture

| Artifact | Format | Control | Storage Path | Retention |
|---|---|---|---|---|
| Period close report | PDF | IC-05 | `evidence/{entity_id}/integrity/{YYYY}/{MM}/period-close/CLOSE-{YYYY}-{MM}/` | PERMANENT |
| Cap table snapshot | JSON | IC-02 | `evidence/{entity_id}/integrity/{YYYY}/{MM}/cap-table-snapshot/` | PERMANENT |
| Reconciliation report | PDF | — | `evidence/{entity_id}/integrity/{YYYY}/{MM}/reconciliation/` | 7_YEARS |
| Share ledger chain verification | JSON | IC-02 | `evidence/{entity_id}/integrity/{YYYY}/{MM}/share-ledger-chain-verify/` | PERMANENT |
| Evidence pack index | JSON | All | Same path as period close | PERMANENT |

### Required Metadata Fields

- `entity_id`, `artifact_id` (e.g., `CLOSE-2026-02`), `sha256`, `created_by`, `retention_class`

### Hashing Expectation

All financial close evidence uploaded via `@nzila/blob` → SHA-256 auto-computed → stored in `documents.sha256` → `audit_event` with `action = 'period_close_evidence_uploaded'`.

The cap table snapshot is also stored in `cap_table_snapshots` table as JSON, cross-referenced with the blob artifact.

## References

- [Required Evidence Map](../../compliance/Required-Evidence-Map.md) — IC-02, IC-05
- [Control Test Plan](../../compliance/Control-Test-Plan.md) — CT-04
- [DB Schema — equity](../../packages/db/src/schema/equity.ts)
- [Runbook Template Schema](../TEMPLATE_SCHEMA.md) — `fc-001` template
