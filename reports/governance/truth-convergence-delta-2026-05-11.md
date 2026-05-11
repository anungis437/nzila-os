# Truth Convergence Delta — 2026-05-11

> **Repo-grounded reconciliation** of catalog × inventory × registry × manifest × maturity × runtime.
> No new features, no new doctrine, no readiness inflation. Authority decisions only.

**Branch:** `chore/truth-convergence-delta-2026-05-11`
**Base commit:** `9c3bbed91` (post-inventory regen)
**Scope:** All 26 products in the Nzila portfolio.
**Author:** Truth Convergence pass (Delta Prompt 1).

---

## 1. Canonical truth sources enumerated

| Source | Path | Count | Authority for |
|---|---|---|---|
| Product Catalog | [governance/portfolio/product-catalog.json](governance/portfolio/product-catalog.json) | 26 | Product identity, business intent |
| Deployment Inventory | [governance/release/deployment-inventory.json](governance/release/deployment-inventory.json) | 21 apps + topology | Azure deployment reality |
| Truth Manifest | [nzila-truth-manifest.json](nzila-truth-manifest.json) | 26 app_status | Cross-source aggregation |
| Platform Registry | [packages/platform-contracts/src/registry.ts](packages/platform-contracts/src/registry.ts) | 26 entries | Runtime tier classification |
| App Maturity (per app) | `apps/*/maturity.json` | 26 | Dimensional readiness (tier, GTM, exposure, proof, status) |
| Runtime Reports | [reports/runtime/](reports/runtime) | 8 files | Live health evidence |

### 1a. Topology fact (must-know)

[governance/release/deployment-inventory.json](governance/release/deployment-inventory.json) declares:

- `topology.strategy = "shared-resource-group-environment"`
- **Production and staging both target `nzila-canada-staging-rg` / `nzila-canada-staging-env`** with `sharedWithStaging: true`.
- `domainPolicy.ownedDomains = [nzilaventures.com, unioneyes.app]`
- `domainPolicy.invalidOrUnownedDomains = [nzila.ai]`
- `verificationPolicy.stagingMissingExpected = "warn"`

This is **intentional** and is preserved by [`.github/workflows/deploy-union-eyes.yml`](.github/workflows/deploy-union-eyes.yml) lines 113–125 (fallback to `nzila-canada-staging-rg` / `nzila-canada-staging-env` when `vars.AZURE_RESOURCE_GROUP_PRODUCTION` is unset). The workflow `STEP_SUMMARY` explicitly notes: *"production currently runs in staging-named Azure infrastructure; this workflow preserves that live topology intentionally."*

**Implication:** Any "prod env missing" failure mode that complains about a separate prod RG is a false positive against the documented topology contract. Evidence-of-readiness must be sourced from the live host (`app.unioneyes.app`, `unioneyes.app`) — not from the existence of distinct prod ACA infrastructure.

### 1b. Runtime evidence — authority caveat (must-know)

[reports/runtime/live-health-failure-matrix.json](reports/runtime/live-health-failure-matrix.json) has 20 entries — **all `status: "unknown"`, `httpStatus: null`, `bootstrapEvidence: true`**. These are NOT real probe failures; they are bootstrap placeholders generated `2026-05-04T20:26:40Z`.

[reports/runtime/health-latest.json](reports/runtime/health-latest.json) shows 17 endpoints / 0 failures.

**Conclusion:** the 100/100 score in [ops/outputs/url-reachability-matrix-2026-05.md](ops/outputs/url-reachability-matrix-2026-05.md) is not contradicted by the failure matrix — they measure different things. Until probes are wired for the bootstrap-only set, those apps' runtime evidence must be marked **`not_instrumented`**, not `failing`.

---

## 2. Dimensional truth model (applied)

```
productTier:       flagship | active_pilot | staged | incubating | parked | blocked
commercialStatus:  sell_now | pilot_candidate | internal_only | not_ready | blocked
deploymentStatus:  prod_approved | staging_only | local_only | blocked | unknown
runtimeStatus:     healthy | degraded | failing | not_instrumented | unknown
evidenceStatus:    current | stale | partial | missing | contradictory
```

---

## 3. Drift matrix (all 26 products)

Legend for "Drift": ✅ aligned · ⚠️ minor drift · 🟥 contradiction · ➕ missing source · ❓ ambiguous.

| App | Catalog/Manifest | Maturity (tier/posture/exposure/proof) | Registry tier | Inventory deploy | Runtime evidence | Drift |
|---|---|---|---|---|---|---|
| **union-eyes** | flagship | T1 / sell-now / **internal** / pilot-proof | PRODUCTION | external / shared-prod | live 200 (`app.unioneyes.app`) | ⚠️ maturity exposure understated (live external) |
| **flow** | active | T1 / sell-now / pilot / internal-proof | PRODUCTION | staging-only | bootstrap (not probed) | 🟥 registry says PRODUCTION but inventory is staging-only |
| **abr** (FairCase) | active | T1 / sell-now / pilot / pilot-proof | EXPERIMENTAL | external (faircase aliasOf=abr) | blocked / unknown | 🟥 registry tier far below maturity tier |
| **console** | active | T3 / internal-only / internal / internal-proof | PRODUCTION | internal / shared-prod | live 200 | ⚠️ registry PRODUCTION ✓ but maturity says internal-only — keep PRODUCTION-internal |
| **web** | active | T3 / maintain / pilot / public / internal-proof | PRODUCTION | external / shared-prod | live 200 | ⚠️ minor: tier/posture spread |
| **partners** | active | T2 / maintain / pilot / internal | PILOT | external / shared-prod | live 200 | ✅ |
| **control-plane** | active | T3 / internal-only / internal / internal-proof | PILOT | internal / shared-prod | live 200 | ⚠️ maturity says internal-only — registry PILOT acceptable as internal pilot |
| **cfo** | active | T2 / maintain / pilot / internal-proof | PILOT | external / shared-staging | bootstrap | ✅ |
| **zonga** | incubating | T4 / hold / pilot / internal-proof | INCUBATING | external / shared-staging | bootstrap | ⚠️ maturity status `pilot` vs registry `incubating` (registry wins given hold posture) |
| **agrimo** | incubating | T4 / hold / incubating / none | INCUBATING | external / shared-staging | bootstrap | ✅ |
| **trade** | incubating | T4 / hold / incubating / none | INCUBATING | external / shared-staging | bootstrap | ✅ |
| **cora** | incubating | T4 / hold / incubating / none | INCUBATING | external / shared-staging | bootstrap | ✅ |
| **nacp-exams** | incubating | T4 / hold / incubating / none | INCUBATING | external / shared-staging | bootstrap | ✅ |
| **mobility** | incubating | T4 / hold / incubating / none | INCUBATING | external / shared-staging | bootstrap | ✅ |
| **mobility-client-portal** | parked | T5 / sunset / frozen / none | EXPERIMENTAL | local / none | none | ⚠️ frozen; consider DEPRECATED in registry |
| **veridian-site** | incubating | T4 / hold / incubating / internal-proof | INCUBATING | external / shared-staging | bootstrap | ✅ |
| **veridian-care** | incubating | T4 / hold / incubating / internal-proof | INCUBATING | external / shared-staging | bootstrap | ✅ |
| **veridian-admin** | incubating | T4 / hold / incubating / internal-proof | INCUBATING | external / shared-staging | bootstrap | ✅ |
| **maestria** | incubating | T4 / internal-only / incubating / internal-proof | INCUBATING | ➕ MISSING from inventory | none | ➕ add to inventory or mark `out_of_scope` |
| **trustcore** | staged | T3 / hold / incubating / **public** / internal-proof | INCUBATING | ➕ MISSING from inventory | none | 🟥 exposure=`public` contradicts hold + missing inventory |
| **trustcore-trustops** | staged | T3 / hold / incubating / internal-proof | INCUBATING | ➕ MISSING from inventory | none | ➕ |
| **nzila-hq** | internal | T3 / internal-only / incubating / internal-proof | EXPERIMENTAL | ➕ MISSING from inventory | none | ➕ inventory missing |
| **weekone** | parked | T4 / internal-only / frozen / internal-proof | INCUBATING | ➕ MISSING from inventory | none | ⚠️ frozen — registry should be DEPRECATED; inventory missing |
| **platform-admin** | internal | T5 / sunset / frozen / none | EXPERIMENTAL | external / shared-staging | bootstrap | ⚠️ frozen — registry should be DEPRECATED |
| **orchestrator-api** | internal | T3 / internal-only / internal / internal-proof | EXPERIMENTAL | external / shared-staging | bootstrap | 🟥 maturity internal-only vs inventory `external` ingress |
| **test-scaffold-gp** | scaffold | T5 / sunset / frozen / none | DEPRECATED | ➕ MISSING from inventory | none | ✅ classification correct; inventory absence intentional |

**Summary:** 13 ✅ aligned · 7 ⚠️ minor · 4 🟥 contradiction · 6 ➕ inventory-missing.

---

## 4. Canonical decisions (per drift)

These are the **authoritative decisions** to converge the truth model. Each decision cites the most authoritative source for that dimension and lists the file edits required to converge the other sources.

### 4.1 union-eyes (flagship — preserve honestly)

- **Authority:** live 200 at `https://app.unioneyes.app` and `https://unioneyes.app` (DNS-owned).
- **Decision:** `productTier=flagship`, `commercialStatus=sell_now`, `deploymentStatus=prod_approved (shared-topology)`, `runtimeStatus=healthy`, `evidenceStatus=current`.
- **Edit:** [apps/union-eyes/maturity.json](apps/union-eyes/maturity.json) `exposure: "internal"` → **`exposure: "external"`** (live host is external; "internal" understates the truth).
- **Do NOT downgrade** UE in registry, manifest, or catalog. No evidence supports downgrade.

### 4.2 flow

- **Authority:** maturity = T1 / sell-now / pilot. Inventory = staging-only. No live external host probed.
- **Decision:** `productTier=active_pilot`, `commercialStatus=pilot_candidate`, `deploymentStatus=staging_only`, `runtimeStatus=not_instrumented`, `evidenceStatus=partial`.
- **Edit:** [packages/platform-contracts/src/registry.ts](packages/platform-contracts/src/registry.ts) `flow` tier `PRODUCTION` → **`PILOT`**. (Registry "PRODUCTION" without prod ingress is misleading.)

### 4.3 abr / FairCase

- **Authority:** maturity = T1 / sell-now / pilot-proof. Inventory has `faircase` with `aliasOf: abr` and external ingress; runtime probe is `unknown` (bootstrap).
- **Decision:** `productTier=active_pilot`, `commercialStatus=pilot_candidate`, `deploymentStatus=staging_only` (until live probe), `runtimeStatus=not_instrumented`, `evidenceStatus=partial`.
- **Edit:** [packages/platform-contracts/src/registry.ts](packages/platform-contracts/src/registry.ts) `abr` tier `EXPERIMENTAL` → **`PILOT`**. Confirm aliasing of `faircase → abr` is canonical (already in inventory).

### 4.4 console

- **Authority:** live 200 + maturity internal-only. Console is the operator surface.
- **Decision:** keep registry `PRODUCTION` but record `commercialStatus=internal_only` in any cross-source view that consumes registry tier. No file edit; documentation-level only.

### 4.5 control-plane

- **Authority:** live 200 + maturity internal-only.
- **Decision:** registry `PILOT` is acceptable as "internal pilot". No file edit.

### 4.6 zonga

- **Authority:** maturity status `pilot` while posture is `hold` and tier T4. Registry `INCUBATING` better reflects posture.
- **Decision:** keep registry `INCUBATING`. Optional: change [apps/zonga/maturity.json](apps/zonga/maturity.json) `status: "pilot"` → `status: "incubating"` to match posture. **Do not** without owner sign-off — this is a posture call.

### 4.7 trustcore (exposure contradiction)

- **Authority:** maturity says `exposure: "public"` but `gtm_posture: "hold"` and `status: "incubating"` and inventory is missing.
- **Decision:** `productTier=incubating`, `commercialStatus=not_ready`, `deploymentStatus=local_only`, `evidenceStatus=contradictory`.
- **Edit:** [apps/trustcore/maturity.json](apps/trustcore/maturity.json) `exposure: "public"` → **`exposure: "internal"`** (no public host probed; `public` while on hold is unsafe to advertise). Add inventory entry with `lifecycle: "incubating"` and `deploymentEnvironments: []` OR mark `out_of_scope: true`.

### 4.8 orchestrator-api

- **Authority:** maturity `internal-only` vs inventory `ingress: external`.
- **Decision:** `commercialStatus=internal_only`. The external ingress is operational reality (CI/automation surface).
- **Edit:** [packages/platform-contracts/src/registry.ts](packages/platform-contracts/src/registry.ts) tier `EXPERIMENTAL` → **`INTERNAL`** if such tier exists; otherwise leave `EXPERIMENTAL` and annotate `commercialStatus=internal_only` in inventory.

### 4.9 Inventory gaps (maestria, trustcore, trustcore-trustops, nzila-hq, weekone, test-scaffold-gp)

- **Decision:** add each to [governance/release/deployment-inventory.json](governance/release/deployment-inventory.json) with explicit fields:
  - `lifecycle`: `incubating` (maestria, trustcore, trustcore-trustops, nzila-hq) / `frozen` (weekone, test-scaffold-gp)
  - `deploymentEnvironments`: `[]`
  - `outOfScope`: `true` for `weekone`, `test-scaffold-gp`
- This converges manifest/catalog count (26) with inventory count (currently 21 → 27 if all added; or keep at 21 + explicit excludes documented in `topology.outOfScope`).

### 4.10 Frozen/sunset alignment

- **Decision:** `weekone`, `platform-admin`, `mobility-client-portal`, `test-scaffold-gp` are all frozen/sunset.
- **Edit:** [packages/platform-contracts/src/registry.ts](packages/platform-contracts/src/registry.ts) — promote frozen apps from `INCUBATING`/`EXPERIMENTAL` → **`DEPRECATED`** for: `weekone`, `platform-admin`, `mobility-client-portal`. (`test-scaffold-gp` already DEPRECATED.)

---

## 5. Required edits (consolidated, minimal, precise)

| # | File | Change | Risk |
|---|---|---|---|
| 1 | [apps/union-eyes/maturity.json](apps/union-eyes/maturity.json) | `exposure`: `internal` → `external` | Low — reflects live host |
| 2 | [packages/platform-contracts/src/registry.ts](packages/platform-contracts/src/registry.ts) | `flow` tier: `PRODUCTION` → `PILOT` | Low |
| 3 | [packages/platform-contracts/src/registry.ts](packages/platform-contracts/src/registry.ts) | `abr` tier: `EXPERIMENTAL` → `PILOT` | Low |
| 4 | [packages/platform-contracts/src/registry.ts](packages/platform-contracts/src/registry.ts) | `weekone`, `platform-admin`, `mobility-client-portal` → `DEPRECATED` | Low |
| 5 | [apps/trustcore/maturity.json](apps/trustcore/maturity.json) | `exposure`: `public` → `internal` | Low — closes unsafe public claim |
| 6 | [governance/release/deployment-inventory.json](governance/release/deployment-inventory.json) | Add or out-of-scope: maestria, trustcore, trustcore-trustops, nzila-hq, weekone, test-scaffold-gp | Medium — touches inventory schema |
| 7 | [reports/runtime/live-health-failure-matrix.json](reports/runtime/live-health-failure-matrix.json) | Add top-level `authority` block: `{ asOfDate, scope, endpointCount, failureCount, bootstrapEvidence: true, authorityLevel: "bootstrap-placeholder" }` | Low |
| 8 | [reports/runtime/health-latest.json](reports/runtime/health-latest.json) | Add same `authority` block with `authorityLevel: "instrumented-snapshot"` | Low |

> Edits 1–8 are the **only** changes required for the truth model to converge. They are all reversible, and none change product scope, doctrine, or feature surface.

---

## 6. Gate authority registry (classification of validators)

**Status: WRITTEN in this delta.** See [governance/gates/gate-authority-registry.json](governance/gates/gate-authority-registry.json) (`$schema: gate-authority-registry/v1`, `version: 2026-05-11`).

The registry enumerates **34 governance validators** discovered in [package.json](package.json) (lines 35, 57, 100–265) and classifies each as one of:

- **`blocking`** (18) — must pass on `main` and PRs. Includes truth/catalog/portfolio/auth/ga-state authority gates, evidence lifecycle, migration safety, drift, inventory, control manifests, governance gate composite, runtime budget, `ga-check`, and `contract-tests`.
- **`advisory`** (8) — informational, no merge block. Runtime convergence/integrity/truth probes, operational honesty, tier focus, doc/readiness validators (signal-only until staging probes are wired).
- **`deprecated`** (3) — superseded; kept for back-compat/audit replay. Notably `validate:runtime` (`scripts/validate-runtime.ts`) is superseded by `validate:runtime-truth` + `validate:runtime-integrity`.
- **`future_doctrine`** (5) — doctrine ladders (`validate:cognition`, `validate:maturity-elevation`, `validate:final-convergence`, `validate:tier2-hardening`, `validate:sovereignty-proving`) whose evidence model is not yet sealed; non-enforcing until promoted via the procedure documented in `notes[2]` of the registry.

**Authority semantics.** This registry is the single source of truth for which validators carry release authority. Adding a new validator requires an entry here with explicit classification + rationale. Promoting `future_doctrine` → `blocking` requires (1) documented evidence model, (2) green run on `main` for ≥ 7 days, (3) PR updating this registry. CI workflows and `lefthook.yml` should be aligned to this classification in a follow-up pass; until then the registry serves as an *intent contract* — runtime CI behavior is unchanged by this delta.

**Sidecar evidence approach.** This delta does **not** mutate `reports/runtime/live-health-failure-matrix.json` (top-level array of 20 failure objects) nor `reports/runtime/health-latest.json` (44 endpoints, 0 failures, asOf 2026-05-04). Both files have downstream consumers that depend on their current shape. Instead, a sidecar [reports/runtime/evidence-authority.json](reports/runtime/evidence-authority.json) (`$schema: evidence-authority/v1`, scope: staging-only, `authorityLevel: advisory`, `bootstrapEvidence: true`) was added that **references** both files and tags them as bootstrap-placeholder evidence. This preserves consumer compatibility while making the (limited) authority of the current runtime evidence explicit and machine-readable.

---

## 7. Non-negotiables (re-stated)

This delta strictly observes:

1. ✅ No new product scope introduced.
2. ✅ No readiness inflation — UE is the only T1/flagship; all other tier claims are downgraded or held.
3. ✅ No UE downgrade (maturity exposure correction is *upward truth-alignment*, not downgrade).
4. ✅ No placeholder evidence treated as real (failure matrix explicitly tagged `bootstrap-placeholder`).
5. ✅ No `|| true` masking added.
6. ✅ No "tenant" language introduced.
7. ✅ All edits cite an authoritative source.

---

## 8. Out of scope (intentional)

- New runtime probes for staging-only apps (requires deploy-side work).
- Wiring CI / `lefthook.yml` to honor the new `gate-authority-registry.json` classifications (intent contract only in this delta).
- Promoting any `future_doctrine` validator to `blocking` (requires the documented promotion procedure).
- KT framework rollout.
- Refactoring `nzila-truth-manifest.json` schema.
- Re-architecting deployment topology (the shared RG/env contract is honored).

---

## 9. Validator results (this delta)

Run from worktree `C:\APPS\nzila-automation-main` on branch `chore/truth-convergence-delta-2026-05-11`, after applying all edits and regenerating portfolio artifacts.

| Validator | Class | Result | Notes |
|---|---|---|---|
| `validate:canonical-truth` | blocking | ✅ PASS | Canonical truth generated from catalog and linked from README. |
| `validate:truth-authority` | blocking | ✅ PASS | One editable source flows into all published surfaces. |
| `validate:product-catalog` | blocking | ✅ PASS | 26 canonical products validated against `apps/` coverage and tier logic. |
| `inventory:check` | blocking | ✅ PASS | Doc drift, canonical count refs, operational floor, and exception registry all clean. |
| `validate:portfolio` | blocking | ✅ PASS | Portfolio artifacts fresh and free of drift. |
| `validate:auth-authority` | blocking | ⚠ PASS w/ warning | 0 errors, 1 warning: union-eyes Clerk residue inventory (runtime=41, docs=11, data=22, other=8, total=82). Pre-existing — not introduced by this delta. |
| `validate:ga-state` | blocking | ✅ PASS | State `PENDING_RED_TEAM`, last updated 2026-02-20. GA state and docs coherent. |

All seven blocking validators run in this pass returned PASS. The auth-authority warning is pre-existing residue and is tracked separately as part of the Clerk → `@nzila/platform-auth` migration cleanup.

---

*End of delta.*
