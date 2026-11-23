# G12 — Telemetry and incident procedure (engineering package)

**Gate status:** Operational live drill remains `NOT_PROVEN` until B-005 + named alert receivers.

This document is the in-repo incident procedure that staging drills must execute.
It does not claim a live collector round-trip.

## 1. Structured operational events

Material SAGE actions must emit audit records through the platform-admin audit
adapter (`apps/platform-admin/lib/sage/audit-adapter.ts`) with:

- action taxonomy from `SAGE_AUDIT_ACTIONS`
- org / workspace scoping
- no email, phone, SIN, or free-text personal identifiers in event payloads

Contract coverage: `tooling/scripts/sage-g12-telemetry-contract.test.mjs`

## 2. Alert routing (staging)

| Severity | Route | Ack SLA |
|---|---|---|
| P1 institutional integrity | On-call + founder paging channel | 15 minutes |
| P2 delivery / notifier failure | Staging ops channel | 4 hours |
| P3 readiness / cron miss | Ticket queue | next business day |

Alert receivers and channel IDs are environment secrets — never committed.

## 3. Acknowledgement and escalation

1. Ack in the alerting tool (creates `incidentId`).
2. Open change/incident record under `ops/change-records/` when write access exists.
3. If unacked past SLA → escalate one level (P3→P2, P2→P1).
4. Close only with: root cause, impact tenant list (ids only), restore/non-impact statement.

## 4. Drill checklist (requires staging)

- [ ] Force a synthetic notifier failure in staging
- [ ] Confirm structured event lands in collector
- [ ] Confirm alert fires to the named receiver
- [ ] Ack within SLA
- [ ] File drill receipt; leave G12 `NOT_PROVEN` until that receipt exists

## Explicit non-claims

- Passing unit/contract tests ≠ live G12.
- Azure Monitor / App Insights wiring still requires staging credentials.
