# Runtime Separation Wave — Phase D: Image Boundary / ACR Promotion Controls (BR-5)

**Date:** 2026-06-28
**Scope:** BR-5 only — separate image build/push authority from environment deployment
authority so deploy identities consume approved images but cannot write arbitrary
images to the registry.
**Status:** BR-5 **partially closed** (implemented for the primary deploy paths;
two items staged). BR-6 remains pending.
**Subscription / tenant identifiers:** redacted in this report.

---

## 0. Primary invariant under test

> A production deployment path must only deploy an approved, traceable image.
> Environment deploy identities must not have registry write authority.

Two enforcement layers were assessed:

1. **Identity layer (already established in Phase C.1):** the four per-environment
   deploy identities (`nzila-os-deploy-{prod,staging,demo,pilot}`) hold **AcrPull
   only** on the shared registry `nzilacanadaacr` and **no AcrPush**. The absence of
   an AcrPush role assignment is the default-deny proof that these identities cannot
   write to the registry. This was verified live in Phase C.1 and was **not changed**
   in Phase D.
2. **Workflow-design layer (this phase):** build/push steps must run under a
   build identity, and deploy steps must consume an **immutable `@sha256` digest**
   produced by the build step — never a mutable tag.

---

## 1. Current image build / push / deploy map (pre-Phase-D)

| Workflow | Build/push? | Deploy? | Identity used for deploy | Image ref deployed | BR-5 issue |
|---|---|---|---|---|---|
| `deploy-union-eyes.yml` (real UE path; driven by `auto-promote-union-eyes.yml` on push to main, per-env fanout) | YES (`docker push`, `az acr build`) | YES | env-scoped OIDC (AcrPull-only) **in the same job** | mutable `:${{ github.sha }}` | **build+push+deploy coupled in one job**; AcrPull-only identity cannot push → job was fail-closed/broken post-C.1; mutable tag deploy |
| `gitops-deploy.yml` | `build` job (repo-level/`AZURE_CREDENTIALS` build identity, AcrPush) | `deploy` job (env-scoped OIDC, AcrPull) | env-scoped OIDC | mutable `${ACR}/nzila/${APP}:${VERSION}` | jobs already separated (good) but deploy used a **mutable tag** |
| `canary-deploy.yml` | NO (updates revisions only) | YES (production canary; targets incl. `nzila-os-union-eyes`) | shared `AZURE_CREDENTIALS` (push-capable), **no `environment:`** | mutable `:${{ inputs.image_tag }}`, default `latest` | **shared push-capable credential + unpinned/`latest` tag to production** |
| `deploy-production.yml` | NO | YES (canonical prod) | env-scoped OIDC (production) | from `staging-artifacts/artifact-manifest.json` via `scripts/deploy-transactional.ts` | **no fail-closed check that the manifest image is digest-pinned** |
| `deploy-staging.yml` (Phase C) | NO build coupling observed | YES | env-scoped OIDC (staging) | n/a (no `az acr build`/`docker push`) | conformant |

`scripts/deploy-transactional.ts` resolves each target's image from
`raw.image ?? raw.imageRef ?? raw.digest`. It accepts whatever the manifest carries
and does **not** itself require a digest — so production immutability must be enforced
by the workflow gate (added in this phase).

---

## 2. Remaining `AZURE_CREDENTIALS` references (classification)

`AZURE_CREDENTIALS` was intentionally **retained** this phase (rollback safety; scope
forbids removal). Classification of remaining references:

| Reference | File | Classification |
|---|---|---|
| `build` job login | `gitops-deploy.yml` (~line 189, OIDC + `AZURE_CREDENTIALS` fallback) | **BUILD authority** — pushes images; legitimate build identity (AcrPush) |
| `verify` job login | `gitops-deploy.yml` (~line 434) | **LEGACY/verify** — read-only post-deploy health; no push, no deploy |
| `build-push` job login | `deploy-union-eyes.yml` (new) | **BUILD authority** — pushes UE frontend/backend images; build identity (AcrPush) |
| `deploy-canary` job login | `canary-deploy.yml` | **DEPLOY (staged for OIDC migration)** — still shared creds; image immutability now enforced, identity migration staged (see §7) |

No environment deploy identity was granted AcrPush. No `AZURE_CREDENTIALS` reference
was removed.

---

## 3. Selected ACR strategy

**Keep the shared registry `nzilacanadaacr`; enforce promotion discipline.** No
physical prod/non-prod registry split was performed (explicitly out of scope unless
the shared-registry control model is proven impossible — it was not). The image
boundary is enforced by:

- build/push authority (AcrPush) is held only by the build identity;
- deploy identities are AcrPull-only and deploy by **immutable `@sha256` digest**;
- mutable tags (`:latest`, `:sha`, `:env`) are not accepted as production promotion
  evidence.

A physical production ACR remains a later hardening option if procurement or
certification requires it.

---

## 4. Workflow changes made

### 4.1 `deploy-union-eyes.yml` — split build/push from deploy (core BR-5 fix)
- Introduced a new **`build-push`** job (no `environment:`) that runs under the
  repo-level **build identity** (`AZURE_CREDENTIALS`, AcrPush). It builds + pushes the
  frontend (`docker push`) and backend (`az acr build`) images, then resolves and
  **outputs the immutable `@sha256` digests** (`frontend_digest`, `backend_digest`).
  It fails closed if a digest cannot be resolved or is not a `sha256:` reference.
- Converted the former `build-and-deploy` job into a pure **`deploy`** job
  (`needs: [plan, pre-deploy-gates, build-push]`, still `environment:`-scoped, AcrPull).
  Removed the `ACR login` / `Build & push frontend` / `Build & push backend` steps.
- The `deploy` job now deploys by digest:
  `--image ${{ env.IMAGE }}@${{ needs.build-push.outputs.frontend_digest }}` (create +
  frontend update) and
  `--image ${{ env.BACKEND_IMAGE }}@${{ needs.build-push.outputs.backend_digest }}`
  (backend update).

### 4.2 `gitops-deploy.yml` — digest-pin the deploy loop
- In the `deploy` job loop, each app's mutable `:${VERSION}` tag is resolved to its
  `@sha256` digest via `az acr repository show` (AcrPull is sufficient) and deployed by
  digest. **Production fails closed** if a digest cannot be resolved; non-production
  emits a warning and falls back to the tag.

### 4.3 `canary-deploy.yml` — reject mutable tags for the prod canary
- The `deploy-canary` step now **rejects `latest`** and resolves the requested tag to
  an immutable `@sha256` digest, deploying by digest. Fails closed if no digest
  resolves. (Identity migration to env-scoped OIDC is staged — see §7.)

### 4.4 `deploy-production.yml` — manifest immutability gate
- Before invoking `scripts/deploy-transactional.ts`, a fail-closed `jq` gate asserts
  that **every** approved deploy target image matches `@sha256:[0-9a-f]{64}$` and that
  at least one target resolved. A mutable tag blocks the production promotion.

---

## 5. Digest-pinning / promotion controls added

- UE: build identity emits digests; deploy consumes `<repo>@sha256:<digest>`.
- gitops: tag→digest resolution at deploy time; prod fail-closed.
- canary: `latest` rejected; tag→digest resolution; fail-closed.
- production: filtered manifest must be 100% digest-pinned before transactional promotion.

---

## 6. Fail-closed checks added

| Required check | Where implemented |
|---|---|
| Deploy fails if image digest is missing for production | UE `deploy` immutability gate; gitops prod branch; canary digest resolve; prod manifest gate |
| Deploy fails if production image source is mutable-only | UE gate (`sha256:` required); gitops prod (`continue`/`FAILED`); canary (`latest` rejected); prod manifest gate (`@sha256:` regex) |
| Deploy fails if target environment/RG does not match the GitHub Environment | Pre-existing BR-4 boundary gates (UE, gitops, deploy-production) — retained |
| Deploy identity has no AcrPush | Enforced at identity layer (Phase C.1, AcrPull-only) + structural separation: deploy jobs contain no `docker push` / `az acr build` |

---

## 7. What remains pending before removing legacy `AZURE_CREDENTIALS`

1. **canary-deploy.yml identity migration (staged):** migrate `deploy-canary` from the
   shared `AZURE_CREDENTIALS` to env-scoped OIDC (`id-token: write` + `environment:`),
   matching `deploy-production.yml`. Image immutability is already enforced; the
   remaining gap is that the canary deploy still authenticates with a push-capable
   shared credential. Low blast radius (manual dispatch only).
2. **gitops-deploy.yml `verify` job:** still read-only `AZURE_CREDENTIALS`; convert to
   OIDC or accept as a read-only legacy reference.
3. **Build identity hardening:** reduce the build identity (`nzila-os-cicd`) to
   AcrPush + minimal build scope, or introduce a dedicated `nzila-os-build` identity
   with a non-environment federated subject so build OIDC can replace the
   `AZURE_CREDENTIALS` client secret entirely.
4. **`scripts/deploy-transactional.ts` (optional defense-in-depth):** add a digest
   assertion in the script so every caller is protected, not only the workflow gate.

Until (1)–(3) land, `AZURE_CREDENTIALS` must remain.

---

## 8. Evidence commands used (this phase)

```bash
# Map build/push/deploy + credential usage
grep -nE 'az acr build|docker push|docker build|containerapp update|--image|AZURE_CREDENTIALS|environment:' \
  .github/workflows/{deploy-union-eyes,gitops-deploy,canary-deploy,deploy-production,auto-promote-union-eyes}.yml

# Confirm build/push steps are confined to the build-push job; deploy job consumes digests
grep -nE 'docker push|az acr build|docker build|needs.build-push.outputs' \
  .github/workflows/deploy-union-eyes.yml

# YAML parse validation (all edited workflows)
for f in deploy-union-eyes gitops-deploy canary-deploy deploy-production; do
  python3 -c "import yaml; yaml.safe_load(open('.github/workflows/$f.yml')); print('$f OK')"
done
```

No secret values were printed by any added step (digests and error strings only).

---

## 9. Rollback plan

- All changes are workflow-design edits in `.github/workflows/`. Revert via
  `git revert`/`git checkout` of the four files to restore the prior coupled behavior.
- No Azure RBAC, identity, registry, or runtime resource was modified this phase.
- `AZURE_CREDENTIALS` and the legacy `nzila-os-cicd` SP remain intact (build authority
  + rollback path).
- The per-environment deploy identities (Phase C.1) are unchanged (AcrPull-only).

---

## 10. Verification results

1. Workflow YAML parses — **PASS** (all four).
2. Deploy jobs do not require AcrPush — **PASS** (UE `deploy` has no `docker push`/`az acr build`; gitops/canary deploy use AcrPull metadata reads; prod gate is `jq` only).
3. Environment deploy identities remain AcrPull-only — **PASS** (unchanged from Phase C.1; no AcrPush granted).
4. Production deploy path requires immutable image evidence — **PASS** (UE digest gate; gitops prod fail-closed; canary reject-`latest`+digest; prod manifest `@sha256` gate).
5. No non-prod deploy identity can push to ACR — **PASS** (AcrPull-only; build via separate build identity).
6. No production deploy job uses staging/demo/pilot credentials — **PASS** (UE `deploy` resolves per-env GitHub Environment secrets; `deploy-production` uses production-scoped OIDC).
7. No secret values printed — **PASS**.
8. `final:go` remains advisory — **PASS** (untouched).

---

## 11. BR-5 declaration

> Image boundary controls are implemented or staged. Deploy identities remain
> AcrPull-only. BR-5 is closed only if build/push authority is separated from
> deployment authority, production image selection is immutable/auditable, and
> fail-closed checks are verified. BR-6 remains pending.

**Assessment:** Build/push authority is now separated from deployment authority on the
primary UE path and the gitops path; production image selection is immutable/auditable
(digest-pinned with fail-closed gates) across UE, gitops, canary, and the canonical
`deploy-production` path; the fail-closed checks parse and are structurally verified.
The **canary identity migration to env-scoped OIDC** and **build-identity hardening /
`AZURE_CREDENTIALS` removal** remain **staged**. Therefore **BR-5 is partially closed**
(image immutability + authority separation implemented; identity-credential cleanup
staged). **BR-6 remains pending.**

`productionBlockingAchieved` remains **0**. `final:go` remains advisory. No
certification artifacts created; no production-readiness claim made.

---

## 12. Correct next sequence

- **Phase D follow-up (staged):** migrate `canary-deploy.yml` to env-scoped OIDC;
  harden build identity; then remove `AZURE_CREDENTIALS`.
- **Phase E:** BR-6 — org-context substrate drift.
