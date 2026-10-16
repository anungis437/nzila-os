# W4FR2 - canonical physical definition retry

**Gate:BLOCKED.** Named-type governance remains complete;this is not the prior missing-type-authority blocker.

## Exact closed-record contradiction

W4FR2 section20 requires every selected canonical column to have complete physical properties and all125 relations to be fully defined. Frozen W4FR explicitly excludes **1299 existing-authority columns** from reauthoring,while selected frozen W4F declarations record **108 non-enum physical representation gaps across26 relations**:94 timestamps,13 numerics,1 varchar. No scope extension,representation default,source inference or new type discovery is authorized.

The183 governed obligations and822 governed columns remain governed;the gaps belong to selected parent-owned columns,not new W4 obligations. The57 owned shapes do not have this inherited-column gap.99 shapes have no detected representation gap,but this is not a claim their complete SQL lowering/constraints were verified.

### Exact W4H3-selected clc_sync_log witness

W4H3 selected B with23 columns. The normalized W4FR model governs only organization_id and explicitly excludes22 parent-owned columns from reauthoring.

| Selected column | Frozen declaration                                        | Recorded unresolved physical fact                                                       |
| --------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| sync_start_date | syncStartDate: timestamp("sync_start_date")               | Timestamp timezone semantics not explicitly established; no preferred timezone inferred |
| sync_end_date   | syncEndDate: timestamp("sync_end_date")                   | Timestamp timezone semantics not explicitly established; no preferred timezone inferred |
| data_hash       | dataHash: varchar("data_hash")                            | Character length/unbounded choice not explicitly established                            |
| verified_at     | verifiedAt: timestamp("verified_at")                      | Timestamp timezone semantics not explicitly established; no preferred timezone inferred |
| created_at      | createdAt: timestamp("created_at").defaultNow().notNull() | Timestamp timezone semantics not explicitly established; no preferred timezone inferred |
| updated_at      | updatedAt: timestamp("updated_at").defaultNow().notNull() | Timestamp timezone semantics not explicitly established; no preferred timezone inferred |

All108 exact contradictory records,selected declaration text/file digest,property fact,authority boundary and affected existing obligation IDs are in the [W4FR2 machine report](./PHASE_1B_3C_A1I_W4FR2_CANONICAL_DEFINITION_REGENERATION.json). No inferred timestamp timezone,numeric precision or varchar width was authored. Existing enum references outside the36-type denominator were not reclassified or discovered.

## Physical authoring and responsibility accounting

-183 input obligations:57 relation/126 column;125 selected relation groups retained.
-Canonical relation/column definitions physically authored:0;183 explicitly withheld,0 unaccounted.
-Verified responsibilities:57 CREATE_RELATION,57 RELATION_CREATE_INCLUDES_COLUMN,69 ADD_COLUMN_TO_EXISTING_RELATION.
-36 exact named types authored as36 inactive qualified enum payloads;38 exact reference identities resolved. Four CURRENT selections and32 prior definitions preserved.
-Relation-create/column-add payloads:0/0;obligation payload links:0;unlinked explicitly withheld:183.
-38 type-before-consumer requirements are recorded;0 complete consumer-payload edges,because all consumer SQL is withheld. This is not W5 authorization.
-No producer metadata integration;MUTATING_OPERATIONS remain empty. No canonical amendment.

## Preservation and validation

Historical W4FR/W4T/W4T1 and governance artifacts,producer and canonical1.3.1 bytes remain unchanged. Exact fixed input hashes/selected source hashes/183 IDs/125 shapes/36 types/38 references and responsibility counts are checked. Preserved tests exercise read-only predecessor models;no historical generator CLI is run and no historical artifact is rewritten.

- `pnpm exec vitest run --config apps\union-eyes\vitest.config.ts scripts\ue\regenerate-w4fr2-definitions.test.ts`: **PASS;34 focused tests;108 inherited representation gaps;exact183/125/36/38 accounting**.
- `pnpm exec vitest run --config apps\union-eyes\vitest.config.ts scripts\ue\record-w4t1-human-type-selections.test.ts scripts\ue\close-w4t-named-types.test.ts scripts\ue\regenerate-w4fr-definitions.test.ts scripts\ue\verify-frozen-w4.test.ts apps\union-eyes\scripts\provisioning\governed-provisioning.test.ts`: **PASS;197 preserved W4T1/W4T/W4FR/W4/W3E tests**.
- `pnpm exec vitest run --config apps\union-eyes\vitest.config.ts scripts\ue\author-w4-canonical-definitions.test.ts`: **PASS;44 frozen W4F tests**.
- `pnpm exec tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --esModuleInterop --types node scripts\ue\regenerate-w4fr2-definitions.ts scripts\ue\regenerate-w4fr2-definitions.test.ts`: **PASS;nullable enum member type narrowed by explicit guard**.
- `pnpm exec eslint --config apps\union-eyes\eslint.config.mjs --max-warnings 0 scripts\ue\regenerate-w4fr2-definitions.ts scripts\ue\regenerate-w4fr2-definitions.test.ts`: **PASS;exit0;existing Next pages-directory diagnostic**.
- `pnpm exec tsx scripts\ue\regenerate-w4fr2-definitions.ts --self-test --check`: **PASS;two-generation exact-byte equality and persisted six supplemental artifacts;gate remains BLOCKED**.
- `pnpm exec prettier --check scripts\ue\regenerate-w4fr2-definitions.ts scripts\ue\regenerate-w4fr2-definitions.test.ts docs\union-eyes\reality-remediation\UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_FINAL.json docs\union-eyes\reality-remediation\UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_FINAL.md docs\union-eyes\reality-remediation\UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_FINAL.json docs\union-eyes\reality-remediation\UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_FINAL.md docs\union-eyes\reality-remediation\PHASE_1B_3C_A1I_W4FR2_CANONICAL_DEFINITION_REGENERATION.json docs\union-eyes\reality-remediation\PHASE_1B_3C_A1I_W4FR2_CANONICAL_DEFINITION_REGENERATION.md`: **PASS;repository formatting**.
- `pnpm validate:docs`: **PASS;0 errors;1215 existing warnings;2611 scanned files**.
- `Independent Node crypto verification of fixed/history/selected-source/type-source bytes and12 accepted section hashes`: **PASS;80 distinct byte commitments;12 frozen section hashes;producer/canonical1.3.1 unchanged**.
- `1.3.2 ->1.3.1 ->1.3 ->1.2 ->1.1 ->1.0 reconstruction`: **NOT_APPLICABLE;W4FR2 BLOCKED;no1.3.2 amendment/inverse authored;1.3.1 byte SHA256 unchanged**.

Total distinct test coverage:275 passed. Model/unit determinism and exact formatted artifact determinism are separate checks.1.3.2 inverse/version-chain reconstruction is NOT_APPLICABLE because no amendment was made.

## State

W4FR2=BLOCKED;DO_NOT_PERFORM_NEW_DISCOVERY=YES.
CANONICAL_CONTRACT_VERSION=1.3.1;VERSION_1_3_2_PUBLISHED=NO.
W4=BLOCKED_DEFINITION_IMPLEMENTATION_PENDING;127 compatibility records remain,but are not yet the sole blocker.
W4_COMPATIBILITY_GATE_NORMALIZATION=NOT_AUTHORIZED;W4P/W5=NOT_AUTHORIZED.
All SQL is DEFINITION_ONLY_NOT_EXECUTABLE/EXECUTION_ALLOWED=NO.
NAMED_TYPES_MATERIALIZED=NO;TYPE_SQL_EXECUTED=NO;READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO.
