# W4C mixed-authority constraint timing closure

W4C PASS:7 exact constraints and14 blocked W4 IDs accounted;0 unaccounted. Canonical contract1.3.1 unchanged.

## Adopted timing rule

MATERIALIZE_ONLY_AFTER_ALL_OPERAND_COLUMNS_EXIST. Complete canonical UNIQUE semantics are preserved independently of deferred baseline materialization. No partial UNIQUE substitute,no scope expansion,no new relation/column/type obligations.

NON_W4_OPERANDS means outside explicit W4 baseline materialization. Frozen W4S context-only W4_OWNED records are preserved;no new parent creation authority is inferred or assigned.

## public.org_entitlements

- ID: `UE-W4C-DEFERRED-CONSTRAINT-687b0013df9b8c8a`
- UNIQUE ordered operands: `organization_id, feature_key`
- W4 baseline operands: `organization_id`
- Non-W4-baseline operands: `feature_key`
- Source W4 IDs: `UE-W4G-DEFINITION-1616d255367c341d`, `UE-W4G-DEFINITION-91539638ae3d477c`
- Definition COMPLETE;semantics PRESERVED;not dropped,replaced or weakened.
- Baseline materialization DEFERRED_NOT_EXECUTED until ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST.
- Linkage: COMPATIBILITY_PHASE_RESOLUTION_REQUIRED;owner LATE_PRODUCER_COMPATIBILITY_RESOLUTION;human schema decision required NO.
- Existing compatibility IDs: NONE RECORDED.
- Future baseline: create relation and authorized W4 columns only;no excluded operands or compound UNIQUE;link this handoff. No payload authored in W4C.

## public.billing_periods

- ID: `UE-W4C-DEFERRED-CONSTRAINT-ab480be7d3ecbe76`
- UNIQUE ordered operands: `organization_id, label`
- W4 baseline operands: `organization_id`
- Non-W4-baseline operands: `label`
- Source W4 IDs: `UE-W4G-DEFINITION-77aa06833477f7cb`, `UE-W4G-DEFINITION-2f46bc9a15b4fe78`
- Definition COMPLETE;semantics PRESERVED;not dropped,replaced or weakened.
- Baseline materialization DEFERRED_NOT_EXECUTED until ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST.
- Linkage: COMPATIBILITY_PHASE_RESOLUTION_REQUIRED;owner LATE_PRODUCER_COMPATIBILITY_RESOLUTION;human schema decision required NO.
- Existing compatibility IDs: NONE RECORDED.
- Future baseline: create relation and authorized W4 columns only;no excluded operands or compound UNIQUE;link this handoff. No payload authored in W4C.

## public.org_configurations

- ID: `UE-W4C-DEFERRED-CONSTRAINT-b54f294d75c25fb5`
- UNIQUE ordered operands: `organization_id, category, key`
- W4 baseline operands: `organization_id`
- Non-W4-baseline operands: `category, key`
- Source W4 IDs: `UE-W4G-DEFINITION-55b4f73e9c33e4a9`, `UE-W4G-DEFINITION-c42b44506e916c09`
- Definition COMPLETE;semantics PRESERVED;not dropped,replaced or weakened.
- Baseline materialization DEFERRED_NOT_EXECUTED until ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST.
- Linkage: COMPATIBILITY_PHASE_RESOLUTION_REQUIRED;owner LATE_PRODUCER_COMPATIBILITY_RESOLUTION;human schema decision required NO.
- Existing compatibility IDs: NONE RECORDED.
- Future baseline: create relation and authorized W4 columns only;no excluded operands or compound UNIQUE;link this handoff. No payload authored in W4C.

## public.pilot_checklist_items

- ID: `UE-W4C-DEFERRED-CONSTRAINT-22e544681ea09ae3`
- UNIQUE ordered operands: `organization_id, item_id`
- W4 baseline operands: `organization_id`
- Non-W4-baseline operands: `item_id`
- Source W4 IDs: `UE-W4G-DEFINITION-34cb89029be25de1`, `UE-W4G-DEFINITION-789de61afb7f456e`
- Definition COMPLETE;semantics PRESERVED;not dropped,replaced or weakened.
- Baseline materialization DEFERRED_NOT_EXECUTED until ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST.
- Linkage: COMPATIBILITY_PHASE_RESOLUTION_REQUIRED;owner LATE_PRODUCER_COMPATIBILITY_RESOLUTION;human schema decision required NO.
- Existing compatibility IDs: NONE RECORDED.
- Future baseline: create relation and authorized W4 columns only;no excluded operands or compound UNIQUE;link this handoff. No payload authored in W4C.

## public.member_jurisdiction_preferences

- ID: `UE-W4C-DEFERRED-CONSTRAINT-921db4f0bc63e01d`
- UNIQUE ordered operands: `user_id, organization_id`
- W4 baseline operands: `organization_id`
- Non-W4-baseline operands: `user_id`
- Source W4 IDs: `UE-W4G-DEFINITION-991a59fe214af62f`, `UE-W4G-DEFINITION-1a482361bcea822b`
- Definition COMPLETE;semantics PRESERVED;not dropped,replaced or weakened.
- Baseline materialization DEFERRED_NOT_EXECUTED until ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST.
- Linkage: COMPATIBILITY_PHASE_RESOLUTION_REQUIRED;owner LATE_PRODUCER_COMPATIBILITY_RESOLUTION;human schema decision required NO.
- Existing compatibility IDs: NONE RECORDED.
- Future baseline: create relation and authorized W4 columns only;no excluded operands or compound UNIQUE;link this handoff. No payload authored in W4C.

## public.contract_covered_orgs

- ID: `UE-W4C-DEFERRED-CONSTRAINT-097a8c58a7231680`
- UNIQUE ordered operands: `contract_id, organization_id`
- W4 baseline operands: `organization_id`
- Non-W4-baseline operands: `contract_id`
- Source W4 IDs: `UE-W4G-DEFINITION-7fb2822005b07979`, `UE-W4G-DEFINITION-b5be0303e59d6043`
- Definition COMPLETE;semantics PRESERVED;not dropped,replaced or weakened.
- Baseline materialization DEFERRED_NOT_EXECUTED until ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST.
- Linkage: COMPATIBILITY_PHASE_RESOLUTION_REQUIRED;owner LATE_PRODUCER_COMPATIBILITY_RESOLUTION;human schema decision required NO.
- Existing compatibility IDs: NONE RECORDED.
- Future baseline: create relation and authorized W4 columns only;no excluded operands or compound UNIQUE;link this handoff. No payload authored in W4C.

## public.duplicate_group_members

- ID: `UE-W4C-DEFERRED-CONSTRAINT-f6342ea2e97736f4`
- UNIQUE ordered operands: `group_id, record_type, record_id`
- W4 baseline operands: `group_id`
- Non-W4-baseline operands: `record_type, record_id`
- Source W4 IDs: `UE-W4G-DEFINITION-bac3a50d170191c0`, `UE-W4G-DEFINITION-cc4bc7b06e15bf5b`
- Definition COMPLETE;semantics PRESERVED;not dropped,replaced or weakened.
- Baseline materialization DEFERRED_NOT_EXECUTED until ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST.
- Linkage: COMPATIBILITY_PHASE_RESOLUTION_REQUIRED;owner LATE_PRODUCER_COMPATIBILITY_RESOLUTION;human schema decision required NO.
- Existing compatibility IDs: NONE RECORDED.
- Future baseline: create relation and authorized W4 columns only;no excluded operands or compound UNIQUE;link this handoff. No payload authored in W4C.

## Blocked-ID disposition

- `UE-W4G-DEFINITION-1616d255367c341d` -> `UE-W4C-DEFERRED-CONSTRAINT-687b0013df9b8c8a`: CLOSED_BY_CONSTRAINT_TIMING_NORMALIZATION;physical definition not authored.
- `UE-W4G-DEFINITION-1a482361bcea822b` -> `UE-W4C-DEFERRED-CONSTRAINT-921db4f0bc63e01d`: CLOSED_BY_CONSTRAINT_TIMING_NORMALIZATION;physical definition not authored.
- `UE-W4G-DEFINITION-2f46bc9a15b4fe78` -> `UE-W4C-DEFERRED-CONSTRAINT-ab480be7d3ecbe76`: CLOSED_BY_CONSTRAINT_TIMING_NORMALIZATION;physical definition not authored.
- `UE-W4G-DEFINITION-34cb89029be25de1` -> `UE-W4C-DEFERRED-CONSTRAINT-22e544681ea09ae3`: CLOSED_BY_CONSTRAINT_TIMING_NORMALIZATION;physical definition not authored.
- `UE-W4G-DEFINITION-55b4f73e9c33e4a9` -> `UE-W4C-DEFERRED-CONSTRAINT-b54f294d75c25fb5`: CLOSED_BY_CONSTRAINT_TIMING_NORMALIZATION;physical definition not authored.
- `UE-W4G-DEFINITION-77aa06833477f7cb` -> `UE-W4C-DEFERRED-CONSTRAINT-ab480be7d3ecbe76`: CLOSED_BY_CONSTRAINT_TIMING_NORMALIZATION;physical definition not authored.
- `UE-W4G-DEFINITION-789de61afb7f456e` -> `UE-W4C-DEFERRED-CONSTRAINT-22e544681ea09ae3`: CLOSED_BY_CONSTRAINT_TIMING_NORMALIZATION;physical definition not authored.
- `UE-W4G-DEFINITION-7fb2822005b07979` -> `UE-W4C-DEFERRED-CONSTRAINT-097a8c58a7231680`: CLOSED_BY_CONSTRAINT_TIMING_NORMALIZATION;physical definition not authored.
- `UE-W4G-DEFINITION-91539638ae3d477c` -> `UE-W4C-DEFERRED-CONSTRAINT-687b0013df9b8c8a`: CLOSED_BY_CONSTRAINT_TIMING_NORMALIZATION;physical definition not authored.
- `UE-W4G-DEFINITION-991a59fe214af62f` -> `UE-W4C-DEFERRED-CONSTRAINT-921db4f0bc63e01d`: CLOSED_BY_CONSTRAINT_TIMING_NORMALIZATION;physical definition not authored.
- `UE-W4G-DEFINITION-b5be0303e59d6043` -> `UE-W4C-DEFERRED-CONSTRAINT-097a8c58a7231680`: CLOSED_BY_CONSTRAINT_TIMING_NORMALIZATION;physical definition not authored.
- `UE-W4G-DEFINITION-bac3a50d170191c0` -> `UE-W4C-DEFERRED-CONSTRAINT-f6342ea2e97736f4`: CLOSED_BY_CONSTRAINT_TIMING_NORMALIZATION;physical definition not authored.
- `UE-W4G-DEFINITION-c42b44506e916c09` -> `UE-W4C-DEFERRED-CONSTRAINT-b54f294d75c25fb5`: CLOSED_BY_CONSTRAINT_TIMING_NORMALIZATION;physical definition not authored.
- `UE-W4G-DEFINITION-cc4bc7b06e15bf5b` -> `UE-W4C-DEFERRED-CONSTRAINT-f6342ea2e97736f4`: CLOSED_BY_CONSTRAINT_TIMING_NORMALIZATION;physical definition not authored.

## Producer and compatibility boundary

0 exact final producers identified;7 explicit compatibility-resolution handoffs. Exact physical identity matches only;no migration invented. Seven supplemental constraint handoffs do not alter,classify or inflate the127 existing compatibility records.

## Semantic and historical preservation

183 obligations;57/57/69 responsibilities;126 design groups;125 relation contexts;2121 column classifications;1299 parent columns;108 inherited parent gaps;36 type definitions/authorities;38 references unchanged.
A/A/B selections and case_documents resolution unchanged. Historical W4F/W4FR/W4FR2/W4FR3,W4S,W4T/W4T1 preserved by fixed byte commitments. 310 ownership decisions,127 late definitions,127 compatibility records,372 Django mappings,86 W5 handoffs,118 W6 handoffs,803 prerequisite IDs and23 frozen migrations retained through upstream byte/section commitments.
W4FR3 remains correctly BLOCKED historically;W4C supersedes only its mixed-authority materialization-timing assumption.

## Validation

Exact7/exact14 ordered operand and provenance checks;scope and183/responsibility/type accounting;48 independently verified fixed byte commitments;12 inherited section commitments (five recomputed from fixed inputs). 338 distinct tests passed,including22 W4C tests. Documentation validation:0 errors,1215 existing warnings.

- `pnpm exec vitest run --config apps\union-eyes\vitest.config.ts scripts\ue\close-w4c-constraint-timing.test.ts scripts\ue\author-w4fr3-minimal-baseline.test.ts scripts\ue\normalize-w4s-authoring-scope.test.ts scripts\ue\record-w4t1-human-type-selections.test.ts scripts\ue\regenerate-w4fr2-definitions.test.ts scripts\ue\regenerate-w4fr-definitions.test.ts scripts\ue\close-w4t-named-types.test.ts scripts\ue\verify-frozen-w4.test.ts apps\union-eyes\scripts\provisioning\governed-provisioning.test.ts` - PASS:294 tests;22 W4C and272 predecessor tests
- `pnpm exec vitest run --config apps\union-eyes\vitest.config.ts scripts\ue\author-w4-canonical-definitions.test.ts` - PASS:44 frozen W4F tests
- `pnpm exec tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --esModuleInterop --types node scripts\ue\close-w4c-constraint-timing.ts scripts\ue\close-w4c-constraint-timing.test.ts` - PASS
- `pnpm exec eslint --config apps\union-eyes\eslint.config.mjs --max-warnings 0 scripts\ue\close-w4c-constraint-timing.ts scripts\ue\close-w4c-constraint-timing.test.ts` - PASS:existing Next pages-directory diagnostic;exit0
- `pnpm exec prettier --check scripts\ue\close-w4c-constraint-timing.ts scripts\ue\close-w4c-constraint-timing.test.ts` - PASS
- `pnpm exec tsx scripts\ue\close-w4c-constraint-timing.ts --self-test --check` - PASS:two-generation exact-byte equality;persisted outputs and fixed upstream hashes
- `pnpm validate:docs` - PASS:0 errors;1215 existing warnings

## State and proof boundary

W4C=PASS;model COMPLETE_NOT_MATERIALIZED;7 deferred constraints;W4FR3 constraint blocker CLOSED_BY_GOVERNANCE.
W4FR4=AUTHORIZED_NOT_STARTED;W4=BLOCKED_DEFINITION_IMPLEMENTATION_PENDING;W4P/W5=NOT_AUTHORIZED. Compatibility normalization NOT_AUTHORIZED.
Canonical1.3.1;no1.3.2. SQL_AUTHORED=0;SQL_EXECUTED=0;no producer updates or activation.
No runtime roles,types,baseline,deferred constraints,configuration or producers materialized/executed. No deferred-constraint,parent-schema,replay,RLS or tenant-isolation runtime proof. BOOTSTRAP_IMPLEMENTATION_COMPLETE=NO;READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO.
Future W4FR4 PASS requirements are recorded in the [registry](./UE_W4_DEFERRED_MIXED_AUTHORITY_CONSTRAINTS.json);W4C does not assert that future work is complete or that127 compatibility records are already the sole blocker.
