# W4LB supplemental operand binding - BLOCKED

## Exact identity accounting

The mission requests10 distinct operands but explicitly lists9. The7 canonical W4C handoffs also contain9 distinct excluded operands. All9 listed identities are accounted;0 lost;no tenth invented. Requested exact10 accounting is not satisfied.
EXACT_PHYSICAL_PRODUCER_IDENTIFIED=0;EXACT_EXISTENCE_BOUNDARY_IDENTIFIED=0;NO_PRODUCER_OR_BOUNDARY_EVIDENCE=9;SUM=9.

## Seven handoff dispositions

ALL_OPERANDS_EXACTLY_BOUND=0;ALL_OPERANDS_EXIST_BY_EXACT_BOUNDARY=0;MIXED_EXACT_PRODUCER_AND_BOUNDARY=0;BLOCKED_MISSING_OPERAND_BINDING=7;SUM=7.
EXISTING_W5_HANDOFF_EXACT_MATCH=0;NO_EXISTING_W5_HANDOFF_EXACT_MATCH=7;SUM=7.
No final operand identity/producer/boundary/position is proven. No materialization location or supplemental ordering edge can be derived. Recorded supplemental ordering requirements=0 because operands are unbound,not because ordering is proven unnecessary.

| Handoff ID                                  | Relation                               | Exact missing identities                                                                                                     | State                           | Final position |
| ------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------- |
| UE-W4C-DEFERRED-CONSTRAINT-687b0013df9b8c8a | public.org_entitlements                | union-eyes::COLUMN::public.org_entitlements.feature_key                                                                      | BLOCKED_MISSING_OPERAND_BINDING | NONE PROVEN    |
| UE-W4C-DEFERRED-CONSTRAINT-ab480be7d3ecbe76 | public.billing_periods                 | union-eyes::COLUMN::public.billing_periods.label                                                                             | BLOCKED_MISSING_OPERAND_BINDING | NONE PROVEN    |
| UE-W4C-DEFERRED-CONSTRAINT-b54f294d75c25fb5 | public.org_configurations              | union-eyes::COLUMN::public.org_configurations.category, union-eyes::COLUMN::public.org_configurations.key                    | BLOCKED_MISSING_OPERAND_BINDING | NONE PROVEN    |
| UE-W4C-DEFERRED-CONSTRAINT-22e544681ea09ae3 | public.pilot_checklist_items           | union-eyes::COLUMN::public.pilot_checklist_items.item_id                                                                     | BLOCKED_MISSING_OPERAND_BINDING | NONE PROVEN    |
| UE-W4C-DEFERRED-CONSTRAINT-921db4f0bc63e01d | public.member_jurisdiction_preferences | union-eyes::COLUMN::public.member_jurisdiction_preferences.user_id                                                           | BLOCKED_MISSING_OPERAND_BINDING | NONE PROVEN    |
| UE-W4C-DEFERRED-CONSTRAINT-097a8c58a7231680 | public.contract_covered_orgs           | union-eyes::COLUMN::public.contract_covered_orgs.contract_id                                                                 | BLOCKED_MISSING_OPERAND_BINDING | NONE PROVEN    |
| UE-W4C-DEFERRED-CONSTRAINT-f6342ea2e97736f4 | public.duplicate_group_members         | union-eyes::COLUMN::public.duplicate_group_members.record_type, union-eyes::COLUMN::public.duplicate_group_members.record_id | BLOCKED_MISSING_OPERAND_BINDING | NONE PROVEN    |

## Residual missing facts and bounded evidence

## union-eyes::COLUMN::public.org_entitlements.feature_key

- Handoff: `UE-W4C-DEFERRED-CONSTRAINT-687b0013df9b8c8a`
- Classification: NO_PRODUCER_OR_BOUNDARY_EVIDENCE.
- Producer/boundary/source/position/physical operation: NONE PROVEN.
- Missing fact: Hash-bound physical producer operation creating this exact column,or accepted exact column-existence boundary with a proven execution position.
- Inspected all8 permitted registries and23 hash-verified frozen files using only exact relation/column pairs.
- Exact file-level pair matches: NONE;physical producing-operation matches:0.
- Declaration is not production: The accepted declaration/constraint context names the operand but has CREATION_AUTHORITY=NO and EXECUTION_AUTHORITY=NO;it is not a physical operation or exact existence proof. RLS relation preflight proves at most relation presence,not this column.

## union-eyes::COLUMN::public.billing_periods.label

- Handoff: `UE-W4C-DEFERRED-CONSTRAINT-ab480be7d3ecbe76`
- Classification: NO_PRODUCER_OR_BOUNDARY_EVIDENCE.
- Producer/boundary/source/position/physical operation: NONE PROVEN.
- Missing fact: Hash-bound physical producer operation creating this exact column,or accepted exact column-existence boundary with a proven execution position.
- Inspected all8 permitted registries and23 hash-verified frozen files using only exact relation/column pairs.
- Exact file-level pair matches: NONE;physical producing-operation matches:0.
- Declaration is not production: The accepted declaration/constraint context names the operand but has CREATION_AUTHORITY=NO and EXECUTION_AUTHORITY=NO;it is not a physical operation or exact existence proof. RLS relation preflight proves at most relation presence,not this column.

## union-eyes::COLUMN::public.org_configurations.category

- Handoff: `UE-W4C-DEFERRED-CONSTRAINT-b54f294d75c25fb5`
- Classification: NO_PRODUCER_OR_BOUNDARY_EVIDENCE.
- Producer/boundary/source/position/physical operation: NONE PROVEN.
- Missing fact: Hash-bound physical producer operation creating this exact column,or accepted exact column-existence boundary with a proven execution position.
- Inspected all8 permitted registries and23 hash-verified frozen files using only exact relation/column pairs.
- Exact file-level pair matches: NONE;physical producing-operation matches:0.
- Declaration is not production: The accepted declaration/constraint context names the operand but has CREATION_AUTHORITY=NO and EXECUTION_AUTHORITY=NO;it is not a physical operation or exact existence proof. RLS relation preflight proves at most relation presence,not this column.

## union-eyes::COLUMN::public.org_configurations.key

- Handoff: `UE-W4C-DEFERRED-CONSTRAINT-b54f294d75c25fb5`
- Classification: NO_PRODUCER_OR_BOUNDARY_EVIDENCE.
- Producer/boundary/source/position/physical operation: NONE PROVEN.
- Missing fact: Hash-bound physical producer operation creating this exact column,or accepted exact column-existence boundary with a proven execution position.
- Inspected all8 permitted registries and23 hash-verified frozen files using only exact relation/column pairs.
- Exact file-level pair matches: NONE;physical producing-operation matches:0.
- Declaration is not production: The accepted declaration/constraint context names the operand but has CREATION_AUTHORITY=NO and EXECUTION_AUTHORITY=NO;it is not a physical operation or exact existence proof. RLS relation preflight proves at most relation presence,not this column.

## union-eyes::COLUMN::public.pilot_checklist_items.item_id

- Handoff: `UE-W4C-DEFERRED-CONSTRAINT-22e544681ea09ae3`
- Classification: NO_PRODUCER_OR_BOUNDARY_EVIDENCE.
- Producer/boundary/source/position/physical operation: NONE PROVEN.
- Missing fact: Hash-bound physical producer operation creating this exact column,or accepted exact column-existence boundary with a proven execution position.
- Inspected all8 permitted registries and23 hash-verified frozen files using only exact relation/column pairs.
- Exact file-level pair matches: NONE;physical producing-operation matches:0.
- Declaration is not production: The accepted declaration/constraint context names the operand but has CREATION_AUTHORITY=NO and EXECUTION_AUTHORITY=NO;it is not a physical operation or exact existence proof. RLS relation preflight proves at most relation presence,not this column.

## union-eyes::COLUMN::public.member_jurisdiction_preferences.user_id

- Handoff: `UE-W4C-DEFERRED-CONSTRAINT-921db4f0bc63e01d`
- Classification: NO_PRODUCER_OR_BOUNDARY_EVIDENCE.
- Producer/boundary/source/position/physical operation: NONE PROVEN.
- Missing fact: Hash-bound physical producer operation creating this exact column,or accepted exact column-existence boundary with a proven execution position.
- Inspected all8 permitted registries and23 hash-verified frozen files using only exact relation/column pairs.
- Exact file-level pair matches: NONE;physical producing-operation matches:0.
- Declaration is not production: The accepted declaration/constraint context names the operand but has CREATION_AUTHORITY=NO and EXECUTION_AUTHORITY=NO;it is not a physical operation or exact existence proof. RLS relation preflight proves at most relation presence,not this column.

## union-eyes::COLUMN::public.contract_covered_orgs.contract_id

- Handoff: `UE-W4C-DEFERRED-CONSTRAINT-097a8c58a7231680`
- Classification: NO_PRODUCER_OR_BOUNDARY_EVIDENCE.
- Producer/boundary/source/position/physical operation: NONE PROVEN.
- Missing fact: Hash-bound physical producer operation creating this exact column,or accepted exact column-existence boundary with a proven execution position.
- Inspected all8 permitted registries and23 hash-verified frozen files using only exact relation/column pairs.
- Exact file-level pair matches: apps/union-eyes/db/migrations-cache/0014_lineage_restoration_rls_closure.sql;physical producing-operation matches:0.
- Declaration is not production: The accepted declaration/constraint context names the operand but has CREATION_AUTHORITY=NO and EXECUTION_AUTHORITY=NO;it is not a physical operation or exact existence proof. RLS relation preflight proves at most relation presence,not this column.

## union-eyes::COLUMN::public.duplicate_group_members.record_type

- Handoff: `UE-W4C-DEFERRED-CONSTRAINT-f6342ea2e97736f4`
- Classification: NO_PRODUCER_OR_BOUNDARY_EVIDENCE.
- Producer/boundary/source/position/physical operation: NONE PROVEN.
- Missing fact: Hash-bound physical producer operation creating this exact column,or accepted exact column-existence boundary with a proven execution position.
- Inspected all8 permitted registries and23 hash-verified frozen files using only exact relation/column pairs.
- Exact file-level pair matches: NONE;physical producing-operation matches:0.
- Declaration is not production: The accepted declaration/constraint context names the operand but has CREATION_AUTHORITY=NO and EXECUTION_AUTHORITY=NO;it is not a physical operation or exact existence proof. RLS relation preflight proves at most relation presence,not this column.

## union-eyes::COLUMN::public.duplicate_group_members.record_id

- Handoff: `UE-W4C-DEFERRED-CONSTRAINT-f6342ea2e97736f4`
- Classification: NO_PRODUCER_OR_BOUNDARY_EVIDENCE.
- Producer/boundary/source/position/physical operation: NONE PROVEN.
- Missing fact: Hash-bound physical producer operation creating this exact column,or accepted exact column-existence boundary with a proven execution position.
- Inspected all8 permitted registries and23 hash-verified frozen files using only exact relation/column pairs.
- Exact file-level pair matches: NONE;physical producing-operation matches:0.
- Declaration is not production: The accepted declaration/constraint context names the operand but has CREATION_AUTHORITY=NO and EXECUTION_AUTHORITY=NO;it is not a physical operation or exact existence proof. RLS relation preflight proves at most relation presence,not this column.

The only exact relation/column pair co-occurrence is contract_covered_orgs+contract_id in frozen0014. Its relation-name entries are RLS/preflight references;the operand token appears elsewhere in the file,not an operation creating this exact relation-column. A table-existence guard cannot prove excluded column presence. No schema declaration,UI/model reference or name similarity was used as physical proof.
No general repository search,no adjacent operand/semantic alias expansion,no new producer or order authority.

## Preservation and validation

94 byte commitments preserved.23 frozen migration hashes verified;127 existing records and complete W4LC mechanics unchanged and not reclassified;86 W5 handoffs unchanged;7 canonical constraint semantics unchanged;W4FR4 definitions/payloads andcanonical1.3.2 unchanged.
71 focused tests+473 W4LC/W4FR4 predecessor tests+22 W4C historical-input tests=566 passed. Exact listed identity/handoff,physical-operation parser,declaration/reference separation,final-boundary derivation,all86 exact-W5/preservation/determinism coverage included. Scoped TypeScript,ESLint(exit0 with existing Next pages-directory diagnostic),formatting,two-generation exact-byte equality and persisted `--check` passed. `pnpm validate:docs`:0 errors/1215 existing warnings. Exact completed commands and results are recorded in the machine report.

## Gate and authorization

W4LB=BLOCKED;9 exact listed operand bindings missing across7 handoffs;NO_FURTHER_GENERIC_OPERAND_DISCOVERY=YES.
W4LC2_FINAL_NORMALIZATION=NOT_AUTHORIZED;W4P=NOT_AUTHORIZED;W5_COMPATIBILITY_SLICE=NOT_AUTHORIZED;fullW5=NOT_AUTHORIZED.
Canonical1.3.2;no1.3.3/1.4. SQL_AUTHORED=0;SQL_EXECUTED=0;COMPATIBILITY_MECHANICS_EXECUTED=NO;DEFERRED_CONSTRAINTS_MATERIALIZED=NO;PRODUCERS_ACTIVATED=0;W5_EXECUTED=NO;READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO.
