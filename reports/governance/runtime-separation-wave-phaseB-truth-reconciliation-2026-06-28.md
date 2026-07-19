# Runtime Separation Implementation Wave — Phase B: Runtime Truth Reconciliation + Deploy/Image Boundary Hardening Design

**Date:** 2026-06-28
**Wave:** Runtime Separation Implementation Wave
**Phase:** B (re-scoped) — runtime truth reconciliation + BR-4/BR-5 hardening *design only*
**Predecessors:** [Phase A inventory](runtime-separation-wave-phaseA-inventory-2026-06-28.md) · [Phase A.1 live verification](runtime-separation-wave-phaseA1-live-verification-2026-06-28.md)
**Plan:** [docs/governance/runtime/runtime-separation-plan.md](../../docs/governance/runtime/runtime-separation-plan.md)

> **Re-scope acknowledgement.** Phase A.1 refuted BR-1/BR-2/BR-3 live. Phase B is therefore **not** "staging isolation." It is: *make the repo tell the truth, preserve the live separation that already exists, and prepare BR-4/BR-5 closure without touching secrets or live Azure resources yet.*
>
> **Constraints honored (verbatim mandate):** No new pilot infrastructure provisioned. No pilot data migrated. No live prod resources touched. No live pilot resources touched except read-only verification. No Azure resources modified. No secrets rotated. No `final:go` promotion. No certification artifacts. No production-readiness claim.

---

## 1. Primary invariant (this phase)

> The repo must stop encoding stale runtime assumptions that contradict live Azure topology.

Status after this phase: **enforced for the BR-1/BR-2/BR-3 surfaces.** The three repo locations that asserted "production runs in staging-named infrastructure" and "pilot reuses nzila-staging-db" are now corrected or explicitly marked superseded/legacy.

---

## 2. Stale / hazardous config inventory (read-only findings)

| ID | Location | Stale assertion | Hazard | Action taken this phase |
| --- | --- | --- | --- | --- |
| D-1 | [.github/workflows/deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml) L215 (step-summary echo) | "production currently runs in staging-named Azure infrastructure; this workflow preserves that live topology intentionally" | Misleads operators reading the deploy summary; could justify a wrong "cutover" that disturbs already-separated prod | **Corrected** the printed note to state prod runs in dedicated `nzila-canada-prod-rg`/`-prod-env` on a dedicated DB, with the hard guard. Fail-safe: it only changes printed summary text, **not** topology resolution logic. |
| D-2 | [infrastructure/gitops/environments/ue-pilot-cupe.yml](../../infrastructure/gitops/environments/ue-pilot-cupe.yml) | Whole profile points CUPE pilot at `nzila-staging-rg`/`-env` + shared `nzila-staging-db` (RLS-only) | A future apply would **re-introduce BR-2 and BR-3** against a pilot that is already sovereign live | **Added a prominent `LEGACY / LATENT — DO NOT DEPLOY` banner** + a stale marker on the `database:` block. No executable keys changed. |
| D-3 | [infrastructure/bicep/main.bicep](../../infrastructure/bicep/main.bicep) L11–18 | `@allowed(['dev','staging','prod'])`; names `nzila-${env}-*` / `nzila${env}acr` | IaC names do not match live `nzila-canada-${env}-*` / `nzilacanadaacr`; Bicep cannot manage live resources as-is, and has no `pilot`/`demo` env | **Documented here only.** Bicep naming/param reconciliation is an executable IaC change → deferred to a separately-approved IaC phase (see §5 risks). Not edited this phase. |
| D-4 | live container-app secrets (observed Phase A.1) | prod/staging `database-url` are **inline** container-app secrets (`keyVaultUrl: null`); pilot/demo are KV-backed | Inconsistent secret topology; prod arguably should be KV-backed like pilot/demo | **Documented here only.** Touches secret wiring → out of scope this phase (no secret changes). Folded into BR-4/D design backlog. |
| D-5 | live RG inventory (Phase A.1) | two staging-ish RGs: `nzila-canada-staging-rg` **and** legacy `nzila-staging-rg` (holds `nzila-staging-db` v15, `nzila-staging-kv`, `nzila-staging-logs`) | Ownership ambiguity; the legacy RG is where the latent `ue-pilot-cupe.yml` would land | **Documented here.** Ownership/retirement decision is a live-resource action → deferred. No change. |

### Docs corrected this phase (living docs only — dated point-in-time reports left intact as historical record)

- [docs/governance/runtime/runtime-separation-plan.md](../../docs/governance/runtime/runtime-separation-plan.md) — added a "Superseded by Phase A.1" admonition under the two anchor findings.
- [docs/categories/stakeholders/commercial/azure-godaddy-cutover.md](../../docs/categories/stakeholders/commercial/azure-godaddy-cutover.md) — corrected the "Operational Risk Note"; struck the stale claim.
- [docs/categories/products-and-market/union-eyes/release/environment-topology-audit.md](../../docs/categories/products-and-market/union-eyes/release/environment-topology-audit.md) — added a "Superseded snapshot (2026-05-09)" banner; the "DOES NOT EXIST" rows are flagged no-longer-accurate.

> Dated reports under `reports/governance/` (e.g. `truth-convergence-delta-2026-05-11.md`, `ue-hardening-wave-phase6-…`, `…phaseA-inventory…`) are **point-in-time records** and were intentionally **not** rewritten; this report supersedes their BR-1/BR-2/BR-3 conclusions.

---

## 3. Residual CUPE data-location check (read-only, existence/location signals only)

**Question:** does CUPE Local 123 / CUPE-pilot org data physically reside only in the pilot DB, or does a legacy staging copy still exist? *(No row data read, no secrets printed, no data modified.)*

Signals observed live (2026-06-28):

| Signal | Observation |
| --- | --- |
| Live UE apps carrying `PILOT_ORG_ID=cupe-local-123` | **None.** `nzila-os-union-eyes-pilot`, `-django-pilot`, and `-staging` carry **no** `PILOT_ORG_ID`/`PILOT_ORG_SLUG`. Only `-demo` carries `UE_DEMO_ORG_ID=cupe-local-4373`. |
| Live pilot DB | `nzila-canada-pilot-db` exists with a dedicated application database `nzila_union_eyes`. |
| Legacy staging DB | `nzila-staging-db` (legacy `nzila-staging-rg`) still exists; single shared app database `nzila_os_staging` (no separate `cupe`/`cupe-local-123` database — consistent with the latent profile's RLS-only design). |

**Interpretation (honest):**
- There is **no active live runtime path serving `cupe-local-123`** — the staging-reuse profile is not deployed, and no live app advertises that org id. The live `pilot` app is the generic sovereign UE pilot.
- The sovereign pilot DB has its own dedicated database; the pilot is not bound to `nzila-staging-db`.
- **Unresolved at row level (intentionally not checked):** whether any historical `cupe-local-123` rows still physically reside inside the shared `nzila_os_staging` database cannot be determined without a row-level query, which is out of scope (would require DB credentials/data access). A latent legacy copy therefore **cannot be positively ruled out** from metadata alone.

**Recommended follow-up (separate approval):** a single read-only, count-only RLS query (`SELECT count(*) … WHERE org_id='cupe-local-123'`) against `nzila_os_staging`, returning only a number, to confirm whether legacy rows remain — and if so, a data-disposition decision. Not performed here.

---

## 4. Outstanding open risks after this phase

| ID | Status | Nature |
| --- | --- | --- |
| **BR-1** | **CLOSED (refuted live)** | Prod is separated; repo note corrected. |
| **BR-2** | **CLOSED for live** (residual: legacy-row check §3) | Live pilot sovereign; latent profile marked DO-NOT-DEPLOY. |
| **BR-3** | **CLOSED (refuted live)** | Pilot has own backup boundary. |
| **BR-4** | **OPEN** | Single shared GitHub deploy identity (`AZURE_CREDENTIALS`) deploys all environments. |
| **BR-5** | **OPEN** | Single shared ACR `nzilacanadaacr` serves prod/staging/demo/pilot. |
| **BR-6** | **OPEN** | Org-context substrate drift (`DEFAULT_ORGANIZATION_ID` fallback) — code-level; not infra-observable. Carried to a code-hardening phase. |

---

## 5. BR-4 / BR-5 implementation design (for the NEXT, separately-approved phase)

> Design only. **Nothing below is executed in Phase B.** No secrets, no federated credentials, no ACR, no live Azure changes are made here.

### 5.1 BR-4 — Split GitHub deployment identity by environment

**Goal:** replace the single shared `secrets.AZURE_CREDENTIALS` (broad-scope SP, password-based, repo-wide) with **per-environment federated (OIDC) identities** scoped to exactly one environment's resource group, gated by GitHub Environment protection rules.

**Target end-state (resources to create later):**

| Item | Per env (prod / staging / demo / pilot) | Scope |
| --- | --- | --- |
| User-assigned managed identity *or* app registration | `nzila-ue-deploy-<env>` | one per env |
| Federated credential (OIDC, no secret) | subject `repo:<org>/nzila-os:environment:<env>` | bound to the matching GitHub Environment |
| RBAC role assignment | `Contributor` (or tighter custom role) **scoped to that env's RG only** (`nzila-canada-<env>-rg`) + `AcrPush`/`AcrPull` per §5.2 decision | least-privilege, RG-scoped |
| GitHub Environment | `production`, `staging`, `demo`, `pilot` | required reviewers on `production`; branch policy `main`-only for prod |

**Workflows likely to change later (not changed now):**
- [.github/workflows/deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml) — replace `azure/login@v3` `creds: ${{ secrets.AZURE_CREDENTIALS }}` with OIDC `client-id`/`tenant-id`/`subscription-id` read from **per-environment** `vars`/`secrets`; `permissions: id-token: write` already present.
- [.github/workflows/auto-promote-union-eyes.yml](../../.github/workflows/auto-promote-union-eyes.yml) — each fan-out leg authenticates with its own env identity; (separately, Phase F should make prod promotion sequential behind a staging soak gate — noted, not designed here).
- Any other `deploy-*.yml` that consumes `AZURE_CREDENTIALS`.

**GitHub secrets / federated credentials required later:**
- Per env: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` as **Environment-scoped** values (client-id is per-env; tenant/sub shared).
- **No client secrets** (OIDC federation eliminates the stored password that BR-4 is about).
- Decommission `AZURE_CREDENTIALS` only **after** all environments cut over and a green deploy is proven per env.

**Rollback plan (BR-4):**
- Keep `AZURE_CREDENTIALS` in place but unused during cutover; gate the new OIDC path behind a workflow input/flag.
- If an env's OIDC deploy fails, revert that env's job to the legacy `creds:` path (one-line revert) — no resource teardown needed since identities are additive.
- Identities/role-assignments are additive and independently revocable (delete the federated credential / role assignment) with zero impact on running workloads.

**Evidence plan (BR-4):**
- Per env: screenshot/JSON of the federated credential, the RG-scoped role assignment (`az role assignment list --scope <rg>`), a green deploy run authenticated via OIDC (no `AZURE_CREDENTIALS` used), and confirmation the legacy secret was unused (run logs).
- Final: `AZURE_CREDENTIALS` removed; `az ad sp` no longer holds repo-wide standing credentials.

### 5.2 BR-5 — ACR boundary: split vs. enforce promotion controls

**Decision recommendation: DO NOT physically split the registry initially. Enforce a stronger image-promotion boundary on the single `nzilacanadaacr` first; treat physical split as a later, optional hardening.**

Rationale: one registry is a *shared substrate*, not a *shared runtime* — it does not carry org data and does not couple prod/pilot blast radius the way a shared DB or ACA env would. The pilot doctrine ([pilot.yml](../../infrastructure/gitops/environments/pilot.yml)) already states "image substrate is shared via ACR" as accepted. A physical split adds cost/operational surface for limited isolation gain. The real BR-5 risk is **unauthorized or unattested image promotion**, which controls solve more cheaply.

**Option A (recommended) — promotion controls on shared `nzilacanadaacr`:**
- Per-environment **AcrPull**-only identities (§5.1) — only the build/promote job gets **AcrPush**.
- Image **digest-pinning** for prod (deploy by `@sha256:` digest, not mutable tag).
- Promotion gate: prod deploys only images that already passed staging (tag/digest allow-list checked in `auto-promote`).
- Enable ACR **content-trust / image signing** (or an attestation step) so prod refuses unsigned images.
- Repository-scoped tokens / `repository-scoped permissions` to fence env tag namespaces.
- *(Tier note: current `nzilacanadaacr` is Basic; content-trust/geo-replication need Premium — a SKU upgrade is a costed prerequisite for full signing.)*

**Option B (later/optional) — physical split:** dedicated `nzilacanadaprodacr` for production with geo-replication; staging/demo/pilot continue on `nzilacanadaacr`. Promote prod images by digest copy (`az acr import`) across registries. Higher isolation, higher cost/ops.

**Resources to create/change later (BR-5):**
- (Option A) ACR scope maps / tokens, content-trust enablement, possible Basic→Premium SKU upgrade; promotion-gate logic in `auto-promote-union-eyes.yml`.
- (Option B) new `nzilacanadaprodacr` + cross-registry import step.

**Rollback plan (BR-5):**
- Option A controls are additive policy/config; disable content-trust or widen token scope to revert. No image data lost.
- Option B: keep dual-push during transition; prod can fall back to pulling from `nzilacanadaacr` until the dedicated registry is proven.

**Evidence plan (BR-5):**
- AcrPush restricted to the promote identity only (`az role assignment list`).
- A prod deploy that pulled a **digest-pinned, signed/attested** image; rejection test of an unsigned/unpromoted image.
- (Option B) successful cross-registry `az acr import` + prod pulling from the dedicated registry.

---

## 6. Things explicitly NOT changed this phase

- No Azure resources created, modified, scaled, or deleted.
- No live prod resources touched (`nzila-os-union-eyes-prod`, `nzila-os-union-eyes-prod-db`, `nzila-canada-prod-env/-kv/-law`).
- No live pilot resources touched except read-only inspection (`nzila-os-union-eyes-pilot`, `nzila-canada-pilot-db/-kv`).
- No secrets created, read-as-value, or rotated; no federated credentials created.
- No ACR change; no registry SKU change.
- No executable deployment behavior changed — the only workflow edit is a **printed step-summary string** (fail-safe), and `ue-pilot-cupe.yml` edits are **comments/markers only** (no executable keys altered).
- No Bicep naming/param reconciliation executed (D-3 deferred).
- No legacy-RG retirement (D-5 deferred); no `nzila-staging-db` change.
- No row-level CUPE data query, no data migration, no data disposition.
- No `final:go` promotion; production-blocking achieved remains **0**; no certification artifacts created.

---

## 7. Forward sequence (for separate approval)

1. **Phase B-resolve (read-only):** count-only RLS check of legacy `cupe-local-123` rows in `nzila_os_staging` (§3 follow-up) → data-disposition decision.
2. **Phase D — BR-4:** implement per-env OIDC deploy identities + GitHub Environment protections; decommission `AZURE_CREDENTIALS` (§5.1).
3. **Phase E — BR-5:** implement ACR promotion controls (Option A); evaluate digest-pinning + signing; defer physical split (Option B) unless required (§5.2).
4. **Phase D-2 — BR-6:** code-level org-context substrate hardening (remove silent `DEFAULT_ORGANIZATION_ID` fallback).
5. **IaC reconcile (D-3):** align Bicep names/params with live `nzila-canada-${env}-*`; add pilot/demo envs.
6. **Legacy retirement (D-2/D-5):** delete `ue-pilot-cupe.yml`; decide fate of legacy `nzila-staging-rg`.
7. **Phase F:** cutover/promotion rehearsal + certification evidence (only gateway toward any future `final:go`).

---

## 8. Honest status

> Runtime truth reconciliation is complete. Live prod and pilot separation remain
> intact. No live Azure resources or secrets were changed. Deployment identity and
> image-boundary hardening remain pending separate approval.

`final:go` remains advisory; production-blocking achieved remains **0**. Sensitive
multi-org production remains pending runtime evidence completion, BR-4/BR-5/BR-6
closure, rehearsal, and final-go certification. This phase did **not** confer any
production-readiness.

## HARD STOP

Do **not** begin any deploy-identity, ACR, secret, or live-Azure change without
separate explicit approval, executed only against the design in §5 and the
sequence in §7.
