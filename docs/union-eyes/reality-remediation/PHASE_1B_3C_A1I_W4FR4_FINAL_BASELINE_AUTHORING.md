# W4FR4 final minimal baseline authoring

W4FR4 PASS;183 exact obligations physically defined;57 CREATE_RELATION/57 included-column/69 ADD_COLUMN responsibilities. 36 type/57 relation/69 add-column payloads=162 inactive payloads.

38 canonical type references: 0 W4-materialized consumers;38 contextual references with null consumer payload IDs. No invented consumer edges.

Seven exact W4C UNIQUE invariants are canonically preserved and linked to their baseline payloads;materialization DEFERRED_NOT_EXECUTED until all operands physically exist. No excluded operands created,no partial UNIQUE substitute. 14 historical blocked IDs retain W4C dispositions.

125 relation contexts/2121 classified columns/1299 parent-owned columns retained;0 parent reauthoring. 108 inherited parent representation gaps remain OUT_OF_SCOPE_FOR_W4_PHYSICAL_AUTHORING. Selected application blueprints are context,not full-table authorization.

183 producer metadata records integrated;36 type definitions and7 deferred handoff metadata records added. No execution authority or producer activation. SQL_STATUS=DEFINITION_ONLY_NOT_EXECUTABLE;EXECUTION_ALLOWED=NO. Definitions use qualified public identities,no IF NOT EXISTS. Ordinary application-context indexes are not added by minimal baseline authoring. Exact approved uniqueIndex participation is lowered as named UNIQUE constraints with PostgreSQL backing unique indexes;no weaker uniqueness semantics.

## Determinism and reconstruction

Two-generation exact-byte equality and persisted --check required. {"DEFINITION_REGISTRY_SHA256":"b84d75a98fec07e86ad68689a93ceebbdb262eee143de2a8f8eee6ba8562784d","TYPE_PAYLOADS_SHA256":"536817325ed00904eda7e0c10860a518a80d0edf664cf64977f0987182bce781","RELATION_PAYLOADS_SHA256":"64adbda5f1f31859e7b82363ff86cf22d821fdcfb399a20ba625f1ceb06b96a5","ADD_COLUMN_PAYLOADS_SHA256":"96853b277746664bba770a42accfa5805a4207e01009dbf2581fca78d1e58f49","ALL_SQL_PAYLOADS_SHA256":"66b540c882adce726f18db2c8727005eeba7b32a3d7020a666c4159c7814f845","OBLIGATION_LINKAGE_SHA256":"d9f911db4107a06f4725aa69c17128dbaa8a4e63d227507f0b9d0ee56907355d","TYPE_REFERENCE_ACCOUNTING_SHA256":"627197c2e7480aba1d8d9446ebff9fb5136b83c2e73861d57c4a936dadc714d0","DEFERRED_CONSTRAINT_LINKAGE_SHA256":"1078a586c27d8930eb843cf7b093e7cfd33fde8d54e2ef50e59aac177bc8f51d","PRODUCER_METADATA_SHA256":"ba88ee29a58c55c6b50930ff75089a59c00c68526f2e2e12547e801cca6c9673"}

Exact version reconstruction:1.3.2 ->1.3.1 ->1.3 ->1.2 ->1.1 ->1.0. Original producer bytes reconstruct exactly. Inverse patches and hashes are in the [machine report](./PHASE_1B_3C_A1I_W4FR4_FINAL_BASELINE_AUTHORING.json).

## State

Canonical1.3.2;amendment PLATFORM_BASELINE_CANONICAL_DEFINITION_AUTHORING. DEFINITION_COMPLETE=YES;MATERIALIZATION_EXECUTED=NO;7 deferred constraints unmaterialized.
W4=BLOCKED_ORDERING_COMPATIBILITY_PENDING. Remaining blocker LATE_PRODUCER_COMPATIBILITY_AND_DEFERRED_CONSTRAINT_RESOLUTION.
Compatibility input sets remain127 existing records +7 supplemental handoffs;0 exact correspondence proven;not134 merged canonical records.
W4_COMPATIBILITY_GATE_NORMALIZATION=AUTHORIZED_NOT_STARTED;W4P/W5=NOT_AUTHORIZED.
No SQL/roles/types/baseline/deferred constraints/producers/configuration executed or materialized. No runtime schema/replay/RLS/tenant-isolation proof. BOOTSTRAP_IMPLEMENTATION_COMPLETE=NO;READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO.

See [definition registry](./UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_W4FR4.json) and [inactive payloads](./UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_W4FR4.json).

## Validation

575 distinct tests passed:237 final-baseline tests and338 frozen predecessor tests. Predecessor tests use exact hash-verified inverse reconstruction,not updated historical expectations. 57 unchanged upstream byte commitments verified;2 original amended contracts reconstruct exactly. Documentation:0 errors,1215 existing warnings.

- `pnpm exec vitest run --config apps\union-eyes\vitest.config.ts scripts\ue\author-w4fr4-final-baseline.test.ts` - PASS:237 tests
- `pnpm exec vitest run --config scripts\ue\w4fr4-predecessor.vitest.config.ts scripts\ue\close-w4c-constraint-timing.test.ts scripts\ue\author-w4fr3-minimal-baseline.test.ts scripts\ue\normalize-w4s-authoring-scope.test.ts scripts\ue\record-w4t1-human-type-selections.test.ts scripts\ue\regenerate-w4fr2-definitions.test.ts scripts\ue\regenerate-w4fr-definitions.test.ts scripts\ue\close-w4t-named-types.test.ts scripts\ue\verify-frozen-w4.test.ts apps\union-eyes\scripts\provisioning\governed-provisioning.test.ts` - PASS:294 predecessor tests against exact reconstructed1.3.1 inputs
- `pnpm exec vitest run --config scripts\ue\w4fr4-predecessor.vitest.config.ts scripts\ue\author-w4-canonical-definitions.test.ts` - PASS:44 frozen W4F tests against exact reconstructed1.3.1 inputs
- `pnpm exec tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --esModuleInterop --types node scripts\ue\author-w4fr4-final-baseline.ts scripts\ue\author-w4fr4-final-baseline.test.ts scripts\ue\w4fr4-historical-test-setup.ts scripts\ue\w4fr4-predecessor.vitest.config.ts scripts\ue\verify-frozen-w4.test.ts` - PASS
- `pnpm exec eslint --config apps\union-eyes\eslint.config.mjs --max-warnings 0 scripts\ue\author-w4fr4-final-baseline.ts scripts\ue\author-w4fr4-final-baseline.test.ts scripts\ue\w4fr4-historical-test-setup.ts scripts\ue\w4fr4-predecessor.vitest.config.ts scripts\ue\verify-frozen-w4.test.ts` - PASS:existing Next pages-directory diagnostic;exit0
- `pnpm exec prettier --check scripts\ue\author-w4fr4-final-baseline.ts scripts\ue\author-w4fr4-final-baseline.test.ts scripts\ue\w4fr4-historical-test-setup.ts scripts\ue\w4fr4-predecessor.vitest.config.ts scripts\ue\verify-frozen-w4.test.ts` - PASS
- `pnpm exec tsx scripts\ue\author-w4fr4-final-baseline.ts --self-test --check` - PASS:two-generation exact-byte equality;persisted outputs and idempotent amended contracts
- `pnpm validate:docs` - PASS:0 errors;1215 existing warnings
