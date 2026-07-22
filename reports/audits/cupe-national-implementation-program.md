# CUPE National — 10-Phase Implementation Program

**Status:** Phase 0 in progress · Phases 1–10 not started
**Program owner:** union-eyes maintainers
**Current authorization:** Phase 0 only (Baseline Stabilization). Do not begin Phase 1 automatically.
**Program target:** graduate 23 CUPE National scenarios to `IMPLEMENTED_AND_DEMONSTRABLE`.

## Program invariants (all phases)

1. **Root cause over green.** Do not disable, skip, weaken, delete, or broadly mock failing tests merely to reach green status. Do not accept partial success as if it were completion.
2. **Phase discipline.** Execute only the currently authorized phase. Halt before the next phase and record the hand-off gate.
3. **Evidence over assertion.** Every phase closes with (a) reproducible failure inventory before, (b) targeted fixes with commit hashes, (c) tests re-executed after, (d) deployment record (or documented external blocker).
4. **Non-regression.** Baselines that passed at the start of a phase must still pass at the end of that phase.
5. **Truth manifest immutability during a phase.** The seven CUPE audit registers under [reports/audits/](../../reports/audits/) are not edited during Phase 0. They will be updated only when a scenario is demonstrated end-to-end.

## Phase map

| Phase | Name | Authorization gate | Exit criteria |
|-------|------|--------------------|---------------|
| 0 | Baseline Stabilization | maintainer approval (this document) | Truth re-established at HEAD; vitest + API baselines recorded; failure inventory published; root-cause fixes for migration/environment defects landed; staging deploy attempted or blocker recorded. **No scenario graduation.** |
| 1 | Auth & Org Boundary Truth | after Phase 0 sign-off | Fixture parity between `orgs` and `organizations`; `getOrganizationIdForUser` covers all role paths; cross-org negative E2E green. |
| 2 | Data Model Reconciliation | after Phase 1 | Reconcile `orgs` vs `organizations` divergence for pilot metrics; align FK targets; seed parity for demo org across both tables. |
| 3 | Pilot Metrics & Alerts Truth | after Phase 2 | `pilot_definitions`, `pilot_metric_events`, `pilot_alerts`, `pilot_alert_rules`, `pilot_alert_escalations` populated with deterministic seed for demo org; `admin/pilot-status` route returns non-empty state; E2E `pilot-mode-gating` + `pilot-journey` green. |
| 4 | Governance Visibility Truth | after Phase 3 | Governance dashboard renders with role-scoped data; audit event canonical hashes verified; `no-fsm-overexposure` E2E green. |
| 5 | Case Lifecycle Truth | after Phase 4 | Case intake → triage → resolution → escalation covered by E2E and negative-path suites. |
| 6 | Member Journey Truth | after Phase 5 | Member self-serve flows (member-journey, empty-states) green; localization drift resolved. |
| 7 | Stakeholder Demo Journeys Truth | after Phase 6 | `stakeholder-demo-journeys` E2E green for all six roles; demo reset deterministic. |
| 8 | Compliance & Evidence Register | after Phase 7 | Evidence register linked to demonstrable runs; deployment digests captured. |
| 9 | Deployment & Smoke | after Phase 8 | Staging Container App carries current image digest; smoke suite green post-deploy. |
| 10 | Scenario Graduation | after Phase 9 | Per-scenario proof recorded; truth manifest updated; audit registers refreshed. |

## Non-goals for Phase 0

- No scenario graduation.
- No product-behaviour change to Union Eyes routes, actions, or FSM.
- No changes to `packages/db/drizzle/*.sql` files that predate this phase (fix-forward only).
- No credential rotation or infra rewiring.
- No modification to the seven CUPE audit registers under [reports/audits/](../../reports/audits/).

## Phase 0 evidence directory

All Phase 0 artefacts live under [reports/audits/cupe-national-phase-0/](../../reports/audits/cupe-national-phase-0/).

- Baseline vitest log: `vitest-run-20260722-162228.log`
- Baseline focused API log: `vitest-api-20260722-162507.log`
- E2E probe log: `e2e-pilot-mode-gating-20260722.log`
- Failure inventory: `failure-inventory.md`
- Phase 0 ledger: `../cupe-national-phase-ledger.md`

## Hand-off from Phase 0 to Phase 1

Phase 1 may begin only after all of the following are recorded in [cupe-national-phase-ledger.md](cupe-national-phase-ledger.md):

- Phase 0 exit checklist ticked.
- Deployment result (success digest or external blocker).
- Post-deployment smoke result (or documented blocker).
- Explicit maintainer sign-off.
