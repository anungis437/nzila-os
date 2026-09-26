# CI duplication matrix

SHA `0d30e316423da50e2e7bdb9fd323d89070ec5f85`.

| Command | Where it runs on current main | Authoritative copy | Disposition |
| --- | --- | --- | --- |
| `pnpm typecheck` | `ci.yml`, `reliability-guard.yml`, `gitops-deploy.yml`, `deploy-staging.yml`, `preview-deploy.yml`, `nzila-playbook-runner.yml` | CI | Remove from Reliability Guard only after CI is confirmed required for that SHA. Leave deploy workflows until deploy no longer re-validates the tree it is about to ship |
| `pnpm lint` | Same set as typecheck | CI | Same disposition as typecheck |
| `pnpm test:fast` | `reliability-guard.yml`, `gitops-deploy.yml`, `deploy-staging.yml` | None yet | Keep. CI runs `pnpm test:coverage`, which may be a superset. That inclusion is not proven here |
| `pnpm test:coverage` | `ci.yml` | CI | Keep |
| `pnpm build` | `reliability-guard.yml`, `deploy-staging.yml`, `preview-deploy.yml` | Reliability Guard for the portfolio graph | Do not delete. CI build is `--affected` |
| `pnpm exec turbo run build --affected` | `ci.yml` Build All | CI for the changed closure | Keep. It does not replace `pnpm build` |
| `pnpm contract-tests` | CI Contract Tests job and CI Governance Gates | One of those two jobs | Later dedupe inside CI. Not a Reliability Guard issue |
| `docker build` / `docker buildx build` | `gitops-deploy.yml`, `trivy.yml`, `deploy-staging.yml`, manual app deploy workflows, `deploy-union-eyes.yml` | Split: Trivy for scan, GitOps or app deploy for the shipped digest | Do not unify until digest promotion is designed. Trivy may build an image that is never the deployed digest |
| `pnpm install --frozen-lockfile` | Every job that calls `setup-monorepo` | Per job today | Expected until jobs share an artifact. CI lint, test, and build jobs each install |

## PR then main

On SHA `0d30e3164`, push to main re-ran CI (20m18s) and Reliability Guard (31m21s) after the pull request had already run both. The merge commit is the tree that was evaluated. Squash merges create a new SHA, so pull-request evidence is not the same input as main. Recomputation on main is not automatically waste.

What is waste on that same main SHA is Reliability Guard repeating typecheck and lint while CI on that SHA already runs them. The full `pnpm build` is additional evidence, not a duplicate of `--affected`.

## Concurrency

Reliability Guard and CI set `cancel-in-progress` only when `github.event_name == 'pull_request'`. The sample contains cancelled Reliability Guard, CI, E2E, and CUPE runs on superseded pull-request heads. Push and deploy workflows do not cancel in progress. That matches the rule that a deploy or migration must not be cancelled mid-flight. GitOps is `workflow_run`, not a pull-request cancel group.
