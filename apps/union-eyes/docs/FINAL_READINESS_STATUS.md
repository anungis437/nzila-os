# UnionEyes — Final Readiness Status

> **Honest readiness label, not marketing language.**

## TL;DR

UnionEyes is **PILOT-READY** for controlled procurement reviews and executive demos. It is **NOT YET** stamped for unsupervised production multi-tenant use. The gap is operational maturity (load testing, full org-scope automation), not architectural soundness.

| Dimension | Status | Evidence |
|---|---|---|
| Auth + org isolation | ✅ Enforced + red-team tested | `ORG_SCOPE_AUDIT.md` |
| Boot-time fail-closed gates | ✅ Active | `instrumentation.ts` |
| Operational metrics | ✅ Real domain state | `/api/metrics/operational` |
| Governance telemetry | ✅ Real domain state | `/api/governance/telemetry` |
| Evidence pack | ✅ Pipeline + endpoint | `pnpm evidence:all`, `/api/evidence/export` |
| Health probes | ✅ Canonical shape | `/api/health` |
| Deterministic staging seed | ✅ Idempotent | `pnpm -C apps/union-eyes staging:seed` |
| Demo runbook | ✅ Authored | `DEMO_RUNBOOK.md` |
| E2E happy-path coverage | ✅ Stakeholder journeys | `e2e/stakeholder-demo-journeys.spec.ts` |
| E2E negative-path coverage | ⚠️ Partial | Arbitration negative paths deferred |
| Cross-tenant fuzz testing | ⚠️ Not automated | Manual + red-team only |
| Load / perf benchmarking | ⚠️ Not benchmarked | Pre-pilot task |
| Production deployment | ⛔ Not configured | `environments.production = null` in registry |

## What is genuinely production-ready

- Database isolation pattern (scoped DB wrappers + audit trail)
- Boot-time critical env validation
- Health and liveness probes with honest degradation
- Evidence collect/seal/verify pipeline
- Marketing vocabulary contract enforcement (no fake "Request a Demo")
- Schema drift detection
- Adversarial red-team boundary test

## What is staging-only

- Deterministic staging seed (refuses prod unless `STAGING_SEED_ALLOW_PROD=true`)
- Pilot demo runtime mode
- Default org `org_demo_unioneyes_staging`

## What remains amber

- Cross-tenant fuzz at scale across 300+ tables (red-team covers structural; not exhaustive)
- Concurrent-user load profile
- Full E2E coverage of arbitration negative paths
- Production deployment topology

## Trust posture

We prefer **truthful amber** over false green. This file is the authoritative readiness statement; if marketing material disagrees, this file wins.
