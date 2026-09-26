# Azure execution map

Repository triggers on `origin/main` `0d30e316423da50e2e7bdb9fd323d89070ec5f85`. Live Azure inventory was not queried. Replica counts, CPU, memory, and ingestion volume are not in this map.

| Workflow | Trigger | Azure operation in the file | When it can run |
| --- | --- | --- | --- |
| `auto-promote-union-eyes.yml` | push to `main` with path filter (`apps/union-eyes/**`, `packages/**`, `platform/**`, `Dockerfile`, `pnpm-lock.yaml`, the two deploy workflows) | Dispatches `deploy-union-eyes.yml` for non-production environments | A Union Eyes or shared-package merge. Production is excluded by the workflow contract |
| `deploy-union-eyes.yml` | push to `hotfix/fr-cta-locale-redirect` only, plus `workflow_dispatch` | `docker build`, ACR login, `az containerapp update` / create | Not on ordinary push to `main`. Production requires dispatch and the production environment |
| `gitops-deploy.yml` | `workflow_run` after CI completes on `main`, plus `workflow_dispatch` | `pnpm typecheck`, `pnpm lint`, `pnpm test:fast`, `docker buildx build`, `az acr`, `az containerapp update` | After every successful main CI run, subject to the workflow's own app filter |
| `deploy-staging.yml` | push and `workflow_dispatch` | lint, typecheck, `test:fast`, `pnpm build`, `az acr login` | Push path must be read before treating every main push as a staging deploy |
| `deploy-web.yml`, `deploy-console.yml`, `deploy-partners.yml` | `workflow_dispatch` | `docker build`, ACR, `az containerapp update` | Manual |
| `canary-deploy.yml` | `workflow_dispatch` | ACR digest, `az containerapp update`, traffic split | Manual |
| `br5-proof-deploy-staging.yml` | `workflow_dispatch` | Container App image swap and rollback | Manual proof |
| `build-identity-proof.yml` | `workflow_dispatch` | Proof image build and ACR delete | Manual |
| `retire-legacy-union-eyes-ca.yml` | `workflow_dispatch` | Hostname moves, Container App delete, ACR repository delete | Manual, destructive |
| `trivy.yml` | pull_request, push, schedule, dispatch | `docker buildx build` for scanning | Does not by itself update a Container App |
| `union-eyes-authority-rollout.yml` | `workflow_dispatch` | `az containerapp show` / env show | Read check |

ACR name hardcoded in several workflows: `nzilacanadaacr`.

## Observed on the baseline SHA

GitOps Deploy run `36254278073` followed CI on this SHA and completed in about 40 seconds (`16:06:38Z`–`16:07:18Z`). That duration is not an image build. Job-level skip versus a real `az containerapp update` was not expanded in this pass (`PENDING_MEASUREMENT`).

Auto-promote Union Eyes does not appear among the completed runs captured for this SHA in the 200-run sample. The commit is Union Eyes application code, so a later auto-promote run may exist outside the sampled window. Do not treat absence in the sample as proof the fanout did not run.
