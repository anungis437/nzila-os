# Runtime Separation Implementation Wave — Phase C.1: Deployment Identity Activation & Verification

**Date:** 2026-06-28
**Wave:** Runtime Separation Implementation Wave
**Phase:** C.1 — Azure/GitHub deployment identity activation and verification (BR-4)
**Predecessor:** [Phase C](runtime-separation-wave-phaseC-deploy-identity-2026-06-28.md) (workflow-layer wiring)
**Repo:** `anungis437/nzila-os` · subscription/tenant redacted throughout

> **Constraints honored (verbatim mandate):** Old shared `AZURE_CREDENTIALS` was **not** deleted or rotated (retained for rollback). OIDC federated credentials used — **no client secrets** issued. Least-privilege RBAC (Contributor on own RG only; AcrPull only). No cross-environment Contributor. No application code deployed. No app runtime resources, database data, ACR topology, BR-5 image controls, BR-6 substrate, `final:go`, or certification artifacts touched. Hard stop after this report.

---

## 0. Privilege correction (material change from Phase C)

Phase C assumed the operator was read-only and therefore *staged* the Azure/GitHub commands without executing them. On re-checking at the start of Phase C.1, the signed-in principal (`support@onelabtech.com`) holds **Global Administrator** (Entra), **Owner**, and **User Access Administrator** on the subscription. Those privileges are sufficient to create app registrations, federated credentials, RG-scoped RBAC, and GitHub Environment secrets — so Phase C.1 was **executed**, not staged.

---

## 1. Identities created (live)

Four dedicated, environment-scoped deployment identities were created (idempotent; none pre-existed). App IDs / object IDs are stored locally and intentionally not printed here.

| Identity (app registration) | GitHub Environment | Service principal | OIDC fed-cred | Client secret |
| --- | --- | --- | --- | --- |
| `nzila-os-deploy-prod` | `production` | created | created | **none** |
| `nzila-os-deploy-staging` | `staging` | created | created | **none** |
| `nzila-os-deploy-demo` | `demo` | created | created | **none** |
| `nzila-os-deploy-pilot` | `pilot` | created | created | **none** |

`--sign-in-audience AzureADMyOrg` (single-tenant). No application passwords/secrets were generated for any of them.

---

## 2. Federated credential subjects (verified)

Each app has exactly one federated credential, issuer `https://token.actions.githubusercontent.com`, audience `api://AzureADTokenExchange`, subject bound to the **exact** GitHub Environment name used by the workflows:

| Identity | Federated subject (verified) | Match |
| --- | --- | --- |
| `nzila-os-deploy-prod` | `repo:anungis437/nzila-os:environment:production` | PASS |
| `nzila-os-deploy-staging` | `repo:anungis437/nzila-os:environment:staging` | PASS |
| `nzila-os-deploy-demo` | `repo:anungis437/nzila-os:environment:demo` | PASS |
| `nzila-os-deploy-pilot` | `repo:anungis437/nzila-os:environment:pilot` | PASS |

The subjects match the `environment:` keys in [deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml), [deploy-staging.yml](../../.github/workflows/deploy-staging.yml), and [gitops-deploy.yml](../../.github/workflows/gitops-deploy.yml), and the GitHub Environments `production` / `staging` / `demo` / `pilot` that already exist in the repo.

---

## 3. RBAC scopes (verified — least privilege)

Authoritative enumeration of each new SP's role assignments. Azure is default-deny, so the **absence** of any assignment on another environment's RG *is* the cross-environment denial.

| Identity | Contributor scope (exactly one) | ACR role | Other |
| --- | --- | --- | --- |
| `nzila-os-deploy-prod` | `nzila-canada-prod-rg` | AcrPull on `nzilacanadaacr` | none |
| `nzila-os-deploy-staging` | `nzila-canada-staging-rg` | AcrPull on `nzilacanadaacr` | none |
| `nzila-os-deploy-demo` | `nzila-canada-demo-rg` | AcrPull on `nzilacanadaacr` | none |
| `nzila-os-deploy-pilot` | `nzila-canada-pilot-rg` | AcrPull on `nzilacanadaacr` | none |

- **No AcrPush** was granted to any deploy identity (write to the registry remains with the build identity — preserved for BR-5).
- **No cross-environment Contributor.** Each Contributor scope set verified as exactly `[<own-rg>]`.
- AcrPull is registry-resource-scoped (not RG Contributor on the staging RG), so the staging-RG-resident registry does not leak staging compute rights to prod/demo/pilot identities.

---

## 4. GitHub Environment secrets (set; values redacted)

Set per environment and verified present **by name only**:

| GitHub Environment | `AZURE_CLIENT_ID` | `AZURE_TENANT_ID` | `AZURE_SUBSCRIPTION_ID` |
| --- | --- | --- | --- |
| `production` | set (= prod appId) | set | set |
| `staging` | set (= staging appId) | set | set |
| `demo` | set (= demo appId) | set | set |
| `pilot` | set (= pilot appId) | set | set |

`AZURE_CLIENT_ID` differs per environment (each env's own app). Because the deploy jobs reference `${{ secrets.AZURE_CLIENT_ID }}` **directly inside a job with `environment:` set**, GitHub resolves the Environment-scoped value, overriding any repo-level secret. No values were printed at any point.

---

## 5. Cross-environment access-denial verification

| Invariant | Method | Result |
| --- | --- | --- |
| Production identity cannot deploy to staging/demo/pilot RGs | RBAC enumeration — prod SP Contributor scope set = `[nzila-canada-prod-rg]` only | **PASS** |
| Staging/demo/pilot identities cannot deploy to production RG | RBAC enumeration — none hold any assignment on `nzila-canada-prod-rg` | **PASS** |
| No identity holds cross-env Contributor | Per-SP Contributor scope set verified = exactly its own RG | **PASS** |
| Federated subject pins each identity to one GitHub Environment | Subject string equality check (§2) | **PASS** |

**Method note (no client secrets used):** denial was proven by authoritative RBAC enumeration rather than by attempting a login as each SP. The identities are OIDC-only (no client secret exists), and the user mandate explicitly prefers federated credentials over long-lived secrets; minting even a temporary secret to attempt an empirical `AuthorizationFailed` would contradict that and is unnecessary because Azure RBAC is default-deny — an unlisted scope is an inaccessible scope. An end-to-end empirical denial (a real OIDC-authenticated `az` call returning `AuthorizationFailed` across a boundary) will naturally occur during the first env-scoped workflow run and should be captured then (§9).

---

## 6. Rollback plan (unchanged credential retained)

- **Rollback asset 1 — repo secret:** `AZURE_CREDENTIALS` is **still present** at repo scope (verified by name). Reverting the three workflow commits restores the old shared-credential login path immediately.
- **Rollback asset 2 — legacy SP:** `nzila-os-cicd` (appId `f79055d7-…`) was **not modified** by any Phase C.1 command and retains its prior broad Contributor across all four env RGs (Phase C state). It remains a working fallback.
- **Per-env disable:** to disable a single new identity, delete its federated credential (`az ad app federated-credential delete`) or its role assignment; the legacy path still works.
- **Full teardown:** delete the four `nzila-os-deploy-*` app registrations (cascades SP + fed-cred + role assignments). Entirely additive change — no existing resource was altered.
- **Do NOT** remove `AZURE_CREDENTIALS` or trim the legacy SP's broad Contributor until at least one environment-scoped deployment path has run green (separately approved smoke deploy — §9).

---

## 7. Remaining shared-credential references

Unchanged from Phase C (out of Phase C.1 scope):

- [gitops-deploy.yml](../../.github/workflows/gitops-deploy.yml) — **build** job (`az acr build`/push) and **verify** job (read-only health) still use `AZURE_CREDENTIALS`. Image push is **BR-5**; verify is read-only.
- [canary-deploy.yml](../../.github/workflows/canary-deploy.yml) — 4× `AZURE_CREDENTIALS`, prod canary, **no `environment:`** (HIGH priority follow-up — same env-scoped OIDC pattern).
- [deploy-console.yml](../../.github/workflows/deploy-console.yml), [deploy-partners.yml](../../.github/workflows/deploy-partners.yml), [deploy-web.yml](../../.github/workflows/deploy-web.yml) — OIDC hoist + fallback; de-hoist + drop fallback.
- [retire-legacy-union-eyes-ca.yml](../../.github/workflows/retire-legacy-union-eyes-ca.yml) — already `environment: production`; de-hoist + drop fallback.

---

## 8. ACR-push coupling caveat (affects deploy-union-eyes only; BR-5 boundary)

[deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml) **builds and pushes** images inside the same `build-and-deploy` job. The new env identities hold **AcrPull only**, so a real UE deploy that pushes an image would fail under the new identity until image build/push is separated onto the build identity (a BR-5 prerequisite). This was deliberate: granting AcrPush to per-env deploy identities would re-share registry write and violate least-privilege. Consequently:

- `gitops-deploy.yml`'s **deploy** job (container-app update only, AcrPull-sufficient) is the clean candidate for the first verified env-scoped deployment path.
- A green UE env-scoped deploy is **not** provable until BR-5 splits build from deploy.

This does **not** block BR-4 closure under the declared criteria (§10), which require identities + federated creds + GH secrets + RG-scoped RBAC + cross-env denial — all verified.

---

## 9. Evidence still to capture (first green run — separately approved)

1. A workflow run authenticating via OIDC as one env identity (no `AZURE_CREDENTIALS` referenced).
2. An empirical cross-boundary `AuthorizationFailed` from that OIDC session against another env's RG.
3. Recommended first target: a `gitops-deploy` deploy job to a non-prod env (AcrPull-sufficient).

Until then, the smoke-deploy evidence is **pending** by design; do not fabricate it.

---

## 10. BR-4 status

**Phase C.1 declaration:**
> Deployment identity activation is complete. BR-4 is closed only if environment-scoped OIDC identities, federated credentials, GitHub Environment secrets, RG-scoped RBAC, and cross-environment denial checks are all verified. BR-5 and BR-6 remain pending.

Against those five criteria:

| Closure criterion | State |
| --- | --- |
| Environment-scoped OIDC identities | **VERIFIED** (4 created) |
| Federated credentials | **VERIFIED** (subjects pinned per env) |
| GitHub Environment secrets | **VERIFIED** (present by name, per env) |
| RG-scoped RBAC | **VERIFIED** (Contributor = own RG only; AcrPull only) |
| Cross-environment denial | **VERIFIED** (RBAC default-deny enumeration) |

All five closure criteria are met → **BR-4 is CLOSED** at the identity/boundary layer.

**Caveats (explicit, not closure-blocking):** (a) the old shared `AZURE_CREDENTIALS` and the legacy SP's broad Contributor are intentionally **retained** for rollback and must be removed only after a green env-scoped deploy; (b) a UE-specific green deploy is gated on BR-5 (ACR push separation) per §8; (c) an empirical (vs. RBAC-derived) cross-boundary denial will be captured on first run (§9).

`final:go` remains advisory; production-blocking achieved remains **0**. No production-readiness is claimed.

---

## HARD STOP

Do **not** proceed to BR-5 (ACR/image-boundary), BR-6 (org-context substrate), the follow-up workflow conversions (§7), removal of `AZURE_CREDENTIALS`, or any smoke deployment without separate explicit approval.

**Correct next sequence:** Phase C closeout (mark BR-4 closed — done above) → Phase D: BR-5 image boundary / ACR promotion controls → Phase E: BR-6 org-context substrate drift.
