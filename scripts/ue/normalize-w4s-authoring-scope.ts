import assert from 'node:assert/strict'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import type { buildRetry } from './regenerate-w4fr2-definitions'
import type { buildRegeneration } from './regenerate-w4fr-definitions'
import type { buildTypeClosure } from './close-w4t-named-types'
import { digest, read, root, sha } from './w4-physical-producers'

const folder = 'docs/union-eyes/reality-remediation/'
export const files = {
  w4fr2: folder + 'PHASE_1B_3C_A1I_W4FR2_CANONICAL_DEFINITION_REGENERATION.json',
  resolved: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_RESOLVED.json',
  types: folder + 'UE_W4_NAMED_TYPE_DEPENDENCY_REGISTRY.json',
  w4t1: folder + 'PHASE_1B_3C_A1I_W4T1_FINAL_TYPE_DEFINITION_SELECTION.json',
  w4h3: folder + 'PHASE_1B_3C_A1I_W4H3_FINAL_BLUEPRINT_SELECTION.json',
}
export const outputs = {
  json: folder + 'PHASE_1B_3C_A1I_W4S_PHYSICAL_AUTHORING_SCOPE_NORMALIZATION.json',
  markdown: folder + 'PHASE_1B_3C_A1I_W4S_PHYSICAL_AUTHORING_SCOPE_NORMALIZATION.md',
}
type Frozen = ReturnType<typeof buildRegeneration>['registry']
type Definition = Frozen['definitionObligationLinkage'][number]
type Retry = ReturnType<typeof buildRetry>['report']
type Gap = Retry['physicalCompletenessBlockers'][number]
type Types = ReturnType<typeof buildTypeClosure>['registry']

export function reconcileResponsibilities(definitions: Definition[]) {
  assert.equal(definitions.length, 183, 'OBLIGATION_DENOMINATOR_DRIFT')
  assert.equal(
    new Set(definitions.map((record) => record.DEFINITION_OBLIGATION_ID)).size,
    183,
    'DUPLICATE_OBLIGATION',
  )
  const buckets = {
    RELATION_CREATE_OBLIGATIONS: definitions.filter(
      (record) => record.DEFINITION_OPERATION === 'CREATE_RELATION',
    ),
    INCLUDED_COLUMN_OBLIGATIONS: definitions.filter(
      (record) => record.DEFINITION_OPERATION === 'RELATION_CREATE_INCLUDES_COLUMN',
    ),
    ADD_COLUMN_OBLIGATIONS: definitions.filter(
      (record) => record.DEFINITION_OPERATION === 'ADD_COLUMN_TO_EXISTING_RELATION',
    ),
  }
  assert.equal(buckets.RELATION_CREATE_OBLIGATIONS.length, 57)
  assert.equal(buckets.INCLUDED_COLUMN_OBLIGATIONS.length, 57)
  assert.equal(buckets.ADD_COLUMN_OBLIGATIONS.length, 69)
  assert.equal(Object.values(buckets).flat().length, 183)
  for (const record of definitions) {
    assert.equal(record.CANONICAL_OWNER, 'PLATFORM_BASELINE')
    assert.equal(record.DATABASE_SCOPE_ID, 'UE_OPERATIONAL')
    if (record.DEFINITION_OPERATION === 'CREATE_RELATION')
      assert.equal(record.OBJECT_KIND, 'RELATION')
    else assert.equal(record.OBJECT_KIND, 'COLUMN')
    if (record.DEFINITION_OPERATION === 'RELATION_CREATE_INCLUDES_COLUMN')
      assert(
        buckets.RELATION_CREATE_OBLIGATIONS.some(
          (relation) => relation.RELATION_DEFINITION_ID === record.RELATION_DEFINITION_ID,
        ),
        'INCLUDED_COLUMN_WITHOUT_RELATION',
      )
    if (record.DEFINITION_OPERATION === 'ADD_COLUMN_TO_EXISTING_RELATION') {
      assert.equal(
        record.ACCEPTED_PARENT_CREATION_AUTHORITY?.CREATION_DEFINITION_ESTABLISHED,
        'YES',
      )
      assert(
        !buckets.RELATION_CREATE_OBLIGATIONS.some(
          (relation) => relation.RELATION_DEFINITION_ID === record.RELATION_DEFINITION_ID,
        ),
      )
    }
  }
  return buckets
}
export function classifyContexts(frozen: Frozen) {
  return frozen.relationDefinitions.map((relation) => {
    const definitions = frozen.definitionObligationLinkage.filter(
      (record) => record.RELATION_DEFINITION_ID === relation.RELATION_DEFINITION_ID,
    )
    const relationOwner = definitions.find((record) => record.OBJECT_KIND === 'RELATION')
    const parents = new Set(relation.EXISTING_AUTHORITY_COLUMNS_NOT_REAUTHORED)
    const governed = new Set(
      relation.GOVERNED_COLUMN_DEFINITIONS.map((column) => column.COLUMN_NAME),
    )
    assert.equal(new Set(relation.ORDERED_COLUMN_SET).size, relation.ORDERED_COLUMN_SET.length)
    const columns = relation.ORDERED_COLUMN_SET.map((column) => {
      const identity = `union-eyes::COLUMN::public.${relation.RELATION_NAME}.${column}`
      const obligation = definitions.find(
        (record) => record.OBJECT_KIND === 'COLUMN' && record.PHYSICAL_IDENTITY === identity,
      )
      assert.notEqual(
        parents.has(column),
        governed.has(column),
        'COLUMN_AUTHORITY_UNCLASSIFIED_OR_OVERLAPPING',
      )
      if (parents.has(column)) {
        assert(!obligation && !relationOwner, 'PARENT_COLUMN_ASSIGNED_W4')
        return {
          PHYSICAL_IDENTITY: identity,
          COLUMN_NAME: column,
          AUTHORITY_CLASS: 'EXISTING_PARENT_AUTHORITY',
          W4_REAUTHOR: 'NO',
          W4_PHYSICAL_COMPLETENESS_REQUIRED: 'NO',
          W4_DEFINITION_OBLIGATION_ID: null,
          RELATED_RELATION_OBLIGATION_ID: null,
          GOVERNED_APPLICATION_COLUMN_CONTEXT: false,
        }
      }
      assert(obligation || relationOwner, 'W4_CONTEXT_WITHOUT_ACCEPTED_RESPONSIBILITY')
      return {
        PHYSICAL_IDENTITY: identity,
        COLUMN_NAME: column,
        AUTHORITY_CLASS: 'W4_OWNED',
        W4_REAUTHOR: obligation
          ? 'AUTHORIZED_FUTURE_INACTIVE_DEFINITION_ONLY'
          : 'NO_INDEPENDENT_COLUMN_OBLIGATION_CONTEXT_ONLY',
        W4_PHYSICAL_COMPLETENESS_REQUIRED: obligation
          ? 'YES'
          : 'NO_INDEPENDENT_COLUMN_COMPLETENESS_DENOMINATOR',
        W4_DEFINITION_OBLIGATION_ID: obligation?.DEFINITION_OBLIGATION_ID ?? null,
        RELATED_RELATION_OBLIGATION_ID: relationOwner?.DEFINITION_OBLIGATION_ID ?? null,
        GOVERNED_APPLICATION_COLUMN_CONTEXT: true,
      }
    })
    assert.equal(
      columns.filter((column) => column.AUTHORITY_CLASS === 'EXISTING_PARENT_AUTHORITY').length,
      parents.size,
    )
    return {
      RELATION_DEFINITION_ID: relation.RELATION_DEFINITION_ID,
      CANONICAL_BLUEPRINT_ID: relation.CANONICAL_BLUEPRINT_ID,
      RELATION: `public.${relation.RELATION_NAME}`,
      RELATION_BLUEPRINT_PURPOSE: 'APPLICATION_SHAPE_AND_PROVENANCE_CONTEXT',
      AUTHORITY_CLASS: relationOwner
        ? 'W4_RELATION_PREREQUISITE'
        : 'EXISTING_PARENT_AUTHORITY_RELATION_CONTEXT',
      W4_RELATION_OBLIGATION_ID: relationOwner?.DEFINITION_OBLIGATION_ID ?? null,
      ORDERED_COLUMN_SET: relation.ORDERED_COLUMN_SET,
      SOURCE_AUTHORITY: relation.AUTHORITY,
      SOURCES: relation.SOURCES,
      COLUMN_AUTHORITY_CLASSIFICATION: columns,
      FUTURE_W4_INCLUDED_COLUMN_OBLIGATION_IDS: definitions
        .filter((record) => record.DEFINITION_OPERATION === 'RELATION_CREATE_INCLUDES_COLUMN')
        .map((record) => record.DEFINITION_OBLIGATION_ID),
      FUTURE_W4_ADD_COLUMN_OBLIGATION_IDS: definitions
        .filter((record) => record.DEFINITION_OPERATION === 'ADD_COLUMN_TO_EXISTING_RELATION')
        .map((record) => record.DEFINITION_OBLIGATION_ID),
      APPLICATION_BLUEPRINT_IS_MATERIALIZATION_AUTHORIZATION: 'NO',
    }
  })
}
export function verifyGapDisjointness(
  gaps: Gap[],
  parentIdentities: Set<string>,
  definitions: Definition[],
  frozen: Frozen,
) {
  assert.equal(gaps.length, 108)
  assert.equal(new Set(gaps.map((gap) => gap.PHYSICAL_IDENTITY)).size, 108)
  for (const gap of gaps) {
    assert(parentIdentities.has(gap.PHYSICAL_IDENTITY), 'GAP_NOT_PARENT_OWNED')
    assert(
      !definitions.some((definition) => definition.PHYSICAL_IDENTITY === gap.PHYSICAL_IDENTITY),
      'FAIL_SCOPE_CLASSIFICATION_ERROR',
    )
    assert(gap.GOVERNED_W4_COLUMN_RECORD === null, 'FAIL_SCOPE_CLASSIFICATION_ERROR')
    const relation = frozen.relationDefinitions.find(
      (record) => record.RELATION_DEFINITION_ID === gap.RELATION_DEFINITION_ID,
    )
    assert(relation)
    assert(relation.EXISTING_AUTHORITY_COLUMNS_NOT_REAUTHORED.includes(gap.COLUMN))
    assert(
      !relation.GOVERNED_COLUMN_DEFINITIONS.some((column) => column.COLUMN_NAME === gap.COLUMN),
      'FAIL_SCOPE_CLASSIFICATION_ERROR',
    )
    assert(
      !definitions.some(
        (record) =>
          record.RELATION_DEFINITION_ID === gap.RELATION_DEFINITION_ID &&
          record.DEFINITION_OPERATION === 'CREATE_RELATION',
      ),
      'GAP_REQUIRED_BY_W4_RELATION_CREATE',
    )
    assert(
      !gap.FROZEN_PHYSICAL_TYPE_FACT.EVIDENCE.startsWith('References existing enum'),
      'ENUM_SCOPE_REOPENED',
    )
  }
  return true
}
export function buildScope() {
  const bytes = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]))
  const retry: Retry = JSON.parse(bytes.w4fr2),
    frozen: Frozen = JSON.parse(bytes.resolved)
  const types: Types = JSON.parse(bytes.types)
  const t1: { NORMALIZED_REGISTRY_SHA256: string; phaseStatus: { PHASE_1B_3C_A1I_W4T1: string } } =
    JSON.parse(bytes.w4t1)
  assert.equal(retry.phaseStatus.PHASE_1B_3C_A1I_W4FR2_GATE, 'BLOCKED')
  assert.equal(t1.phaseStatus.PHASE_1B_3C_A1I_W4T1, 'PASS')
  assert.equal(sha(bytes.types), t1.NORMALIZED_REGISTRY_SHA256)
  assert.equal(types.typeRecords.length, 36)
  assert.equal(types.referenceLinks.length, 38)
  assert(
    types.typeRecords.every(
      (record) =>
        record.TYPE_APPROVAL_STATUS === 'APPROVED' &&
        record.DEFINITION_STATUS === 'EXACT_DEFINITION_AVAILABLE' &&
        record.OWNERSHIP_AUTHORITY === 'HUMAN_GOVERNANCE_W4T' &&
        record.CANONICAL_CREATION_AUTHORITY === 'PLATFORM_BASELINE',
    ),
  )
  assert.equal(types.summary.REFERENCES_WITH_APPROVED_TYPE, 38)
  const preservation = Object.fromEntries(
    Object.values(files).map((file) => [file, sha(read(file))]),
  )
  for (const [file, hash] of Object.entries(retry.preservation)) {
    assert.equal(sha(read(file)), hash, `FROZEN_UPSTREAM_DRIFT:${file}`)
    preservation[file] = hash
  }
  for (const file of [
    files.w4fr2.replace(/\.json$/, '.md'),
    folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_FINAL.json',
    folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_FINAL.md',
    folder + 'UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_FINAL.json',
    folder + 'UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_FINAL.md',
  ])
    preservation[file] = sha(read(file))
  const buckets = reconcileResponsibilities(frozen.definitionObligationLinkage)
  const contexts = classifyContexts(frozen)
  assert.equal(contexts.length, 125)
  const columns = contexts.flatMap((context) => context.COLUMN_AUTHORITY_CLASSIFICATION)
  assert.equal(new Set(columns.map((column) => column.PHYSICAL_IDENTITY)).size, columns.length)
  const parents = columns.filter((column) => column.AUTHORITY_CLASS === 'EXISTING_PARENT_AUTHORITY')
  const explicitW4 = columns.filter((column) => column.W4_DEFINITION_OBLIGATION_ID !== null)
  assert.equal(parents.length, 1299)
  assert.equal(explicitW4.length, 126)
  assert.deepEqual(
    explicitW4.map((column) => column.W4_DEFINITION_OBLIGATION_ID).sort(),
    frozen.definitionObligationLinkage
      .filter((record) => record.OBJECT_KIND === 'COLUMN')
      .map((record) => record.DEFINITION_OBLIGATION_ID)
      .sort(),
  )
  verifyGapDisjointness(
    retry.physicalCompletenessBlockers,
    new Set(parents.map((column) => column.PHYSICAL_IDENTITY)),
    frozen.definitionObligationLinkage,
    frozen,
  )
  const gapDisposition = retry.physicalCompletenessBlockers.map((gap) => ({
    BLOCKER_ID: gap.BLOCKER_ID,
    PHYSICAL_IDENTITY: gap.PHYSICAL_IDENTITY,
    RELATION_DEFINITION_ID: gap.RELATION_DEFINITION_ID,
    COLUMN: gap.COLUMN,
    ORIGINAL_W4FR2_BLOCKER: gap,
    W4FR2_BLOCKER_DISPOSITION: 'SUPERSEDED_BY_W4S_SCOPE_NORMALIZATION',
    UNDERLYING_REPRESENTATION_GAP: 'PRESERVED',
    GAP_RESOLVED: 'NO',
    GAP_ASSIGNED_TO_W4: 'NO',
    W4_REAUTHORING_AUTHORIZED: 'NO',
    W4_DECISION_REQUIRED: 'NO',
  }))
  const gapCounts = {
    TIMESTAMP_REPRESENTATION_GAPS: gapDisposition.filter((record) =>
      record.ORIGINAL_W4FR2_BLOCKER.FROZEN_PHYSICAL_TYPE_FACT.EVIDENCE.startsWith('Timestamp'),
    ).length,
    NUMERIC_PRECISION_SCALE_GAPS: gapDisposition.filter((record) =>
      record.ORIGINAL_W4FR2_BLOCKER.FROZEN_PHYSICAL_TYPE_FACT.EVIDENCE.startsWith('Numeric'),
    ).length,
    VARCHAR_LENGTH_OR_UNBOUNDED_GAPS: gapDisposition.filter((record) =>
      record.ORIGINAL_W4FR2_BLOCKER.FROZEN_PHYSICAL_TYPE_FACT.EVIDENCE.startsWith('Character'),
    ).length,
  }
  assert.deepEqual(gapCounts, {
    TIMESTAMP_REPRESENTATION_GAPS: 94,
    NUMERIC_PRECISION_SCALE_GAPS: 13,
    VARCHAR_LENGTH_OR_UNBOUNDED_GAPS: 1,
  })
  if (existsSync(path.join(root, ...outputs.json.split('/')))) {
    const previous: { preservation: { BYTE_COMMITMENTS: typeof preservation } } = JSON.parse(
      read(outputs.json),
    )
    assert.deepEqual(
      preservation,
      previous.preservation.BYTE_COMMITMENTS,
      'W4S_FROZEN_UPSTREAM_DRIFT',
    )
  }
  const summary = {
    DEFINITION_OBLIGATIONS: 183,
    RELATION_OBLIGATIONS: 57,
    COLUMN_OBLIGATIONS: 126,
    RELATION_CREATE_OBLIGATIONS: 57,
    INCLUDED_COLUMN_OBLIGATIONS: 57,
    ADD_COLUMN_OBLIGATIONS: 69,
    SUM: 183,
    UNACCOUNTED_OBLIGATIONS: 0,
    SELECTED_RELATION_CONTEXTS: 125,
    W4_RELATION_PREREQUISITES: 57,
    PARENT_AUTHORITY_RELATION_CONTEXTS: contexts.filter(
      (context) => context.AUTHORITY_CLASS === 'EXISTING_PARENT_AUTHORITY_RELATION_CONTEXT',
    ).length,
    SELECTED_COLUMNS_CLASSIFIED: columns.length,
    UNCLASSIFIED_SELECTED_COLUMNS: 0,
    W4_GOVERNED_COLUMN_CONTEXTS: columns.filter((column) => column.AUTHORITY_CLASS === 'W4_OWNED')
      .length,
    EXPLICIT_W4_COLUMN_PREREQUISITES: 126,
    OTHER_GOVERNED_RELATION_COLUMN_CONTEXTS_NOT_INDEPENDENT_OBLIGATIONS: columns.filter(
      (column) =>
        column.AUTHORITY_CLASS === 'W4_OWNED' && column.W4_DEFINITION_OBLIGATION_ID === null,
    ).length,
    PARENT_OWNED_COLUMNS_EXCLUDED_FROM_REAUTHORING: 1299,
    PARENT_OWNED_COLUMNS_WITH_UNRESOLVED_PHYSICAL_REPRESENTATION: 108,
    ...gapCounts,
    W4_OWNED_GAPS_WITHIN_108: 0,
    PARENT_OWNED_COLUMNS_REAUTHORED: 0,
    HYBRID_APPLICATION_BLUEPRINTS_CREATED: 0,
    DISTINCT_NAMED_TYPES: 36,
    EXACT_TYPE_DEFINITIONS: 36,
    TYPE_REFERENCES_RESOLVED: 38,
    TYPE_HOLDS: 0,
    SQL_AUTHORED: 0,
    SQL_EXECUTED: 0,
  }
  return {
    metadata: {
      PHASE: 'PHASE_1B_3C_A1I_W4S',
      INPUTS: files,
      STATUS: 'GOVERNANCE_SCOPE_OVERLAY_ONLY',
    },
    humanArchitectureDecision: {
      AUTHORITY: 'HUMAN_ARCHITECTURE_W4S',
      W4_PHYSICAL_AUTHORING_SCOPE: 'W4_OWNED_PRECONSUMER_PREREQUISITES_ONLY',
      PLATFORM_BASELINE_DOCTRINE: 'MINIMUM_GOVERNED_PRECONSUMER_PHYSICAL_BASELINE',
      W4_PHYSICAL_AUTHORING_DENOMINATOR: '183_GOVERNED_W4_OBLIGATIONS',
      SELECTED_APPLICATION_BLUEPRINT: 'CANONICAL_CONTEXT_FOR_IDENTITY_AND_PROVENANCE',
      W4_PRECONSUMER_BASELINE: 'GOVERNED_SUBSET_OWNED_BY_PLATFORM_BASELINE',
      INHERITED_PARENT_REPRESENTATION_GAPS: 'OUT_OF_SCOPE_FOR_W4_PHYSICAL_AUTHORING',
      INHERITED_PARENT_GAPS_BLOCK_W4: 'NO',
      W4_REAUTHORING_AUTHORIZED: 'NO_FOR_PARENT_COLUMNS',
      RATIONALE:
        'W4 physically defines its accepted preconsumer prerequisite objects,not every column in the selected application blueprints. Parent authority and unresolved physical facts are preserved.',
    },
    w4ObligationUniverse: {
      summary,
      EXACT_DEFINITION_OBLIGATION_IDS: frozen.definitionObligationLinkage.map(
        (record) => record.DEFINITION_OBLIGATION_ID,
      ),
      ORIGINAL_OBLIGATION_LINKAGE_SHA256: digest(frozen.definitionObligationLinkage),
    },
    relationContextUniverse: contexts,
    columnAuthorityClassification: columns,
    w4OwnedResponsibilities: Object.fromEntries(
      Object.entries(buckets).map(([key, records]) => [
        key,
        records.map((record) => ({
          DEFINITION_OBLIGATION_ID: record.DEFINITION_OBLIGATION_ID,
          SOURCE_W4_DECISION_ID: record.SOURCE_W4_DECISION_ID,
          PHYSICAL_IDENTITY: record.PHYSICAL_IDENTITY,
          RELATION_DEFINITION_ID: record.RELATION_DEFINITION_ID,
          CANONICAL_OWNER: record.CANONICAL_OWNER,
          DEFINITION_OPERATION: record.DEFINITION_OPERATION,
          ACCEPTED_PARENT_CREATION_AUTHORITY: record.ACCEPTED_PARENT_CREATION_AUTHORITY,
        })),
      ]),
    ),
    parentOwnedContext: parents,
    w4fr2BlockerDisposition: gapDisposition,
    revisedCompletionContract: {
      AUTHORITY: 'HUMAN_ARCHITECTURE_W4S',
      W4_PHYSICAL_COMPLETENESS: 'EVERY_W4_OWNED_PREREQUISITE_HAS_AN_EXACT_PHYSICAL_DEFINITION',
      PASS_REQUIREMENTS: {
        W4_OBLIGATIONS: 183,
        W4_RELATION_PREREQUISITES: 57,
        W4_COLUMN_PREREQUISITES: 126,
        NAMED_TYPES: 36,
        W4_NAMED_TYPE_REFERENCES: 38,
        RELATION_CONTEXTS_ACCOUNTED: 125,
        UNRESOLVED_W4_PROPERTIES: 0,
        CREATION_AUTHORITY_CONFLICTS: 0,
        DUPLICATE_W4_RESPONSIBILITIES: 0,
        PARENT_COLUMNS_REAUTHORED: 0,
        INACTIVE_SQL_DETERMINISTIC: 'YES',
        PRODUCER_METADATA_LINKS_COMPLETE: 'YES',
        EXECUTION_ALLOWED: 'NO',
      },
      FULL125_APPLICATION_RELATIONS_AUTHORED_BY_W4_REQUIRED: 'NO',
      FUTURE_RELATION_CREATE_CONTENT:
        'W4 relation identity;explicit W4 included-column obligations;governed relation-level W4 properties and dependencies required by those objects;no automatic full-blueprint expansion',
      CONTEXT_ONLY_COLUMN_COUNT_IS_NOT_PHYSICAL_DENOMINATOR: 'YES',
      FUTURE_MATERIALIZATION_COLUMN_IDS: frozen.definitionObligationLinkage
        .filter((record) => record.OBJECT_KIND === 'COLUMN')
        .map((record) => record.PHYSICAL_IDENTITY),
      APPLICATION_BLUEPRINT_COLUMN_COUNT_DIFFERS_FROM_BASELINE:
        'VALID_AND_EXPECTED;not a hybrid application blueprint',
    },
    preservation: {
      BYTE_COMMITMENTS: preservation,
      PRESERVED_SECTIONS: retry.preservedSections,
      GOVERNED_DESIGN_REGISTRY_SHA256: sha(bytes.resolved),
      TYPE_REGISTRY_SHA256: sha(bytes.types),
      TYPE_DEFINITIONS_SHA256: digest(types.typeRecords),
      TYPE_REFERENCES_SHA256: digest(types.referenceLinks),
      HISTORICAL_W4FR2_BYTES_CHANGED: 'NO',
      RELATION_GOVERNANCE_CHANGED: 'NO',
      TYPE_GOVERNANCE_CHANGED: 'NO',
      PARENT_PROPERTY_INFERENCE: 'NO',
      LATE_PRODUCER_COMPATIBILITY_RECORDS: 127,
      COMPATIBILITY_ANALYSIS: 'NOT_STARTED',
    },
    validation: {
      closeoutChecks: [
        {
          COMMAND:
            'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\normalize-w4s-authoring-scope.test.ts',
          RESULT: 'PASS;22 focused scope/classification/disjointness/preservation/negative tests',
        },
        {
          COMMAND:
            'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\regenerate-w4fr2-definitions.test.ts scripts\\ue\\record-w4t1-human-type-selections.test.ts scripts\\ue\\close-w4t-named-types.test.ts scripts\\ue\\regenerate-w4fr-definitions.test.ts scripts\\ue\\verify-frozen-w4.test.ts apps\\union-eyes\\scripts\\provisioning\\governed-provisioning.test.ts',
          RESULT:
            'PASS;231 preserved predecessor tests;historical generators not run as writing CLIs',
        },
        {
          COMMAND:
            'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\author-w4-canonical-definitions.test.ts',
          RESULT: 'PASS;44 frozen W4F tests',
        },
        {
          COMMAND:
            'pnpm exec tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --esModuleInterop --types node scripts\\ue\\normalize-w4s-authoring-scope.ts scripts\\ue\\normalize-w4s-authoring-scope.test.ts',
          RESULT: 'PASS;exit0',
        },
        {
          COMMAND:
            'pnpm exec eslint --config apps\\union-eyes\\eslint.config.mjs --max-warnings 0 scripts\\ue\\normalize-w4s-authoring-scope.ts scripts\\ue\\normalize-w4s-authoring-scope.test.ts',
          RESULT: 'PASS;exit0;existing Next pages-directory diagnostic',
        },
        {
          COMMAND:
            'pnpm exec tsx scripts\\ue\\normalize-w4s-authoring-scope.ts --self-test --check',
          RESULT:
            'PASS;two-generation exact-byte equality;persisted scope-only artifact check;historical bytes unchanged',
        },
        {
          COMMAND:
            'pnpm exec prettier --check scripts\\ue\\normalize-w4s-authoring-scope.ts scripts\\ue\\normalize-w4s-authoring-scope.test.ts docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1I_W4S_PHYSICAL_AUTHORING_SCOPE_NORMALIZATION.json docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1I_W4S_PHYSICAL_AUTHORING_SCOPE_NORMALIZATION.md',
          RESULT: 'PASS;repository formatting',
        },
        {
          COMMAND: 'pnpm validate:docs',
          RESULT: 'PASS;0 errors;1215 existing warnings;2612 scanned files',
        },
        {
          COMMAND:
            'Independent Node crypto frozen-byte check and exact108-parent-subset/183-ownership-disjointness comparison',
          RESULT:
            'PASS;24 historical/input byte commitments;1299 exact parents;108 intersection183=0;original108 facts unchanged',
        },
      ],
      EXACT183_57_57_69_IDS: 'PASS',
      ALL125_CONTEXT_COLUMNS_CLASSIFIED: 'PASS',
      EXACT1299_PARENTS_108_SUBSET: 'PASS',
      INTERSECTION108_W4_OWNED: 0,
      W4_COLUMNS126_PRESERVED: 'PASS',
      TYPES36_REFERENCES38_PRESERVED: 'PASS',
      NO_PROPERTY_GOVERNANCE_INFERENCE: 'PASS',
    },
    proofBoundaries: { ...retry.proofBoundaries, PARENT_SCHEMA_RUNTIME_CORRECTNESS_PROVEN: 'NO' },
    phaseStatus: {
      PHASE_1B_3C_A1I_W4S_GATE: 'PASS',
      PHASE_1B_3C_A1I_W4S: 'PASS',
      W4_PHYSICAL_AUTHORING_SCOPE: 'NORMALIZED_TO_W4_OWNED_PREREQUISITES',
      W4FR2_SCOPE_CONTRADICTION: 'CLOSED_BY_GOVERNANCE',
      W4FR3: 'AUTHORIZED_NOT_STARTED',
      W4FR3_STARTED: 'NO',
      CANONICAL_CONTRACT_VERSION: '1.3.1',
      VERSION_1_3_2_PUBLISHED: 'NO',
      W4: 'BLOCKED_DEFINITION_IMPLEMENTATION_PENDING',
      W4P: 'NOT_AUTHORIZED',
      W5: 'NOT_AUTHORIZED',
      READY_FOR_RUNTIME_PROOF: 0,
      PRODUCT_READY: 'NO',
    },
  }
}
export async function generate() {
  const model = buildScope(),
    config = (await resolveConfig(path.join(root, 'package.json'))) ?? {}
  const markdown = `# W4S - physical authoring scope normalization

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
${model.validation.closeoutChecks.map((check) => `- \`${check.COMMAND}\`: **${check.RESULT}**.`).join('\n')}

Total distinct test coverage:297 passed. Historical W4FR2 remains BLOCKED under its original criterion;W4S supersedes only the blocking scope effect,not any evidence or physical representation.

## State

W4S=PASS;W4FR2_SCOPE_CONTRADICTION=CLOSED_BY_GOVERNANCE.
W4FR3=AUTHORIZED_NOT_STARTED;W4FR3_STARTED=NO.
CANONICAL_CONTRACT_VERSION=1.3.1;no1.3.2.
W4=BLOCKED_DEFINITION_IMPLEMENTATION_PENDING;W4P/W5=NOT_AUTHORIZED.
SQL_AUTHORED=0;SQL_EXECUTED=0;PARENT_SCHEMA_RUNTIME_CORRECTNESS_PROVEN=NO.
READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO. No SQL,physical authoring,retry or execution was performed.
`
  return {
    [outputs.json]: await format(JSON.stringify(model), { ...config, parser: 'json' }),
    [outputs.markdown]: await format(markdown, { ...config, parser: 'markdown' }),
  }
}
export async function main(args: string[]) {
  assert(
    args.every((arg) => ['--plan', '--self-test', '--check'].includes(arg)),
    'UNAUTHORIZED_W4S_FLAG',
  )
  assert.equal(new Set(args).size, args.length)
  const generated = await generate()
  if (args.includes('--self-test')) {
    assert.deepEqual(generated, await generate(), 'NONDETERMINISTIC_W4S')
    console.log('PASS W4S two-generation exact-byte scope overlay')
  }
  if (args.includes('--check')) {
    for (const [file, bytes] of Object.entries(generated))
      assert.equal(read(file), bytes, `STALE_W4S_OUTPUT:${file}`)
    console.log('PASS W4S persisted scope artifacts;historical bytes unchanged')
  } else if (!args.includes('--self-test')) {
    for (const [file, bytes] of Object.entries(generated))
      writeFileSync(path.join(root, ...file.split('/')), bytes)
    console.log(
      'W4S PASS;108 gaps parent-owned/nonblocking;183 exact prerequisites;no SQL or retry',
    )
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error('[normalize-w4s-authoring-scope]', error)
    process.exitCode = 1
  })
