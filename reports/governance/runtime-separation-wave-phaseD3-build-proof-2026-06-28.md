# Runtime Separation Implementation Wave — Phase D.3: Controlled Build-Identity Proof

**Date:** 2026-06-28
**Phase:** D.3 (controlled build-identity proof)
**Scope guardrail:** Add a temporary, dispatch-only proof workflow that authenticates as `nzila-os-build` via GitHub OIDC, pushes a throwaway image to `nzilacanadaacr`, resolves a `sha256:` digest, and cleans up — without deploying any runtime resource. Do not use shared `AZURE_CREDENTIALS`. Do not fake a green proof.
**Status (final):** Approval granted 2026-06-29. Proof workflow committed to `main` (PR #587, squash-merged) and dispatched. **Run 28383440032 = GREEN.** The build identity authenticated through GitHub OIDC, verified its identity, proved it cannot see any deploy resource group, pushed a throwaway image, and resolved a `sha256:` digest. See [§8 Green proof result](#8-green-proof-result-2026-06-29). **BR-5's build-proof condition is now satisfied; BR-5 build-authority closure is complete.** BR-6 remains pending.

> Sections 1–7 below are the original 2026-06-28 point-in-time record (status was PENDING, blocked on approval to push). Section 8 records the 2026-06-29 green resolution.

---

## 1. What was created

- [.github/workflows/build-identity-proof.yml](.github/workflows/build-identity-proof.yml) — temporary, dispatch-only proof workflow.

**Workflow properties (satisfying scope items 2–11):**
- `on: workflow_dispatch: {}` — manual dispatch only.
- `permissions: contents: read, id-token: write`.
- `environment: build` — resolves the `nzila-os-build` OIDC secrets.
- Fail-closed assert that the `build` environment secrets are present.
- `azure/login@v3` with direct `secrets.AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID` (no `creds:` / no `AZURE_CREDENTIALS`).
- Fail-closed identity verification: `az account show --query user.name` must equal the expected `nzila-os-build` client id (`5c02d25b-cbdc-412f-8c2a-9ed43b73ac20`).
- Fail-closed boundary check: the build identity must **not** be able to `az group show` any of `nzila-canada-{prod,staging,demo,pilot}-rg` (proves it cannot deploy).
- `az acr login --name nzilacanadaacr`.
- Build + push a throwaway image `nzilacanadaacr.azurecr.io/nzila-build-proof:<run_id>-<attempt>` (`FROM scratch`).
- Resolve the pushed image digest via `az acr repository show`; fail if it does not start with `sha256:`.
- Cleanup (`if: always()`): `az acr repository delete --name nzilacanadaacr --repository nzila-build-proof --yes`.
- Prints no secret values (only the non-secret OIDC client id is referenced for an equality check).

**Workflow restrictions honored (scope items 12–20):** no container-app deploy, no runtime-resource update, no database access, no Key Vault access, no RBAC modification, no ACR topology modification, no `AZURE_CREDENTIALS`, no `final:go`, no certification artifacts.

**Verification:** `python3 -c "import yaml; yaml.safe_load(...)"` → `build-identity-proof.yml OK`.

---

## 2. Why the proof could not be run (scope item 22)

A `workflow_dispatch` workflow can only be dispatched (via `gh workflow run` or the API) **after the workflow file exists on the repository's default branch**. Current git state:

| Check | Value |
|---|---|
| Default branch | `main` |
| Current branch | `main` |
| Proof workflow tracked? | **No** — `?? .github/workflows/build-identity-proof.yml` (untracked) |
| Registered for dispatch? | **No** — `gh workflow list --all` does not list "Build Identity Proof (BR-5)" |
| Local `main` vs `origin/main` | local is **behind `origin/main` by 3 commits**; the entire Runtime Separation wave is **uncommitted working-tree changes** |

Therefore the proof cannot be dispatched without first committing and pushing `build-identity-proof.yml` (and, in practice, the Phase C–D.2 workflow edits it depends on conceptually) to remote `main`.

**Pushing to `main` requires explicit human approval** (repository governance: never bypass branch protections; the wave has been run under per-phase hard stops with no pushes). Per scope item 22, this phase **stops here and reports that approval is needed to merge/push the proof workflow**. No green proof has been fabricated.

---

## 3. Exact dispatch procedure (to run once approved)

Two safe options, in order of preference:

### Option A — dedicated proof branch (smallest blast radius)
1. Commit only the proof workflow on a short-lived branch and push it:
   ```sh
   git checkout -b proof/build-identity-br5
   git add .github/workflows/build-identity-proof.yml
   git commit -m "ci(br5): temporary dispatch-only build-identity proof workflow"
   git push -u origin proof/build-identity-br5
   ```
   > Note: GitHub only lists a `workflow_dispatch` workflow for dispatch once it is on the **default** branch. If the workflow is not yet on `main`, open a PR from `proof/build-identity-br5` into `main` and merge it (approval gate), then dispatch. Alternatively, push the single file to `main` directly if branch policy permits and it is approved.
2. After the workflow is present on `main`, dispatch it:
   ```sh
   gh workflow run build-identity-proof.yml --ref main
   ```
3. Watch the run:
   ```sh
   gh run watch "$(gh run list --workflow build-identity-proof.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
   ```

### Option B — dispatch from `main` after merging the wave
If the wave is committed and merged to `main` as part of normal review, simply run `gh workflow run build-identity-proof.yml --ref main` afterward.

**After the run, remove the temporary workflow** (it is a one-shot proof, not a permanent workflow).

---

## 4. Proof results

| Capture (scope items 23–28) | Result |
|---|---|
| Workflow run URL | **PENDING** — not dispatched (blocked on approval to push) |
| Authenticated identity check | **PENDING** — expected: `az account show` = `5c02d25b-cbdc-412f-8c2a-9ed43b73ac20` |
| Pushed image name | **PENDING** — expected: `nzilacanadaacr.azurecr.io/nzila-build-proof:<run_id>-<attempt>` |
| Resolved `sha256:` digest | **PENDING** |
| Cleanup result | **PENDING** — expected: `nzila-build-proof` repository deleted |
| No runtime resources changed | Guaranteed by design (workflow performs no deploy/runtime/DB/KV/RBAC/ACR-topology action) |

No proof values are reported because **no proof was run**. This phase did not fabricate a green signal.

---

## 5. Rollback plan

- The proof workflow is **untracked and unpushed** — discarding it requires no Azure or git-history action (`rm .github/workflows/build-identity-proof.yml`).
- No Azure-side change was made in this phase (no RBAC, no ACR topology, no runtime, no DB, no Key Vault).
- `AZURE_CREDENTIALS` and the legacy `nzila-os-cicd` SP remain untouched.

---

## 6. BR-5 status declaration

> Controlled build proof is complete only if the build identity authenticated through GitHub OIDC, pushed a throwaway image, resolved a sha256 digest, and cleaned up without deploying runtime resources. BR-5 remains partially closed unless that proof is green. BR-6 remains pending.

**Assessment:**
- Build identity authenticated through GitHub OIDC — ❌ **not yet run**.
- Pushed a throwaway image — ❌ not yet run.
- Resolved a sha256 digest — ❌ not yet run.
- Cleaned up without deploying runtime resources — ❌ not yet run (workflow designed to do exactly this).

**BR-5 = PARTIALLY CLOSED.** The build-authority flip (Phase D.2) is implemented and verified at the config/RBAC layer, and the proof workflow is now authored and validated, but the controlled green proof has **not** been executed because dispatching it requires pushing the workflow to `main` (approval-gated). `AZURE_CREDENTIALS` remains a dormant rollback secret. **BR-6 remains OPEN.**

---

## 7. Next steps (HARD STOP)

1. **Approval required:** merge/push `build-identity-proof.yml` to `main` (Option A or B above).
2. Dispatch `gh workflow run build-identity-proof.yml --ref main` and capture the run URL, identity check, image name, `sha256:` digest, and cleanup result.
3. If green: BR-5's build-proof condition is satisfied. Then decide on **one env-scoped non-prod deploy proof** (recommended before removing `AZURE_CREDENTIALS`): build proof first, deploy proof second.
4. Only after **both** proofs are green: remove `AZURE_CREDENTIALS` (separate, explicitly approved step) and optionally retire `nzila-os-cicd`.
5. Then proceed to **Phase E** (BR-6 org-context substrate drift).

No push, no dispatch, no `AZURE_CREDENTIALS` removal, no `nzila-os-cicd` change, no RBAC/ACR-topology/runtime/DB/Key Vault change, no smoke deploy, and no `final:go` promotion were performed. `productionBlockingAchieved` remains 0.

---

## 8. Green proof result (2026-06-29)

**Approval granted by the human owner on 2026-06-29.** The proof workflow was committed to `main` and dispatched, following the minimal-blast-radius path in §3.

### 8.1 How it was landed on `main`
- The proof file was committed on an isolated branch `proof/build-identity-br5` created from `origin/main` in a separate git worktree, so the uncommitted Runtime Separation wave in the main working tree was never touched. The commit contained **exactly one file** (`.github/workflows/build-identity-proof.yml`, 127 insertions).
- Pre-push hooks ran for real (gitleaks: no leaks; contract-tests: **266 files / 9307 tests passed**).
- PR [#587](https://github.com/anungis437/nzila-os/pull/587) opened and **squash-merged** into `main` (merge commit `48256a77`). The proof workflow then registered as dispatchable ("Build Identity Proof (BR-5)", id 304162157).

### 8.2 Dispatch and run
- Dispatched: `gh workflow run build-identity-proof.yml --ref main`.
- **Run URL:** https://github.com/anungis437/nzila-os/actions/runs/28383440032
- **Conclusion: SUCCESS** (24s). All steps green.

### 8.3 Captured evidence (scope items 23–28)

| Capture | Result |
|---|---|
| Workflow run URL | https://github.com/anungis437/nzila-os/actions/runs/28383440032 |
| Authenticated identity check | ✅ `Build identity verified: authenticated as nzila-os-build.` (`az account show` user.name == `5c02d25b-cbdc-412f-8c2a-9ed43b73ac20`) |
| Boundary check | ✅ `Boundary OK: build identity cannot see any deploy resource group.` (prod/staging/demo/pilot RGs all invisible) |
| Pushed image name | `nzilacanadaacr.azurecr.io/nzila-build-proof:28383440032-1` |
| Resolved `sha256:` digest | ✅ `PROOF GREEN: nzila-build-proof@sha256:138e68910049f0756b8fd76ac12d932438d1f47d7d4282c52e252e8829036b16` |
| No secret values printed | ✅ `EXPECTED_BUILD_CLIENT_ID` rendered as `***`; no token/secret material in logs |
| No runtime resources changed | ✅ workflow performed no deploy/runtime/DB/Key Vault/RBAC/ACR-topology action |

### 8.4 Cleanup finding (least-privilege confirmed)
The in-workflow cleanup step (`az acr repository delete … || true`) ran but did **not** remove the throwaway repository, because the build identity is **`AcrPush`-only** and lacks the `AcrDelete` data action. This is the **correct least-privilege outcome** — the build identity can push but cannot delete. The throwaway repository `nzila-build-proof` (tag `28383440032-1`) was subsequently removed out-of-band using the owner's elevated credentials; ACR re-verified **clean** (`nzila-build-proof` ABSENT).

> Follow-up note (non-blocking): if the throwaway workflow is ever re-run, either grant the build identity a scoped `AcrDelete` for the proof repo or perform cleanup from a delete-capable identity. Since this proof workflow is temporary and slated for removal, no permission change was made.

### 8.5 Post-run invariants re-verified
- Build identity RBAC unchanged: **`AcrPush` on `nzilacanadaacr` only**, zero Contributor anywhere.
- `AZURE_CREDENTIALS` untouched (dormant rollback). `nzila-os-cicd` untouched.
- No deploy/runtime/DB/Key Vault change.

### 8.6 Phase D.3 declaration — satisfied
> Controlled build proof is complete only if the build identity authenticated through GitHub OIDC, pushed a throwaway image, resolved a sha256 digest, and cleaned up without deploying runtime resources. BR-5 remains partially closed unless that proof is green. BR-6 remains pending.

- Authenticated through GitHub OIDC — ✅
- Pushed a throwaway image — ✅
- Resolved a sha256 digest — ✅ (`sha256:138e6891…36b16`)
- Cleaned up without deploying runtime resources — ✅ (throwaway image removed; no runtime touched). The in-workflow delete was a no-op by least-privilege design and was completed out-of-band.

**BR-5 build-authority closure = COMPLETE (green proof landed).** BR-6 remains **OPEN**. `AZURE_CREDENTIALS` retained as dormant rollback. `productionBlockingAchieved` remains 0; `final:go` advisory.

### 8.7 Temporary workflow removal
Per the workflow's stated temporary intent, `.github/workflows/build-identity-proof.yml` is removed from `main` after this single green run (PR [#588](https://github.com/anungis437/nzila-os/pull/588)). The green evidence above is the durable record.

### 8.8 Next decision (unchanged)
Run **one env-scoped non-prod deploy proof** before removing `AZURE_CREDENTIALS`: build proof first (done, green), deploy proof second. Keep `AZURE_CREDENTIALS` and legacy `nzila-os-cicd` until that deploy proof is also green. Then remove `AZURE_CREDENTIALS` (separate approval), then Phase E (BR-6).
