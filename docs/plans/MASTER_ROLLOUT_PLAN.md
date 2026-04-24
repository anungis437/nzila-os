# NzilaOS Master Rollout Plan

**Version:** 1.0.0
**Date:** 2026-04-20
**Classification:** Internal — Operator & Executive Reference
**Authority:** `docs/governance/APP_LIFECYCLE_MATRIX.md` · `docs/ops/ownership-registry.md`

---

## How to Read This Document

Each phase is broken into **tracks**, each track into **tasks**. Every task row specifies:

- the exact repo asset(s) to execute or deliver
- who owns the outcome
- what the deliverable is
- what gate must pass before moving forward
- the recommended calendar window

This is not a conceptual plan. Every asset listed exists in the repo today. The job is to run them, in order, and record outcomes.

> **Admission rule:** An app does not enter a phase until the gate from the previous phase is closed and recorded. No exceptions.

---

## App Wave Classification

Derived from `docs/governance/APP_LIFECYCLE_MATRIX.md` and `docs/ops/ownership-registry.md`.

| Wave | Apps | Rationale |
|------|------|-----------|
| **Wave 1 — Platform Backbone** | `control-plane`, `console`, `web` | Internal operator surfaces; prerequisite for all pilots |
| **Wave 2 — First Lighthouse Pilot** | `union-eyes` | Strongest repo maturity; evidence-first; reference governance implementation |
| **Wave 3 — Operational Workflow** | `flow` | Lower political sensitivity; multi-tenant; broader commercial use |
| **Wave 4 — Growth & Scale** | `zonga` | Higher operational complexity; defer until platform ops discipline proven |
| **Blocked / Not in scope yet** | `mobility`, `mobility-client-portal`, `nacp-exams`, `platform-admin` | Not pilot-eligible until tier graduation criteria met |

---

## Phase 1 — Freeze the Rollout Baseline

**Goal:** Define, document, and lock the operational baseline before any external org is onboarded.
**Calendar:** Weeks 1–2

### Track 1A — Deployment Profile Freeze

| # | Task | Repo Asset | Owner | Output | Gate |
|---|------|-----------|-------|--------|------|
| 1.1 | Select and record the Wave 1 deployment model (Managed Cloud / Canada Central is the current canonical option) | `docs/buyers/deployment-models.md` | Platform Owner | Decision recorded in `docs/deploy/active-profile.md` | Written record committed to `main` |
| 1.2 | Confirm infrastructure is provisioned and healthy (ACR, Container Apps env, DB, Key Vault, Blob) | `docs/buyers/deployment-models.md` § Infrastructure Stack | <team-platform-ops@nzila.ai> | All 5 Container Apps return HTTP 200 | `pnpm release:smoke` passes for `web,console,union-eyes` |
| 1.3 | Confirm Entra auth and session model is live for all pilot-eligible apps | `docs/platform/auth-migration-final.md` | <team-platform-admin@nzila.ai> | Auth health check passes on staging | `pnpm sre:health:contract` passes |

### Track 1B — Environment Model Freeze

| # | Task | Repo Asset | Owner | Output | Gate |
|---|------|-----------|-------|--------|------|
| 1.4 | Document the environment set in use: `local → staging → production` | `docs/ops/ENVIRONMENT_OPERATIONS.md` | Platform Owner | Env model confirmed, no preview layer needed for Wave 1 | Written in ops register |
| 1.5 | Freeze the pilot-approved app list: Wave 1–4 classification above is the record | `docs/governance/APP_LIFECYCLE_MATRIX.md` | Platform Owner | `platform/registry/apps.json` updated to reflect wave assignment | `pnpm app:lifecycle:check` passes |
| 1.6 | Confirm staging drift is clean before any pilot onboarding | `docs/ops/staging-runtime-drift-runbook.md` | <team-platform-ops@nzila.ai> | Zero version and env drift on staging | `pnpm drift:full:staging` passes |

### Track 1C — Release Gate Freeze

| # | Task | Repo Asset | Owner | Output | Gate |
|---|------|-----------|-------|--------|------|
| 1.7 | Ratify the mandatory pre-pilot release gate set (see table below) | `docs/ops/release-governance/release-governance.md` | Platform Owner | Gate sequence documented; no bypasses permitted | Reviewed and signed by platform owner |
| 1.8 | Confirm all gates currently pass on `main` | Multiple scripts (see gate set below) | <team-platform-admin@nzila.ai> | All gates green on `main` | CI clean; gate run logged |
| 1.9 | Confirm signed tag policy is enforced | `docs/ops/release-governance/release-governance.md` § Signed Tags | <team-platform-admin@nzila.ai> | GPG or SSH signing configured; `pnpm release:verify-signature` passes | `pnpm release:verify-signature` passes |

**Mandatory Release Gate Set (frozen at Phase 1)**

| Order | Command | What It Checks |
|-------|---------|----------------|
| 1 | `pnpm lint` | No lint regressions |
| 2 | `pnpm typecheck` | No TypeScript errors |
| 3 | `pnpm test:fast` | Unit tests excluding slow contracts |
| 4 | `pnpm contract-tests` | 129+ contract invariants (org isolation, audit, evidence, etc.) |
| 5 | `pnpm pilot:check` | Pilot technical readiness gate |
| 6 | `pnpm release:audit` | Governance snapshot and change audit |
| 7 | `pnpm release:migration:safety` | DB migration safety check |
| 8 | `pnpm sre:validate` | SRE health contract, synthetic dry-run, alert routing |
| 9 | `pnpm drift:full:staging` | Version + env drift checks against staging |
| 10 | `pnpm deploy:evidence` | Deploy evidence package generated |

---

## Phase 2 — Control Plane and Console Hardening

**Goal:** Make the platform's operator surfaces — not just the app UI — production-capable. Every pilot runs through these.
**Calendar:** Weeks 2–3

### Track 2A — Org Provisioning Operationalization

| # | Task | Repo Asset | Owner | Output | Gate |
|---|------|-----------|-------|--------|------|
| 2.1 | Define and document the canonical org provisioning sequence (8 steps) | `docs/pilot/01-scope-checklist.md` § Customer & Org Setup | <team-platform-admin@nzila.ai> | SOP written and linked from pilot checklist | SOP committed and reviewed |
| 2.2 | Walk through org creation end-to-end in staging Console | `apps/console` · `apps/control-plane` | <team-platform-admin@nzila.ai> | Org provisioned, isolated, admin user active | Console → Isolation check passes |
| 2.3 | Verify org isolation runtime invariants | `tooling/contract-tests/org-isolation-runtime.test.ts` · `tooling/contract-tests/org-isolation-stress.test.ts` | <team-platform-admin@nzila.ai> | Zero cross-org leaks recorded in stress run | Both contract tests green |
| 2.4 | Confirm proof pack generation works for a new org | `apps/console` → Proof Pack · `scripts/proof/generate-runtime-proof.ts` | <team-platform-admin@nzila.ai> | Proof pack PDF/JSON generated and sealed for demo org | `pnpm proof:runtime` exits clean; artifact in blob storage |

### Track 2B — Pilot Metrics Activation

| # | Task | Repo Asset | Owner | Output | Gate |
|---|------|-----------|-------|--------|------|
| 2.5 | Confirm `@nzila/platform-pilot-metrics` is emitting for `union-eyes` in staging | `docs/control-plane/pilot-metrics-operator-guide.md` · `apps/control-plane` | <team-union-eyes-engineering@nzila.ai> | Pilot metric events appear in Control Plane `/pilots` dashboard | Dashboard non-empty for demo org |
| 2.6 | Confirm alert routing is functional for pilot org signals | `docs/platform/ALERTING_RUNBOOK.md` · `pnpm sre:alerts:dry-run` | <team-platform-ops@nzila.ai> | Alert routes confirmed for: adoption low, SLA spike, error spike, dead letters high | `pnpm sre:alerts:dry-run` passes |
| 2.7 | Confirm pilot metrics export works for a demo org | Control Plane `/api/control-plane/pilot-metrics/{pilotId}/export` | <team-platform-admin@nzila.ai> | Export returns valid JSON and Markdown for demo pilot | Export endpoint returns 200 with valid payload |

### Track 2C — Governance Snapshot Baseline

| # | Task | Repo Asset | Owner | Output | Gate |
|---|------|-----------|-------|--------|------|
| 2.8 | Run full governance audit and record as the Phase 2 baseline | `pnpm governance:audit` | <team-platform-admin@nzila.ai> | Governance audit output committed to `ops/governance-snapshots/` | `pnpm governance:audit` exits 0 |
| 2.9 | Run architecture checks to confirm no boundary violations | `pnpm architecture:check` | <team-platform-admin@nzila.ai> | All architecture checks pass | `pnpm architecture:check` exits 0 |
| 2.10 | Confirm app lifecycle registry is accurate | `pnpm app:lifecycle:check` · `pnpm registry:check` | <team-platform-admin@nzila.ai> | Registry is consistent with code reality | Both checks exit 0 |

---

## Phase 3 — Internal Mock Pilot (Dry Run)

**Goal:** Run one full pilot cycle end-to-end using internal actors before any external org is onboarded.
**Calendar:** Week 3

This is compulsory. No external pilot launches without a completed internal dry run.

### Track 3A — Mock Pilot Execution

| # | Task | Repo Asset | Owner | Output | Gate |
|---|------|-----------|-------|--------|------|
| 3.1 | Create an internal demo org through Console | `docs/pilot/01-scope-checklist.md` | Pilot Captain | Demo org live in staging | Console shows org active |
| 3.2 | Onboard sample data following the data onboarding protocol | `docs/pilot/02-data-onboarding.md` | Pilot Captain + Engineering | Sample data in org; import validated | `docs/pilot/02-data-onboarding.md` checklist complete |
| 3.3 | Assign roles and verify RBAC is scoped correctly | `docs/governance/GOVERNANCE_ARCHITECTURE.md` | Pilot Captain | Admin and user roles assigned; cross-role access tested | No RBAC bypass observed |
| 3.4 | Run primary workflow (case creation → assignment → resolution in union-eyes) | `apps/union-eyes` · `docs/pilot/05-demo-script.md` | Pilot Captain | Workflow completes without errors | Demo script passes end-to-end |
| 3.5 | Generate proof pack and evidence export for the demo org | `apps/console` → Proof Pack · `pnpm proof:runtime` | Pilot Captain | Sealed proof artifact exists for demo org | Artifact SHA-256 hash recorded |
| 3.6 | Trigger a test health alert and follow the response runbook | `docs/ops/incident-response.md` · `pnpm sre:alerts:dry-run` | Pilot Captain + Ops | Alert triggered → received → runbook executed → resolved | Resolution documented in incident log |
| 3.7 | Simulate a rollback scenario | `docs/ops/release-governance/rollback-runbook.md` · `pnpm release:rollback --list` | Pilot Captain + Ops | Rollback candidate identified; dry-run executed successfully | `pnpm release:rollback --tag <tag>` (dry-run) passes |
| 3.8 | Export evidence and produce pilot summary memo | `apps/console` → Evidence Export · `docs/control-plane/pilot-metrics-operator-guide.md` | Pilot Captain | Written pilot summary memo with outcomes and friction log | Memo committed to `docs/ops/pilots/mock-pilot-summary.md` |

### Track 3B — Friction and Gap Log

| # | Task | Repo Asset | Owner | Output | Gate |
|---|------|-----------|-------|--------|------|
| 3.9 | Log every friction point, manual step, or workaround encountered during mock pilot | (New file: `docs/ops/pilots/mock-pilot-friction-log.md`) | Pilot Captain | Friction log with each issue, severity, and disposition | Log committed before Phase 4 gate |
| 3.10 | Triage friction log; raise issues for anything blocking a real pilot | GitHub Issues | Platform Owner + Engineering | All P0/P1 frictions have issues assigned and resolved or deferred with rationale | No open P0 blockers |

---

## Phase 4 — Union Eyes Lighthouse Pilot (Wave 2)

**Goal:** Run the first real external pilot. Controlled. Documented. Measured.
**App:** `apps/union-eyes`
**Calendar:** Weeks 4–14

**Deployment model for this pilot:** Managed Cloud (Canada Central) — org-level isolation, no dedicated infrastructure.
**Ownership:** <team-union-eyes-engineering@nzila.ai> (Technical) · <team-union-eyes-business@nzila.ai> (Business) · Pilot Captain (named)

### Track 4A — Pre-Launch (Weeks 4–5)

| # | Task | Repo Asset | Owner | Output | Gate |
|---|------|-----------|-------|--------|------|
| 4.1 | Complete all 7 gates in pilot readiness checklist for union-eyes | `docs/buyers/pilot-readiness-checklist.md` | Pilot Captain | All gates checked ✅; checklist committed | `pnpm pilot:check` passes for `union-eyes` |
| 4.2 | Deliver security and privacy packet to buyer | `docs/pilot/03-security-privacy-packet.md` · `docs/governance/security-overview.md` · `docs/governance/procurement-pack.md` | CISO / Platform Owner | Packet delivered and acknowledged by buyer | Buyer sign-off recorded |
| 4.3 | Confirm SLO policy and perf budgets are acceptable for pilot duration | `docs/pilot/04-monitoring-and-slos.md` · `ops/perf-budgets.yml` · `docs/platform/SLO_ERROR_BUDGET_POLICY.md` | <team-platform-ops@nzila.ai> | SLO thresholds reviewed and acknowledged | SLO review written record |
| 4.4 | Provision pilot org, roles, and admin user | `docs/pilot/01-scope-checklist.md` §1 | <team-platform-admin@nzila.ai> | Org active in Console; buyer admin user confirmed | Console → Isolation check passes for pilot org |
| 4.5 | Run release gate set (Phase 1 frozen gates) against current `main` | All gates in Phase 1 gate set | <team-platform-admin@nzila.ai> | All 10 gates pass | CI log and `pnpm deploy:evidence` artifact recorded |
| 4.6 | Execute on-call rotation check — pilot org is covered | `docs/ops/on-call.md` | <team-platform-ops@nzila.ai> | On-call schedule confirmed; escalation path tested | <oncall-union-eyes@nzila.ai> paged successfully in test |

### Track 4B — Data Onboarding (Weeks 5–6)

| # | Task | Repo Asset | Owner | Output | Gate |
|---|------|-----------|-------|--------|------|
| 4.7 | Complete data inventory and PII handling classification | `docs/pilot/02-data-onboarding.md` §1 | Pilot Captain + Legal | Data inventory doc committed | Legal sign-off |
| 4.8 | Execute data import using documented method; sample-validate records | `docs/pilot/02-data-onboarding.md` §3–4 | <team-union-eyes-engineering@nzila.ai> | Import complete; validation sampling logged | ≥ 95% sample validation pass rate |
| 4.9 | Verify org isolation post-import (no cross-org data visible) | `tooling/contract-tests/org-isolation-runtime.test.ts` | <team-union-eyes-engineering@nzila.ai> | Zero isolation violations recorded | Contract test passes post-import |
| 4.10 | Confirm rollback / data removal path for this pilot | `docs/pilot/02-data-onboarding.md` §5 | <team-union-eyes-engineering@nzila.ai> | Rollback procedure documented and tested | Rollback dry-run passes |

### Track 4C — Soft Launch (Weeks 6–7)

| # | Task | Repo Asset | Owner | Output | Gate |
|---|------|-----------|-------|--------|------|
| 4.11 | Run demo script with buyer stakeholders | `docs/pilot/05-demo-script.md` | Pilot Captain | Demo completed; stakeholder sign-off | Stakeholder confirms readiness to proceed |
| 4.12 | Conduct admin training | `docs/platform/APP_ADOPTION_GUIDE.md` | Pilot Captain | All admins trained; training attendance recorded | Training completion ≥ 100% of pilot admins |
| 4.13 | Conduct end-user onboarding (limited cohort) | `docs/platform/ONBOARDING.md` | Pilot Captain | Cohort onboarded; initial workflow completed by all users | First successful workflow per user recorded |
| 4.14 | Go live — open to pilot cohort | — | Pilot Captain + Ops | Pilot org live; monitoring active | Daily health check green on day 1 |

### Track 4D — Pilot Operations (Weeks 7–12)

| # | Task | Repo Asset | Owner | Output | Gate |
|---|------|-----------|-------|--------|------|
| 4.15 | Daily: review Control Plane pilot health dashboard | `docs/control-plane/pilot-metrics-operator-guide.md` § Daily Operator Workflow | Pilot Captain | No unresolved P0 alerts | Daily log maintained |
| 4.16 | Weekly: produce KPI review memo from pilot metrics export | Control Plane `/api/control-plane/pilot-metrics/{pilotId}/export` | Pilot Captain | Weekly memo committed to `docs/ops/pilots/ue-pilot/weekly/` | Memo produced every Friday |
| 4.17 | Resolve all P0/P1 issues within 24h SLA | `docs/ops/incident-response.md` | <oncall-union-eyes@nzila.ai> | Incidents resolved; post-mortems filed for any P0 | P0 TTR ≤ 24h; P1 TTR ≤ 72h |
| 4.18 | Track conversion readiness score weekly using pilot metrics | `@nzila/platform-pilot-metrics` | Pilot Captain | Score trend recorded; drops investigated | Score ≥ 60 before exit decision |

### Track 4E — Pilot Exit (Weeks 12–14)

| # | Task | Repo Asset | Owner | Output | Gate |
|---|------|-----------|-------|--------|------|
| 4.19 | Generate final evidence pack and proof pack for pilot org | `pnpm proof:runtime` · `pnpm evidence:pack:monthly` | <team-platform-admin@nzila.ai> | Evidence pack sealed and stored in blob | SHA-256 hash recorded in pilot ledger |
| 4.20 | Produce pilot outcome memo | (New file: `docs/ops/pilots/ue-pilot/outcome-memo.md`) | Pilot Captain | Memo covers: KPIs vs targets, friction log, incident count, conversion recommendation | Memo committed before exit decision |
| 4.21 | Make the exit decision: convert / extend / pause / reshape | `docs/buyers/union-eyes-revenue-playbook.md` | Platform Owner + Business Owner | Decision documented with rationale | Decision recorded and communicated to buyer |

---

## Phase 5 — Production Promotion Path (All Apps)

**Goal:** Formalize the one and only allowed path from feature → production.
**Calendar:** Weeks 5–8 (runs in parallel with pilot; must be locked before any production conversion)

### Track 5A — Production Gate Lock

| # | Task | Repo Asset | Owner | Output | Gate |
|---|------|-----------|-------|--------|------|
| 5.1 | Confirm the artifact immutability policy is enforced | `docs/ops/DEPLOYMENT_PROMOTION_MODEL.md` | <team-platform-admin@nzila.ai> | Artifact digest verification passes on last staging deploy | `pnpm release:verify-signature` and digest check pass |
| 5.2 | Confirm SBOM and attestation exist for all Wave 1–2 images | `docs/ops/DEPLOYMENT_PROMOTION_MODEL.md` § Artifact Manifest | <team-platform-admin@nzila.ai> | SBOM and attestation references recorded in artifact manifests | `ops/artifacts/*.json` all have `sbom_hash` and `attestation_ref` |
| 5.3 | Validate DB promotion safety for any pending migrations | `docs/ops/release-governance/db-promotion-safety.md` · `pnpm db:doctor:strict` | <team-platform-admin@nzila.ai> | No unsafe migrations pending | `pnpm db:migration:safety` exits 0 |
| 5.4 | Document the production promotion sequence as a named SOP | `docs/ops/DEPLOYMENT_PROMOTION_MODEL.md` | Platform Owner | SOP: 9-step production promotion sequence committed | SOP reviewed and approved |

**Canonical Production Promotion Sequence (frozen)**

| Step | Command / Action | Owner |
|------|-----------------|-------|
| 1 | Feature complete on app branch | App team |
| 2 | `pnpm lint && pnpm typecheck && pnpm test:fast && pnpm contract-tests` | App team |
| 3 | Merge to `main`; staging deploy via `gitops-deploy.yml` | CI / App team |
| 4 | `pnpm drift:full:staging` | Ops |
| 5 | `pnpm release:staging` (audit + migration safety + smoke) | Ops |
| 6 | `pnpm sre:validate` | Ops |
| 7 | `pnpm release:tag` (signed) | Platform Owner |
| 8 | Production deploy via `deploy-production.yml` with digest verification | CI / Ops |
| 9 | `pnpm deploy:evidence` + `pnpm release:evidence --tag <tag>` | Ops |

### Track 5B — App-Class Production Standards

| App Class | Apps | Production Standard Requirements |
|-----------|------|----------------------------------|
| **Class A — Governance / Regulated** | `union-eyes`, `abr`, `cfo` | Full gold standard (`docs/governance/APP_GOLD_STANDARD.md`); proof pack visible; evidence sealing enforced; tighter release gating; buyer/security documentation complete |
| **Class B — Operational Workflow** | `flow`, `partners` | Gold standard; uptime and process reliability; integration health monitoring; admin usability validated |
| **Class C — Growth / Scale** | `zonga` | Gold standard; performance budgets enforced; media pipeline reliability; billing/payout integrity verified; creator support operations documented |

### Track 5C — Support and On-Call Formalization

| # | Task | Repo Asset | Owner | Output | Gate |
|---|------|-----------|-------|--------|------|
| 5.5 | Confirm on-call coverage exists for every Wave 1–2 app | `docs/ops/on-call.md` · `docs/ops/ownership-registry.md` | <team-platform-ops@nzila.ai> | All pilot apps have named on-call and escalation path | Ownership registry 100% coverage (already at 100%) |
| 5.6 | Schedule quarterly DR drill | `docs/ops/disaster-recovery.md` · `pnpm db:restore-drill` | <team-platform-ops@nzila.ai> | DR drill scheduled; runbook accessible | First drill date committed in ops calendar |
| 5.7 | Confirm SLA tiers are defined and communicated to pilot buyers | `docs/buyers/sla-support-model.md` | Platform Owner + Business | SLA tier doc delivered to buyer | Buyer acknowledgement on file |

---

## Phase 6 — Flow Pilot (Wave 3)

**Goal:** Reuse the rollout motion for a second product vertical.
**App:** `apps/flow`
**Calendar:** Weeks 12–22 (starts after UE pilot reaches steady state)
**Condition:** UE pilot is at steady state (no open P0s; daily ops are routine)

| # | Task | Repo Asset | Owner | Output | Gate |
|---|------|-----------|-------|--------|------|
| 6.1 | Confirm `flow` meets pilot readiness gates | `docs/buyers/pilot-readiness-checklist.md` | Pilot Captain (Flow) | All 7 checklist gates pass | `pnpm pilot:check` passes for `flow` |
| 6.2 | Deliver flow buyer pack and security packet | `docs/buyers/flow-buyer-pack.md` · `docs/pilot/03-security-privacy-packet.md` | CISO / Platform Owner | Packet delivered and acknowledged | Buyer sign-off |
| 6.3 | Provision flow org through same Console provisioning SOP | Org provisioning SOP (from Task 2.1) | <team-platform-admin@nzila.ai> | Org active; roles assigned | Console shows org isolated |
| 6.4 | Execute same 4-track pilot motion (pre-launch → data → soft-launch → operations) | All `docs/pilot/*` assets | Pilot Captain (Flow) | Flow pilot running with daily monitoring | Daily health green |
| 6.5 | Maintain shared services discipline — do not let flow bypass platform packages | `docs/platform/WHEN_TO_USE_PLATFORM_PACKAGES.md` · `pnpm platform:adoption:check` | <team-platform-admin@nzila.ai> | Platform adoption check passes | `pnpm platform:adoption:check` exits 0 |
| 6.6 | Produce flow pilot outcome memo | (New file: `docs/ops/pilots/flow-pilot/outcome-memo.md`) | Pilot Captain (Flow) | Exit decision documented | Decision recorded and communicated |

---

## Phase 7 — Zonga Pilot (Wave 4)

**Goal:** Extend the platform into a higher-scale, higher-complexity vertical.
**App:** `apps/zonga`
**Calendar:** Weeks 22+ (starts only after platform ops discipline is proven across Waves 1–3)
**Condition:** Both UE and Flow pilots are in steady state or converted; no open platform-level P0s

| # | Task | Repo Asset | Owner | Output | Gate |
|---|------|-----------|-------|--------|------|
| 7.1 | Confirm `zonga` has graduated from INCUBATING to PILOT tier | `docs/governance/APP_LIFECYCLE_MATRIX.md` § Tier Graduation | Platform Owner | `app:lifecycle:check` shows `zonga` at PILOT or higher | `pnpm app:lifecycle:check` passes |
| 7.2 | Confirm billing and payout integrity is validated | `docs/platform/revenue-architecture.md` · `docs/platform/revenue-system.md` | <team-zonga-engineering@nzila.ai> | Billing pipeline test passes; no revenue attribution gaps | Billing contract test passes |
| 7.3 | Confirm media pipeline reliability meets perf budgets | `ops/perf-budgets.yml` · `pnpm sre:validate` | <team-zonga-engineering@nzila.ai> | Perf budget check passes for zonga | `pnpm sre:validate` passes for `zonga` |
| 7.4 | Execute pilot motion (same 4-track pattern) | All `docs/pilot/*` assets | Pilot Captain (Zonga) | Zonga pilot running with daily monitoring | Daily health green |

---

## Phase 8 — Rollout Machine Industrialization

**Goal:** Make the pilot motion a repeatable kit the team runs without heroics.
**Calendar:** Weeks 6–10 (runs in parallel; should be complete before Flow pilot launches)

| # | Task | Repo Asset | Owner | Output | Gate |
|---|------|-----------|-------|--------|------|
| 8.1 | Consolidate all pilot assets into one canonical Pilot Kit directory | `docs/pilot/*` · `docs/buyers/*` · `docs/ops/on-call.md` · `docs/ops/incident-response.md` | Platform Owner | `docs/pilot/PILOT_KIT.md` index committed | Index reviewed; all links resolve |
| 8.2 | Write the org provisioning SOP as a standalone runbook | Output from Task 2.1 | <team-platform-admin@nzila.ai> | `docs/ops/runbooks/org-provisioning.md` committed | Reviewed by ops and engineering |
| 8.3 | Write the training deck for pilot admins and end-users | `docs/platform/APP_ADOPTION_GUIDE.md` · `docs/platform/ONBOARDING.md` | Platform Owner | Training deck (slides or markdown) committed | Used in and validated against UE pilot |
| 8.4 | Define and record the weekly pilot review template | Control Plane pilot metrics export | Pilot Captain | Template committed to `docs/ops/pilots/weekly-review-template.md` | Used in first weekly UE pilot review |
| 8.5 | Define the exit decision memo template | Output from UE pilot outcome memo (Task 4.20) | Platform Owner | Template committed to `docs/ops/pilots/exit-decision-template.md` | Reviewed before Flow pilot exit |
| 8.6 | Define the production conversion checklist | `docs/buyers/pilot-readiness-checklist.md` · `docs/governance/enterprise-readiness.md` | Platform Owner + Business | Checklist committed to `docs/ops/pilots/production-conversion-checklist.md` | Reviewed before any paid production conversion |

---

## Rollout Dashboard — Current State Tracker

> Update this table as phases and tasks close. Record blockers immediately.

| Phase | Status | Pilot / App | Open Blockers | Last Updated |
|-------|--------|------------|---------------|--------------|
| Phase 1 — Freeze Baseline | ⬜ Not Started | Platform | — | 2026-04-20 |
| Phase 2 — Control Plane Hardening | ⬜ Not Started | Platform | — | 2026-04-20 |
| Phase 3 — Internal Mock Pilot | ⬜ Not Started | Internal | — | 2026-04-20 |
| Phase 4 — UE Lighthouse Pilot | ⬜ Not Started | union-eyes | Blocked on Phase 3 | 2026-04-20 |
| Phase 5 — Production Promotion Path | ⬜ Not Started | Platform | — | 2026-04-20 |
| Phase 6 — Flow Pilot | ⬜ Not Started | flow | Blocked on Phase 4 | 2026-04-20 |
| Phase 7 — Zonga Pilot | ⬜ Not Started | zonga | Blocked on Phase 6 | 2026-04-20 |
| Phase 8 — Industrialization | ⬜ Not Started | Platform | — | 2026-04-20 |

---

## Named Role Requirements

The following roles must be named before Phase 3 begins. These are not code constructs.

| Role | Responsibility | Suggested Owner |
|------|---------------|-----------------|
| **Platform Owner** | Release gates, deployment profile decisions, app admission, exit decisions | TBD |
| **Pilot Captain — UE** | End-to-end UE pilot execution, daily ops, weekly memos, friction log | TBD |
| **Pilot Captain — Flow** | Same scope for Flow | TBD |
| **Pilot Captain — Zonga** | Same scope for Zonga | TBD |
| **On-Call Lead** | On-call schedule, incident triage, DR drills | <team-platform-ops@nzila.ai> (from registry) |
| **CISO / Security Owner** | Security packet delivery, pentest scheduling, OWASP review | TBD |
| **Customer Success Owner** | Buyer communications, training, conversion recommendation | TBD |

---

## What Is Explicitly Out of Scope Until Phase 6+

These items are deliberately deferred to prevent over-expansion before core pilots are proven:

| Item | Rationale |
|------|-----------|
| `mobility`, `mobility-client-portal` release | `frozen` in ownership registry; tier graduation not met |
| `nacp-exams` release | `blocked` in ownership registry; tier graduation not met |
| `platform-admin` external exposure | `frozen`; internal only |
| New infrastructure regions | No multi-region need until post-Wave-3 scale demand |
| Dedicated tenant infrastructure per pilot | Managed Cloud org-scoping is sufficient for Wave 1–3 |
| Sovereign / hybrid deployment model | Only for specific enterprise or government buyers identified post-Wave-3 |

---

## Key Document Index

| Document | Purpose |
|----------|---------|
| `docs/pilot/01-scope-checklist.md` | Per-pilot scope and org setup gate |
| `docs/pilot/02-data-onboarding.md` | Data inventory, import, validation, rollback |
| `docs/pilot/03-security-privacy-packet.md` | Security packet for buyer delivery |
| `docs/pilot/04-monitoring-and-slos.md` | SLO configuration and alert setup for pilot |
| `docs/pilot/05-demo-script.md` | Rehearsed demo walkthrough |
| `docs/buyers/pilot-readiness-checklist.md` | 7-gate technical readiness gate for pilot entry |
| `docs/buyers/deployment-models.md` | Infrastructure stack and deployment options |
| `docs/buyers/union-eyes-buyer-pack.md` | UE external buyer documentation |
| `docs/buyers/flow-buyer-pack.md` | Flow external buyer documentation |
| `docs/ops/DEPLOYMENT_PROMOTION_MODEL.md` | Artifact immutability and promotion flow |
| `docs/ops/ENVIRONMENT_OPERATIONS.md` | Environment set and operations model |
| `docs/ops/on-call.md` | On-call schedule and escalation |
| `docs/ops/incident-response.md` | Incident response playbook |
| `docs/ops/disaster-recovery.md` | DR runbooks and drill schedule |
| `docs/ops/release-governance/release-governance.md` | Release types, gate set, commands |
| `docs/ops/release-governance/rollback-runbook.md` | Rollback procedure |
| `docs/control-plane/pilot-metrics-operator-guide.md` | Daily operator workflow for pilot monitoring |
| `docs/governance/APP_LIFECYCLE_MATRIX.md` | App tier classification and graduation criteria |
| `docs/governance/APP_GOLD_STANDARD.md` | Production-readiness standard (union-eyes is reference) |
| `docs/governance/platform-readiness.md` | Platform-grade posture memo |
| `docs/governance/enterprise-readiness.md` | Enterprise deployment readiness |
| `docs/platform/SLO_ERROR_BUDGET_POLICY.md` | SLO policy and error budget rules |
| `docs/platform/SHARED_SERVICES.md` | Shared platform service ownership and upgrade rules |
