# Business Continuity

**Owner:** CISO / CTO  
**Review Cadence:** Annually  
**Controls Covered:** DR-03

## Purpose

Define the business continuity plan (BCP) for Nzila OS, covering people, processes,
and technology required to maintain critical operations during disruptions.

## Critical Services

| Service | Priority | Max Downtime | Dependencies |
|---|---|---|---|
| Console (apps/console) | P1 | 4 hours | Clerk, PostgreSQL, Azure Blob |
| Web (apps/web) | P2 | 8 hours | Static content, CDN |
| Equity ledger (share_ledger_entries) | P1 | 4 hours | PostgreSQL |
| Document storage (Azure Blob) | P1 | 0 (RA-GRS failover) | Azure Storage |
| Authentication (Clerk) | P1 | Dependent on Clerk SLA | Clerk platform |

## BCP Activation Criteria

- Primary Azure region unavailable > 30 minutes
- Database unrecoverable from primary backup
- Key personnel unavailable (bus factor event)
- Third-party provider (Clerk) extended outage

## Annual Review Process

See `Control-Test-Plan.md` → CT-09 for the full annual review procedure.

1. Review current BCP document against actual infrastructure
2. Update contact lists and escalation paths
3. Review and update recovery procedures
4. Obtain sign-off from CISO and CTO
5. Version and store updated BCP

## Evidence to Capture

| Artifact | Format | Control | Storage Path | Retention |
|---|---|---|---|---|
| BCP document (versioned) | PDF | DR-03 | `evidence/{entity_id}/dr-bcp/{YYYY}/bcp-review/BCP-{YYYY}/bcp-document-v{version}.pdf` | PERMANENT |
| BCP review sign-off | JSON | DR-03 | Same path | PERMANENT |
| Evidence pack index | JSON | DR-03 | Same path | PERMANENT |

### Required Metadata Fields

- `entity_id`, `artifact_id` (e.g., `BCP-2026`), `sha256`, `created_by`, `retention_class = 'PERMANENT'`

### Hashing Expectation

SHA-256 computed at upload via `@nzila/blob` → stored in `documents.sha256` → `audit_event` with `action = 'bcp_review_uploaded'`.

## References

- [Required Evidence Map](../compliance/Required-Evidence-Map.md) — DR-03
- [Control Test Plan](../compliance/Control-Test-Plan.md) — CT-09
- [Disaster Recovery](../disaster-recovery/README.md)
