# 04 — Full Deployment Parity Convergence

**Authority:** Repo HEAD vs deployed image SHAs (May 9, 2026).

---

## 1. Repo Truth (snapshot)

| Branch                            | HEAD SHA                                  |
|-----------------------------------|-------------------------------------------|
| `feat/trustcore-trust-ops-v1`     | `8b415d86239863737b795881c97ff6c655f091d9`|
| `main` (`origin/main`)            | `53198df99e4f851b03f1860cfd15cdb9256831bc`|

---

## 2. Deployed SHA Per App (staging fabric)

| App                          | Deployed image SHA / tag                                                                              | Drift vs `main`? |
|------------------------------|-------------------------------------------------------------------------------------------------------|------------------|
| `nzila-os-web`               | `f1e66a2d04720c5e8df59454e14e75104292f250`                                                            | UNKNOWN — earlier SHA, requires git lookup |
| `nzila-os-console`           | `f1e66a2d04720c5e8df59454e14e75104292f250`                                                            | UNKNOWN |
| `nzila-os-partners`          | `f1e66a2d04720c5e8df59454e14e75104292f250`                                                            | UNKNOWN |
| `nzila-os-union-eyes`        | `f1e66a2d04720c5e8df59454e14e75104292f250`                                                            | UNKNOWN |
| `nzila-os-zonga`             | `f1e66a2d04720c5e8df59454e14e75104292f250`                                                            | UNKNOWN |
| `nzila-os-control-plane`     | `f1e66a2d04720c5e8df59454e14e75104292f250`                                                            | UNKNOWN |
| `nzila-os-flow`              | `f1e66a2d04720c5e8df59454e14e75104292f250`                                                            | UNKNOWN |
| `nzila-os-cfo`               | `f1e66a2d04720c5e8df59454e14e75104292f250`                                                            | UNKNOWN |
| `nzila-os-agrimo`            | `f1e66a2d04720c5e8df59454e14e75104292f250`                                                            | UNKNOWN |
| `nzila-os-cora`              | `f1e66a2d04720c5e8df59454e14e75104292f250`                                                            | UNKNOWN |
| `nzila-os-trade`             | `f1e66a2d04720c5e8df59454e14e75104292f250`                                                            | UNKNOWN |
| `nzila-os-mobility`          | `f1e66a2d04720c5e8df59454e14e75104292f250`                                                            | UNKNOWN |
| `nzila-os-orchestrator-api`  | `f1e66a2d04720c5e8df59454e14e75104292f250`                                                            | UNKNOWN |
| `nzila-os-abr`               | `f1e66a2d04720c5e8df59454e14e75104292f250`                                                            | UNKNOWN |
| `nzila-os-platform-admin`    | `platform-admin-1636e98e-20260422172320:latest` **(DRIFT)**                                           | YES — divergent  |

> **Honest gap:** 14 of 15 apps share SHA `f1e66a2d…` (uniform — good).
> Platform-admin is on a 2026-04-22 image with a non-SHA tag — drifted from
> the canonical pipeline. Requires reconciliation.

---

## 3. Demo Fabric Parity

| App                          | Deployed image                                                  | SHA pinning     |
|------------------------------|-----------------------------------------------------------------|-----------------|
| `nzila-os-union-eyes-demo`   | `nzilacanadaacr.azurecr.io/nzila-os-union-eyes:production`      | NO — mutable tag |

> **Honest gap:** Demo uses `:production` tag, not a SHA. Demo deployment is
> **non-reproducible** — a re-pull at any time may yield a different image.

---

## 4. Release Metadata Inspection

The staging UE app has the following release metadata env vars set:
- `RELEASE_ID` — populated (per `valueSet: true`)
- `GITHUB_SHA` — populated
- `BUILD_TIME`, `BUILD_TIMESTAMP`, `ARTIFACT_ID` — populated
- `REVISION_TAG` — populated

Demo UE app has **none** of these. Release lineage is invisible on demo.

---

## 5. Migration State

| Tier    | Migration runner | Last verified | Verdict |
|---------|------------------|---------------|---------|
| local   | `pnpm db:migrate` | continuous (dev workflow) | LIVE |
| staging | gitops-deploy + manual `db:migrate` step | per release | PARTIAL — runs but unverified post-hoc |
| demo    | UNKNOWN — no automated migration runner detected | n/a | MISSING |
| pilot   | n/a                | n/a           | DEFERRED |
| prod    | shares staging migration runner (shared DB) | per release | INHERITED |

---

## 6. Required Remediation (NOT auto-executed)

| # | Action                                                              | Authorization |
|---|---------------------------------------------------------------------|---------------|
| P1 | Reconcile `nzila-os-platform-admin` to canonical SHA (`f1e66a2d…` or newer) | YES |
| P2 | Re-tag demo image with SHA, update demo container app to pinned tag | YES |
| P3 | Wire RELEASE_ID / GITHUB_SHA / BUILD_TIME on demo container        | YES (additive) |
| P4 | Add post-deploy migration verification step to gitops-deploy.yml   | LOW (CI-only)  |
| P5 | Verify each ACA app's deployed SHA against current `main` HEAD     | YES (script)   |

---

## 7. Findings

| # | Finding                                                            | Severity |
|---|--------------------------------------------------------------------|----------|
| 1 | platform-admin image drift                                         | Medium   |
| 2 | Demo uses mutable image tag                                        | Medium   |
| 3 | Demo lacks release metadata env vars                               | Medium   |
| 4 | No automated post-deploy SHA verification gate                     | Medium   |
| 5 | No automated migration verification post-deploy                    | Medium   |
| 6 | 14-app uniform SHA on staging (positive — good parity)             | LIVE     |

---

**Verdict for §4:** Deployment parity is **PARTIAL**. Staging fabric has
strong intra-fabric parity (14/15 apps same SHA). Platform-admin and demo
require reconciliation. No silent SHA drift detected for the 14 uniform apps.
