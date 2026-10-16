# W4S - physical authoring scope normalization

**W4S=PASS.** Authority:HUMAN_ARCHITECTURE_W4S.

W4_PHYSICAL_AUTHORING_SCOPE=W4_OWNED_PRECONSUMER_PREREQUISITES_ONLY.
PLATFORM_BASELINE_DOCTRINE=MINIMUM_GOVERNED_PRECONSUMER_PHYSICAL_BASELINE.
W4 authors accepted prerequisites,not the full eventual application schema.

## Exact obligation and context accounting

183 exact obligations:57 relation/126 column. Responsibility IDs reconcile57 CREATE_RELATION +57 RELATION_CREATE_INCLUDES_COLUMN +69 ADD_COLUMN_TO_EXISTING_RELATION=183,each once.
125 selected application relation contexts:57 W4 relation prerequisites and68 parent-authority relation contexts.
2121 selected columns classified:822 governed W4 column contexts and1299 existing-parent columns;0 unclassified.
Of822 governed contexts,126 are explicit W4 column prerequisite obligations;696 are embedded relation-blueprint column context,not independent column obligations or automatic full-blueprint materialization authority. The future authoring denominator remains183,not2121 or822.

Every1299 parent column is EXISTING_PARENT_AUTHORITY/W4_REAUTHOR=NO/W4_PHYSICAL_COMPLETENESS_REQUIRED=NO. Exact per-column identities and126 materialization column IDs are in the [scope artifact](./PHASE_1B_3C_A1I_W4S_PHYSICAL_AUTHORING_SCOPE_NORMALIZATION.json).

##108 inherited gaps

108 exact historical W4FR2 blockers are a subset of1299 parent columns:94 timestamp,13 numeric,1 varchar.
W4_OWNED_GAPS_WITHIN_108=0. None is a W4 column obligation,none belongs to a W4 relation-create payload,and none is governed as a W4 prerequisite property.
W4FR2_BLOCKER_DISPOSITION=SUPERSEDED_BY_W4S_SCOPE_NORMALIZATION;UNDERLYING_REPRESENTATION_GAP=PRESERVED;GAP_RESOLVED=NO;GAP_ASSIGNED_TO_W4=NO.
Only their incorrect W4 blocking effect is superseded. No timezone,precision,scale or width is chosen.

## Revised completion contract

W4_PHYSICAL_COMPLETENESS=EVERY_W4_OWNED_PREREQUISITE_HAS_AN_EXACT_PHYSICAL_DEFINITION.
Future W4FR3 must complete183 obligations/57 relations/126 columns/36 types/38 references,account125 contexts,retain zero unresolved W4-owned properties/creation conflicts/duplicate responsibilities/parent-column reauthoring,complete producer metadata links,and keep deterministic SQL inactive.
125 full application relations authored by W4 are not required.

Selected consent_records A,automation_rules A,clc_sync_log B remain canonical application context. A smaller authority-scoped preconsumer subset is not a hybrid business blueprint.
36 exact type definitions and38 references remain closed;no W4T/W4T1 change.

## Preservation and validation

Historical W4FR2 and all fixed governance/type/producer/canonical evidence remain byte-preserved.183 IDs/126 groups/125 contexts/A-A-B/case_documents/310/127/127/372/82/4/86/118/803/23 commitments retained;no127 compatibility inspection or analysis.

- `pnpm exec vitest run --config apps\union-eyes\vitest.config.ts scripts\ue\normalize-w4s-authoring-scope.test.ts`: **PASS;22 focused scope/classification/disjointness/preservation/negative tests**.
- `pnpm exec vitest run --config apps\union-eyes\vitest.config.ts scripts\ue\regenerate-w4fr2-definitions.test.ts scripts\ue\record-w4t1-human-type-selections.test.ts scripts\ue\close-w4t-named-types.test.ts scripts\ue\regenerate-w4fr-definitions.test.ts scripts\ue\verify-frozen-w4.test.ts apps\union-eyes\scripts\provisioning\governed-provisioning.test.ts`: **PASS;231 preserved predecessor tests;historical generators not run as writing CLIs**.
- `pnpm exec vitest run --config apps\union-eyes\vitest.config.ts scripts\ue\author-w4-canonical-definitions.test.ts`: **PASS;44 frozen W4F tests**.
- `pnpm exec tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --esModuleInterop --types node scripts\ue\normalize-w4s-authoring-scope.ts scripts\ue\normalize-w4s-authoring-scope.test.ts`: **PASS;exit0**.
- `pnpm exec eslint --config apps\union-eyes\eslint.config.mjs --max-warnings 0 scripts\ue\normalize-w4s-authoring-scope.ts scripts\ue\normalize-w4s-authoring-scope.test.ts`: **PASS;exit0;existing Next pages-directory diagnostic**.
- `pnpm exec tsx scripts\ue\normalize-w4s-authoring-scope.ts --self-test --check`: **PASS;two-generation exact-byte equality;persisted scope-only artifact check;historical bytes unchanged**.
- `pnpm exec prettier --check scripts\ue\normalize-w4s-authoring-scope.ts scripts\ue\normalize-w4s-authoring-scope.test.ts docs\union-eyes\reality-remediation\PHASE_1B_3C_A1I_W4S_PHYSICAL_AUTHORING_SCOPE_NORMALIZATION.json docs\union-eyes\reality-remediation\PHASE_1B_3C_A1I_W4S_PHYSICAL_AUTHORING_SCOPE_NORMALIZATION.md`: **PASS;repository formatting**.
- `pnpm validate:docs`: **PASS;0 errors;1215 existing warnings;2612 scanned files**.
- `Independent Node crypto frozen-byte check and exact108-parent-subset/183-ownership-disjointness comparison`: **PASS;24 historical/input byte commitments;1299 exact parents;108 intersection183=0;original108 facts unchanged**.

Total distinct test coverage:297 passed. Historical W4FR2 remains BLOCKED under its original criterion;W4S supersedes only the blocking scope effect,not any evidence or physical representation.

## State

W4S=PASS;W4FR2_SCOPE_CONTRADICTION=CLOSED_BY_GOVERNANCE.
W4FR3=AUTHORIZED_NOT_STARTED;W4FR3_STARTED=NO.
CANONICAL_CONTRACT_VERSION=1.3.1;no1.3.2.
W4=BLOCKED_DEFINITION_IMPLEMENTATION_PENDING;W4P/W5=NOT_AUTHORIZED.
SQL_AUTHORED=0;SQL_EXECUTED=0;PARENT_SCHEMA_RUNTIME_CORRECTNESS_PROVEN=NO.
READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO. No SQL,physical authoring,retry or execution was performed.
