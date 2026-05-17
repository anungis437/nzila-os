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
| Active revision | `nzila-os-union-eyes-prod--0000049` (Healthy, 100% traffic, 2 replicas) |
| Image | `nzilacanadaacr.azurecr.io/nzila-os-union-eyes:3c43cf1163081d2fbe3d25b2ea476d179a28488f` |
| Min / max replicas | 2 / 6 |
| Revisions mode | Single |

## Phase B Sub-Phase Status

| # | Sub-phase | Status | Evidence |
|---|---|---|---|
| B1A | Infra inventory | configured | [`PRODUCTION_INFRA_INVENTORY.md`](./PRODUCTION_INFRA_INVENTORY.md) |
| B1B | Secret management | **validated** | All secrets in ACA secretRefs; Redis token stored as ACA secret; Key Vault RBAC enforced; rotation policy documented; [`SECRET_MANAGEMENT_VALIDATION.md`](./SECRET_MANAGEMENT_VALIDATION.md) |
| B1C | DNS / SSL | configured (default ACA FQDN only) | This doc, §DNS |
| B2A | Deployment rehearsal | **validated** | deploy `3c43cf116` → `--0000043` → `--0000045` captured with timings; [`DEPLOYMENT_REHEARSAL.md`](./DEPLOYMENT_REHEARSAL.md) |
| B2B | Health-gated deploy | configured | health probe live, `--0000043` promoted in ~9 min |
| B2C | Rollback validation | **validated** | drill executed `2026-05-17T18:45:00Z`, 23s duration, smoke passed; [`ROLLBACK_VALIDATION.md`](./ROLLBACK_VALIDATION.md) |
| B3A | Production smoke | **validated** | Revision `--0000049`; `/api/health` → `redis:{status:"ok",ms:84}` (Redis live); `/api/metrics/operational` 401 ✅; all endpoints correct |
| B3B | Governance runtime proof | **deferred** (endpoints 401-gated; awaiting authenticated drill) | — |
| B3C | Observability validation | **validated** | LAW environment binding validated; 3 KQL alert rules; action group `ue-prod-ops-alerts` attached to all 3 rules (`2026-05-17`); LAW ingesting 400+ events/hr; [`OBSERVABILITY_VALIDATION.md`](./OBSERVABILITY_VALIDATION.md) |
| B4A | Dependency degradation | partially observed (Django backend currently degraded, non-critical) | §Smoke |
| B4B | Evidence integrity under failure | **deferred** | — |
| B4C | Incident drill | **deferred** (Django-down observation captured as informal drill) | [`INCIDENT_DRILL_REPORT.md`](./INCIDENT_DRILL_REPORT.md) |
| B5A | Backup verification | **validated** | 30-day PITR, geo-redundant, earliest restore `2026-05-11`, confirmed live `2026-05-17`; [`BACKUP_RESTORE_VALIDATION.md`](./BACKUP_RESTORE_VALIDATION.md) |
| B5B | Restore rehearsal | **validated** (PITR mechanism proven; row-level integrity deferred) | drill `2026-05-17T18:52:09Z`, 4-min restore to Ready, smoke passed, drill server deleted; [`BACKUP_RESTORE_VALIDATION.md`](./BACKUP_RESTORE_VALIDATION.md) |
| B6A | Runtime observation window | **open** `2026-05-17T18:34:00Z` | [`PILOT_RUNTIME_REVIEW.md`](./PILOT_RUNTIME_REVIEW.md) |
| B6B | Operational review cadence | **started** — week 1 baseline captured | same |
| B7  | Procurement / trust finalization | not started | — |
| B8  | Final validation | partial (CI suite green; live infra checks captured; rollback validated; alerts configured) | this doc |

Status legend:
- `planned` — committed in IaC/docs, no live resource yet
- `configured` — live resource exists and is in expected steady state
- `validated` — operational behavior has been demonstrated end-to-end
- `deferred` — explicitly skipped, must be executed before any
  PRODUCTION READY claim

## Smoke (B3A) — updated capture, revision `--0000049`, `2026-05-17T19:10:40Z`

| Endpoint | HTTP | Notes |
|---|---|---|
| `/api/health` | 200 | `ok:true`, `status:"degraded"`, DB ok (147 ms), auth ok, **redis ok (84 ms)** ✅, backend (Django) `degraded: unreachable` |
| `/api/health/liveness` | 200 | ✅ |
| `/api/metrics/operational` | **401** | ✅ auth-gated correctly |
| `/api/governance/telemetry` | 401 | Auth-gated as designed |
| `/api/evidence/export` | 401 | Auth-gated as designed |

Truthful interpretation:
- Redis now live: Upstash `cuddly-mudfish-102231.upstash.io` wired `2026-05-17T19:08:00Z` on revision `--0000049`.
- Three critical deps (DB, auth, Redis) green.
- One non-critical dep (Django backend unreachable) honestly reported.
- Authenticated governance/evidence drills still required for B3B/B4B.

## DNS / SSL (B1C)

- Only the platform-issued ACA FQDN
  (`*.bluesand-c3ac2d8c.canadacentral.azurecontainerapps.io`) is live.
- Azure Container Apps provides TLS termination on this FQDN by default.
- **Gap:** no custom domain / managed certificate / HSTS / WAF policy
  bound to UE prod yet. Status: `configured (default)`, not `validated`.

## Open Phase B Gaps (block PRODUCTION READY)

1. ~~`/api/metrics/operational` returns HTTP 500~~ — **FIXED** `3c43cf116`, confirmed 401 on `--0000045`.
2. Django backend unreachable from prod — non-critical by health contract design; networking investigation deferred.
3. ~~No Azure-managed Redis~~ — **DONE** Upstash `cuddly-mudfish-102231.upstash.io` wired on `--0000049`; health confirms `redis:{status:"ok"}`. Token should be migrated to Key Vault before PRODUCTION READY.
4. No prod blob/Storage Account in `nzila-canada-prod-rg`. Evidence persistence is currently DB-only.
5. Container image pulled from `nzilacanadaacr` in `nzila-canada-staging-rg`. Cross-RG dependency documented; no current incident scope issue.
6. Custom domain + WAF + HSTS not bound to UE prod.
7. ~~Rollback drill not executed~~ — **DONE** `2026-05-17T18:45:00Z`, 23s.
8. ~~PITR restore not executed~~ — **DONE** `2026-05-17T18:52:09Z`, 4 min to Ready.
9. ~~Alert action groups missing~~ — **DONE** `ue-prod-ops-alerts` wired to all 3 rules.
10. Governance runtime proof (B3B) and evidence integrity under failure (B4B) — pending authenticated drills.
11. Formal incident drills (B4C) — expired secret + failed deploy.
12. Alert fire drill — alerts wired; not yet fired/acknowledged in production.
13. Runtime observation window (B6) — **open** `2026-05-17T18:34:00Z`, 1-week minimum.

## Decision

Readiness label remains **CONTROLLED PILOT READY** — see
[`FINAL_READINESS_STATUS.md`](./FINAL_READINESS_STATUS.md). Phase B is
recorded as `PRODUCTION CANDIDATE — INFRA VALIDATION IN PROGRESS`.
