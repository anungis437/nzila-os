# Runtime Separation Implementation Wave — Phase D.1: BR-5 Credential Cleanup & Build-Identity Hardening

**Date:** 2026-06-28
**Phase:** D.1 (credential cleanup + build-identity isolation)
**Scope guardrail:** Finish BR-5 credential cleanup without changing app runtime resources or physically splitting ACR. Shared `AZURE_CREDENTIALS` must no longer be required for **deployment authority**; build/push authority must be isolated from deploy authority; production deployment must remain digest-pinned and auditable.
**Status:** BR-5 credential cleanup **partially complete** — deploy-authority paths migrated off the shared credential; build-authority flip **staged** (identity created live, wiring documented, not flipped). `AZURE_CREDENTIALS` **retained** for rollback. **HARD STOP** at end of phase.

---

## 1. Workflows changed

| Workflow | Job(s) | Change | Authority class | Shared-cred status |
|---|---|---|---|---|
| [.github/workflows/canary-deploy.yml](../../.github/workflows/canary-deploy.yml) | `deploy-canary`, `bake-and-observe`, `promote`, `rollback` | Added `environment: production`; replaced `azure/login` `creds: AZURE_CREDENTIALS` with environment-scoped OIDC (`client-id` / `tenant-id` / `subscription-id`); added fail-closed identity assertion on `deploy-canary` | Deploy | **Removed** (no real `AZURE_CREDENTIALS` usage; only a comment remains) |
| [.github/workflows/gitops-deploy.yml](../../.github/workflows/gitops-deploy.yml) | `verify` | Added `environment: ${{ needs.plan.outputs.environment }}`; replaced `creds: AZURE_CREDENTIALS` with environment-scoped OIDC; added fail-closed identity assertion | Verify (read-only, env-bound) | **Removed** |
| [scripts/deploy-transactional.ts](../../scripts/deploy-transactional.ts) | n/a (defense-in-depth) | Added `--require-digest-pinned` flag, `DIGEST_PINNED_RE = /@sha256:[0-9a-f]{64}$/`, prod-RG auto-default, and a fail-closed `ensure(...)` rejecting non-`@sha256` targets in production | Deploy validation | n/a |

Workflow-level `permissions: id-token: write` was already present on `canary-deploy.yml` (added earlier in Phase D.1) and `gitops-deploy.yml`, enabling OIDC for the migrated jobs.

**Build-authority workflows NOT flipped this phase (staged only):**

| Workflow | Job | Current credential | Reason staged |
|---|---|---|---|
| [.github/workflows/gitops-deploy.yml](../../.github/workflows/gitops-deploy.yml) | `build` (line ~189) | `AZURE_CREDENTIALS` fallback | Automated push-to-main, high blast radius; no green-CI proof possible this phase |
| [.github/workflows/deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml) | `build-push` | `AZURE_CREDENTIALS` | Backend uses `az acr build` which AcrPush-only cannot run (see §3); requires docker-push conversion |

---

## 2. Identities created or staged

### Created (live in Azure + GitHub)

- **App registration / service principal:** `nzila-os-build`
  - **Client ID (OIDC, non-secret):** `5c02d25b-cbdc-412f-8c2a-9ed43b73ac20`
  - **SP object ID:** `bfa4a851-696a-4d3f-927b-5fb1526f79f2`
  - **Sign-in audience:** `AzureADMyOrg` (single tenant)
  - **Client secret:** none — OIDC federation only (no long-lived password)
  - **Federated credential:** issuer `https://token.actions.githubusercontent.com`, subject `repo:anungis437/nzila-os:environment:build`, audience `api://AzureADTokenExchange`
- **GitHub Environment `build`** created with environment-scoped secrets (names only): `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`. No secret values printed.

### Staged (documented, not yet wired)

The build identity is **inert** until the build jobs are flipped. The exact flip diff (to be applied only under green-CI proof in a follow-up):

- **gitops `build` job:** add `environment: build`; replace the dual `Azure Login (OIDC)` / `Azure Login (Credentials Fallback)` steps with a single environment-scoped `azure/login@v3` using `client-id`/`tenant-id`/`subscription-id`. The build step already uses `docker buildx build ... --push`, which works with AcrPush + metadata.
- **UE `build-push` job:** add `environment: build`; replace `azure/login@v2 creds: AZURE_CREDENTIALS` with environment-scoped OIDC; **and** convert the backend `az acr build --registry nzilacanadaacr --image ... --file apps/union-eyes/backend/Dockerfile apps/union-eyes/backend` to runner-side `docker build --file apps/union-eyes/backend/Dockerfile -t <image> apps/union-eyes/backend` + `docker push <image>` (both tags). This is required because AcrPush lacks `Microsoft.ContainerRegistry/registries/scheduleRun/action`.

---

## 3. RBAC scopes

| Identity | Role | Scope | Notes |
|---|---|---|---|
| `nzila-os-build` | **AcrPush** | `/subscriptions/5d819f33-d16f-429c-a3c0-5b0e94740ba3/resourceGroups/nzila-canada-staging-rg/providers/Microsoft.ContainerRegistry/registries/nzilacanadaacr` | **ACR resource scope only.** No Contributor on any RG (prod/staging/demo/pilot). Verified via `az role assignment list --assignee <sp> --all` → single AcrPush row. |
| Environment deploy identities (production / staging / demo / pilot) | Contributor (own RG) + **AcrPull** | own `nzila-canada-<env>-rg` + ACR | **Unchanged from Phase C.1.** AcrPull-only at the registry — no push capability. No environment deploy identity was granted AcrPush. |

**Key constraint discovered (drives the staging decision):** the built-in `AcrPush` role grants pull/push/metadata but **not** `scheduleRun/action`, so an AcrPush-only identity cannot execute `az acr build`. The UE backend build must therefore move to runner-side `docker build`/`docker push` before the build identity can replace `AZURE_CREDENTIALS` there.

---

## 4. Remaining `AZURE_CREDENTIALS` references

| Location | Class | Disposition |
|---|---|---|
| gitops `build` job (line ~189) | Build authority | Replace with `nzila-os-build` (staged; flip under green proof) |
| UE `build-push` job | Build authority | Replace with `nzila-os-build` after `az acr build` → docker-push conversion (staged) |
| Repo-level `AZURE_CREDENTIALS` secret | Rollback safety | **Retained** per guardrail until all replacement paths are proven green |
| Comments in canary/gitops | Documentation only | No runtime effect |

**No remaining deploy-authority or verify-authority usage of `AZURE_CREDENTIALS`.** The shared credential is now used only by the two build jobs (and retained as a secret for rollback).

---

## 5. Is legacy credential removal now safe?

**No — not yet.** `AZURE_CREDENTIALS` must be retained because:

1. The build-authority paths (gitops `build`, UE `build-push`) still depend on it.
2. The build-identity flip has **no green-CI proof** and the build jobs are automated push-to-main (high blast radius).
3. Per the review guardrail: keep `AZURE_CREDENTIALS` until the build identity and canary OIDC path are proven green in real runs.

Removal becomes safe only after: (a) the build-job flip is applied and a real build run pushes successfully via `nzila-os-build`, and (b) the production canary OIDC path is exercised green.

---

## 6. Rollback plan

- **Workflow changes:** `git revert` the canary/gitops/transactional edits; the prior `creds: AZURE_CREDENTIALS` paths return immediately (secret still present).
- **Build identity:** `nzila-os-build` is inert (no job references it); leaving it in place has no runtime effect. To fully unwind: delete the `build` GitHub environment, the federated credential, the AcrPush role assignment, and the app registration.
- **No application, database, or live container-app changes were made** in this phase; nothing to roll back at the runtime layer.

---

## 7. Verification results

1. **Workflow YAML parses** — `canary-deploy.yml`, `gitops-deploy.yml`, `deploy-union-eyes.yml`, `deploy-production.yml` all parse via `yaml.safe_load`. ✅
2. **Canary uses production OIDC, not shared credentials** — all four canary jobs use `client-id`/`tenant-id`/`subscription-id` under `environment: production`; no `creds:` remain. ✅
3. **Build identity has AcrPush only, no RG Contributor** — `az role assignment list` shows a single AcrPush row scoped to the ACR resource. ✅
4. **Environment deploy identities remain AcrPull-only** — unchanged from Phase C.1; none granted AcrPush. ✅
5. **Production deploy paths still require immutable image references** — `deploy-transactional.ts` fail-closed `@sha256` guard (prod-default); existing `jq` digest gate in `deploy-production.yml` and tag→digest resolution in gitops/canary deploy paths retained. ✅
6. **No deploy job requires AcrPush** — deploy/verify jobs use `az acr login` with AcrPull (read) only. ✅
7. **No non-prod identity can push to ACR** — only `nzila-os-build` (build env) holds AcrPush; env deploy identities are AcrPull-only. ✅
8. **No secret values printed** — only names and the non-secret OIDC client/SP identifiers are recorded. ✅
9. **`final:go` remains advisory** — unchanged; `productionBlockingAchieved` remains 0. ✅
10. **`deploy-transactional.ts` typechecks** — no errors. ✅

---

## 8. BR-5 status declaration

> BR-5 credential cleanup is complete or staged. Deploy identities remain AcrPull-only. Build/push authority is isolated from deployment authority. BR-5 is closed only if canary, build, and verification paths no longer depend on the shared credential for deployment authority and all immutability checks remain fail-closed. BR-6 remains pending.

**Assessment:**
- **Deployment authority** (canary deploy, gitops verify) no longer depends on `AZURE_CREDENTIALS`. ✅
- **Build authority** is now isolatable: a dedicated AcrPush-only identity (`nzila-os-build`) exists with no RG Contributor, separated from all deploy identities. The build jobs are **staged** to use it but not yet flipped (retained on `AZURE_CREDENTIALS` pending green proof). ⏳
- **Immutability checks** remain fail-closed (prod `@sha256` guards intact). ✅

**BR-5 = PARTIALLY CLOSED.** Credential cleanup for deploy/verify authority is complete; build-authority flip is staged and gated on green CI. `AZURE_CREDENTIALS` retained for rollback. **BR-6 remains OPEN** (org-context substrate drift).

---

## 9. Next steps (not performed this phase — HARD STOP)

- Apply the build-job flip (§2 staged diff) and prove a real build run pushes via `nzila-os-build`.
- Exercise the production canary OIDC path green.
- Only then: remove `AZURE_CREDENTIALS` (separate, explicitly approved step).
- Then proceed to **Phase E** (BR-6 org-context substrate drift).

No `AZURE_CREDENTIALS` removal, no physical ACR split, no BR-6 work, no smoke deploy, and no `final:go` promotion were performed.
