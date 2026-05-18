# UnionEyes — Deployment Rehearsal (B2A)

This document records what is **observably true** about UE prod
deployments. No synthetic deploy was performed during this Phase B pass.

## Current revision

| Field | Value |
|---|---|
| Active revision | `nzila-os-union-eyes-prod--0000045` |
| Active | true |
| HealthState | Healthy |
| Traffic weight | 100 % |
| Replicas | 2 |
| Image | `nzilacanadaacr.azurecr.io/nzila-os-union-eyes:3c43cf1163081d2fbe3d25b2ea476d179a28488f` |
| Revisions mode | Single |

## Pipeline truth

- Build / push / deploy is governed by the GitOps manifest at
  `infrastructure/gitops/environments/production.yml`.
- Container image tag is the git commit SHA — verifiable here as
  `4697daeee1d9a3e4393350159207429a5eb9044b`.
- ACR (`nzilacanadaacr`) lives in `nzila-canada-staging-rg` and is
  shared with the staging deploy pipeline. Cross-RG, single-region.

## Health-gated behaviour (B2B)

Container Apps will only promote a new revision to 100 % traffic when
the readiness probe succeeds. UE's readiness probe is
`/api/health` (HTTP 200 = ok). Live capture against revision
`--0000041` returned HTTP 200 with `status:"degraded"`. Because the
health contract returns 200 whenever no critical dep is failing, the
deploy gate is satisfied as long as DB + auth are healthy.

Truthful caveat: a degraded non-critical dep (e.g. backend Django) will
**not** block promotion under the current contract. That is the
designed behaviour; if a stricter gate is needed, it should be
implemented in the deployment workflow, not the health contract.

## Smoke after deploy (captured)

See `PHASE_B_PRODUCTION_DEPLOYMENT_VALIDATION.md` §Smoke. Notable:

- `/api/health` → 200 (degraded, honest)
- `/api/metrics/operational` → **500 — FIXED** (commit `3c43cf116`; now returns 401 for unauthenticated requests)
- `/api/governance/telemetry` → 401 (auth-gated, expected)
- `/api/evidence/export` → 401 (auth-gated, expected)

## Deploy cycle — `3c43cf116` (metrics fix)

| Event | Value |
|---|---|
| Trigger | `git push` to `main` at `2026-05-17T18:29:50Z` |
| Pipeline | `GitOps Deploy` run `25999144816` |
| Plan Deployment job | ✅ success |
| Pre-Deploy Validation | in-progress (typecheck + lint + tests + migration safety) |
| Image tag | `3c43cf1163081d2fbe3d25b2ea476d179a28488f` |
| New revision created | `--0000043` at `2026-05-17T18:38:32Z` |
| Deploy time (push → revision healthy) | ~9 minutes |

## Rollback drill — `2026-05-17T18:45:00Z`

Full drill documented in [`ROLLBACK_VALIDATION.md`](./ROLLBACK_VALIDATION.md).
Summary:
- Created drill revision `--0000044` (benign env var change, same image)
- Rolled back to `--0000043` via mode switch + traffic set
- Rollback duration: **23 seconds** (activate → smoke pass)
- Post-rollback smoke: `/api/health` 200, `/api/metrics/operational` 401 ✅
- Cleaned up: removed drill marker → clean revision `--0000045` now active

## Post-deploy smoke — `--0000045` (current active)

| Endpoint | HTTP | Notes |
|---|---|---|
| `/api/health` | 200 | `ok:true`, `status:degraded`, DB ok (114ms), auth ok |
| `/api/health/liveness` | 200 | ✅ |
| `/api/metrics/operational` | **401** | ✅ Fixed — was 500, now correctly auth-gated |
| `/api/governance/telemetry` | 401 | Auth-gated as designed |
| `/api/evidence/export` | 401 | Auth-gated as designed |

## Gaps before this is "validated"

1. ~~Fix the `/api/metrics/operational` 500 and re-capture smoke.~~ **DONE** ✅
2. ~~Capture a full deploy → smoke → revision-promotion cycle.~~ **DONE** ✅ (`3c43cf116` → `--0000043` → `--0000045`)
3. Run an explicit failed-deploy drill (e.g. push an image whose
   `/api/health` 503s and confirm promotion is blocked). Status: **deferred**.
