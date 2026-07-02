# Runtime Separation Implementation Wave — Phase D.2: Build-Identity Flip & Controlled Proof

**Date:** 2026-06-28
**Phase:** D.2 (build-authority flip to the dedicated build identity + controlled proof)
**Scope guardrail:** Update the two build jobs only. Move build/push authority from shared `AZURE_CREDENTIALS` to the dedicated `nzila-os-build` OIDC identity. The build identity may push to ACR but must not be able to deploy to prod/staging/demo/pilot resource groups. Do not remove the repo-level `AZURE_CREDENTIALS` secret. Do not deploy runtime resources without separate approval.
**Status:** Build-authority flip **implemented and verified**; controlled green proof **pending** (exact instructions provided). BR-5 remains **partially closed** until one green build run is observed.

---

## 1. Workflows changed

| Workflow | Job | Change |
|---|---|---|
| [.github/workflows/gitops-deploy.yml](.github/workflows/gitops-deploy.yml) | `build` | Added `environment: build`; replaced the dual `Azure Login (OIDC)` / `Azure Login (Credentials Fallback)` steps with a single build-identity OIDC login using **direct** `secrets.AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID`; added a fail-closed "assert build identity is configured" step and a "verify authenticated identity is the build identity" step (`az account show --query user.name` must equal the build client id); added a post-push "resolve immutable image digest" step that fails if the pushed image does not resolve to `sha256:`. |
| [.github/workflows/deploy-union-eyes.yml](.github/workflows/deploy-union-eyes.yml) | `build-push` | Added `environment: build`; replaced `azure/login@v2` `creds: AZURE_CREDENTIALS` with `azure/login@v3` direct build-identity OIDC; replaced the `AZURE_CREDENTIALS` assert with a build-env-secret assert; added the same build-identity verification step; **converted the backend `az acr build` to runner-side `docker build --file apps/union-eyes/backend/Dockerfile … apps/union-eyes/backend` + `docker push`** (two tags); frontend `docker build`/`docker push` behavior preserved; the existing digest-resolution step (frontend + backend `@sha256`) preserved unchanged. |

**Why the backend conversion was required:** the built-in `AcrPush` role grants pull/push/metadata but **not** `Microsoft.ContainerRegistry/registries/scheduleRun/action`, so an AcrPush-only identity cannot run server-side `az acr build`. Runner-side `docker build` + `docker push` needs only AcrPush. The backend Dockerfile uses only context-relative `COPY` (`COPY requirements.txt .`, `COPY . .`); the new build context (`apps/union-eyes/backend`) is identical to the previous `az acr build` context, so the conversion is behavior-preserving.

**Direct-secret pattern (not the workflow-level `env:` hoist):** both build jobs reference `secrets.AZURE_CLIENT_ID` **directly** inside the job (which now sets `environment: build`), mirroring the deploy job. This avoids the known pitfall where the workflow-level `env: AZURE_CLIENT_ID: ${{ secrets.* }}` hoist resolves at repo scope and defeats per-environment secret resolution.

The `deploy` jobs in both workflows are **unchanged**: they remain environment-scoped, AcrPull-only, and consume the immutable `@sha256` digests emitted by the build jobs.

---

## 2. Build identity verification (live)

`nzila-os-build` — verified via `az role assignment list --assignee <sp> --all`:

| Property | Value |
|---|---|
| Client ID (OIDC, non-secret) | `5c02d25b-cbdc-412f-8c2a-9ed43b73ac20` |
| SP object ID | `bfa4a851-696a-4d3f-927b-5fb1526f79f2` |
| Role assignments | **AcrPush** on `/subscriptions/5d819f33-d16f-429c-a3c0-5b0e94740ba3/resourceGroups/nzila-canada-staging-rg/providers/Microsoft.ContainerRegistry/registries/nzilacanadaacr` — **single row** |
| Contributor on any RG | **none** (query for `Contributor` scopes returned empty) |
| Federated credential subject | `repo:anungis437/nzila-os:environment:build` (issuer `https://token.actions.githubusercontent.com`, aud `api://AzureADTokenExchange`) |
| Client secret | none (OIDC only) |

**Invariant satisfied:** the build identity can push images to ACR but cannot deploy to prod/staging/demo/pilot resource groups (no Contributor anywhere). Environment deploy identities remain **AcrPull-only** (unchanged from Phase C.1 — no AcrPush was granted to any deploy identity).

In-workflow fail-closed enforcement of the invariant:
- Build jobs fail closed if the `build` environment secrets are absent.
- Build jobs fail closed if `az account show --query user.name` ≠ the expected build client id (proves the runtime identity is `nzila-os-build`, not a fallback).
- Build jobs fail closed if a pushed image does not resolve to a `sha256:` digest.

---

## 3. Remaining `AZURE_CREDENTIALS` references

| Location | Class | Disposition |
|---|---|---|
| Comments in [gitops-deploy.yml](.github/workflows/gitops-deploy.yml) (lines ~154, ~312, ~494) and [deploy-union-eyes.yml](.github/workflows/deploy-union-eyes.yml) (line ~512) | Documentation only | No runtime effect |
| Repo-level `AZURE_CREDENTIALS` secret | Rollback safety | **Retained** (not removed) per the key decision |
| Legacy SP `nzila-os-cicd` | Rollback safety | **Untouched** (still holds broad Contributor — intentionally retained for rollback) |

**No build, deploy, or verify job executes `azure/login` with `creds: AZURE_CREDENTIALS` anymore.** The shared credential now has **zero active execution paths**; it is retained only as a dormant rollback secret.

---

## 4. Build proof result / exact pending proof command

**Result: PENDING — no green build run has been executed.**

A genuine build-identity green proof requires a **GitHub Actions run under `environment: build`**, because the `nzila-os-build` identity authenticates only via GitHub OIDC federation (it has no client secret, by design). This cannot be exercised locally. The two workflows now wired to `environment: build` both chain build → deploy and would deploy runtime resources, which is **out of scope without separate approval** (scope item 24). Therefore, per scope item 25, exact proof instructions are provided and the phase stops here rather than deploying runtime resources or fabricating a green signal.

### Recommended controlled proof (deploys nothing)

Run a one-off, dispatch-only proof on a non-default branch that authenticates as the build identity, pushes a throwaway image, resolves its digest, and cleans up. Add the following workflow on a branch, then dispatch it:

```yaml
# .github/workflows/build-identity-proof.yml  (temporary, dispatch-only)
name: Build Identity Proof (BR-5)
on: { workflow_dispatch: {} }
permissions: { contents: read, id-token: write }
jobs:
  proof:
    runs-on: ubuntu-latest
    environment: build
    steps:
      - uses: actions/checkout@v5
      - name: Azure Login (OIDC, build identity)
        uses: azure/login@v3
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - name: Verify identity is nzila-os-build
        run: |
          set -euo pipefail
          test "$(az account show --query user.name -o tsv)" = "5c02d25b-cbdc-412f-8c2a-9ed43b73ac20"
      - name: ACR login + push throwaway image
        run: |
          set -euo pipefail
          az acr login --name nzilacanadaacr
          printf 'FROM scratch\nCOPY Dockerfile /proof\n' > Dockerfile.proof
          docker build -f Dockerfile.proof -t nzilacanadaacr.azurecr.io/nzila-build-proof:${{ github.run_id }} .
          docker push nzilacanadaacr.azurecr.io/nzila-build-proof:${{ github.run_id }}
      - name: Resolve digest (must be sha256)
        run: |
          set -euo pipefail
          D=$(az acr repository show --name nzilacanadaacr --image nzila-build-proof:${{ github.run_id }} --query digest -o tsv)
          case "$D" in sha256:*) echo "PROOF GREEN: $D" ;; *) echo "::error::no sha256 digest"; exit 1 ;; esac
      - name: Cleanup throwaway repo
        if: always()
        run: az acr repository delete --name nzilacanadaacr --repository nzila-build-proof --yes || true
```

Dispatch: `gh workflow run build-identity-proof.yml --ref <proof-branch>`

**Expected green signal:** identity assertion passes (`az account show` = build client id), push succeeds (proves AcrPush via OIDC), digest resolves to `sha256:…`. No runtime resource is deployed.

> Note: adding this proof workflow requires it to exist on the default branch for dispatch, i.e. a push to `main`. That push was **not** performed in this phase (it requires separate approval). The alternative is to observe the first real `gitops-deploy` (`build` job) run on `staging` once a deploy is independently approved.

---

## 5. Verification results

1. **Workflow YAML parses** — `gitops-deploy.yml`, `deploy-union-eyes.yml`, `canary-deploy.yml`, `deploy-production.yml` all parse via `yaml.safe_load`. ✅
2. **No build job uses `AZURE_CREDENTIALS`** — both build jobs use build-identity OIDC; remaining references are comments only. ✅
3. **No deploy job has an AcrPush requirement** — deploy jobs use `az acr login` (pull) and consume digests; no push. ✅
4. **`nzila-os-build` has AcrPush only, no RG Contributor** — verified: single AcrPush row, zero Contributor scopes. ✅
5. **Environment deploy identities remain AcrPull-only** — unchanged from Phase C.1; none granted AcrPush. ✅
6. **Production image references remain immutable** — `deploy-production.yml` `jq` `@sha256` gate, `deploy-transactional.ts` prod digest guard, and the gitops/canary/UE deploy digest consumption are all unchanged and intact. ✅
7. **`az acr build` removed from the build path** — `grep` confirms no `az acr build` remains in `deploy-union-eyes.yml`. ✅
8. **Backend build context preserved** — backend Dockerfile uses only context-relative `COPY`; new context equals the previous `az acr build` context. ✅
9. **No secret values printed; `final:go` advisory; `productionBlockingAchieved` = 0.** ✅

---

## 6. Rollback plan

- **Workflow changes:** `git revert` the two workflow edits — the prior `creds: AZURE_CREDENTIALS` build path returns immediately (the secret and `nzila-os-cicd` SP are untouched).
- **Build identity:** `nzila-os-build` and the `build` GitHub Environment can remain in place (inert if the workflows are reverted) or be removed (delete the `build` env, the federated credential, the AcrPush assignment, and the app registration).
- **No application, database, or live container-app changes were made** in this phase; nothing to roll back at the runtime layer.
- **`AZURE_CREDENTIALS` retained** and the legacy `nzila-os-cicd` SP retained, so a full revert restores the prior working build path with no Azure-side changes.

---

## 7. BR-5 status declaration

> Build authority has been flipped to the dedicated build identity or staged with exact proof instructions. BR-5 is closed only if build/push authority no longer depends on shared credentials, deploy identities remain AcrPull-only, production images remain digest-pinned, and at least one controlled build proof is green. BR-6 remains pending.

**Assessment:**
- Build/push authority no longer references shared credentials in any execution path. ✅
- Deploy identities remain AcrPull-only. ✅
- Production images remain digest-pinned. ✅
- At least one controlled build proof is green. ❌ **(pending — exact proof instructions provided in §4)**

**BR-5 = PARTIALLY CLOSED.** The build-authority flip is fully implemented and verified at the configuration and RBAC layers, but the required green build proof has not yet been observed. `AZURE_CREDENTIALS` is retained for rollback and must not be removed until (a) one controlled build proof is green and (b) one environment-scoped deploy path has also run cleanly. **BR-6 remains OPEN.**

---

## 8. Next steps (not performed this phase — HARD STOP)

- Execute the §4 controlled proof (requires the proof workflow on `main`, i.e. a separately-approved push) **or** observe the first approved `gitops-deploy` `build` run on `staging`.
- After the build proof is green **and** one env-scoped deploy path runs cleanly: remove `AZURE_CREDENTIALS` (separate, explicitly approved step) and optionally retire the broad `nzila-os-cicd` SP.
- Then proceed to **Phase E** (BR-6 org-context substrate drift).

No `AZURE_CREDENTIALS` removal, no `nzila-os-cicd` change, no AcrPush grant to deploy identities, no RG Contributor grant to `nzila-os-build`, no physical ACR split, no database or runtime change, no smoke deploy, and no `final:go` promotion were performed.
