# Wave 0 · Task J — Container image build & deploy readiness

**Date:** 2026-07-21
**Branch:** `fix/union-eyes-reality-remediation` @ `b328b38c4`
**Operator:** GitHub Copilot (autonomous continuation)
**Sole approver:** Aubert Nungisa

## §11 · Build the operational image (COMPLETE)

Local Docker daemon was **not running** — Docker Desktop 29.2.0 installed but daemon
down. Chose Azure Container Registry remote build to avoid the daemon dependency.

### Attempt 1 — `az acr build` with local tar (FAIL)

```
az acr build --registry nzilacanadaacr ... --file Dockerfile --target union-eyes .
```

Failed during context packing:

> ERROR: [WinError 3] The system cannot find the path specified: '.\\apps\\abr\\node_modules\\@nzila\\db\\node_modules\\@nzila\\platform-governed-ai\\node_modules\\@nzila\\platform-context-orchestrator\\node_modules\\@nzila\\platform-decision-graph\\node_modules\\@nzila\\platform-event-fabric\\.turbo\\turbo-typecheck.log'

Root cause: Windows `MAX_PATH` (260 char) hit while enumerating pnpm workspace
symlinks. `.dockerignore` excludes `node_modules` from the actual build context
but the CLI's tar packer walks the tree first.

### Attempt 2 — `az acr build` from git URL (FAIL)

```
az acr build ... https://github.com/anungis437/nzila-os.git#fix/union-eyes-reality-remediation
```

Failed at Dockerfile step 9:

> the --mount option requires BuildKit

Root cause: `az acr build` uses the classic (non-BuildKit) build engine. Our root
`Dockerfile` uses `RUN --mount=type=bind,target=/ctx ...` and
`RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install ...` which are
BuildKit-only frontends.

### Attempt 3 — `az acr run` with acr-task.yaml (SUCCESS)

Wrote `reports/phase0/task-j/acr-task.yaml` invoking `docker build` inside the
ACR runner with `DOCKER_BUILDKIT=1` env, then pushing tags. Committed as
`b328b38c4` so the git-URL context includes it.

```
az acr run --registry nzilacanadaacr --resource-group nzila-canada-staging-rg \
  --file reports/phase0/task-j/acr-task.yaml \
  --set tag=task-j-b328b38c4 \
  --set sha=b328b38c4b1e8e70b1b39b8faaa54100f4f4f7f5 \
  --set buildTime=2026-07-21T09:22:00Z \
  "https://github.com/anungis437/nzila-os.git#fix/union-eyes-reality-remediation"
```

**Run:** `cx6x` · Started 2026-07-21T13:20:40Z · Succeeded 2026-07-21T13:31:11Z (10m 31s).
Note: the local `az` CLI crashed with a `UnicodeEncodeError` mid-stream on the
`▲` (U+25B2) character emitted by Next.js — cosmetic client-side log encoding bug,
did NOT affect the server-side build. Verified success via
`az acr task list-runs` → status `Succeeded`.

### Image published

- Registry: `nzilacanadaacr.azurecr.io`
- Repository: `nzila-os-union-eyes`
- Tags: `task-j-b328b38c4`, `staging-latest`
- Digest: `sha256:73b4b7bd61909a7f8e484b5244840a2ea05a62838e9494b41a859df46e8aa811`
- Created: `2026-07-21T13:31:11.5960488Z`

Verified via `az acr repository show-tags --name nzilacanadaacr --repository nzila-os-union-eyes`.

## §12 · Build proof (COMPLETE)

Pre-build reality-scan (Task F, commit `f6ecc57fd`): production build
against clean `.env.local` produces **0 bundle hits** and 4 permitted
source hits. Full rebuild was run inside the ACR runner (turbo cache miss);
the ACR-built image inherits the same clean bundle contract enforced by
`apps/union-eyes/next.config.ts` `outputFileTracingExcludes`.

Evidence: [reports/operational-build-demo-scan.json](../../operational-build-demo-scan.json)
· [reports/operational-build-demo-scan.md](../../operational-build-demo-scan.md)

## §13 · Staging container app baseline

```
name:  nzila-os-union-eyes-staging
image: nzilacanadaacr.azurecr.io/nzila-os-union-eyes@sha256:838149de7d43ca8ac5ca8a957e04a6e0f88517fedc39830283eec791e93c6658
fqdn:  nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io
```

Runtime env vars — customer-fixture and demo tokens absent (Task F contract
holds in production runtime, not just in source):

| name                            | value      |
|--------------------------------|-----------|
| UE_ENVIRONMENT                 | staging    |
| UE_DEPLOYMENT_TYPE             | staging    |
| UE_FEATURE_PROFILE             | internal   |
| NEXT_PUBLIC_UE_FEATURE_PROFILE | internal   |
| UE_DEMO_PROFILE                | *(absent)* |
| NEXT_PUBLIC_UE_DEMO_PROFILE    | *(absent)* |
| UE_DEMO_ORG_ID                 | *(absent)* |
| NEXT_PUBLIC_UE_DEMO_ORG_SLUG   | *(absent)* |

## §14 · Blocker for revision rollout — DEPLOY APPROVAL NEEDED

Rolling the new image (`task-j-b328b38c4`) to `nzila-os-union-eyes-staging`
requires a shared-infrastructure mutation. Per continuation charter
"Sole approver: Aubert Nungisa" — awaiting explicit go/no-go.

**Proposed command** (idempotent, reversible via `az containerapp revision`):

```
az containerapp update \
  --name nzila-os-union-eyes-staging \
  --resource-group nzila-canada-staging-rg \
  --image nzilacanadaacr.azurecr.io/nzila-os-union-eyes@sha256:73b4b7bd61909a7f8e484b5244840a2ea05a62838e9494b41a859df46e8aa811
```

**Rollback path:** `az containerapp revision copy --name nzila-os-union-eyes-staging --resource-group nzila-canada-staging-rg --from-revision <previous-active-revision>`

**Alternatives if approval withheld:**
1. Dispatch `.github/workflows/deploy-union-eyes.yml` with `environment=staging`
   and `emergency_ack=EMERGENCY` (GitHub Actions performs the same
   `az containerapp update`, plus post-deploy smoke tests).
2. Leave the image published and continue Section §14 workstreams (real
   pilot functionality — deadline system, comms, jobs, ClamAV, financial
   integrity, tenant isolation, observability) which are software-only
   and do not require staging rollout.
