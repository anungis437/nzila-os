# CI authority graph

SHA `0d30e316423da50e2e7bdb9fd323d89070ec5f85`. Authority means the gate whose command is the one that must stay if duplicates are removed. A duplicate may be removed only after that gate is required for the same SHA.

| Property | Authoritative gate | Workflow | Command | Evidence |
| --- | --- | --- | --- | --- |
| Type correctness | CI / Lint & Typecheck | `ci.yml` | `pnpm typecheck` | Job log on the SHA |
| Lint correctness | CI / Lint & Typecheck | `ci.yml` | `pnpm lint` | Job log on the SHA |
| Unit correctness | CI / Unit Tests | `ci.yml` | `pnpm test:coverage` | Coverage artifact |
| Fast unit subset | Unassigned | `reliability-guard.yml` | `pnpm test:fast` | Not proven to be a subset of coverage |
| Affected buildability | CI / Build All | `ci.yml` | `pnpm exec turbo run build --affected` | Affected closure only |
| Portfolio buildability | Reliability Guard | `reliability-guard.yml` | `pnpm build` | Full task graph. No other PR/main workflow uses this exact command |
| Contract invariants | CI / Contract Tests | `ci.yml` | `pnpm contract-tests` | Also invoked inside CI Governance Gates |
| Migration immutability | CI / SAGE Live PostgreSQL | `ci.yml` | `pnpm verify:migrations` | Static plus live suite |
| RLS / Postgres server | CI / SAGE PostgreSQL Concurrency and RLS | `ci.yml` | `vitest` `records-postgres-server.test.ts` | postgres:16 service |
| Schema drift | CI / Schema Drift Detection | `ci.yml` | `schema-snapshot.ts verify`, canonical schema, preflight | Job log |
| Governance integrity | CI Governance Gates and Nzila Governance Gate | `ci.yml`, `nzila-governance.yml` | governance validators | Separate workflows; overlap not fully deduplicated |
| Secret safety | Secret Scan | `secret-scan.yml` | secret scanners | PR and push |
| Image / filesystem scan | Trivy | `trivy.yml` | `docker buildx build` plus Trivy | Rebuilds images for scan |
| Supply chain / SBOM | CI Enterprise Hardening | `ci.yml` | `scripts/generate-sbom.ts` | Also `sbom.yml` on push |
| Reliability configuration | Reliability Guard scripts | `reliability-guard.yml` | health contract, synthetic dry-run, alert routing, audit, executive dashboard | About 3s on the anchor run |
| Union Eyes non-prod deploy | Auto-promote then deploy-union-eyes | `auto-promote-union-eyes.yml` | path-filtered dispatch | Production excluded |
| Broad app deploy | GitOps Deploy | `gitops-deploy.yml` | `workflow_run` after CI on main | Also re-runs typecheck, lint, `test:fast`, then image build |
| Production deploy | deploy-union-eyes dispatch | `deploy-union-eyes.yml` | `workflow_dispatch` with environment production | Not on push to main |

## Class for each expensive gate

| Gate | Class |
| --- | --- |
| CI lint, typecheck, unit, affected build, schema, SAGE RLS, contracts | `PR_REQUIRED` and `MAIN_REQUIRED` |
| Reliability scripts | `PR_REQUIRED` and `MAIN_REQUIRED` until a consumer of CI evidence exists |
| Reliability full `pnpm build` | `PR_REQUIRED` today, because nothing else proves the full graph |
| Secret scan, Trivy | `PR_REQUIRED` |
| Red-team, DAST, game day, DR reminder, compliance schedule | `SCHEDULED_ASSURANCE` or dispatch |
| Production Container App update | `RELEASE_REQUIRED` |
| Auto-promote demo/pilot/staging | `MAIN_REQUIRED` only when its path filter matches |

Fail closed: if a later change cannot tell whether `pnpm test:fast` is contained in `pnpm test:coverage`, both stay.
