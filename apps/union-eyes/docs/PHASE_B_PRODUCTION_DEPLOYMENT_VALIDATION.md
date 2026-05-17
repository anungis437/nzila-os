# UnionEyes — Phase B Production Deployment Validation

> Status: **IN PROGRESS** — live runtime evidence captured against
> `nzila-os-union-eyes-prod` in `nzila-canada-prod-rg`
> (Canada Central, subscription `5d819f33-d16f-429c-a3c0-5b0e94740ba3`).
>
> Prefer truthful amber over false green. No claim in this document is
> upgraded to `validated` without runtime proof in the linked evidence file.

## Phase A Carry-In

Phase A is complete and verified — see
[`PHASE_A_PRODUCTION_INFRA_VALIDATION.md`](./PHASE_A_PRODUCTION_INFRA_VALIDATION.md)
and [`AUTH_REALITY_AUDIT.md`](./AUTH_REALITY_AUDIT.md). Auth stack is PG
session primary + Entra External ID secondary; legacy auth vendor fully
removed (see audit for history).

## Live Production Target

| Attribute | Value |
|---|---|
| Container App | `nzila-os-union-eyes-prod` |
| Resource group | `nzila-canada-prod-rg` |
| Region | Canada Central |
| FQDN | `nzila-os-union-eyes-prod.bluesand-c3ac2d8c.canadacentral.azurecontainerapps.io` |
| Active revision | `nzila-os-union-eyes-prod--0000062` (Healthy, 100% traffic, 2 replicas) |
| Image | `nzilacanadaacr.azurecr.io/nzila-os-union-eyes:3c43cf1163081d2fbe3d25b2ea476d179a28488f` |
| Min / max replicas | 2 / 6 |
| Revisions mode | Single |

## Phase B Sub-Phase Status

| # | Sub-phase | Status | Evidence |
|---|---|---|---|
| B1A | Infra inventory | **validated** | Redis (Upstash), DB (PG16 ZR-HA), KV, LAW all live in canadacentral; [`PRODUCTION_INFRA_INVENTORY.md`](./PRODUCTION_INFRA_INVENTORY.md) |
| B1B | Secret management | **validated** | All secrets in ACA secretRefs; Redis token stored as ACA secret (`upstash-redis-url/token`); Key Vault RBAC enforced; rotation policy documented; [`SECRET_MANAGEMENT_VALIDATION.md`](./SECRET_MANAGEMENT_VALIDATION.md) |
| B1C | DNS / SSL | **validated** (custom domain + HSTS) + **configured** (AFD + WAF) | `app.unioneyes.app` bound to ACA with managed cert (SniEnabled); 2-year HSTS with preload + full security header suite live `2026-05-17T20:00:00Z`. AFD Standard `nzila-ue-afd-prod` + WAF `nzilauewafdprod` (Prevention mode, 2 custom rules) provisioned; security policy linked (`Succeeded`). DNS CNAME for `app.unioneyes.app` → AFD hostname pending registrar update (requires human action). |
| B2A | Deployment rehearsal | **validated** | deploy `3c43cf116` → `--0000043` → `--0000045` captured with timings; [`DEPLOYMENT_REHEARSAL.md`](./DEPLOYMENT_REHEARSAL.md) |
| B2B | Health-gated deploy | configured | health probe live, `--0000043` promoted in ~9 min |
| B2C | Rollback validation | **validated** | drill executed `2026-05-17T18:45:00Z`, 23s duration, smoke passed; [`ROLLBACK_VALIDATION.md`](./ROLLBACK_VALIDATION.md) |
| B3A | Production smoke | **validated** | Revision `--0000049`; `/api/health` → `redis:{status:"ok",ms:37}` (Redis live ✅); `database:{status:"ok",ms:87}`; `auth:{status:"ok"}`; `/api/metrics/operational` 401 ✅ |
| B3B | Governance runtime proof | **deferred** (endpoints 401-gated; awaiting authenticated drill) | — |
| B3C | Observability validation | **validated** | LAW environment binding validated; 3 KQL alert rules; action group `ue-prod-ops-alerts` attached to all 3 rules (`2026-05-17`); LAW ingesting 400+ events/hr; [`OBSERVABILITY_VALIDATION.md`](./OBSERVABILITY_VALIDATION.md) |
| B4A | Dependency degradation | **validated** (Django backend non-critical degraded observed live + fast-fail deploy drill) | §Smoke, [`INCIDENT_DRILL_REPORT.md`](./INCIDENT_DRILL_REPORT.md) |
| B4B | Evidence integrity under failure | **deferred** | — |
| B4C | Incident drill | **validated** — Drill 1 (failed deploy fast-fail) `2026-05-17T19:18:22Z`; Drill 2 (backend degraded) observed live; 3 drills deferred (maintenance window) | [`INCIDENT_DRILL_REPORT.md`](./INCIDENT_DRILL_REPORT.md) |
| B5A | Backup verification | **validated** | 30-day PITR, geo-redundant, earliest restore `2026-05-11`, confirmed live `2026-05-17`; [`BACKUP_RESTORE_VALIDATION.md`](./BACKUP_RESTORE_VALIDATION.md) |
| B5B | Restore rehearsal | **validated** (PITR mechanism proven; row-level integrity deferred) | drill `2026-05-17T18:52:09Z`, 4-min restore to Ready, smoke passed, drill server deleted; [`BACKUP_RESTORE_VALIDATION.md`](./BACKUP_RESTORE_VALIDATION.md) |
| B6A | Runtime observation window | **open** `2026-05-17T18:34:00Z` | [`PILOT_RUNTIME_REVIEW.md`](./PILOT_RUNTIME_REVIEW.md) |
| B6B | Operational review cadence | **started** — week 1 baseline captured | same |
| B7  | Procurement / trust finalization | **validated** | B7A: `FINAL_READINESS_STATUS.md` → PRODUCTION CANDIDATE; B7B: `ue-procurement-pack-cupe.md` updated with Phase B operational evidence; legacy auth vendor refs removed from all buyer-facing docs — commit `b335ae2e8` |
| B8  | Final validation | **validated** | typecheck ✅, lint 0 errors ✅, 7075 UE tests ✅, 8962 contract tests ✅, governance 54/54 ✅, platform contract 0 errors ✅, app lifecycle 0 errors ✅ — `2026-05-17T19:24Z` |

Status legend:
- `planned` — committed in IaC/docs, no live resource yet
- `configured` — live resource exists and is in expected steady state
- `validated` — operational behavior has been demonstrated end-to-end
- `deferred` — explicitly skipped, must be executed before any
  PRODUCTION READY claim

## Smoke (B3A) — updated capture, revision `--0000062`, `2026-05-17T20:55:00Z`

| Endpoint | HTTP | Notes |
|---|---|---|
| `/api/health` | 200 | `ok:true`, `status:"degraded"`, `environment:"production"` ✅, DB ok (133 ms), auth ok, **redis ok (70 ms)** ✅, backend (Django) `degraded: unreachable` |
| `/api/health/liveness` | 200 | ✅ |
| `/api/metrics/operational` | **401** | ✅ auth-gated correctly |
| `/api/governance/telemetry` | 401 | Auth-gated as designed |
| `/api/evidence/export` | 401 | Auth-gated as designed |

Truthful interpretation:
- `environment:"production"` now correct — `NZILA_MODE=prod→production` fix deployed on `--0000056/0000057`.
- Redis live: Upstash `cuddly-mudfish-102231.upstash.io` wired `2026-05-17T19:08:00Z`.
- Lineage vars (`SECRET_TOPOLOGY`, `SECRET_AUTHORITY`, `ENVIRONMENT_ISOLATION`) set and validated.
- Three critical deps (DB, auth, Redis) green; overall `status:"degraded"` remains honest signal — Django backend unreachable (non-critical).
- Authenticated governance/evidence drills still required for B3B/B4B.

## DNS / SSL (B1C)

- **Custom domain** `app.unioneyes.app` bound to ACA with `SniEnabled` + Azure managed certificate.
- HSTS `max-age=63072000; includeSubDomains; preload` (2-year) active via Next.js application headers.
- Full security header suite live: CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff,
  Referrer-Policy, Permissions-Policy, COEP: credentialless, COOP: same-origin, CORP: same-origin.
- **Azure Front Door** `nzila-ue-afd-prod` (Standard_AzureFrontDoor, canadacentral):
  - Endpoint `ue-prod` → `ue-prod-a7cah9hhf9dycxcc.z02.azurefd.net`
  - Route: HTTP→HTTPS redirect, HTTPS-only forwarding, `/*`
  - Origin: ACA FQDN, health probe: `/api/health/liveness`
- **WAF** `nzilauewafdprod` (Standard, Prevention mode, 2 custom rules):
  - `RateLimitPerIP`: 300 req/min → Block
  - `BlockScanners`: `.env`, `wp-admin`, `phpinfo`, `/etc/passwd`, `xmlrpc` patterns → Block
  - Security policy `ue-prod-waf` linked to AFD endpoint (`Succeeded`)
- **Gap:** DNS CNAME for `app.unioneyes.app` currently points to ACA directly.
  Must update to `ue-prod-a7cah9hhf9dycxcc.z02.azurefd.net` at registrar to route through WAF.
  **Requires human action (registrar access).**
- **Note:** OWASP managed rule sets require Premium_AzureFrontDoor (currently Standard) — deferred.

Status: `validated` (custom domain + HSTS), `configured` (AFD + WAF), DNS routing **pending**.

## Open Phase B Gaps (block PRODUCTION READY)

1. ~~`/api/metrics/operational` returns HTTP 500~~ — **FIXED** `3c43cf116`, confirmed 401 on `--0000045`.
2. Django backend unreachable from prod — non-critical by health contract design; networking investigation deferred.
3. ~~No Azure-managed Redis~~ — **DONE** Upstash `cuddly-mudfish-102231.upstash.io` wired on `--0000049`; health confirms `redis:{status:"ok"}`. ~~Remaining gap: migrate token from ACA secret to Key Vault (blocked on RBAC)~~ → **UNBLOCKED** `Key Vault Secrets Officer` granted to ACA MI `264f8347` `2026-05-17T20:45:00Z`. Migrate before PRODUCTION READY.
4. ~~No prod blob/Storage Account in `nzila-canada-prod-rg`~~ — **DONE** `nzilacanadaprodev` (GRS, deny-all) created `2026-05-17T20:30:00Z`; `union-eyes-evidence` container configured; wired on `--0000062`. Remaining gap: migrate storage key from ACA secret to Key Vault (same KV RBAC path as above).
5. Container image pulled from `nzilacanadaacr` in `nzila-canada-staging-rg`. Cross-RG dependency documented; no current incident scope issue.
6. ~~Custom domain + WAF + HSTS not bound to UE prod~~ — **DONE** `app.unioneyes.app` validated (custom domain + managed cert + 2-year HSTS). WAF provisioned + linked. DNS routing through AFD pending registrar CNAME update (human action required).
7. ~~Rollback drill not executed~~ — **DONE** `2026-05-17T18:45:00Z`, 23s.
8. ~~PITR restore not executed~~ — **DONE** `2026-05-17T18:52:09Z`, 4 min to Ready.
9. ~~Alert action groups missing~~ — **DONE** `ue-prod-ops-alerts` wired to all 3 rules.
10. ~~Incident drill (B4C) not executed~~ — **DONE** Failed-deploy drill `2026-05-17T19:18:22Z`: ACA fast-failed on unknown image, prod unaffected; [`INCIDENT_DRILL_REPORT.md`](./INCIDENT_DRILL_REPORT.md).
11. Governance runtime proof (B3B) and evidence integrity under failure (B4B) — pending authenticated drills.
12. Alert fire drill — alerts wired; not yet fired/acknowledged in production (deferred to maintenance window).
13. Expired-secret, DB-timeout, telemetry-outage drills — deferred (require maintenance window).
14. Runtime observation window (B6) — **open** `2026-05-17T18:34:00Z`, 1-week minimum.

## Decision

Readiness label advanced to **PRODUCTION CANDIDATE** — see
[`FINAL_READINESS_STATUS.md`](./FINAL_READINESS_STATUS.md).

Phase B operational validation substantially complete. Remaining deferred items (alert fire drill, governance authenticated drill, KV RBAC migration, observation window) do not block PRODUCTION CANDIDATE but block PRODUCTION READY.
