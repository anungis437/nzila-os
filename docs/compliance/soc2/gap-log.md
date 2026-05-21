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
| SOC2-CL-005 | Union Eyes RLS fail-open (CC6.1, CC6.6) | May 2026 P0 sprint | `apps/union-eyes/lib/db/with-rls-context.ts` fail-closed throw; 27/27 tests pass |
| SOC2-CL-006 | Cross-org idempotency collision risk (CC6.1) | May 2026 P0 sprint | `intake/route.ts` org-scoped hash + `withRLSContext` duplicate check; 4/4 cross-org isolation tests |
| SOC2-CL-007 | Unscoped assignClaim / claim mutation helpers (CC6.1) | May 2026 P0 sprint | `workflow-engine.ts` + `claims-queries.ts` org-scoped; 38/38 tests pass |
| SOC2-CL-008 | No canonical runtime truth source (A1.2, CC9.2) | May 2026 P0 sprint | `reports/runtime/platform-runtime-truth-latest.json` (status: HEALTHY — EXC-001 resolved 2026-05-14; prod/staging separated, `sharedBlastRadius: false`) |

## Notes

- This log is intentionally short and scoped to SOC 2 readiness. Engineering
  backlog items unrelated to control evidence live in GitHub Issues.
- A gap is "closed" only when (a) the control is implemented, (b) evidence is
  produced on a regular cadence, and (c) the evidence is discoverable from
  [`evidence-inventory.md`](./evidence-inventory.md).
