# Audit Enforcement

> **Canonical platform documentation** for audit enforcement across Nzila OS.

## Overview

Audit enforcement ensures that all platform actions that affect governance-sensitive data are
recorded, traceable, and verifiable. The enforcement layer sits at the boundary between
application logic and the audit ledger.

## Enforcement Points

| Enforcement Point | Mechanism |
|-------------------|-----------|
| **API boundary** | All mutating API calls are logged with actor, timestamp, and payload hash |
| **Decision events** | All policy decisions are recorded in the `decision_events` ledger |
| **Evidence packs** | CI evidence packs seal audit artifacts per release |
| **Schema changes** | Schema drift detection gates block unapproved schema changes |

## Audit Obligations

- All actions affecting `governed_policies`, `org_entitlements`, or `decision_events` MUST
  be written to the audit ledger
- Audit records are immutable once written
- Read-only operations are exempt from audit logging unless they involve sensitive data access

## Related

- [Evidence Lifecycle Policy](EVIDENCE_LIFECYCLE_POLICY.md)
- [Architecture: Audit Enforcement](../architecture/AUDIT_ENFORCEMENT.md)
