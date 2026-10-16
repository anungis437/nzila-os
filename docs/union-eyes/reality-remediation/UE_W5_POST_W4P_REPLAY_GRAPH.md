# W5A post-W4P replay and ordering graph - PASS

## Bound replay-unit accounting

127/127 original compatibility records/mechanics preserved. 84 exact shared CREATE units: 43 standalone statements/41 enum DO wrappers. All23 original-position frozen migration boundaries retained separately;107 total graph nodes. No forced127-node denominator,no synthetic producer.

## Ordering,atomicity and wrapper preservation

86/86 exact accepted handoffs mapped to86 provenance-preserving edges;43 unique endpoint pairs. Provider availability precedes consumer;historical positions remain recorded,not execution authority. ORDER_OVERRIDE_SOURCE=ACCEPTED_W5_HANDOFF.
Exact enum wrappers remain indivisible. Standalone CREATE units retain their complete table definition. State-aware prestate validation fails on drift before duplicate/IF-NOT-EXISTS paths;all original wrappers/non-CREATE/postcreate behavior stays at original migration replay. Frozen schema objects are not renamed or rewritten.
Atomicity conflicts=0;unresolved endpoints=0;graph cycles=0;unproven edges=0.

## Graph and topological plan

231 exact-provenance edge records. Original UE manifest-relative order is retained under the accepted scope rule;financial replay remains separate. Exact column-type references within recorded CREATE definitions supply only bound type-to-table edges. No semantic-similarity dependencies.
Deterministic tie rule: frozen position,source statement ordinal,stable unit ID. Complete ordered topology in [the plan](./UE_W5_REPLAY_TOPOLOGICAL_PLAN.md).
Sequence remains DJANGO_FIRST ->successful future W4P verification ->post-W4P state-aware replay ->later constraint materialization when operands exist. W4P precondition graph unchanged;0 downstream items moved before W4P.

## Carried deferred register

| Handoff ID                                  | State                                       | Materialization position |
| ------------------------------------------- | ------------------------------------------- | ------------------------ |
| UE-W4C-DEFERRED-CONSTRAINT-687b0013df9b8c8a | DEFERRED_AFTER_REPLAY_OR_OPERAND_PRODUCTION | UNRESOLVED_DOWNSTREAM    |
| UE-W4C-DEFERRED-CONSTRAINT-ab480be7d3ecbe76 | DEFERRED_AFTER_REPLAY_OR_OPERAND_PRODUCTION | UNRESOLVED_DOWNSTREAM    |
| UE-W4C-DEFERRED-CONSTRAINT-b54f294d75c25fb5 | DEFERRED_AFTER_REPLAY_OR_OPERAND_PRODUCTION | UNRESOLVED_DOWNSTREAM    |
| UE-W4C-DEFERRED-CONSTRAINT-22e544681ea09ae3 | DEFERRED_AFTER_REPLAY_OR_OPERAND_PRODUCTION | UNRESOLVED_DOWNSTREAM    |
| UE-W4C-DEFERRED-CONSTRAINT-921db4f0bc63e01d | DEFERRED_AFTER_REPLAY_OR_OPERAND_PRODUCTION | UNRESOLVED_DOWNSTREAM    |
| UE-W4C-DEFERRED-CONSTRAINT-097a8c58a7231680 | DEFERRED_AFTER_REPLAY_OR_OPERAND_PRODUCTION | UNRESOLVED_DOWNSTREAM    |
| UE-W4C-DEFERRED-CONSTRAINT-f6342ea2e97736f4 | DEFERRED_AFTER_REPLAY_OR_OPERAND_PRODUCTION | UNRESOLVED_DOWNSTREAM    |

| Exact operand                                                      | State                 |
| ------------------------------------------------------------------ | --------------------- |
| union-eyes::COLUMN::public.org_entitlements.feature_key            | UNRESOLVED_DOWNSTREAM |
| union-eyes::COLUMN::public.billing_periods.label                   | UNRESOLVED_DOWNSTREAM |
| union-eyes::COLUMN::public.org_configurations.category             | UNRESOLVED_DOWNSTREAM |
| union-eyes::COLUMN::public.org_configurations.key                  | UNRESOLVED_DOWNSTREAM |
| union-eyes::COLUMN::public.pilot_checklist_items.item_id           | UNRESOLVED_DOWNSTREAM |
| union-eyes::COLUMN::public.member_jurisdiction_preferences.user_id | UNRESOLVED_DOWNSTREAM |
| union-eyes::COLUMN::public.contract_covered_orgs.contract_id       | UNRESOLVED_DOWNSTREAM |
| union-eyes::COLUMN::public.duplicate_group_members.record_type     | UNRESOLVED_DOWNSTREAM |
| union-eyes::COLUMN::public.duplicate_group_members.record_id       | UNRESOLVED_DOWNSTREAM |

DEFERRED_CONSTRAINT_LOCATIONS_COMPLETE=NO;UNRESOLVED_OPERAND_BINDINGS=9. None is a bound127/86 graph blocker;none is erased,resolved or included as an executable constraint unit.

## Determinism,preservation and validation

Graph SHA256: `b700d55469c27bed84d98aa4281fb800486a4f776e4d88d753031d28446b21b2`.
Plan SHA256: `e5c5a60e8f37ee6c43617d44ca73d2f541d28777f3d0609863e0aad6dd87a989`.
36 fixed byte commitments including12 authoritative inputs,the W4P engine and23 frozen migrations. W4P plan digest,canonical1.3.3 and downstream mechanics unchanged. Exact completed validation commands/results are recorded in [the phase report](./PHASE_1B_3C_A1I_W5A_REPLAY_ORDERING_GRAPH.json).

## Gate and proof boundary

W5A=PASS;BOUND_REPLAY_ORDERING_GRAPH=COMPLETE_NOT_EXECUTED;W5=IN_PROGRESS;W5B_REPLAY_IMPLEMENTATION=AUTHORIZED_NOT_STARTED;CANONICAL_CONTRACT_VERSION=1.3.3. W5 not complete;no1.3.4.
DATABASE_CONNECTIONS=0;SQL_EXECUTED=0;W4P_EXECUTED=NO;FROZEN_MIGRATIONS_EXECUTED=0;COMPATIBILITY_MECHANICS_EXECUTED=0;DEFERRED_CONSTRAINTS_MATERIALIZED=NO;W5_EXECUTED=NO;PRODUCERS_ACTIVATED=0;BOOTSTRAP_IMPLEMENTATION_COMPLETE=NO;FAITHFUL_SCHEMA_REPLAY_PROVEN=NO;RLS_POLICY_CORRECTNESS_RUNTIME_PROVEN=NO;TENANT_ISOLATION_RUNTIME_PROVEN=NO;READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO.

## Exact127 record-to-unit bindings

| Obligation ID                         | Physical identity                                                               | Unit ID                      | Unit class            | Atomicity                            |
| ------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------- | --------------------- | ------------------------------------ |
| UE-W4G-COMPATIBILITY-b4631140cb8692c8 | union-eyes::COLUMN::public.ai_grievance_triages.organization_id                 | UE-W5A-UNIT-65749f8875f9316b | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-e3195fbd250217ab | union-eyes::RELATION::public.grievance_events                                   | UE-W5A-UNIT-0acdedbf984426e5 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-e769c52e9f3f0ab7 | union-eyes::COLUMN::public.ai_clause_reasonings.organization_id                 | UE-W5A-UNIT-174fc34875314095 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-283484cf393095a6 | union-eyes::COLUMN::public.pension_members.organization_id                      | UE-W5A-UNIT-4586ea279a921eb5 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-c3999da65da11125 | union-eyes::COLUMN::public.grievance_events.grievance_id                        | UE-W5A-UNIT-0acdedbf984426e5 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-724804cd28a46064 | union-eyes::TYPE::public.external_matter_grant_status                           | UE-W5A-UNIT-6b7fa7c3bb3a9d39 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-c5eb3f6b978c3ddd | union-eyes::RELATION::public.pension_plans                                      | UE-W5A-UNIT-e1bccaef050717c7 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-af3167ad2c819722 | union-eyes::COLUMN::public.ai_copilot_sessions.organization_id                  | UE-W5A-UNIT-12f9ac3a54194825 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-7a7a506da0e111f2 | union-eyes::TYPE::public.strategic_goal_status                                  | UE-W5A-UNIT-92537bccc8321684 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-ae1d74638c26d300 | union-eyes::COLUMN::public.governance_policies.organization_id                  | UE-W5A-UNIT-40e0ad2409d69da3 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-49d73e6fd5079140 | union-eyes::TYPE::public.employer_execution_replay_mode                         | UE-W5A-UNIT-8b749f997f7a70a1 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-e2a5f08b3ff2ac1a | union-eyes::TYPE::public.employer_timesheet_batch_status                        | UE-W5A-UNIT-0942d4ca182fafc1 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-8d662b8e811b8d7c | union-eyes::COLUMN::public.satisfaction_surveys.organization_id                 | UE-W5A-UNIT-9376a21a5a05bcd3 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-d88290a8c07a463b | union-eyes::RELATION::public.employer_remittance_runs                           | UE-W5A-UNIT-2f3b80d97427c106 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-805d954c4663ace8 | union-eyes::RELATION::public.ai_copilot_sessions                                | UE-W5A-UNIT-12f9ac3a54194825 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-079fc377274badef | union-eyes::TYPE::public.employer_contact_role                                  | UE-W5A-UNIT-d376506d10d2aae9 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-e325230a9c2473dc | union-eyes::COLUMN::public.pension_trustees.organization_id                     | UE-W5A-UNIT-b185dd5888ecbd54 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-06d7901ee922c700 | union-eyes::COLUMN::public.billing_subscriptions.organization_id                | UE-W5A-UNIT-dba29b588058e693 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-a96c8c7a92db7cf2 | union-eyes::COLUMN::public.employer_risk_scores.organization_id                 | UE-W5A-UNIT-f7a539954b1f976f | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-7a7c3171cd86c0f5 | union-eyes::COLUMN::public.employer_timesheet_batches.organization_id           | UE-W5A-UNIT-8706411d3a69dca5 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-f6a588739edadf8d | union-eyes::COLUMN::public.employer_payroll_runs.organization_id                | UE-W5A-UNIT-4187996b94a24360 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-e48f07f598c81af8 | union-eyes::RELATION::public.strategic_goals                                    | UE-W5A-UNIT-b04871966ce9bb4b | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-c21c522c20f0b1f7 | union-eyes::TYPE::public.compliance_alert_type                                  | UE-W5A-UNIT-0eaa3eae565a837d | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-c8d876875402e713 | union-eyes::TYPE::public.representation_authority_scope                         | UE-W5A-UNIT-072f8d6b78f62da2 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-bae47341eda11b14 | union-eyes::COLUMN::public.employer_execution_compliance_events.organization_id | UE-W5A-UNIT-420ea4d347b89b83 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-1a3c221ccbf2c2da | union-eyes::COLUMN::public.employer_reports.employer_id                         | UE-W5A-UNIT-85f36882224629d2 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-39c45f5de19b34ed | union-eyes::RELATION::public.employer_remittance_run_items                      | UE-W5A-UNIT-a4eb3adae5e1c328 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-3761da35850761b0 | union-eyes::TYPE::public.employer_payroll_run_type                              | UE-W5A-UNIT-cc3295246ba4cd03 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-725a84a67dacf344 | union-eyes::TYPE::public.compliance_alert_severity                              | UE-W5A-UNIT-c8578f4ca15cde85 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-4b3872c568daabd6 | union-eyes::TYPE::public.employer_payroll_run_status                            | UE-W5A-UNIT-ce71ae6d9c3e7b7e | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-823442683fd1ebd2 | union-eyes::RELATION::public.employer_execution_compliance_events               | UE-W5A-UNIT-420ea4d347b89b83 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-b014f0ff28ef932e | union-eyes::RELATION::public.compliance_alerts                                  | UE-W5A-UNIT-aff16f2eefb2ebb2 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-acbae9e0de5f3d34 | union-eyes::RELATION::public.employer_payroll_runs                              | UE-W5A-UNIT-4187996b94a24360 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-4f09decd29b449af | union-eyes::TYPE::public.grievance_event_type                                   | UE-W5A-UNIT-0c77d8a1f13a8e65 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-d7ae11750b75a337 | union-eyes::TYPE::public.employer_execution_compliance_severity                 | UE-W5A-UNIT-d6f4fa42c353735b | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-68ff05f0569a8d6d | union-eyes::TYPE::public.ai_triage_status                                       | UE-W5A-UNIT-c48d283372591a30 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-1fcd4e211cb30a20 | union-eyes::COLUMN::public.employer_timesheet_entries.organization_id           | UE-W5A-UNIT-a24d4c974c5bbd0b | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-e7690b896b3668d0 | union-eyes::COLUMN::public.employer_execution_evidence_links.organization_id    | UE-W5A-UNIT-82739eb740717c09 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-60f2e01c545ffc23 | union-eyes::TYPE::public.employer_execution_compliance_status                   | UE-W5A-UNIT-45dc2e4afdfa8caa | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-4aed58f41ff33c33 | union-eyes::RELATION::public.employer_reports                                   | UE-W5A-UNIT-85f36882224629d2 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-a928864a58f85736 | union-eyes::RELATION::public.billing_subscriptions                              | UE-W5A-UNIT-dba29b588058e693 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-5490c3676f8dbf20 | union-eyes::RELATION::public.employer_execution_replays                         | UE-W5A-UNIT-a48fb327bdea0dac | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-ee26fd1844e7581f | union-eyes::COLUMN::public.employer_remittance_run_items.organization_id        | UE-W5A-UNIT-a4eb3adae5e1c328 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-1121ef13c5569ae8 | union-eyes::TYPE::public.employer_execution_artifact_type                       | UE-W5A-UNIT-44d17f5222eb788c | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-4daad5d506e0f007 | union-eyes::TYPE::public.representation_authority_status                        | UE-W5A-UNIT-13310055eee591d4 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-ef53ebf8854f867e | union-eyes::TYPE::public.employer_execution_compliance_blocking                 | UE-W5A-UNIT-c04ea4ce6d59711a | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-71cf8c8283fcf684 | union-eyes::TYPE::public.dispatch_request_status                                | UE-W5A-UNIT-7795f522fea7eb43 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-8d1919e4f9a8f54e | union-eyes::RELATION::public.employer_execution_artifacts                       | UE-W5A-UNIT-c500f96a2ad9ac55 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-9c0ceda5ba4fd4b7 | union-eyes::COLUMN::public.cba_rule_set_items.organization_id                   | UE-W5A-UNIT-87551a13ff91159c | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-e79772a3da75ad9a | union-eyes::TYPE::public.employer_execution_profile_status                      | UE-W5A-UNIT-9836d89dd87adc6b | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-c02638c752afe820 | union-eyes::RELATION::public.ai_insight_reports                                 | UE-W5A-UNIT-391cb4cfa9598e6c | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-3c68d4782567c065 | union-eyes::RELATION::public.pension_trustees                                   | UE-W5A-UNIT-b185dd5888ecbd54 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-91f3b935d4d8f067 | union-eyes::RELATION::public.employer_contacts                                  | UE-W5A-UNIT-28bbad5e26b418e6 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-f423d67422fd62b4 | union-eyes::RELATION::public.pension_benefit_claims                             | UE-W5A-UNIT-e11d202ed0634dc3 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-abfd6dfb3bd01b24 | union-eyes::COLUMN::public.pension_plans.organization_id                        | UE-W5A-UNIT-e1bccaef050717c7 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-7a370dc84c8f3fa9 | union-eyes::COLUMN::public.dispatch_assignments.request_id                      | UE-W5A-UNIT-53398c582f5bd362 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-30a5af45ee9d036b | union-eyes::RELATION::public.member_breaks                                      | UE-W5A-UNIT-69d5719573b34e07 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-69550109d53bd177 | union-eyes::TYPE::public.employer_timesheet_entry_status                        | UE-W5A-UNIT-67d23150240b8a73 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-84f3a7c8db5d91b1 | union-eyes::COLUMN::public.member_breaks.organization_id                        | UE-W5A-UNIT-69d5719573b34e07 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-c690127ab2817eea | union-eyes::TYPE::public.insight_report_type                                    | UE-W5A-UNIT-b7d6c09eee1adcdc | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-60ff9ee1068fa55d | union-eyes::RELATION::public.ai_clause_reasonings                               | UE-W5A-UNIT-174fc34875314095 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-8cdb9b8de7d6b3b2 | union-eyes::RELATION::public.dispatch_rules                                     | UE-W5A-UNIT-f21a1be9ee58212f | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-6341ea640f926a96 | union-eyes::COLUMN::public.break_policies.organization_id                       | UE-W5A-UNIT-2ae1edfd782e2d56 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-6cd5218a21e86cda | union-eyes::RELATION::public.security_posture_checks                            | UE-W5A-UNIT-724e1646eef925e6 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-c4b0a290a57e8faf | union-eyes::RELATION::public.employer_timesheet_entries                         | UE-W5A-UNIT-a24d4c974c5bbd0b | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-039c2ca3750b2751 | union-eyes::RELATION::public.integration_partners                               | UE-W5A-UNIT-d3417886e6f09bdd | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-1295095e5d3f72c5 | union-eyes::COLUMN::public.strategic_goals.organization_id                      | UE-W5A-UNIT-b04871966ce9bb4b | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-89195e05edc0eb91 | union-eyes::TYPE::public.copilot_action_type                                    | UE-W5A-UNIT-64c589577b45587f | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-1d7ef92acc31767d | union-eyes::RELATION::public.employer_timesheet_batches                         | UE-W5A-UNIT-8706411d3a69dca5 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-2ac3b8c52ccd6d37 | union-eyes::COLUMN::public.pension_benefit_claims.organization_id               | UE-W5A-UNIT-e11d202ed0634dc3 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-7f965317233201b6 | union-eyes::COLUMN::public.employer_execution_replays.organization_id           | UE-W5A-UNIT-a48fb327bdea0dac | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-7d1d1d8d8b28e42c | union-eyes::TYPE::public.employer_risk_band                                     | UE-W5A-UNIT-3e7e36a49da7d959 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-775b746a47059495 | union-eyes::TYPE::public.break_status                                           | UE-W5A-UNIT-27b7ed57bb1d1a19 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-5b8bd80f36c63734 | union-eyes::RELATION::public.pension_t4a_records                                | UE-W5A-UNIT-75b71b4744a6eed7 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-93b95e6f85408bc5 | union-eyes::RELATION::public.employer_execution_evidence_links                  | UE-W5A-UNIT-82739eb740717c09 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-19ccfd40e8ed25a0 | union-eyes::TYPE::public.dispatch_assignment_status                             | UE-W5A-UNIT-19dd5595300bd2d5 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-9bc15440ee449502 | union-eyes::RELATION::public.pension_contributions                              | UE-W5A-UNIT-a98b690f278e1151 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-4a38bb56ce38e9fd | union-eyes::TYPE::public.copilot_outcome                                        | UE-W5A-UNIT-ae84b7ed89d56a40 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-0167d469c06bf8e0 | union-eyes::COLUMN::public.pension_contributions.organization_id                | UE-W5A-UNIT-a98b690f278e1151 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-7beafcfb93d9d738 | union-eyes::RELATION::public.governance_policies                                | UE-W5A-UNIT-40e0ad2409d69da3 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-ebf25894ccf7f12c | union-eyes::TYPE::public.dispatch_rule_type                                     | UE-W5A-UNIT-df884d8c591ed17f | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-677221e132ca3cb3 | union-eyes::TYPE::public.insight_timeframe                                      | UE-W5A-UNIT-47a85ebc512be639 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-852c815ad716aa40 | union-eyes::RELATION::public.cba_rule_set_items                                 | UE-W5A-UNIT-87551a13ff91159c | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-0267051ea34a6f17 | union-eyes::COLUMN::public.compliance_alerts.org_id                             | UE-W5A-UNIT-aff16f2eefb2ebb2 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-71deb7ed768bd0e2 | union-eyes::RELATION::public.clause_embeddings                                  | UE-W5A-UNIT-21f2b23e12dea4f0 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-d1db1f9648429c48 | union-eyes::RELATION::public.satisfaction_surveys                               | UE-W5A-UNIT-9376a21a5a05bcd3 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-70c79a2602591928 | union-eyes::TYPE::public.external_document_grant_status                         | UE-W5A-UNIT-9e08c215ed632188 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-63289147884b53e7 | union-eyes::RELATION::public.employer_risk_scores                               | UE-W5A-UNIT-f7a539954b1f976f | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-babe744d3d30c21d | union-eyes::COLUMN::public.dispatch_rules.org_id                                | UE-W5A-UNIT-f21a1be9ee58212f | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-d1edf8530d082555 | union-eyes::TYPE::public.strategic_goal_category                                | UE-W5A-UNIT-dab392692d89ad77 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-6ed9f5dbb7d4c7cd | union-eyes::RELATION::public.pension_trustee_meetings                           | UE-W5A-UNIT-7fd5f02b757e0f80 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-c2149289335776fb | union-eyes::TYPE::public.employer_execution_evidence_entity_type                | UE-W5A-UNIT-3abbc1556e6c978d | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-10cb2c8ec94c0520 | union-eyes::COLUMN::public.ai_insight_reports.organization_id                   | UE-W5A-UNIT-391cb4cfa9598e6c | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-6405727cff6a7cfa | union-eyes::COLUMN::public.employer_payroll_run_items.organization_id           | UE-W5A-UNIT-cd135365e1d54ff5 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-dbb63ea4009c5bb7 | union-eyes::COLUMN::public.employer_execution_profiles.organization_id          | UE-W5A-UNIT-fe0a6794a15e309b | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-c983c8702d05fff3 | union-eyes::TYPE::public.clause_reasoning_status                                | UE-W5A-UNIT-c780e4aee4e65401 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-cb487179ca437d44 | union-eyes::TYPE::public.cba_rule_version_status                                | UE-W5A-UNIT-f474bf717882a3bf | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-8181542ff1dc3539 | union-eyes::RELATION::public.employer_execution_profiles                        | UE-W5A-UNIT-fe0a6794a15e309b | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-ce1562d988dbf7be | union-eyes::RELATION::public.dispatch_requests                                  | UE-W5A-UNIT-d3f3fdac0e364a32 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-9e6f50c40f09b83d | union-eyes::RELATION::public.break_policies                                     | UE-W5A-UNIT-2ae1edfd782e2d56 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-2c2e9241bce19726 | union-eyes::RELATION::public.dispatch_assignments                               | UE-W5A-UNIT-53398c582f5bd362 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-753016f85d5d75ee | union-eyes::TYPE::public.compliance_report_type                                 | UE-W5A-UNIT-2aff627a01aff9ca | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-0f355e3df086a2a0 | union-eyes::TYPE::public.cba_rule_set_item_type                                 | UE-W5A-UNIT-1744394e8bce863a | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-7ccc3f38bec8bac5 | union-eyes::COLUMN::public.cba_rule_versions.organization_id                    | UE-W5A-UNIT-97c7d3c2e5dfa56f | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-9e1ea67cc8e59408 | union-eyes::TYPE::public.break_compensation                                     | UE-W5A-UNIT-029e5593f1d44ea5 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-294ea086ea087eb8 | union-eyes::RELATION::public.pension_members                                    | UE-W5A-UNIT-4586ea279a921eb5 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-8bb8e7260614b626 | union-eyes::COLUMN::public.employer_execution_artifacts.organization_id         | UE-W5A-UNIT-c500f96a2ad9ac55 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-1dfd6d9b30dd2df8 | union-eyes::COLUMN::public.employer_communications.organization_id              | UE-W5A-UNIT-a252a18612d88e4d | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-85ad4c3cc791cbf9 | union-eyes::COLUMN::public.security_posture_checks.organization_id              | UE-W5A-UNIT-724e1646eef925e6 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-2c78c9336db1ab36 | union-eyes::COLUMN::public.clause_embeddings.clause_id                          | UE-W5A-UNIT-21f2b23e12dea4f0 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-63e4555c283a0922 | union-eyes::TYPE::public.break_type                                             | UE-W5A-UNIT-8796ec08748f60be | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-91b3fabd5d8c211c | union-eyes::RELATION::public.cba_rule_versions                                  | UE-W5A-UNIT-97c7d3c2e5dfa56f | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-30e84cd2bd2cd83e | union-eyes::TYPE::public.employer_remittance_run_status                         | UE-W5A-UNIT-e2e26f29d1a9203e | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-29945e8654e166b6 | union-eyes::RELATION::public.employer_communications                            | UE-W5A-UNIT-a252a18612d88e4d | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-1202362c399c144e | union-eyes::COLUMN::public.stewards.org_id                                      | UE-W5A-UNIT-160faa299cd8561f | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-9e3151150ab472b2 | union-eyes::COLUMN::public.dispatch_requests.org_id                             | UE-W5A-UNIT-d3f3fdac0e364a32 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-cb3c9d2cc9d15c0a | union-eyes::RELATION::public.ai_grievance_triages                               | UE-W5A-UNIT-65749f8875f9316b | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-ffcb0dab9fa0dc65 | union-eyes::TYPE::public.employer_communication_status                          | UE-W5A-UNIT-a1afaab31f0efbfe | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-3c2aa7241d164b82 | union-eyes::COLUMN::public.employer_contacts.organization_id                    | UE-W5A-UNIT-28bbad5e26b418e6 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-6261866451b4ca7b | union-eyes::COLUMN::public.employer_remittance_runs.organization_id             | UE-W5A-UNIT-2f3b80d97427c106 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-2b55f2d796db17fb | union-eyes::RELATION::public.stewards                                           | UE-W5A-UNIT-160faa299cd8561f | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-844a56d3066454a4 | union-eyes::COLUMN::public.pension_trustee_meetings.organization_id             | UE-W5A-UNIT-7fd5f02b757e0f80 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-4b6806396937faff | union-eyes::TYPE::public.employer_communication_type                            | UE-W5A-UNIT-4ca7e7d6246a03a7 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-073e8aab1d91b7a2 | union-eyes::TYPE::public.ai_complexity                                          | UE-W5A-UNIT-44336ecc70fc3415 | FROZEN_WRAPPER_UNIT   | SATISFIABLE_WITH_STATE_AWARE_WRAPPER |
| UE-W4G-COMPATIBILITY-cd438b9cc5957086 | union-eyes::COLUMN::public.pension_t4a_records.organization_id                  | UE-W5A-UNIT-75b71b4744a6eed7 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-a6ea832bf14f70d8 | union-eyes::RELATION::public.employer_payroll_run_items                         | UE-W5A-UNIT-cd135365e1d54ff5 | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |
| UE-W4G-COMPATIBILITY-37c6ab3bf15be5f4 | union-eyes::COLUMN::public.integration_partners.organization_id                 | UE-W5A-UNIT-d3417886e6f09bdd | FROZEN_STATEMENT_UNIT | SATISFIABLE_WITH_UNIT_ORDERING       |

## Exact86 handoff-to-edge bindings

| Ordering record ID                   | From unit                    | To unit                           | Historical provider/consumer | Required provider/consumer | Atomicity                      |
| ------------------------------------ | ---------------------------- | --------------------------------- | ---------------------------- | -------------------------- | ------------------------------ |
| UE-1B3CA1D-ORDERING-0568f852fa763933 | UE-W5A-UNIT-97c7d3c2e5dfa56f | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 38 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-071624afce082c74 | UE-W5A-UNIT-2ae1edfd782e2d56 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 50 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-0b5c991a021a7d89 | UE-W5A-UNIT-82739eb740717c09 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 48 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-0f6cc2e80902aa01 | UE-W5A-UNIT-aff16f2eefb2ebb2 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 80 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-11bd7968b7102751 | UE-W5A-UNIT-85f36882224629d2 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 86 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-133aa71af8af276b | UE-W5A-UNIT-c500f96a2ad9ac55 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 46 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-13e1878d788e004e | UE-W5A-UNIT-724e1646eef925e6 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 17 / 14                      | 54 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-13f618b9a65abab8 | UE-W5A-UNIT-a48fb327bdea0dac | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 47 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-175855373fda99d9 | UE-W5A-UNIT-fe0a6794a15e309b | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 37 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-2327dc1414697e1f | UE-W5A-UNIT-b185dd5888ecbd54 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 96 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-24377daa2a55a4ba | UE-W5A-UNIT-cd135365e1d54ff5 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 43 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-25e2b75e1af72e1c | UE-W5A-UNIT-160faa299cd8561f | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 97 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-25ff46a662999b1f | UE-W5A-UNIT-391cb4cfa9598e6c | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 78 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-265ffba073a3ef54 | UE-W5A-UNIT-724e1646eef925e6 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 17 / 14                      | 54 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-27ac08647b5ff4f6 | UE-W5A-UNIT-2ae1edfd782e2d56 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 50 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-3531705a0c5cbfdc | UE-W5A-UNIT-65749f8875f9316b | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 77 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-387195a134d9d3c3 | UE-W5A-UNIT-40e0ad2409d69da3 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 88 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-3edbffd9e7688771 | UE-W5A-UNIT-87551a13ff91159c | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 39 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-41420a4c51403dd4 | UE-W5A-UNIT-a24d4c974c5bbd0b | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 41 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-43f6aabcb493da33 | UE-W5A-UNIT-65749f8875f9316b | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 77 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-490fd6e6c1d5ef47 | UE-W5A-UNIT-0acdedbf984426e5 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 89 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-4bf0c5250463b341 | UE-W5A-UNIT-aff16f2eefb2ebb2 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 80 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-4ee79aa3d1b592f5 | UE-W5A-UNIT-420ea4d347b89b83 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 49 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-4f5f169b51702db6 | UE-W5A-UNIT-75b71b4744a6eed7 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 94 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-507434b79aee1076 | UE-W5A-UNIT-2f3b80d97427c106 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 44 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-520fa14510b3a8ae | UE-W5A-UNIT-21f2b23e12dea4f0 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 79 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-566dd134fa767ee6 | UE-W5A-UNIT-a252a18612d88e4d | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 84 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-567c8e6ee8dfd925 | UE-W5A-UNIT-e11d202ed0634dc3 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 90 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-57319516717cc930 | UE-W5A-UNIT-cd135365e1d54ff5 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 43 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-579f53811baf1517 | UE-W5A-UNIT-f21a1be9ee58212f | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 83 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-5eeaee754a205ff9 | UE-W5A-UNIT-a4eb3adae5e1c328 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 45 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-600dd52533995c3c | UE-W5A-UNIT-0acdedbf984426e5 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 89 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-6170ec3aae5d6b5b | UE-W5A-UNIT-a24d4c974c5bbd0b | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 41 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-67e8c9845b4418e3 | UE-W5A-UNIT-b04871966ce9bb4b | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 98 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-725672159f31a721 | UE-W5A-UNIT-a48fb327bdea0dac | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 47 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-72b0b7ae05362352 | UE-W5A-UNIT-391cb4cfa9598e6c | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 78 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-73e8614ce2d17244 | UE-W5A-UNIT-e1bccaef050717c7 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 93 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-748c4a74ddb3a180 | UE-W5A-UNIT-82739eb740717c09 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 48 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-7c118dd2570271f1 | UE-W5A-UNIT-e11d202ed0634dc3 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 90 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-7e2e30700211d592 | UE-W5A-UNIT-85f36882224629d2 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 86 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-801e5232e47bbbfd | UE-W5A-UNIT-53398c582f5bd362 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 81 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-80fec4bfe766fc83 | UE-W5A-UNIT-d3f3fdac0e364a32 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 82 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-81997d1f4d04dd9b | UE-W5A-UNIT-a98b690f278e1151 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 91 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-8374a14eddea8fb3 | UE-W5A-UNIT-160faa299cd8561f | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 97 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-8504d82897e73ba7 | UE-W5A-UNIT-d3417886e6f09bdd | UE-W5A-MIGRATION-c1a4ed09468e3478 | 17 / 14                      | 53 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-8c3127847bde6b44 | UE-W5A-UNIT-f7a539954b1f976f | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 87 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-8ccc8a2231fc0462 | UE-W5A-UNIT-174fc34875314095 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 75 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-8d8d560098cf4943 | UE-W5A-UNIT-7fd5f02b757e0f80 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 95 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-927d8407b7e36dd4 | UE-W5A-UNIT-b04871966ce9bb4b | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 98 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-97f9a29da9ee0e7b | UE-W5A-UNIT-9376a21a5a05bcd3 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 52 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-99c25671ffaf4ea8 | UE-W5A-UNIT-c500f96a2ad9ac55 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 46 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-9d09c1b5a787c30e | UE-W5A-UNIT-a252a18612d88e4d | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 84 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-a2027792007b40cf | UE-W5A-UNIT-4187996b94a24360 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 42 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-a7c528b8b75107d5 | UE-W5A-UNIT-4586ea279a921eb5 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 92 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-aaaa0920a2ef2e78 | UE-W5A-UNIT-12f9ac3a54194825 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 76 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-af3e8df84bac5d93 | UE-W5A-UNIT-53398c582f5bd362 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 81 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-b26c6dd7715eaaab | UE-W5A-UNIT-f21a1be9ee58212f | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 83 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-b2c67f2520167576 | UE-W5A-UNIT-7fd5f02b757e0f80 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 95 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-b3cdab78c189b4ff | UE-W5A-UNIT-b185dd5888ecbd54 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 96 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-b42bab8963eadbc8 | UE-W5A-UNIT-9376a21a5a05bcd3 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 52 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-b46322845f9d6ad3 | UE-W5A-UNIT-d3f3fdac0e364a32 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 82 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-b46b2d871e6124f3 | UE-W5A-UNIT-4187996b94a24360 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 42 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-b532ff68fa847eb3 | UE-W5A-UNIT-2f3b80d97427c106 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 44 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-b695f404a04bf1d0 | UE-W5A-UNIT-40e0ad2409d69da3 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 88 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-bbee3aaac2a03213 | UE-W5A-UNIT-8706411d3a69dca5 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 40 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-bc2bb1cf0c41b8a1 | UE-W5A-UNIT-dba29b588058e693 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 15 / 14                      | 19 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-bcd5c7b970994100 | UE-W5A-UNIT-fe0a6794a15e309b | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 37 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-c62705afa7248944 | UE-W5A-UNIT-12f9ac3a54194825 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 76 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-c8bb4e21fc12728f | UE-W5A-UNIT-f7a539954b1f976f | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 87 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-cd816cdd01d84e97 | UE-W5A-UNIT-87551a13ff91159c | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 39 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-cf223e628f51185c | UE-W5A-UNIT-a4eb3adae5e1c328 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 45 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-d44cca0d54e0060e | UE-W5A-UNIT-97c7d3c2e5dfa56f | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 38 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-d6741a084fab35d7 | UE-W5A-UNIT-420ea4d347b89b83 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 49 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-da3ef9287389fb43 | UE-W5A-UNIT-69d5719573b34e07 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 51 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-dd32c940b591cc5f | UE-W5A-UNIT-28bbad5e26b418e6 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 85 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-e195fe342c5f63a2 | UE-W5A-UNIT-75b71b4744a6eed7 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 94 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-e772981a40f85c30 | UE-W5A-UNIT-dba29b588058e693 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 15 / 14                      | 19 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-e7cf8719159b391d | UE-W5A-UNIT-69d5719573b34e07 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 51 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-eaab532708d8625f | UE-W5A-UNIT-a98b690f278e1151 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 91 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-eb2346d111ccc98b | UE-W5A-UNIT-28bbad5e26b418e6 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 85 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-f0449bb98ec5bf59 | UE-W5A-UNIT-4586ea279a921eb5 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 92 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-f0bc082090c6c856 | UE-W5A-UNIT-8706411d3a69dca5 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 16 / 14                      | 40 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-f2c3cbedac9e8936 | UE-W5A-UNIT-d3417886e6f09bdd | UE-W5A-MIGRATION-c1a4ed09468e3478 | 17 / 14                      | 53 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-f848d88c5a9ff50a | UE-W5A-UNIT-21f2b23e12dea4f0 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 79 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-f9e2b98703c613e7 | UE-W5A-UNIT-e1bccaef050717c7 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 93 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |
| UE-1B3CA1D-ORDERING-fd2cf7ca4575b0c5 | UE-W5A-UNIT-174fc34875314095 | UE-W5A-MIGRATION-c1a4ed09468e3478 | 18 / 14                      | 75 / 99                    | SATISFIABLE_WITH_UNIT_ORDERING |

Every graph edge has exact source record/file/digest and evidence in [the machine graph](./UE_W5_POST_W4P_REPLAY_GRAPH.json). No replay implementation or runtime receipt.
