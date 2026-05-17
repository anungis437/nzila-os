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
| Active revision | `nzila-os-union-eyes-prod--0000041` (Healthy, 100% traffic, 2 replicas) |
| Image | `nzilacanadaacr.azurecr.io/nzila-os-union-eyes:4697daeee1d9a3e4393350159207429a5eb9044b` |
| Min / max replicas | 2 / 6 |
| Revisions mode | Single |

## Phase B Sub-Phase Status

| # | Sub-phase | Status | Evidence |
|---|---|---|---|
| B1A | Infra inventory | configured | [`PRODUCTION_INFRA_INVENTORY.md`](./PRODUCTION_INFRA_INVENTORY.md) |
| B1B | Secret management | configured | [`SECRET_MANAGEMENT_VALIDATION.md`](./SECRET_MANAGEMENT_VALIDATION.md) |
| B1C | DNS / SSL | configured (default ACA FQDN only) | This doc, §DNS |
| B2A | Deployment rehearsal | observed (current revision only) | [`DEPLOYMENT_REHEARSAL.md`](./DEPLOYMENT_REHEARSAL.md) |
| B2B | Health-gated deploy | configured | health probe live |
| B2C | Rollback validation | **deferred** (procedure documented, not executed) | [`ROLLBACK_VALIDATION.md`](./ROLLBACK_VALIDATION.md) |
| B3A | Production smoke | partial — 1 failing endpoint | This doc, §Smoke |
| B3B | Governance runtime proof | **deferred** (endpoints 401-gated; awaiting authenticated drill) | — |
| B3C | Observability validation | configured | [`OBSERVABILITY_VALIDATION.md`](./OBSERVABILITY_VALIDATION.md) |
| B4A | Dependency degradation | partially observed (Django backend currently degraded) | §Smoke |
| B4B | Evidence integrity under failure | **deferred** | — |
| B4C | Incident drill | **deferred** (Django-down observation captured as informal drill) | [`INCIDENT_DRILL_REPORT.md`](./INCIDENT_DRILL_REPORT.md) |
| B5A | Backup verification | configured | [`BACKUP_RESTORE_VALIDATION.md`](./BACKUP_RESTORE_VALIDATION.md) |
| B5B | Restore rehearsal | **deferred** (PITR procedure documented, not executed) | same |
| B6A | Runtime observation window | not started | [`PILOT_RUNTIME_REVIEW.md`](./PILOT_RUNTIME_REVIEW.md) |
| B6B | Operational review cadence | not started | same |
| B7  | Procurement / trust finalization | not started | — |
| B8  | Final validation | partial (CI suite green; live infra checks captured) | this doc |

Status legend:
- `planned` — committed in IaC/docs, no live resource yet
- `configured` — live resource exists and is in expected steady state
- `validated` — operational behavior has been demonstrated end-to-end
- `deferred` — explicitly skipped, must be executed before any
  PRODUCTION READY claim

## Smoke (B3A) — captured against live FQDN

Run timestamp: revision `--0000041`, post Phase A completion.

| Endpoint | HTTP | Notes |
|---|---|---|
| `/api/health` | 200 | `ok:true`, `status:"degraded"`, DB ok (163 ms), auth ok, redis "not configured — optional for this deployment", backend (Django) `degraded: unreachable` |
| `/api/metrics/operational` | **500** | **Real production defect** — captured during this validation pass. Tracked as a Phase B follow-up; do not gate Phase A on it but block PRODUCTION READY label until fixed. |
| `/api/governance/telemetry` | 401 | Auth-gated as designed |
| `/api/evidence/export` | 401 | Auth-gated as designed |

Truthful interpretation:
- Health contract works (HTTP 200 with `status:"degraded"` is the
  honest signal we designed for).
- Two critical deps (DB, auth) green; two non-critical deps (redis
  not configured, backend Django unreachable) honestly reported.
- Authenticated governance/evidence drills are still required for B3B/B4B.

## DNS / SSL (B1C)

- Only the platform-issued ACA FQDN
  (`*.bluesand-c3ac2d8c.canadacentral.azurecontainerapps.io`) is live.
- Azure Container Apps provides TLS termination on this FQDN by default.
- **Gap:** no custom domain / managed certificate / HSTS / WAF policy
  bound to UE prod yet. Status: `configured (default)`, not `validated`.

## Open Phase B Gaps (block PRODUCTION READY)

1. `/api/metrics/operational` returns HTTP 500 under unauthenticated GET.
2. Django backend dependency reachable from staging but unreachable from
   prod — confirm whether prod is intended to run backend-less or fix
   networking.
3. No Azure-managed Redis or prod Storage Account in
   `nzila-canada-prod-rg`. Upstash is referenced via env vars but not
   verified live. Evidence/blob storage residency must be confirmed.
4. Container image is pulled from `nzilacanadaacr` which lives in
   `nzila-canada-staging-rg`. Cross-RG dependency is workable but should
   be documented for incident scope.
5. Custom domain + WAF + HSTS not bound to UE prod.
6. Rollback, restore, and incident drills documented but **not executed**.
7. Runtime observation window (B6) not started.

## Decision

Readiness label remains **CONTROLLED PILOT READY** — see
[`FINAL_READINESS_STATUS.md`](./FINAL_READINESS_STATUS.md). Phase B is
recorded as `PRODUCTION CANDIDATE — INFRA VALIDATION IN PROGRESS`.
