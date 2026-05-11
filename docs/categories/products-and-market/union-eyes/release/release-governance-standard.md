# Union Eyes — Release Governance Standard (Phase A)

**Status:** binding standard for all Union Eyes deployments after Phase A closure.
**Owner:** platform-ops + union-eyes engineering.
**Effective date:** 2026-05-09.

This document defines the non-negotiable rules for what a "release" of Union Eyes looks like, what artifacts it must produce, and what gates must pass before each environment receives traffic.

---

## 1. Environment matrix

| Env        | Purpose                              | Branch trigger | Approval required | Public hostname               | Container App                  | Database              | Key Vault          |
| ---------- | ------------------------------------ | -------------- | ----------------- | ----------------------------- | ------------------------------ | --------------------- | ------------------ |
| local      | developer machine                    | n/a            | n/a               | `http://localhost:3000`        | n/a                            | local PG `localhost:5433` | n/a              |
| dev        | shared integration                    | `develop`      | none              | n/a (private)                  | optional                       | per-developer or shared | optional         |
| staging    | pre-prod validation, contract tests  | manual / `develop` | none          | `staging-app.unioneyes.app`    | `nzila-os-union-eyes-staging`  | `nzila_os_staging`    | `nzila-staging-kv` |
| demo       | CLC convention + procurement demos    | manual         | one reviewer      | `demo.unioneyes.app`           | `nzila-os-union-eyes-demo`     | `nzila_os_demo`       | `nzila-demo-kv`    |
| pilot      | live pilot organizations              | manual         | one reviewer      | `pilot.unioneyes.app`          | `nzila-os-union-eyes-pilot`    | `nzila_os_pilot`      | `nzila-pilot-kv`   |
| production | real production for paying customers  | manual + tag   | **two reviewers** | `app.unioneyes.app`            | `nzila-os-union-eyes-prod`     | `nzila_os_prod`       | `nzila-prod-kv`    |

No environment may share an ACA, DB, or KV with another environment.

---

## 2. Canonical environment variables (set at deploy time)

Every release MUST set the following on its target Container App:

| Variable               | Source                                  | Example                              |
| ---------------------- | --------------------------------------- | ------------------------------------ |
| `NODE_ENV`             | constant                                | `production`                         |
| `UE_ENVIRONMENT`       | plan step                               | `staging` \| `demo` \| `pilot` \| `production` |
| `NEXT_PUBLIC_APP_ENV`  | mirror of `UE_ENVIRONMENT`              | `production`                         |
| `NZILA_MODE`           | plan step                               | `staging` \| `demo` \| `pilot` \| `prod` |
| `UE_DEPLOYMENT_TYPE`   | plan step                               | `staging` \| `clc-demo` \| `pilot` \| `prod` |
| `UE_FEATURE_PROFILE`   | plan step                               | `internal` \| `clc` \| `executive`   |
| `GITHUB_SHA`           | `${{ github.sha }}`                     | 40-char SHA                          |
| `RELEASE_ID`           | plan step (`UE-YYYY-MM-DD-shortsha`)    | `UE-2026-05-09-df936f4`              |
| `BUILD_TIME`           | plan step (`date -u +%Y-%m-%dT%H:%M:%SZ`) | ISO 8601 UTC                       |
| `BUILD_TIMESTAMP`      | mirror of `BUILD_TIME` (consumer compat) | ISO 8601 UTC                        |
| `ARTIFACT_ID`          | mirror of `GITHUB_SHA`                  | 40-char SHA                          |
| `AUTH_URL`             | per-env public app URL                  | `https://app.unioneyes.app`          |
| `NEXT_PUBLIC_SITE_URL` | per-env marketing URL                   | `https://unioneyes.app`              |
| `NEXT_PUBLIC_APP_URL`  | per-env app URL                         | `https://app.unioneyes.app`          |
| `PGHOST`               | per-env PG FQDN                         |                                      |
| `PGDATABASE`           | per-env DB name (`nzila_os_<env>`)      |                                      |
| `PGSSLMODE`            | constant                                | `require`                            |

A deploy that omits any of `RELEASE_ID`, `GITHUB_SHA`, `BUILD_TIME`, `UE_ENVIRONMENT`, `NZILA_MODE` is **invalid**.

The legacy malformed pattern `NODE_ENV="production NEXT_PUBLIC_APP_ENV=staging"` is **forbidden**. The canonical helper [`apps/union-eyes/lib/runtime/environment.ts`](../../../apps/union-eyes/lib/runtime/environment.ts) tolerates it for runtime read but no deploy may produce it.

---

## 3. /api/health response contract

Every environment's `/api/health` MUST return:

```json
{
  "status": "ok" | "degraded",
  "app": "union-eyes",
  "environment": "<UE_ENVIRONMENT>",
  "gitSha": "<40-char SHA>",
  "buildTimestamp": "<ISO 8601 UTC>",
  "artifactId": "<40-char SHA>",
  "releaseId": "UE-YYYY-MM-DD-shortsha",
  "appVersion": "<package version>",
  "timestamp": "<now ISO 8601 UTC>",
  "checks": { "process": "ok", "database": "ok" }
}
```

A response that contains any of `gitSha:"local"`, `releaseId:"unknown"`, `buildTimestamp:"unknown"`, or whose `environment` does not match the host the request came from is a **release defect** and blocks traffic cutover.

---

## 4. Deployment pipeline rules

1. **Per-env target inferred from `plan` step.** No deploy step hardcodes an ACA name; all targets come from `needs.plan.outputs.app_name`.
2. **`production` deploys are gated** by GitHub Environment protection (two reviewers, change-window check, contract tests pass, SLO gate pass, release-attestation generated).
3. **Auto-creation of missing ACAs is forbidden in production** ([`apps/union-eyes/.github/workflows/deploy-union-eyes.yml`](../../../.github/workflows/deploy-union-eyes.yml) — non-prod envs may auto-create from Bicep).
4. **No deploy may set `NZILA_MODE=pilot` or `NZILA_MODE=demo` on the production ACA.** The `plan` step enforces this via the env matrix.

---

## 5. Database & seed rules

1. Each environment MUST have its own Postgres database. No cross-env writes.
2. All seed/reset scripts MUST call `assertNotProduction(scriptName)` from [`apps/union-eyes/lib/runtime/production-guard.ts`](../../../apps/union-eyes/lib/runtime/production-guard.ts) at module-load. Bypass requires `ALLOW_PRODUCTION_SEED=1`, which is never set in CI or any deployed container.
3. Migrations run via the backend container's startup CMD against the env's own `PGHOST`/`PGDATABASE`. CI MUST refuse to deploy if `db:migrate --dry-run` reports pending migrations against the target env.

---

## 6. Release artifacts (must be produced by every deploy)

| Artifact                        | Producer                                                | Retention |
| ------------------------------- | ------------------------------------------------------- | --------- |
| `release-attestation.json`      | `scripts/release-attestation.ts` (CI step)              | 365 days  |
| `slo-summary.txt`               | `scripts/slo-gate.ts`                                   | 90 days   |
| Container image tag             | `${IMAGE}:${{ github.sha }}` and `${IMAGE}:<env>`        | indefinite|
| Container revision label        | env vars `GITHUB_SHA`, `RELEASE_ID`, `BUILD_TIME`        | live in revision |
| Health response (proof of live) | hit `/api/health` post-deploy and archive               | 90 days   |

---

## 7. Rollback rules

1. Every `RELEASE_ID` must map to a single ACR image tag (`${IMAGE}:${{ github.sha }}`).
2. To roll back: `az containerapp update --name <env-app> --resource-group <env-rg> --image <IMAGE>:<previous-sha>` and refresh `RELEASE_ID`/`GITHUB_SHA`/`BUILD_TIME` env vars to the rollback target.
3. Rollback in `production` requires the same two-reviewer approval as forward deploys.
4. Rollback is forbidden across schema-incompatible migrations; consult `schema-parity-report.md` and the migration directory's compatibility matrix first.

---

## 8. Environment protection rules (GitHub side)

- `production` GitHub Environment: protected, required reviewers ≥ 2, restricted to `main`.
- `pilot` GitHub Environment: protected, required reviewer ≥ 1.
- `demo` GitHub Environment: protected, required reviewer ≥ 1.
- `staging` GitHub Environment: open to `develop` and `main`, no reviewers required.
- All four environments MUST hold their own copies of: `AZURE_CREDENTIALS`, `PLATFORM_ADMIN_USER_IDS`, `SUPER_ADMIN_ORG_ID`, `AUTH_JWKS_URL`, `AUTH_WEBHOOK_SECRET`, `DJANGO_ALLOWED_HOSTS`, and any Stripe / Resend keys appropriate to that env.

---

## 9. Audit obligations

Any change to this standard is itself a release-governance change and requires a PR with two approvals. Quarterly drift audits MUST run the same probes that produced [environment-topology-audit.md](environment-topology-audit.md) and [schema-parity-report.md](schema-parity-report.md).
