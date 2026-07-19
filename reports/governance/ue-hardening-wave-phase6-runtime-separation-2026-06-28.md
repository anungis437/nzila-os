# UE Hardening & Gate Convergence Wave — Phase 6: Runtime Separation Plan

**Date:** 2026-06-28
**Phase:** 6 of the wave (Phases 0–5 complete and approved)
**Scope (verbatim):** *"Proceed to Phase 6 only: runtime separation plan. Do not implement infrastructure changes. Do not modify Azure resources. Do not modify deployment workflows except documentation if needed. Do not change CI authority. Do not touch final:go certification artifacts. Do not create fake live-readiness evidence. Do not claim production readiness. Objective: Produce a concrete prod/staging runtime separation implementation plan that closes the known blast-radius risk identified in the runtime truth reports."*
**Outcome:** ✅ Complete — **planning only**. **HARD STOP** for human review. The wave can now close with an honest status.

---

## 1. Primary invariant — satisfied

> The plan must make clear **what must be separated before** sensitive multi-org
> production or enterprise procurement can be claimed.

Delivered as the implementation-ready plan:
[docs/governance/runtime/runtime-separation-plan.md](../../docs/governance/runtime/runtime-separation-plan.md).

It defines exactly how prod/staging separation will be implemented and certified
— **without** touching Azure, secrets, CI authority, or `final:go`, and **without**
any production-readiness claim.

---

## 2. What was produced

A single doctrine artifact under `docs/governance/runtime/` containing all six
required outputs:

1. **Runtime separation plan** (the document itself).
2. **Current-state vs target-state matrix** across all 11 separation surfaces (§3).
3. **Phased implementation sequence** Phase A–F: inventory/freeze → staging isolation → production isolation → deployment-identity separation → observability/backup separation → rehearsal/certification (§4).
4. **Risk matrix** (BR-1…BR-7) with risk / impact / mitigation / required evidence / owner (§5).
5. **Certification checklist** for future `final:go` / production-blocking promotion (§6).
6. **This Phase 6 report** summarizing remaining risk, required work, required evidence, and what still blocks broad production readiness.

---

## 3. Current-state findings (read-only investigation)

Investigation was performed against runtime-integrity docs, Bicep IaC, GitOps env
configs, and deployment workflows. **No files were modified.** Two anchor
findings were verified directly against source:

- **UE production runs in staging-named Azure infrastructure** — [.github/workflows/deploy-union-eyes.yml](../../.github/workflows/deploy-union-eyes.yml#L215) (*"production currently runs in staging-named Azure infrastructure; this workflow preserves that live topology intentionally"*).
- **CUPE pilot reuses the staging PostgreSQL instance** with RLS-only isolation — [infrastructure/gitops/environments/ue-pilot-cupe.yml](../../infrastructure/gitops/environments/ue-pilot-cupe.yml#L66) (`name: nzila-staging-db`).

**Most surfaces are already separated** at the IaC layer (resource groups,
declared Container App environments, Key Vaults, runtime managed identities,
per-vault secrets, DNS, Log Analytics, and the production DB with HA + 35-day
geo-redundant backup). The blast-radius risk is concentrated in a small number
of shared **runtime** surfaces.

---

## 4. What runtime risks remain (blast-radius, not yet closed)

| ID | Remaining risk |
| --- | --- |
| **BR-1** | UE production Container App runs in the **staging-named** managed environment; a staging-env operation can cascade to live production. |
| **BR-2** | Pilot reuses `nzila-staging-db` with **application-layer RLS only**; a staging migration/restore or an RLS regression is a cross-org data event. |
| **BR-3** | Pilot has **no independent backup/restore boundary** (shares staging's). |
| **BR-4** | A **single shared GitHub deploy identity** authenticates all environments; separation is enforced only by a bash resource-group name guard. |
| **BR-5** | **Shared ACR**; environment correctness depends on CI tagging, not registry boundary. |
| **BR-6** | Runtime-integrity **substrate drift** (silent `DEFAULT_ORGANIZATION_ID` fallback, org-cookie duplication, schema drift) can differ prod vs staging — a separation-blocking foundational risk. |
| **BR-7** | The cutover/migration itself carries outage/split-brain risk if unrehearsed. |

---

## 5. What separation work is required

- **Phase C cutover:** move UE production into a true `nzila-canada-prod-env` (blue/green).
- **Phase B migration:** provision a dedicated `nzila-pilot-db` with its own credentials, pool, and backup; migrate pilot org data off `nzila-staging-db`; keep RLS as defense-in-depth.
- **Phase D identity split:** per-environment OIDC subjects with environment-scoped RBAC; move deploy creds to GitHub Environment secrets.
- **Phase E isolation:** independent per-environment backup/restore boundaries + confirmed observability isolation.
- **Phase F rehearsal:** full-chain build → staging → soak → gated promotion → prod cutover → smoke → rollback drill, with captured artifacts.

All of the above is **future, separately-approved execution work**. Phase 6 ships
the plan only.

---

## 6. What evidence must be produced (certification contract)

The plan's §6 certification checklist defines the evidence required before any
future `final:go` / production-blocking promotion — including live proof that UE
prod runs in the prod env, pilot is on a dedicated instance, cross-env deploy is
denied at the RBAC layer, image promotion is attested, per-environment PITR/
rollback drills pass, and runtime-integrity substrate drift is closed. **None of
these are claimed as met today.** Promotion remains governed by the Phase 5
gate-authority rules (running green ≠ promotion).

---

## 7. What is still blocking broad production readiness

- BR-1 (prod execution topology), BR-2/BR-3 (pilot DB + backup isolation), BR-4 (deploy identity), BR-5 (registry promotion), BR-6 (substrate drift) are all **open**.
- `validate-live-readiness`, `validate-infra-convergence`, and `validate-final-go` remain **advisory** with **zero** production-blocking gates achieved (unchanged from Phase 5).

---

## 8. Constraints honored

- Planning only — no Azure changes, no secrets touched, no infrastructure implemented.
- No deployment-workflow implementation changes (documentation/plan only).
- No CI authority change; gate classifications untouched.
- No `final:go` promotion; no live-readiness artifact fabrication.
- No production-readiness claim; production-blocking achieved remains **0**.

---

## Honest closing declaration

> Runtime separation planning is complete. Nzila OS / Union Eyes remains
> controlled-pilot safe; sensitive multi-org production remains pending
> infrastructure separation, rehearsal evidence, and final-go certification.

**Wave status:** controlled-pilot hardened, gate authority explicit, production
certification still pending runtime separation and final evidence.

## HARD STOP

Phase 6 is complete and is a **plan, not an implementation**. Do **not** begin any
runtime separation execution (Azure changes, DB migration, identity split,
cutover) without a separate, explicit human approval.
