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
