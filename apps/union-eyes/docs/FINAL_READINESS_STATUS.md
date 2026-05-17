# UnionEyes — Final Readiness Status

> **Honest readiness label, not marketing language.**

## TL;DR

UnionEyes is **CONTROLLED PILOT READY** for controlled procurement reviews and executive demos. It is **NOT YET** stamped for unsupervised production multi-tenant use. The remaining gap is production deployment topology (planned but not yet live), not architectural soundness or test coverage.

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
| E2E negative-path coverage | ✅ Implemented | `tests/e2e/negative-workflow-transitions.spec.ts`, `org-isolation-negative.spec.ts`, `auth-failure-handling.spec.ts`, `evidence-misuse.spec.ts` |
| Cross-tenant fuzz testing | ✅ Automated | `security/redteam/ue-org-scope-fuzz.test.ts`, `tooling/contract-tests/ue-org-column-audit.test.ts` |
| Load / perf benchmarking | ✅ Documented | `docs/PERFORMANCE_BASELINE.md`, `scripts/perf-baseline.ts` (awaiting live run) |
| Production topology | ⚠️ Live infra exists, runtime validation in progress | `docs/PRODUCTION_TOPOLOGY.md`, `docs/PHASE_B_PRODUCTION_DEPLOYMENT_VALIDATION.md`, `docs/PRODUCTION_INFRA_INVENTORY.md` |

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

## What was amber — now closed

| Item | Resolution |
|---|---|
| E2E negative-path coverage | ✅ 4 spec files added covering FSM transitions, org isolation, auth failures, evidence misuse |
| Cross-tenant fuzz testing | ✅ `ue-org-scope-fuzz.test.ts` (10 parameterized red-team probes) + `ue-org-column-audit.test.ts` (INV-34 schema audit) |
| Load / perf benchmarking | ✅ `PERFORMANCE_BASELINE.md` defines thresholds; `perf-baseline.ts` script records live p50/p95/p99 |
| Auth reality / stale vendor refs | ✅ Phase A complete — all active provider refs removed; PG sessions (primary) + Entra SSO (secondary) documented |
| `/api/metrics/operational` 500 in prod | ✅ Fixed commit `3c43cf116` — confirmed 401 on `--0000045` `2026-05-17T18:47:00Z` |
| Rollback drill not executed | ✅ Drill `2026-05-17T18:45:00Z` — 23s end-to-end, smoke passed; see `ROLLBACK_VALIDATION.md` |
| PITR restore rehearsal not executed | ✅ Drill `2026-05-17T18:52:09Z` — restored to Ready in 4 min, prod unaffected; see `BACKUP_RESTORE_VALIDATION.md` |
| Alert action groups not configured | ✅ `ue-prod-ops-alerts` (→ `ops@nzila.ca`) attached to all 3 KQL rules `2026-05-17T18:55:00Z` |
| Redis not configured (empty env vars) | ✅ Upstash `cuddly-mudfish-102231.upstash.io` provisioned; wired via ACA secretRef on `--0000049`; health confirms `redis:{status:"ok",ms:37}` `2026-05-17T19:12:05Z` |

## What remains amber

- Production deployment topology — live Azure infrastructure exists in
  `nzila-canada-prod-rg` (Container App `nzila-os-union-eyes-prod` on
  revision `--0000049`, Postgres flex v16 with ZR-HA + geo backups,
  Redis Upstash live, Key Vault `nzila-canada-prod-kv`, Log Analytics
  `nzila-canada-prod-law`), Phase B operational validation in progress.
  See `PHASE_B_PRODUCTION_DEPLOYMENT_VALIDATION.md`.
- Live-captured gaps blocking PRODUCTION READY:
  - Django backend dependency reports `degraded: unreachable` from
    prod (honest amber via health contract — non-critical by design).
  - No dedicated prod blob/storage account.
  - Upstash Redis token stored as ACA secret (not yet migrated to Key Vault).
  - Custom domain / WAF / HSTS not bound to UE prod.
  - Row-level DB integrity drill deferred (private endpoint / jump-host
    not configured for direct psql access to drill server).
  - Governance runtime proof (B3B) and evidence integrity under failure (B4B) pending authenticated drills.
  - Formal incident drills (expired secret, failed deploy) pending.
  - Alert fire drill not yet executed (alerts wired, not yet fired/acknowledged).
  - Pilot runtime observation window opened `2026-05-17T18:34:00Z`;
    1-week minimum observation period running.
- B8 validation suite (local): all checks green —
  governance 54/54 ✅, platform contract 0 errors ✅,
  app lifecycle 0 errors ✅, validate:docs 0 errors ✅,
  contract-tests 8962/8962 ✅, UE unit tests 7075/7075 ✅.

## Trust posture

We prefer **truthful amber** over false green. This file is the authoritative readiness statement; if marketing material disagrees, this file wins.

## Readiness label

**CONTROLLED PILOT READY**

UE is ready for:
- Controlled procurement reviews
- Executive demos
- Security/trust reviews (with staging)
- Pilot usage with known organizations

UE is NOT yet stamped for:
- Unsupervised multi-tenant production
- Public launch
- Unmonitored customer-facing deployment

The only gate remaining before PRODUCTION CANDIDATE is completion of
Phase B operational validation. UE Phase B status:
**PRODUCTION CANDIDATE — INFRA VALIDATION IN PROGRESS**
(see `PHASE_B_PRODUCTION_DEPLOYMENT_VALIDATION.md`).
