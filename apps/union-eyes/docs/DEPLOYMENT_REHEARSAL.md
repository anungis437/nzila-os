# UnionEyes — Deployment Rehearsal (B2A)

This document records what is **observably true** about UE prod
deployments. No synthetic deploy was performed during this Phase B pass.

## Current revision

| Field | Value |
|---|---|
| Active revision | `nzila-os-union-eyes-prod--0000041` |
| Active | true |
| HealthState | Healthy |
| Traffic weight | 100 % |
| Replicas | 2 |
| Image | `nzilacanadaacr.azurecr.io/nzila-os-union-eyes:4697daeee1d9a3e4393350159207429a5eb9044b` |
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
- `/api/metrics/operational` → **500** — real prod regression flagged
- `/api/governance/telemetry` → 401 (auth-gated, expected)
- `/api/evidence/export` → 401 (auth-gated, expected)

## Gaps before this is "validated"

1. Capture a full deploy → smoke → revision-promotion cycle with
   timestamps and durations.
2. Fix the `/api/metrics/operational` 500 and re-capture smoke.
3. Run an explicit failed-deploy drill (e.g. push an image whose
   `/api/health` 503s and confirm promotion is blocked).
