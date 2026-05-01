# Disaster Recovery and Backup Posture — May 2026

Generated: 2026-05-01
Period: 2026-05

## Scope

This document captures current disaster recovery posture for controlled production operations based on known platform topology and proof artifacts.

Primary runtime region: Canada Central

## Dependency Posture Snapshot

Container platform:
- Azure Container Apps environment active in Canada Central
- Critical production-approved services reachable and healthy

Database:
- PostgreSQL Flexible Server: nzila-staging-db
- State: Ready
- Backup retention: 35 days
- Geo-redundant backup: Disabled

Storage:
- Account: nzilacanadastore
- Containers present: backups, documents, exports, media, evidence

Observability:
- Log Analytics workspace present (nzila-staging-logs)

## Recovery Assumptions

- Recovery objective prioritizes service continuity for production-approved endpoints.
- Database point-in-time restore is available within configured retention window.
- Cross-region failover is not currently the default strategy due to disabled geo-redundant DB backup.

## Risk Register

| Risk | Impact | Likelihood | Current Mitigation | Residual |
|------|--------|------------|--------------------|----------|
| Regional outage in Canada Central | High | Medium | Backup retention + redeploy runbooks | Medium-High |
| DB corruption requiring restore | High | Medium | PITR availability and restore drills | Medium |
| DNS misconfiguration drift | Medium | Medium | Deployment inventory and periodic health proof | Medium |
| Alert coverage gaps on non-zonga apps | Medium | Medium | Existing health proof + planned alert expansion | Medium |

## DR Readiness Actions

Completed:
- Runtime proof shows restore dimension fully earned for current period.
- Drift report present with zero drift items for 2026-05.
- Health checks pass for all gate-scoped endpoints.

Required hardening:
- Evaluate geo-redundant backup enablement for postgres where cost/risk justifies.
- Add explicit backup failure alerts and restore SLA monitors.
- Add quarterly game-day DR exercise with app + DB + DNS scenarios.

## Recovery Workflow (High-Level)

1. Classify incident (service-only, data, regional).
2. Stabilize access paths (DNS, ingress, cert health checks).
3. Restore data plane if required (PITR workflow).
4. Redeploy/control app revisions with signed artifacts.
5. Validate via health probes and runtime proof gate.
6. Record evidence in ops outputs and incident timeline.

## Gate Alignment

Current posture does not block runtime gate for 2026-05. Residual DR risk is documented and accepted for this sprint with action items tracked for hardening.
