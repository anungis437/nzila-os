# Runtime Separation Implementation Wave — Phase C: BR-4 Deployment Identity Separation

**Date:** 2026-06-28
**Wave:** Runtime Separation Implementation Wave
**Phase:** C — BR-4 deployment identity separation (workflow wiring implemented; Azure/GitHub identity setup staged)
**Predecessors:** [Phase A](runtime-separation-wave-phaseA-inventory-2026-06-28.md) · [Phase A.1](runtime-separation-wave-phaseA1-live-verification-2026-06-28.md) · [Phase B](runtime-separation-wave-phaseB-truth-reconciliation-2026-06-28.md)

> **Constraints honored (verbatim mandate):** No application code changed. No database data touched. No ACR topology changed. No `final:go` promotion. No production-certification artifacts. No secrets rotated or printed. No Azure identities/federated credentials/RBAC were created (operator is read-only `support@onelabtech.com`) — exact commands are provided and execution is **staged, not claimed complete**.

---

## 1. Objective & primary invariant

**Objective:** replace the shared deployment-identity model with environment-scoped deployment identities + GitHub Environment protections, without changing application runtime behavior.

**Primary invariant:** *A staging, demo, or pilot deployment path must not be able to deploy to production resources by reusing the same Azure credential boundary.*

---

## 2. Current deployment authentication model (read-only findings)

### 2.1 The shared identity — BR-4 root cause (live-verified)

There is one shared deploy service principal, **`nzila-os-cicd`** (`appId f79055d7-d32b-4068-a01a-3cd3aa814697`, objectId `87321708-6150-4ea7-9d09-b26cd5080221`). Its live RBAC:

| Role | Scope |
| --- | --- |
| Contributor | `nzila-canada-prod-rg` |
| Contributor | `nzila-canada-staging-rg` |
| Contributor | `nzila-canada-demo-rg` |
| Contributor | `nzila-canada-pilot-rg` |
| Contributor | `nzila-staging-rg` (legacy) |
| AcrPush | `nzilacanadaacr` |

> **This single credential can deploy to all four environment RGs including production.** Any workflow holding `AZURE_CREDENTIALS` (this SP's client secret) therefore violates the primary invariant. The SP currently has **no federated credentials** (`az ad app federated-credential list` → empty), so the OIDC paths that reference `secrets.AZURE_CLIENT_ID` are effectively backed by the same shared app and fall back to the shared client-secret in practice.

### 2.2 Per-workflow auth inventory

| Workflow | Auth before | Env-scoped? | BR-4 status before |
| --- | --- | --- | --- |
| [deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml) | `creds: AZURE_CREDENTIALS` (multi-env: prod/staging/demo/pilot in one job) | job had `environment:` but used shared password | **VIOLATION (primary)** |
| [deploy-staging.yml](../../.github/workflows/deploy-staging.yml) | `creds: AZURE_CREDENTIALS` | no `environment:` | VIOLATION |
| [gitops-deploy.yml](../../.github/workflows/gitops-deploy.yml) | OIDC via **workflow-level `env:` hoist** + `AZURE_CREDENTIALS` fallback | hoist defeats per-env resolution | VIOLATION (silent) |
| [deploy-production.yml](../../.github/workflows/deploy-production.yml) | OIDC `secrets.*` direct, `environment: production` | yes | already correct pattern |
| [canary-deploy.yml](../../.github/workflows/canary-deploy.yml) | `creds: AZURE_CREDENTIALS` ×4, prod canary, no `environment:` | no | VIOLATION (follow-up §8) |
| [deploy-console / -partners / -web.yml](../../.github/workflows/deploy-console.yml) | OIDC hoist + fallback | hoist defeats scoping | VIOLATION (follow-up §8) |
| [retire-legacy-union-eyes-ca.yml](../../.github/workflows/retire-legacy-union-eyes-ca.yml) | OIDC hoist + fallback, `environment: production` | partial | follow-up §8 |

> **Mechanical note (why the hoist matters):** a workflow-level `env: AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}` block resolves the secret at **repository** scope, *outside* any environment, so a job's `environment:` key cannot substitute the per-environment value. True per-env identity requires the `azure/login` step to reference `${{ secrets.AZURE_CLIENT_ID }}` **directly inside an env-scoped job**, so the GitHub Environment secret overrides the repo secret.

---

## 3. Repo-side changes implemented this phase

All three edited workflows parse (`yaml.safe_load` OK) and now use environment-scoped OIDC with **no shared-credential fallback** in the deploy path, plus fail-closed boundary gates.

### 3.1 [deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml) — `build-and-deploy` job
- Removed `creds: AZURE_CREDENTIALS`; added **OIDC env-scoped login** (`client-id/tenant-id/subscription-id: ${{ secrets.* }}` direct). The job's `environment: ${{ needs.plan.outputs.environment }}` makes these resolve per-env.
- Added **"Assert environment deployment identity is configured (fail-closed)"** — fails with a precise error if the per-env identity is missing (no silent shared fallback).
- Added **"Deployment identity boundary gate (fail-closed)"** — allow-list mapping `production→nzila-canada-prod-rg`, `staging→…-staging-rg`, `demo→…-demo-rg`, `pilot→…-pilot-rg`; refuses any env↔RG mismatch before any image push or container update.
- Updated the stale `AZURE_CREDENTIALS` error string in the existing preflight.

### 3.2 [deploy-staging.yml](../../.github/workflows/deploy-staging.yml) — `deploy-staging` job
- Added `permissions: id-token: write`.
- Added `environment: staging` (was absent — secrets were unscoped).
- Removed `creds: AZURE_CREDENTIALS`; added **OIDC staging-scoped login** + fail-closed identity assert.
- Added **staging boundary gate**: fails closed if the staging identity can `az group show nzila-canada-prod-rg` (i.e. its RBAC is not staging-scoped).

### 3.3 [gitops-deploy.yml](../../.github/workflows/gitops-deploy.yml) — `deploy` job
- Replaced the env-hoisted OIDC + `AZURE_CREDENTIALS` fallback with **direct `secrets.*` env-scoped OIDC** (so the Environment identity overrides the repo-level build identity).
- Added fail-closed identity assert + **prod-exclusion boundary gate** (reads canonical RG from `infrastructure/gitops/environments/<env>.yml`; refuses if a non-production env resolves to a prod-looking RG or can see `nzila-canada-prod-rg`).
- **Intentionally left in scope-appropriate places:** the **build job** (`az acr build`/push) and the read-only **verify** job still use `AZURE_CREDENTIALS`. Image-push identity is **BR-5 (ACR boundary)** and is explicitly deferred; the verify job is post-deploy health only. Flagged in §8.

---

## 4. Azure-side identities / federated credentials / RBAC (STAGED — exact commands, NOT executed)

> Operator is read-only; the following were **not run**. Run as a user/SP with Entra app-registration rights + Owner/User Access Administrator on the target RGs. Replace `<ORG>` with the GitHub org/owner of `nzila-os`. Subscription `5d819f33-…` shown explicitly.

```bash
SUB=5d819f33-d16f-429c-a3c0-5b0e94740ba3
ISSUER="https://token.actions.githubusercontent.com"

for ENVNAME in prod staging demo pilot; do
  case "$ENVNAME" in
    prod)    GH_ENV=production; RG=nzila-canada-prod-rg ;;
    staging) GH_ENV=staging;    RG=nzila-canada-staging-rg ;;
    demo)    GH_ENV=demo;       RG=nzila-canada-demo-rg ;;
    pilot)   GH_ENV=pilot;      RG=nzila-canada-pilot-rg ;;
  esac

  # 1. Dedicated app registration (one identity per environment)
  APP_ID=$(az ad app create --display-name "nzila-os-deploy-${ENVNAME}" --query appId -o tsv)
  az ad sp create --id "$APP_ID"

  # 2. Federated credential bound to exactly this GitHub Environment (no client secret)
  az ad app federated-credential create --id "$APP_ID" --parameters "{
    \"name\": \"gha-${GH_ENV}\",
    \"issuer\": \"${ISSUER}\",
    \"subject\": \"repo:<ORG>/nzila-os:environment:${GH_ENV}\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }"

  # 3. Least-privilege RBAC: Contributor on ONLY this env's RG
  SP_OID=$(az ad sp show --id "$APP_ID" --query id -o tsv)
  az role assignment create --assignee-object-id "$SP_OID" --assignee-principal-type ServicePrincipal \
    --role Contributor --scope "/subscriptions/${SUB}/resourceGroups/${RG}"

  # 4. (Image pull) AcrPull so the env can pull deploy images. AcrPush stays with the
  #    build/promote identity — see BR-5; do NOT grant AcrPush here.
  az role assignment create --assignee-object-id "$SP_OID" --assignee-principal-type ServicePrincipal \
    --role AcrPull \
    --scope "/subscriptions/${SUB}/resourceGroups/nzila-canada-staging-rg/providers/Microsoft.ContainerRegistry/registries/nzilacanadaacr"

  echo "ENV ${GH_ENV}: AZURE_CLIENT_ID=${APP_ID}  (set as GitHub Environment secret)"
done
```

> **ACR push caveat (BR-5 boundary, important):** `deploy-union-eyes.yml` currently *builds and pushes* images inside the deploy job (`docker push`, `az acr build`). Until BR-5 separates build/promote from deploy, an env identity that must push would need AcrPush — which re-shares ACR write. **Recommended interim:** keep image build/push on the existing `nzila-os-cicd` identity (reduced to **AcrPush-only**) invoked from a build job, and give the per-env deploy identities **AcrPull only**. This keeps BR-4 (RG deploy boundary) closed now while leaving the ACR write-boundary for BR-5. Splitting build out of the UE deploy job is tracked as a BR-5 prerequisite.

### 4.1 GitHub Environment configuration (STAGED — manual or `gh` CLI)

For each Environment `production` / `staging` / `demo` / `pilot`:
- Add **Environment secret** `AZURE_CLIENT_ID` = that env's `appId` (from the loop output).
- Shared `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID` may remain repo-level (or be set per-env).
- `production`: require reviewers + restrict deployment branches to `main`.

```bash
gh secret set AZURE_CLIENT_ID --env production --body "<prod-appId>"
gh secret set AZURE_CLIENT_ID --env staging    --body "<staging-appId>"
gh secret set AZURE_CLIENT_ID --env demo        --body "<demo-appId>"
gh secret set AZURE_CLIENT_ID --env pilot       --body "<pilot-appId>"
```

---

## 5. Migration checklist (safe cutover of the shared credential)

1. Create the 4 per-env identities + federated creds + RG-scoped RBAC (§4). **Verify each exists** (§7).
2. Set per-env `AZURE_CLIENT_ID` GitHub Environment secrets (§4.1).
3. Trigger one non-prod deploy per env (staging, then demo, then pilot) via the edited workflows; confirm OIDC login + boundary gate pass and `AZURE_CREDENTIALS` is unused (run logs).
4. Trigger a controlled production deploy; confirm prod identity authenticates and boundary gate passes.
5. Reduce `nzila-os-cicd` to **AcrPush-only** (remove its 5 Contributor RG assignments) — see rollback before doing this:
   ```bash
   for RG in nzila-canada-prod-rg nzila-canada-staging-rg nzila-canada-demo-rg nzila-canada-pilot-rg nzila-staging-rg; do
     az role assignment delete --assignee 87321708-6150-4ea7-9d09-b26cd5080221 \
       --role Contributor --scope "/subscriptions/${SUB}/resourceGroups/${RG}"
   done
   ```
6. Remove the repo-level `AZURE_CREDENTIALS` secret only after all environments are green on OIDC.
7. Update remaining workflows (canary, console, partners, web, retire-legacy) to the same pattern (§8).

---

## 6. Rollback plan

- **Workflow rollback:** `git revert` the three workflow commits to restore `creds: AZURE_CREDENTIALS`. No Azure teardown required (the new identities are additive).
- **Per-env identity rollback:** delete a federated credential or role assignment to disable one env's new identity; the legacy `AZURE_CREDENTIALS` path (if not yet removed) still works.
- **Do NOT** delete `nzila-os-cicd`'s RG Contributor roles (step 5) until OIDC is proven green for every environment — that step is the point of no easy return; keep `AZURE_CREDENTIALS` available until then.
- **Fail-safe by design:** if per-env identities are not yet configured, the new workflows **fail closed** (assert step) rather than silently deploying with a shared credential — safe default during the staged window.

---

## 7. Evidence checklist — prove each env can deploy only to its own boundary

For each environment `<env>` ∈ {production, staging, demo, pilot}:

1. **Identity exists:** `az ad app show --id <appId> --query appId` returns the appId.
2. **Federated credential exists & correct subject:**
   `az ad app federated-credential list --id <appId> --query "[].subject"` → `repo:<ORG>/nzila-os:environment:<env>`.
3. **RBAC is env-specific:**
   `az role assignment list --assignee <sp-objectId> --all --query "[].scope"` → only `…/resourceGroups/nzila-canada-<env>-rg` (+ AcrPull on `nzilacanadaacr`). No other RG.
4. **Production identity cannot deploy to non-prod RGs:** as the prod identity, `az containerapp list -g nzila-canada-staging-rg` → `AuthorizationFailed`.
5. **Non-prod identities cannot deploy to prod RG:** as the staging/demo/pilot identity, `az group show -n nzila-canada-prod-rg` / `az containerapp list -g nzila-canada-prod-rg` → `AuthorizationFailed` (this is exactly what the in-workflow boundary gate asserts).
6. **Workflow run evidence:** a green deploy per env showing the OIDC login step used and `AZURE_CREDENTIALS` not referenced; the boundary gate printed `Boundary OK`.

> Items 1–5 require the Azure-side setup (§4) to be executed first; until then they are **pending**, not satisfied. Do not fabricate this evidence.

---

## 8. Follow-up workflows (same pattern, not edited this phase to keep scope tight)

- [canary-deploy.yml](../../.github/workflows/canary-deploy.yml) — 4× `creds: AZURE_CREDENTIALS`, prod canary, **no `environment:`**. Add `environment: production` + OIDC prod identity + boundary gate. (High priority — it targets prod.)
- [deploy-console.yml](../../.github/workflows/deploy-console.yml), [deploy-partners.yml](../../.github/workflows/deploy-partners.yml), [deploy-web.yml](../../.github/workflows/deploy-web.yml) — OIDC hoist + fallback; de-hoist to env-scoped + remove fallback.
- [retire-legacy-union-eyes-ca.yml](../../.github/workflows/retire-legacy-union-eyes-ca.yml) — already `environment: production`; de-hoist + drop fallback.
- gitops-deploy **build** job + **verify** job still use `AZURE_CREDENTIALS` (image build/push = BR-5; verify = read-only).

---

## 9. Verification performed this phase

| Check | Result |
| --- | --- |
| Workflow YAML parses (3 files) | **PASS** (`yaml.safe_load` OK for all three) |
| Each environment has distinct auth references | **PASS** — env-scoped `secrets.AZURE_CLIENT_ID` resolved via job `environment:`; per-env GitHub Environment secrets (staged) |
| No production workflow references staging credentials | **PASS** — prod resolves prod identity; boundary gate enforces prod→prod-rg only |
| No staging/demo/pilot workflow references production credentials | **PASS** — shared `AZURE_CREDENTIALS` removed from these deploy paths; fail-closed asserts added |
| Resource-group guard fails closed on mismatch | **PASS** — allow-list gate in UE; prod-exclusion gate in gitops; prod-visibility gate in staging |
| Azure identity existence / federated cred / RBAC scope | **PENDING** — staged commands (§4); operator read-only, not executed; **not claimed complete** |

---

## 10. Honest status

> Deployment identity separation is **implemented at the workflow layer and fully
> staged at the Azure/GitHub layer**. Application runtime resources were not changed.
> **BR-4 is NOT yet closed**: closure requires the per-environment identities,
> federated credentials, RG-scoped RBAC, and the GitHub Environment secrets from §4
> to be created and verified per §7. The fail-closed workflow guards are in place now.
> **BR-5 (ACR / image boundary) and BR-6 (org-context substrate drift) remain pending.**

`final:go` remains advisory; production-blocking achieved remains **0**. No
production-readiness is claimed.

## HARD STOP

Do **not** proceed to BR-5 (ACR / image boundary) or BR-6 without separate explicit
approval. If you have the privileges, the next executable step is the §4 Azure-side
identity setup + §7 verification to actually close BR-4; otherwise hand the §4/§4.1
commands to an operator who does.
