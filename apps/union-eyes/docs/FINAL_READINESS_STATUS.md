# UnionEyes — Final Readiness Status

> **Honest readiness label, not marketing language.**

## TL;DR

UnionEyes is **PRODUCTION CANDIDATE** — live production infrastructure validated, operational drills executed, B8 suite green, all 3 secrets migrated to Key Vault. It is **NOT YET** stamped for unsupervised public multi-tenant use. Remaining gates: Cloudflare DNS routing through AFD/WAF, governance authenticated drill, 1-week observation window.

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
| Custom domain + HSTS | ✅ Validated | `app.unioneyes.app` bound (SniEnabled + managed cert); 2-year HSTS with preload; full security header suite live |
| Dedicated evidence blob store | ✅ Configured | `nzilacanadaprodev` (GRS, deny-all network, private container) wired on `--0000062` |
| Key Vault RBAC for ACA managed identity | ✅ Granted | `Key Vault Secrets Officer` → MI `264f8347`, `2026-05-17T20:45:00Z` |
| WAF (Azure Front Door) | ✅ Configured | `nzilauewafdprod` Prevention mode, 2 custom rules; security policy linked to AFD endpoint (`Succeeded`) |
| HTTP autoscaling | ✅ Configured | KEDA HTTP concurrency=10, min 2 / max 6, active on `--0000062` |
| IaC parity | ✅ Updated | `infra/environments/union-eyes-env.bicep` (evidence store, autoscaling, secrets) + `infra/waf-afd/waf-afd.bicep` (AFD+WAF) |
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
| Formal incident drill (B4C) | ✅ Failed-deploy drill executed `2026-05-17T19:18:22Z` — ACA fast-fail on unknown image, 0 prod impact, 82s total; see `INCIDENT_DRILL_REPORT.md` |
| B8 validation suite | ✅ Full suite green `2026-05-17T19:24Z` — 7075 UE tests, 8962 contract tests, governance 54/54, platform contract 0 errors |
| No dedicated prod blob/storage | ✅ `nzilacanadaprodev` created `2026-05-17T20:30:00Z` — GRS, canadacentral, deny-all network, `union-eyes-evidence` container; wired on `--0000062` |
| Custom domain / WAF / HSTS not bound | ✅ `app.unioneyes.app` validated (SniEnabled, managed cert, 2-year HSTS with preload). WAF `nzilauewafdprod` (Prevention, 2 custom rules) + AFD `nzila-ue-afd-prod` provisioned; security policy linked; DNS routing pending registrar update |
| Key Vault RBAC grant blocked | ✅ `Key Vault Secrets Officer` granted to ACA MI `264f8347` `2026-05-17T20:45:00Z` — KV migration path unblocked |
| No HTTP autoscaling | ✅ KEDA HTTP rule (concurrency 10) added, active on `--0000062` |
| IaC parity | ✅ `union-eyes-env.bicep` updated (evidence store, autoscaling, secrets); `waf-afd/waf-afd.bicep` created |
| Upstash token + evidence key not in KV | ✅ **Migrated `2026-05-18`** — all 3 secrets (`upstash-redis-url`, `upstash-redis-token`, `evidence-storage-key`) now KV-backed ACA secretRefs (versioned URI). `SECRET_TOPOLOGY=aca-kv-integrated` on `--0000064`. |
| AFD/WAF diagnostic logs not in LAW | ✅ **Enabled `2026-05-18`** — `ue-afd-diag` diagnostic settings on AFD profile: `FrontDoorAccessLog` + `FrontDoorWebApplicationFirewallLog` + `FrontDoorHealthProbeLog` → `nzila-canada-prod-law`. |

## What remains amber

- Production deployment topology — live Azure infrastructure validated in
  `nzila-canada-prod-rg` (Container App `nzila-os-union-eyes-prod` on
  revision `--0000064`, Postgres flex v16 with ZR-HA + geo backups,
  Redis Upstash live (KV-backed), Key Vault `nzila-canada-prod-kv`,
  Log Analytics `nzila-canada-prod-law`, evidence blob store `nzilacanadaprodev`
  (KV-backed), AFD + WAF configured + diag logs to LAW). Phase B operational
  validation substantially complete. See `PHASE_B_PRODUCTION_DEPLOYMENT_VALIDATION.md`.
- Remaining gaps before PRODUCTION READY stamp:
  - Django backend dependency reports `degraded: unreachable` from
    prod (honest amber via health contract — non-critical by design).
  - **AFD DNS routing**: `app.unioneyes.app` CNAME must be updated to
    `ue-prod-a7cah9hhf9dycxcc.z02.azurefd.net` in Cloudflare. AFD custom
    domain added (`Succeeded`). Validation TXT `_dnsauth.app.unioneyes.app
    = _q1en0zg4c8s9sockra3ayi3esqr7jw1` must be added + CNAME updated.
    Until done, WAF is provisioned but not in live traffic path.
  - Row-level DB integrity drill deferred (private endpoint / jump-host required for direct psql access).
  - Governance runtime proof (B3B) and evidence integrity under failure (B4B) pending authenticated drills.
  - Alert fire drill deferred (alerts wired; confirmed via ARM REST; fire not yet observed).
  - Expired-secret, DB-timeout, telemetry-outage drills deferred (maintenance window required).
  - Pilot runtime observation window opened `2026-05-17T18:34:00Z`; 1-week minimum running.
- B8 validation suite: all checks green — governance 54/54 ✅, platform contract 0 errors ✅,
  app lifecycle 0 errors ✅, contract-tests 8962/8962 ✅, UE unit tests 7075/7075 ✅.

## Trust posture

We prefer **truthful amber** over false green. This file is the authoritative readiness statement; if marketing material disagrees, this file wins.

## Readiness label

**PRODUCTION CANDIDATE**

Operational evidence backing this label:
- ✅ Deployed to real Azure production infrastructure (Canada Central)
- ✅ Deploy rehearsal with health-gated promotion (`--0000043` → `--0000045` → `--0000049`)
- ✅ Rollback drill: 23s end-to-end, smoke passed
- ✅ PITR restore drill: 4 min to Ready, prod unaffected
- ✅ All 3 critical health deps green: `database:ok`, `auth:ok`, `redis:ok` (Redis KV-backed)
- ✅ All secrets (Upstash URL/token, evidence key) migrated to Key Vault (`SECRET_TOPOLOGY=aca-kv-integrated`)
- ✅ AFD + WAF diagnostic logs to LAW enabled (`ue-afd-diag`, 3 log categories)
- ✅ Observability: 3 KQL alert rules + action group wired to `ops@nzila.ca`
- ✅ Incident drill (failed deploy): ACA fast-fail, 0 prod impact
- ✅ B8 validation: 7075 UE tests + 8962 contract tests + governance 54/54

UE is ready for:
- Controlled procurement reviews
- Executive demos
- Security/trust reviews (with staging)
- Pilot usage with known organizations
- Limited production use under active monitoring

UE is NOT yet stamped for:
- Unsupervised multi-tenant production
- Public launch
- Unmonitored customer-facing deployment

Remaining gates before PRODUCTION READY:
1. ~~Key Vault migration for Upstash token~~ ✅ DONE — all 3 secrets KV-backed on `--0000064`
2. ~~Custom domain + WAF + HSTS~~ ✅ Domain + HSTS validated; WAF provisioned + diag logs to LAW; DNS routing through AFD pending Cloudflare update
3. Cloudflare DNS: update `app.unioneyes.app` CNAME → `ue-prod-a7cah9hhf9dycxcc.z02.azurefd.net` (grey cloud / DNS-only) + add TXT `_dnsauth.app.unioneyes.app = _q1en0zg4c8s9sockra3ayi3esqr7jw1`
4. Governance runtime proof (authenticated drill)
5. Alert fire drill confirmation
6. 1-week minimum pilot observation window (opened `2026-05-17T18:34:00Z`)
