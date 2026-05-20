# SOC 2 Gap Log — Nzila OS

> Open gaps that must be closed before a SOC 2 Type I examination can begin.
> Each gap lists the related TSC criteria, owner, and target close.

## Priority 1 — Blockers for Type I

| ID | Gap | Criteria | Owner | Target |
|----|-----|----------|-------|--------|
| SOC2-001 | No third-party penetration test completed | CC4.1 | Security Lead | Before pilot GA |
| SOC2-002 | No formal access review cadence (quarterly attestation) | CC6.2, CC6.3 | Eng Lead | Before pilot GA |
| SOC2-003 | No documented capacity / scaling thresholds | A1.1 | Platform Lead | Pre-audit |
| SOC2-004 | Vendor SOC 2 reports not aggregated (Azure, OpenAI, GitHub, Vercel, etc.) | CC9.2 | Compliance PM | Pre-audit |
| SOC2-005 | Disaster Recovery runbook not exercised | CC7.5, CC9.1 | Platform Lead | Pre-audit |
| SOC2-006 | Formal incident response training records | CC7.4 | Security Lead | Pre-audit |

## Priority 2 — Type II readiness (after Type I)

| ID | Gap | Criteria | Owner | Target |
|----|-----|----------|-------|--------|
| SOC2-101 | Continuous control monitoring dashboard | CC4.1 | Platform Lead | Type II window |
| SOC2-102 | Quarterly risk register reviews logged | CC3.2 | Compliance PM | Type II window |
| SOC2-103 | HR onboarding/offboarding workflow with evidence | CC1.4 | Ops Lead | Type II window |
| SOC2-104 | Background check policy (where applicable) | CC1.4 | Ops Lead | Type II window |

## Recently closed

| ID | Gap | Closed in | Evidence |
|----|-----|-----------|----------|
| SOC2-CL-001 | Lifecycle CI test for audit → seal → verify | May 2026 | `apps/union-eyes/lib/__tests__/evidence-export.lifecycle.test.ts` |
| SOC2-CL-002 | FSM transition + SLA guard tests | May 2026 | `apps/union-eyes/lib/workflow/__tests__/case-lifecycle.test.ts` |
| SOC2-CL-003 | Django ↔ TS correlation header parity | May 2026 | `apps/union-eyes/backend/observability/tests/test_correlation_parity.py` |
| SOC2-CL-004 | Multi-org SaaS terminology consistency (docs) | May 2026 | `scripts/migrate-tenant-to-org.ts` + 5 doc updates |

## Notes

- This log is intentionally short and scoped to SOC 2 readiness. Engineering
  backlog items unrelated to control evidence live in GitHub Issues.
- A gap is "closed" only when (a) the control is implemented, (b) evidence is
  produced on a regular cadence, and (c) the evidence is discoverable from
  [`evidence-inventory.md`](./evidence-inventory.md).
