# Runtime Separation Wave — Phase D.4: Env-Scoped Non-Prod Deploy Proof

**Date:** 2026-06-28
**Phase:** D.4 — environment-scoped non-prod deploy proof
**Status:** ✅ GREEN
**Scope discipline:** No production deploy, no production runtime/DB/Key Vault
touch, no new RBAC, `AZURE_CREDENTIALS` retained (dormant), `nzila-os-cicd`
untouched, no BR-6 work, no `final:go`, no certification artifacts, no
production-readiness claims.

---

## 1. Objective

Prove that an environment-scoped deploy identity can deploy using the new OIDC
path, consume an immutable digest, and stay inside its own non-prod resource
boundary.

**Primary invariant:** A non-prod deploy identity may update only its own
non-prod target and must not have access to production resources.

**Proof target:** `staging` (the repo's approved non-prod GitHub Environment).

---

## 2. Proof vehicle

A minimal, dispatch-only proof workflow `br5-staging-deploy-proof.yml` was used
rather than the full `gitops-deploy.yml` deploy path. Rationale:

- `gitops-deploy.yml`'s `deploy` job has `needs: [plan, build]`, where `build`
  rebuilds **all 16 matrix apps** and runs the full validate gate — far broader
  than a controlled single-target identity proof, and its trailing
  "Set Sentry DSN" step touches `union-eyes`/`zonga` regardless of target.
- Phase D.4 scope items 11–16 (single target; capture before/after revision;
  rollback on failure) call for a **tightly scoped** proof.

The proof workflow used the **identical deploy mechanic** as the
`gitops-deploy.yml` `deploy` job:
- job bound to the `staging` GitHub Environment,
- `azure/login@v3` with direct `${{ secrets.AZURE_CLIENT_ID/TENANT_ID/SUBSCRIPTION_ID }}`
  (environment-scoped OIDC, **not** `AZURE_CREDENTIALS`),
- fail-closed production boundary gate,
- AcrPull digest resolution + `az containerapp update --image <repo>@sha256:...`.

It redeployed a single harmless staging app (`nzila-os-cora`) to its **own
current digest** (byte-identical image) so the running workload did not change,
with before/after capture and rollback on health failure.

The workflow was deliberately named `br5-*` (not `deploy-*`) so it is correctly
excluded from the `deploy-*` release-attestation contract invariants
(`RELEASE_ATTESTATION_REQUIRED_001`, `RELEASE_ATTESTATION_CORRECTNESS_001`) —
it is a scoped identity proof, not a release pipeline. (A first push using the
`deploy-proof-staging.yml` name was correctly blocked by those pre-push contract
tests; the rename resolved it and all 9307 contract tests passed.)

The workflow was landed on `main` via the isolated-worktree pattern (PR #589,
squash commit `8554041938a92334d80ea701009efba81fa584ca`), dispatched, then
removed from `main` after the green run (PR #590). The uncommitted Runtime
Separation wave (69 working-tree files) was never disturbed.

---

## 3. Pre-flight identity verification (live)

`nzila-os-deploy-staging`:
- **appId (OIDC, non-secret):** `8bfc2641-827c-4acd-8350-22434d64bcf1`
- **SP object id:** `66ec0cdf-ff35-42bd-9104-f424f7c8a455`
- **Federated subject:** `repo:anungis437/nzila-os:environment:staging`
- **RBAC (complete):**
  - `Contributor` on `/subscriptions/5d819f33-…/resourceGroups/nzila-canada-staging-rg` (own RG only)
  - `AcrPull` on `…/nzila-canada-staging-rg/providers/Microsoft.ContainerRegistry/registries/nzilacanadaacr`
  - **No `AcrPush`. No production RG. No Contributor anywhere else.**

`staging` GitHub Environment:
- Protection rules: none (did not block dispatch).
- Secret names present (no values read): `AZURE_CLIENT_ID`,
  `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (+ unrelated DNS secrets).

---

## 4. Required report fields

| Field | Value |
|---|---|
| **Workflow run URL** | https://github.com/anungis437/nzila-os/actions/runs/28385060423 (conclusion: **success**, 53s) |
| **Target environment** | GitHub Environment `staging` |
| **Target resource group** | `nzila-canada-staging-rg` |
| **Authenticated deploy identity** | `nzila-os-deploy-staging` (appId `8bfc2641-827c-4acd-8350-22434d64bcf1`); the run asserted `az account show --query user.name` == the staging environment `AZURE_CLIENT_ID` secret |
| **Proof production RG was inaccessible** | Boundary gate step passed: `Boundary OK: production RG invisible; staging RG visible.` The gate runs `az group show --name nzila-canada-prod-rg` under the staging identity and fails closed if it succeeds; it did not. |
| **Immutable image digest used** | `nzilacanadaacr.azurecr.io/nzila/cora@sha256:46368d7284004c5fb5ce2162bb613b45509788779c86be73b8ad39021dc03730` |
| **Before state** | image `nzilacanadaacr.azurecr.io/nzila/cora:6262e38ce7f09d1dc04ea9480b49bf236c37bf6a` (mutable tag), revision `nzila-os-cora--0000146` |
| **After state** | image `nzilacanadaacr.azurecr.io/nzila/cora@sha256:46368d7…03730` (digest-pinned), revision `nzila-os-cora--0000147`, `Running` |
| **Rollback result** | Not needed — new revision reached `Running`; health check reported `Health OK: revision nzila-os-cora--0000147 is Running.` |
| **Is BR-5 now closed?** | **Yes** — see §6. |
| **Remaining `AZURE_CREDENTIALS` retirement plan** | Deferred to Phase D.5 (legacy credential retirement). `AZURE_CREDENTIALS` remains in place as a dormant rollback. See §7. |

---

## 5. What the proof demonstrated

1. **GitHub Environment** = `staging` (approved non-prod). ✅
2. **Azure login via environment-scoped OIDC**, not `AZURE_CREDENTIALS`. ✅
3. **Authenticated client id matches** the expected non-prod deploy identity
   (`az account show` == staging `AZURE_CLIENT_ID` secret). ✅
4. **Target RG matches the GitHub Environment** (`nzila-canada-staging-rg`). ✅
5. **Production RG not visible/accessible** to the non-prod identity (boundary
   gate `az group show nzila-canada-prod-rg` failed for the staging identity). ✅
6. **Image reference is immutable `@sha256:`** (digest resolved via AcrPull and
   the container app updated by digest). ✅
7. **Deploy identity has no `AcrPush`** (only `AcrPull` + `Contributor` on its
   own RG, verified live in §3). ✅
8. **No secret values printed** (client id appeared only as `***`; only resource
   names, revisions, and the public image digest were emitted). ✅
9. **Real container app update** performed on staging only: before/after captured,
   health verified, rollback path present (not exercised). ✅

Production `nzila-canada-prod-rg` remained `Succeeded` and untouched (owner-view
sanity check). The `cora` workload is byte-identical (same digest) and now
pinned by digest rather than mutable tag.

---

## 6. BR-5 closure

> **Declaration.** Env-scoped non-prod deploy proof is complete only if the
> non-prod deploy identity authenticated through GitHub OIDC, stayed inside its
> own resource boundary, consumed an immutable image reference, and completed
> without production access. BR-5 is closed only if this proof is green. BR-6
> remains pending.

All four conditions are satisfied by run 28385060423:
- authenticated through GitHub OIDC (env-scoped staging identity, no `AZURE_CREDENTIALS`),
- stayed inside its own resource boundary (`nzila-canada-staging-rg`; prod invisible),
- consumed an immutable image reference (`@sha256:46368d7…03730`),
- completed without production access.

Combined with the previously-accepted BR-5 evidence — build proof GREEN
(Phase D.3, run 28383440032), deploy authority cleanup GREEN, image
immutability GREEN — **BR-5 is CLOSED.** BR-6 remains **OPEN**.

---

## 7. Remaining `AZURE_CREDENTIALS` retirement plan (Phase D.5)

`AZURE_CREDENTIALS` was **not** removed in this phase. It is retained as a
dormant rollback. Phase D.5 (legacy credential retirement) will:
1. Remove repo-level `AZURE_CREDENTIALS` from active use (confirm no live
   workflow path still references it for login).
2. Optionally disable/trim `nzila-os-cicd`.
3. Produce the BR-5 closeout.

D.5 is a separate future phase and is **not** part of D.4.

---

## 8. Current BR state (post-D.4)

- BR-1 / BR-2 / BR-3: refuted live (earlier phases).
- BR-4: CLOSED.
- **BR-5: CLOSED** (this phase).
- BR-6: OPEN.
- `AZURE_CREDENTIALS`: retained, dormant rollback.
- `final:go`: advisory.
- productionBlockingAchieved: 0.

---

## 9. Artifacts & references

- Proof run: https://github.com/anungis437/nzila-os/actions/runs/28385060423
- Land PR: #589 (squash `8554041938a92334d80ea701009efba81fa584ca`)
- Remove PR: #590 (workflow now 404 on `main`)
- Prior build proof: [Phase D.3 report](runtime-separation-wave-phaseD3-build-proof-2026-06-28.md)

---

**HARD STOP.** Phase D.4 is complete and green. BR-5 is closed. Awaiting human
review before any Phase D.5 (legacy credential retirement) work. Do not proceed
to BR-6, `final:go`, certification artifacts, or production-readiness claims.
