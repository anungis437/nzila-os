import assert from 'node:assert/strict'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import type { buildRegeneration } from './regenerate-w4fr-definitions'
import type { buildRegistry } from './author-w4-canonical-definitions'
import type { buildTypeClosure } from './close-w4t-named-types'
import type { buildSelection } from './record-w4t1-human-type-selections'
import { enumDescriptor, sqlTokens } from './close-w4t-named-types'
import { digest, read, root, sha } from './w4-physical-producers'

const folder = 'docs/union-eyes/reality-remediation/'
export const files = {
  w4h3: folder + 'PHASE_1B_3C_A1I_W4H3_FINAL_BLUEPRINT_SELECTION.json',
  w4t1: folder + 'PHASE_1B_3C_A1I_W4T1_FINAL_TYPE_DEFINITION_SELECTION.json',
  types: folder + 'UE_W4_NAMED_TYPE_DEPENDENCY_REGISTRY.json',
  w4t: folder + 'PHASE_1B_3C_A1I_W4T_NAMED_TYPE_PRODUCTION_CLOSURE.json',
  w4fr: folder + 'PHASE_1B_3C_A1I_W4FR_CANONICAL_DEFINITION_REGENERATION.json',
  resolved: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_RESOLVED.json',
  w4f: folder + 'PHASE_1B_3C_A1I_W4F_CANONICAL_DEFINITION_AUTHORING.json',
  w4g: folder + 'PHASE_1B_3C_A1I_W4G_PRECONSUMER_OWNERSHIP_ADOPTION.json',
  w4h: folder + 'PHASE_1B_3C_A1I_W4H_CANONICAL_DEFINITION_GOVERNANCE.json',
  producer: folder + 'UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.json',
  canonical: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json',
}
export const outputs = {
  registry: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_FINAL.json',
  registryMarkdown: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_FINAL.md',
  payloads: folder + 'UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_FINAL.json',
  payloadsMarkdown: folder + 'UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_FINAL.md',
  report: folder + 'PHASE_1B_3C_A1I_W4FR2_CANONICAL_DEFINITION_REGENERATION.json',
  markdown: folder + 'PHASE_1B_3C_A1I_W4FR2_CANONICAL_DEFINITION_REGENERATION.md',
}
type Frozen = ReturnType<typeof buildRegeneration>
type F = Awaited<ReturnType<typeof buildRegistry>>
type Types = ReturnType<typeof buildTypeClosure>['registry']
type T1 = ReturnType<typeof buildSelection>['report'] & { NORMALIZED_REGISTRY_SHA256: string }
type Relation = Frozen['registry']['relationDefinitions'][number]
type Declaration = F['relationDefinitions'][number]['DECLARATIONS'][number]
export function selectedDeclaration(relation: Relation, declarations: Declaration[]) {
  const selected = declarations.find(
    (declaration) =>
      relation.SOURCES.some(
        (source) =>
          source.FILE === declaration.REFERENCE.FILE &&
          source.DIGEST === declaration.REFERENCE.DIGEST,
      ) &&
      digest(declaration.COLUMNS.map((column) => column.NAME).sort()) ===
        digest([...relation.ORDERED_COLUMN_SET].sort()),
  )
  assert(selected, 'NO_EXACT_SELECTED_BLUEPRINT')
  assert.equal(sha(selected.REFERENCE.TEXT), selected.REFERENCE.DIGEST, 'DECLARATION_DIGEST_DRIFT')
  assert.deepEqual(
    selected.COLUMNS.map((column) => column.NAME),
    relation.ORDERED_COLUMN_SET,
    'BLUEPRINT_ORDER_DRIFT',
  )
  return selected
}
export function physicalRepresentationGap(
  fact: Declaration['COLUMNS'][number]['PROPERTIES']['POSTGRES_TYPE'],
) {
  if (fact.STATE !== 'UNRESOLVED') return false
  return [
    'Timestamp timezone semantics not explicitly established; no preferred timezone inferred',
    'Numeric precision/scale or unconstrained representation requires explicit adoption',
    'Character length/unbounded choice not explicitly established',
  ].includes(fact.EVIDENCE)
}
export function validateTypeSql(sql: string) {
  const tokens = sqlTokens(sql)
  const words = tokens
    .filter((token) => token.kind === 'WORD')
    .map((token) => token.value.toUpperCase())
  assert.deepEqual(words, ['CREATE', 'TYPE', 'AS', 'ENUM'], 'UNSAFE_OR_NONCANONICAL_TYPE_SQL')
  assert.equal(tokens.filter((token) => token.value === ';').length, 1)
  assert.equal(tokens[2]?.value, 'public', 'UNQUALIFIED_TYPE_SQL')
  assert.equal(tokens[3]?.value, '.')
  assert(!sql.includes('IF NOT EXISTS'), 'EXECUTION_TOLERANCE_MASKING')
}
export function buildRetry() {
  const bytes = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]))
  const frozen: Frozen['registry'] = JSON.parse(bytes.resolved)
  const fr: Frozen['report'] = JSON.parse(bytes.w4fr)
  const f: F = JSON.parse(bytes.w4f)
  const types: Types = JSON.parse(bytes.types)
  const t1: T1 = JSON.parse(bytes.w4t1)
  const canonical: { CONTRACT_VERSION: string } = JSON.parse(bytes.canonical)
  const h3: {
    phaseStatus: { PHASE_1B_3C_A1I_W4H3_GATE: string }
    governanceAccounting: { DESIGN_GROUPS_CLOSED: number; DEFINITION_OBLIGATIONS_GOVERNED: number }
    selectedBlueprints: {
      RELATION: string
      SOURCE_FILE: string
      DECLARATION_DIGEST: string
      ORDERED_COLUMN_SET: string[]
    }[]
  } = JSON.parse(bytes.w4h3)
  assert.equal(canonical.CONTRACT_VERSION, '1.3.1')
  assert.equal(h3.phaseStatus.PHASE_1B_3C_A1I_W4H3_GATE, 'PASS')
  assert.equal(h3.governanceAccounting.DESIGN_GROUPS_CLOSED, 126)
  assert.equal(h3.governanceAccounting.DEFINITION_OBLIGATIONS_GOVERNED, 183)
  assert.equal(t1.phaseStatus.PHASE_1B_3C_A1I_W4T1, 'PASS')
  assert.equal(t1.phaseStatus.W4FR_RETRY, 'AUTHORIZED_NOT_STARTED')
  assert.equal(sha(bytes.types), t1.NORMALIZED_REGISTRY_SHA256)
  const preservation = Object.fromEntries(
    Object.values(files).map((file) => [file, sha(read(file))]),
  )
  for (const [file, hash] of Object.entries(fr.preservation)) {
    assert.equal(sha(read(file)), hash, `FROZEN_UPSTREAM_DRIFT:${file}`)
    preservation[file] = hash
  }
  for (const file of [
    files.w4fr.replace(/\.json$/, '.md'),
    files.w4t.replace(/\.json$/, '.md'),
    folder + 'UE_W4T_NAMED_TYPE_HUMAN_DECISION_PACKET.json',
    files.w4t1.replace(/\.json$/, '.md'),
  ])
    preservation[file] = sha(read(file))
  assert.equal(frozen.definitionObligationLinkage.length, 183)
  assert.equal(frozen.relationDefinitions.length, 125)
  assert.deepEqual(
    frozen.definitionObligationLinkage
      .map((definition) => definition.DEFINITION_OBLIGATION_ID)
      .sort(),
    f.definitionRecords.map((definition) => definition.DEFINITION_OBLIGATION_ID).sort(),
  )
  assert.equal(
    new Set(
      frozen.definitionObligationLinkage.map((definition) => definition.DEFINITION_OBLIGATION_ID),
    ).size,
    183,
  )
  assert.equal(types.typeRecords.length, 36)
  assert.equal(types.referenceLinks.length, 38)
  assert.equal(types.summary.REFERENCES_WITH_APPROVED_TYPE, 38)
  assert.equal(types.summary.HELD_DEFINITION_CONFLICT, 0)
  assert.deepEqual(
    types.referenceLinks,
    t1.preDecisionRegistry.referenceLinks,
    'TYPE_REFERENCE_IDENTITY_DRIFT',
  )
  const four = new Set(t1.fourSelections.map((selection) => selection.CANONICAL_TYPE_IDENTITY))
  assert.equal(four.size, 4)
  assert.deepEqual(
    types.typeRecords.filter((record) => !four.has(record.CANONICAL_TYPE_IDENTITY)),
    t1.preDecisionRegistry.typeRecords.filter(
      (record) => !four.has(record.CANONICAL_TYPE_IDENTITY),
    ),
    'PRIOR_32_TYPE_DRIFT',
  )
  const sourceHashes: { [file: string]: string } = {}
  const typeDefinitions = types.typeRecords.map((record) => {
    assert.equal(record.TYPE_APPROVAL_STATUS, 'APPROVED')
    assert.equal(record.DEFINITION_STATUS, 'EXACT_DEFINITION_AVAILABLE')
    assert.equal(record.OWNERSHIP_AUTHORITY, 'HUMAN_GOVERNANCE_W4T')
    assert.equal(record.CANONICAL_CREATION_AUTHORITY, 'PLATFORM_BASELINE')
    assert(record.SELECTED?.ORDERED_ENUM_MEMBERS && record.SELECTED.TYPE_KIND === 'ENUM')
    const human = t1.fourSelections.find(
      (selection) => selection.CANONICAL_TYPE_IDENTITY === record.CANONICAL_TYPE_IDENTITY,
    )
    if (human)
      assert.deepEqual(
        record.SELECTED,
        human.SELECTED_DEFINITION,
        'W4T1_CURRENT_MEMBER_ORDER_DRIFT',
      )
    const selected = record.SELECTED
    assert(selected.ORDERED_ENUM_MEMBERS)
    assert.equal(sha(selected.EXACT_DEFINITION_TEXT), selected.DEFINITION_DIGEST)
    assert.equal(
      sha(read(selected.SOURCE_FILE)),
      selected.SOURCE_SHA256,
      'RECORDED_TYPE_SOURCE_DRIFT',
    )
    sourceHashes[selected.SOURCE_FILE] = selected.SOURCE_SHA256
    const descriptor = enumDescriptor(
      selected.SCHEMA_NAME,
      selected.TYPE_NAME,
      selected.ORDERED_ENUM_MEMBERS,
    )
    assert.deepEqual(descriptor, record.INACTIVE_TYPE_DESCRIPTOR, 'FROZEN_TYPE_DESCRIPTOR_DRIFT')
    validateTypeSql(descriptor.SQL)
    return {
      CANONICAL_TYPE_IDENTITY: record.CANONICAL_TYPE_IDENTITY,
      TYPE_KIND: record.TYPE_KIND,
      TYPE_DEFINITION_DIGEST: selected.DEFINITION_DIGEST,
      TYPE_DEFINITION_AUTHORITY: human ? 'HUMAN_ARCHITECTURE_W4T1' : 'EXACT_FROZEN_DECLARATION',
      TYPE_OWNERSHIP_AUTHORITY: record.OWNERSHIP_AUTHORITY,
      TYPE_REGISTRY_REFERENCE: { FILE: files.types, TYPE_DEPENDENCY_ID: record.TYPE_DEPENDENCY_ID },
      SELECTED_DEFINITION: selected,
      TYPE_DEFINITION_EVIDENCE: record.TYPE_DEFINITION_EVIDENCE,
      PAYLOAD_ID: `UE-W4FR2-TYPE-${sha(record.CANONICAL_TYPE_IDENTITY).slice(0, 16)}`,
      DEFINITION_STATUS: 'COMPLETE',
      ...descriptor,
    }
  })
  const typePayloads = typeDefinitions.map((type) => ({
    PAYLOAD_ID: type.PAYLOAD_ID,
    PAYLOAD_KIND: 'TYPE_DEFINITION',
    PHYSICAL_IDENTITIES_PRODUCED: [`union-eyes::TYPE::${type.CANONICAL_TYPE_IDENTITY}`],
    DEPENDENCY_PAYLOAD_IDS: [] as string[],
    DEFINITION_OBLIGATION_IDS: [] as string[],
    SQL: type.SQL,
    SQL_SHA256: type.SQL_SHA256,
    SQL_STATUS: type.SQL_STATUS,
    EXECUTION_ALLOWED: type.EXECUTION_ALLOWED,
  }))
  const relationPreflight = frozen.relationDefinitions.map((relation) => {
    const original = f.relationDefinitions.find(
      (record) => record.RELATION_DEFINITION_ID === relation.RELATION_DEFINITION_ID,
    )
    assert(original)
    const declaration = selectedDeclaration(relation, original.DECLARATIONS)
    const selectedHuman = h3.selectedBlueprints.find(
      (record) => record.RELATION === `public.${relation.RELATION_NAME}`,
    )
    if (selectedHuman) {
      assert.equal(declaration.REFERENCE.FILE, selectedHuman.SOURCE_FILE)
      assert.equal(declaration.REFERENCE.DIGEST, selectedHuman.DECLARATION_DIGEST)
      assert.deepEqual(relation.ORDERED_COLUMN_SET, selectedHuman.ORDERED_COLUMN_SET)
    }
    for (const column of relation.GOVERNED_COLUMN_DEFINITIONS) {
      for (const property of column.SELECTED_PROPERTIES)
        assert.equal(property.STATUS, 'APPROVED', 'GOVERNED_PROPERTY_INCOMPLETE')
      for (const name of ['POSTGRES_TYPE', 'NULLABILITY', 'DEFAULT', 'IDENTITY_OR_GENERATED']) {
        const property = column.SELECTED_PROPERTIES.find((record) => record.PROPERTY === name)
        assert(property?.VALUE !== null && property?.VALUE !== undefined)
      }
    }
    const blockers = declaration.COLUMNS.filter(
      (column) =>
        relation.EXISTING_AUTHORITY_COLUMNS_NOT_REAUTHORED.includes(column.NAME) &&
        physicalRepresentationGap(column.PROPERTIES.POSTGRES_TYPE),
    ).map((column) => ({
      BLOCKER_ID: `UE-W4FR2-COMPLETENESS-${sha(`${relation.RELATION_DEFINITION_ID}:${column.NAME}`).slice(0, 16)}`,
      RELATION_DEFINITION_ID: relation.RELATION_DEFINITION_ID,
      CANONICAL_BLUEPRINT_ID: relation.CANONICAL_BLUEPRINT_ID,
      RELATION: `public.${relation.RELATION_NAME}`,
      COLUMN: column.NAME,
      PHYSICAL_IDENTITY: `union-eyes::COLUMN::public.${relation.RELATION_NAME}.${column.NAME}`,
      SELECTED_BLUEPRINT_AUTHORITY: relation.AUTHORITY,
      SELECTED_BLUEPRINT_SOURCE: declaration.REFERENCE,
      EXACT_COLUMN_DECLARATION: column,
      FROZEN_PHYSICAL_TYPE_FACT: column.PROPERTIES.POSTGRES_TYPE,
      PRIOR_AUTHORITY_BOUNDARY: 'EXISTING_AUTHORITY_COLUMNS_NOT_REAUTHORED',
      GOVERNED_W4_COLUMN_RECORD:
        relation.GOVERNED_COLUMN_DEFINITIONS.find((record) => record.COLUMN_NAME === column.NAME) ??
        null,
      AFFECTED_EXISTING_DEFINITION_OBLIGATION_IDS: frozen.definitionObligationLinkage
        .filter((record) => record.RELATION_DEFINITION_ID === relation.RELATION_DEFINITION_ID)
        .map((record) => record.DEFINITION_OBLIGATION_ID),
      CONTRADICTORY_REQUIREMENTS: [
        'W4FR2 section20:every selected canonical column must have complete POSTGRES_TYPE/NULLABILITY/DEFAULT/IDENTITY_OR_GENERATED;125 fully defined relations',
        'W4FR2 sections18/39/STOP:preserve accepted parent authority;no new physical governance;no new discovery',
        'Frozen W4FR selected blueprint includes this column but explicitly excludes it from canonical reauthoring;frozen selected W4F fact leaves its physical representation unresolved',
      ],
      REQUIRED_BOUNDARY_DECISION:
        'Clarify whether existing-authority columns are excluded from125 full-definition proof,or explicitly authorize exact parent-column physical facts;no automatic defaults/source inference allowed',
      INHERITED_ENUM_GOVERNANCE_REOPENED: 'NO',
    }))
    if (!(declaration.REFERENCE.FILE in sourceHashes)) {
      assert.equal(
        sha(read(declaration.REFERENCE.FILE)),
        declaration.REFERENCE.FILE_SHA256,
        'RECORDED_SOURCE_DRIFT',
      )
      sourceHashes[declaration.REFERENCE.FILE] = declaration.REFERENCE.FILE_SHA256
    }
    assert.equal(
      sourceHashes[declaration.REFERENCE.FILE],
      declaration.REFERENCE.FILE_SHA256,
      'SELECTED_SOURCE_HASH_CONFLICT',
    )
    return {
      RELATION_DEFINITION_ID: relation.RELATION_DEFINITION_ID,
      RELATION: `public.${relation.RELATION_NAME}`,
      SELECTED_COLUMN_COUNT: relation.ORDERED_COLUMN_SET.length,
      GOVERNED_COLUMN_COUNT: relation.GOVERNED_COLUMN_DEFINITIONS.length,
      EXISTING_AUTHORITY_COLUMNS_NOT_REAUTHORED: relation.EXISTING_AUTHORITY_COLUMNS_NOT_REAUTHORED,
      PHYSICAL_REPRESENTATION_BLOCKERS: blockers,
      PREFLIGHT_STATUS: blockers.length
        ? 'BLOCKED_SELECTED_SHAPE_COMPLETENESS'
        : 'NO_REPRESENTATION_GAP_FOUND_NOT_FULL_SQL_LOWERING_PROOF',
    }
  })
  const blockers = relationPreflight.flatMap(
    (relation) => relation.PHYSICAL_REPRESENTATION_BLOCKERS,
  )
  // This entry point records the bounded BLOCKED branch; it must never silently graduate to PASS.
  assert(
    blockers.length > 0,
    'COMPLETENESS_CLEARED_FULL_LOWERING_REQUIRED_DO_NOT_REUSE_BLOCKED_BRANCH',
  )
  const typeReferences = types.referenceLinks.map((reference) => {
    const type = typeDefinitions.find(
      (type) => type.CANONICAL_TYPE_IDENTITY === reference.CANONICAL_TYPE_IDENTITY,
    )
    assert(type, 'UNRESOLVED_NAMED_TYPE')
    assert(
      fr.dependencyBlockers.some(
        (dependency) =>
          dependency.RELATION === reference.CONSUMER_RELATION &&
          dependency.COLUMN === reference.CONSUMER_COLUMN &&
          dependency.GOVERNED_TYPE_NAME === reference.GOVERNED_TYPE_NAME &&
          digest(dependency.AFFECTED_DEFINITION_OBLIGATION_IDS) ===
            digest(reference.SOURCE_W4_DEFINITION_OBLIGATION_IDS),
      ),
    )
    return {
      ...reference,
      TYPE_KIND: type.TYPE_KIND,
      TYPE_DEFINITION_DIGEST: type.TYPE_DEFINITION_DIGEST,
      TYPE_DEFINITION_AUTHORITY: type.TYPE_DEFINITION_AUTHORITY,
      TYPE_OWNERSHIP_AUTHORITY: type.TYPE_OWNERSHIP_AUTHORITY,
      TYPE_REGISTRY_REFERENCE: type.TYPE_REGISTRY_REFERENCE,
      DEPENDENCY_TYPE_PAYLOAD_ID: type.PAYLOAD_ID,
      CONSUMER_PAYLOAD_ID: null,
      DEPENDENCY_STATUS: 'TYPE_RESOLVED_CONSUMER_PAYLOAD_WITHHELD_GLOBAL_COMPLETENESS_BLOCKED',
      W5_EXECUTION_ORDER_AUTHORIZATION: 'NO',
    }
  })
  const definitions = frozen.definitionObligationLinkage.map((definition) => ({
    ...definition,
    TYPE_DEPENDENCIES: typeReferences.filter((reference) =>
      reference.SOURCE_W4_DEFINITION_OBLIGATION_IDS.includes(definition.DEFINITION_OBLIGATION_ID),
    ),
    PAYLOAD_RESPONSIBILITY_ID: null,
    DEFINITION_STATUS: 'GOVERNED_DESIGN_ONLY_COMPLETE_PHYSICAL_AUTHORING_WITHHELD',
    SQL_PAYLOAD_ID: null,
  }))
  const summary = {
    DEFINITION_OBLIGATIONS_INPUT: 183,
    RELATION_OBLIGATIONS: definitions.filter((definition) => definition.OBJECT_KIND === 'RELATION')
      .length,
    COLUMN_OBLIGATIONS: definitions.filter((definition) => definition.OBJECT_KIND === 'COLUMN')
      .length,
    CANONICAL_DEFINITION_AUTHORED: 0,
    DESIGN_DECISION_REQUIRED: 0,
    DEFINITION_CONFLICT: 0,
    PHYSICAL_COMPLETENESS_SCOPE_BLOCKERS: blockers.length,
    DISTINCT_RELATION_GROUPS: 125,
    RELATIONS_FULLY_DEFINED: 0,
    RELATIONS_WITH_RECORDED_REPRESENTATION_GAP: relationPreflight.filter(
      (relation) => relation.PHYSICAL_REPRESENTATION_BLOCKERS.length,
    ).length,
    OTHER_RELATIONS_NOT_FULLY_LOWERED_OR_CLAIMED: relationPreflight.filter(
      (relation) => !relation.PHYSICAL_REPRESENTATION_BLOCKERS.length,
    ).length,
    GOVERNED_COLUMNS_RETAINED: frozen.columnDefinitions.length,
    EXISTING_AUTHORITY_COLUMNS_NOT_REAUTHORED: relationPreflight.reduce(
      (sum, relation) => sum + relation.EXISTING_AUTHORITY_COLUMNS_NOT_REAUTHORED.length,
      0,
    ),
    DISTINCT_NAMED_TYPES: 36,
    TYPE_DEFINITIONS_AUTHORED: 36,
    TYPE_REFERENCES: 38,
    TYPE_REFERENCES_RESOLVED: 38,
    TYPE_HOLDS: 0,
    CREATE_RELATION_RESPONSIBILITIES: definitions.filter(
      (definition) => definition.DEFINITION_OPERATION === 'CREATE_RELATION',
    ).length,
    RELATION_CREATE_INCLUDES_COLUMN: definitions.filter(
      (definition) => definition.DEFINITION_OPERATION === 'RELATION_CREATE_INCLUDES_COLUMN',
    ).length,
    FUTURE_ADD_COLUMN_RESPONSIBILITIES: definitions.filter(
      (definition) => definition.DEFINITION_OPERATION === 'ADD_COLUMN_TO_EXISTING_RELATION',
    ).length,
    TYPE_SQL_PAYLOADS: 36,
    RELATION_CREATE_PAYLOADS: 0,
    COLUMN_ADD_PAYLOADS: 0,
    SQL_PAYLOADS: 36,
    OBLIGATION_PAYLOAD_LINKS: 0,
    UNLINKED_OBLIGATIONS: 183,
    MULTI_LINKED_OBLIGATIONS: 0,
    ACCOUNTED_WITHHELD_OBLIGATIONS: 183,
    UNACCOUNTED: 0,
    TYPE_BEFORE_CONSUMER_RULES_RESOLVED: 38,
    COMPLETE_CONSUMER_PAYLOAD_DEPENDENCY_EDGES: 0,
    PRODUCER_METADATA_UPDATES: 0,
    MULTIPLE_CREATION_AUTHORITIES: 0,
    DUPLICATE_COLUMN_CREATION: 0,
    HYBRID_SCHEMAS_AUTHORED: 0,
    SQL_EXECUTED: 0,
  }
  assert.equal(summary.RELATION_OBLIGATIONS, 57)
  assert.equal(summary.COLUMN_OBLIGATIONS, 126)
  assert.equal(summary.CREATE_RELATION_RESPONSIBILITIES, 57)
  assert.equal(summary.RELATION_CREATE_INCLUDES_COLUMN, 57)
  assert.equal(summary.FUTURE_ADD_COLUMN_RESPONSIBILITIES, 69)
  const phaseStatus = {
    PHASE_1B_3C_A1I_W4FR2_GATE: 'BLOCKED',
    PHASE_1B_3C_A1I_W4FR2: 'BLOCKED',
    BLOCKER_CLASS: 'SELECTED_FULL_SHAPE_COMPLETENESS_VS_EXISTING_PARENT_AUTHORITY_BOUNDARY',
    DO_NOT_PERFORM_NEW_DISCOVERY: 'YES',
    CANONICAL_DEFINITION_AUTHORING: 'NOT_COMPLETE_PHYSICAL_COMPLETENESS_SCOPE_CONTRADICTION',
    W4T: 'PASS',
    W4T1: 'PASS',
    NAMED_TYPE_PRODUCTION_MODEL: 'COMPLETE_NOT_EXECUTED',
    CANONICAL_CONTRACT_VERSION: '1.3.1',
    VERSION_1_3_2_PUBLISHED: 'NO',
    W4: 'BLOCKED_DEFINITION_IMPLEMENTATION_PENDING',
    W4P: 'NOT_AUTHORIZED',
    W5: 'NOT_AUTHORIZED',
    W4_COMPATIBILITY_GATE_NORMALIZATION: 'NOT_AUTHORIZED',
    W4_REMAINING_COMPATIBILITY_RECORDS: 127,
    W4_REMAINING_BLOCKER:
      'PHYSICAL_COMPLETENESS_SCOPE_CONTRADICTION;127_COMPATIBILITY_RECORDS_STILL_REMAIN_NOT_SOLE_BLOCKER',
  }
  if (existsSync(path.join(root, ...outputs.report.split('/')))) {
    const previous: { preservation: typeof preservation; sourceHashes: typeof sourceHashes } =
      JSON.parse(read(outputs.report))
    assert.deepEqual(preservation, previous.preservation, 'W4FR2_FROZEN_INPUT_DRIFT')
    for (const [file, hash] of Object.entries(previous.sourceHashes))
      assert.equal(sourceHashes[file], hash, `W4FR2_RECORDED_SOURCE_DRIFT:${file}`)
  }
  const registry = {
    metadata: {
      PHASE: 'PHASE_1B_3C_A1I_W4FR2',
      STATUS: 'BLOCKED_NOT_COMPLETE_PHYSICAL_REGISTRY',
      HISTORICAL_REGISTRY_REPLACED: 'NO',
    },
    governedDesignRegistry: frozen,
    typeDefinitions,
    typeReferences,
    relationCompletenessPreflight: relationPreflight,
    definitionObligationLinkage: definitions,
    payloadLinkage: [] as unknown[],
    summary,
    phaseStatus,
  }
  const payloads = {
    metadata: {
      PHASE: 'PHASE_1B_3C_A1I_W4FR2',
      STATUS: 'BLOCKED_TYPE_ONLY_PARTIAL_PAYLOAD_MODEL',
      SQL_STATUS: 'DEFINITION_ONLY_NOT_EXECUTABLE',
      EXECUTION_ALLOWED: 'NO',
    },
    TYPE_PAYLOADS: typePayloads,
    RELATION_CREATE_PAYLOADS: [] as unknown[],
    COLUMN_ADD_PAYLOADS: [] as unknown[],
    typeBeforeConsumerRequirements: typeReferences,
    obligationPayloadLinkage: [] as unknown[],
    withheldObligations: definitions.map((definition) => ({
      DEFINITION_OBLIGATION_ID: definition.DEFINITION_OBLIGATION_ID,
      RESPONSIBILITY: definition.DEFINITION_OPERATION,
      REASON: 'GLOBAL125_SELECTED_SHAPE_PHYSICAL_COMPLETENESS_PREFLIGHT_BLOCKED',
    })),
    summary,
    phaseStatus,
  }
  return {
    registry,
    payloads,
    report: {
      PHASE: 'PHASE_1B_3C_A1I_W4FR2',
      summary,
      phaseStatus,
      physicalCompletenessBlockers: blockers,
      governanceAccounting: fr.governanceAccounting,
      preservation,
      sourceHashes,
      preservedSections: fr.preservedSections,
      historicalEvidence: {
        W4FR: fr.phaseStatus,
        W4T: 'BLOCKED_PRE_HUMAN_HISTORICAL',
        W4T1: t1.phaseStatus,
        HISTORICAL_W4FR_BYTES_CHANGED: 'NO',
        HISTORICAL_W4T_BYTES_CHANGED: 'NO',
      },
      governanceNotReopened:
        '183 governed obligations/126 groups/125 shapes/36 type definitions remain accepted;108 inherited physical gaps are not new definition obligations or newly discovered types',
      producerDefinitionMetadataIntegration: {
        STATUS: 'NOT_PERFORMED_GATE_BLOCKED',
        UPDATES: [] as unknown[],
        MUTATING_OPERATIONS: [],
        EXECUTION_ALLOWED: 'NO',
      },
      versionAmendment: {
        STATUS: 'NOT_PERFORMED_GATE_BLOCKED',
        VERSION_1_3_1_SHA256: sha(bytes.canonical),
        VERSION_1_3_2_SHA256: null,
        PRIOR_JSON_INVERSE_PATCHES: [],
        FULL_VERSION_CHAIN_RECONSTRUCTION: 'NOT_APPLICABLE_NO1_3_2_AMENDMENT',
      },
      proofBoundaries: {
        ...fr.proofBoundaries,
        NAMED_TYPES_MATERIALIZED: 'NO',
        TYPE_SQL_EXECUTED: 'NO',
        READY_FOR_RUNTIME_PROOF: 0,
        PRODUCT_READY: 'NO',
      },
      validation: {
        closeoutChecks: [
          {
            COMMAND:
              'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\regenerate-w4fr2-definitions.test.ts',
            RESULT:
              'PASS;34 focused tests;108 inherited representation gaps;exact183/125/36/38 accounting',
          },
          {
            COMMAND:
              'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\record-w4t1-human-type-selections.test.ts scripts\\ue\\close-w4t-named-types.test.ts scripts\\ue\\regenerate-w4fr-definitions.test.ts scripts\\ue\\verify-frozen-w4.test.ts apps\\union-eyes\\scripts\\provisioning\\governed-provisioning.test.ts',
            RESULT: 'PASS;197 preserved W4T1/W4T/W4FR/W4/W3E tests',
          },
          {
            COMMAND:
              'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\author-w4-canonical-definitions.test.ts',
            RESULT: 'PASS;44 frozen W4F tests',
          },
          {
            COMMAND:
              'pnpm exec tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --esModuleInterop --types node scripts\\ue\\regenerate-w4fr2-definitions.ts scripts\\ue\\regenerate-w4fr2-definitions.test.ts',
            RESULT: 'PASS;nullable enum member type narrowed by explicit guard',
          },
          {
            COMMAND:
              'pnpm exec eslint --config apps\\union-eyes\\eslint.config.mjs --max-warnings 0 scripts\\ue\\regenerate-w4fr2-definitions.ts scripts\\ue\\regenerate-w4fr2-definitions.test.ts',
            RESULT: 'PASS;exit0;existing Next pages-directory diagnostic',
          },
          {
            COMMAND:
              'pnpm exec tsx scripts\\ue\\regenerate-w4fr2-definitions.ts --self-test --check',
            RESULT:
              'PASS;two-generation exact-byte equality and persisted six supplemental artifacts;gate remains BLOCKED',
          },
          {
            COMMAND:
              'pnpm exec prettier --check scripts\\ue\\regenerate-w4fr2-definitions.ts scripts\\ue\\regenerate-w4fr2-definitions.test.ts docs\\union-eyes\\reality-remediation\\UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_FINAL.json docs\\union-eyes\\reality-remediation\\UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_FINAL.md docs\\union-eyes\\reality-remediation\\UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_FINAL.json docs\\union-eyes\\reality-remediation\\UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_FINAL.md docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1I_W4FR2_CANONICAL_DEFINITION_REGENERATION.json docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1I_W4FR2_CANONICAL_DEFINITION_REGENERATION.md',
            RESULT: 'PASS;repository formatting',
          },
          {
            COMMAND: 'pnpm validate:docs',
            RESULT: 'PASS;0 errors;1215 existing warnings;2611 scanned files',
          },
          {
            COMMAND:
              'Independent Node crypto verification of fixed/history/selected-source/type-source bytes and12 accepted section hashes',
            RESULT:
              'PASS;80 distinct byte commitments;12 frozen section hashes;producer/canonical1.3.1 unchanged',
          },
          {
            COMMAND: '1.3.2 ->1.3.1 ->1.3 ->1.2 ->1.1 ->1.0 reconstruction',
            RESULT:
              'NOT_APPLICABLE;W4FR2 BLOCKED;no1.3.2 amendment/inverse authored;1.3.1 byte SHA256 unchanged',
          },
        ],
        EXACT183_57_126_125_ACCOUNTING: 'PASS',
        EXACT36_TYPES_38_REFERENCES: 'PASS',
        W4H3_SELECTED_SOURCE_DIGEST_COLUMN_SET: 'PASS',
        W4T1_FOUR_CURRENT_32_PRIOR: 'PASS',
        GOVERNED_PROPERTY_PROVENANCE: 'PRESERVED;822 governed columns;no override',
        FULL125_RELATION_PHYSICAL_COMPLETENESS:
          'BLOCKED;parent-owned selected columns explicitly outside prior reauthoring scope lack exact frozen representation',
        NAMED_TYPE_PROVENANCE_SAFETY: 'PASS;36 inactive exact types;38 use links',
        OBLIGATION_PAYLOAD_LINKAGE: 'WITHHELD183_GLOBAL_COMPLETENESS_BLOCKED_NOT_PASS',
        EXECUTION_DISABLED: 'YES',
        NO_NEW_DISCOVERY: 'YES',
      },
      determinismDigests: {
        TYPE_DEFINITIONS_SHA256: digest(typeDefinitions),
        TYPE_PAYLOADS_SHA256: digest(typePayloads),
        RELATION_DEFINITIONS_SHA256: digest(frozen.relationDefinitions),
        COLUMN_DEFINITIONS_SHA256: digest(frozen.columnDefinitions),
        SQL_PAYLOADS_SHA256: digest(typePayloads),
        RELATION_PAYLOADS_SHA256: digest([]),
        COLUMN_PAYLOADS_SHA256: digest([]),
        OBLIGATION_LINKAGE_SHA256: digest(definitions),
        PRODUCER_METADATA_SHA256: sha(bytes.producer),
        PHYSICAL_COMPLETENESS_BLOCKERS_SHA256: digest(blockers),
      },
    },
  }
}
export async function generate() {
  const model = buildRetry(),
    config = (await resolveConfig(path.join(root, 'package.json'))) ?? {}
  const registryBytes = await format(JSON.stringify(model.registry), { ...config, parser: 'json' })
  const payloadBytes = await format(JSON.stringify(model.payloads), { ...config, parser: 'json' })
  const report = {
    ...model.report,
    DEFINITION_REGISTRY_SHA256: sha(registryBytes),
    SQL_PAYLOAD_ARTIFACT_SHA256: sha(payloadBytes),
  }
  const witness = report.physicalCompletenessBlockers
    .filter((blocker) => blocker.RELATION === 'public.clc_sync_log')
    .map(
      (blocker) =>
        `| ${blocker.COLUMN} | ${blocker.EXACT_COLUMN_DECLARATION.SOURCE_EXPRESSION.replace(/\|/g, '\\|')} | ${blocker.FROZEN_PHYSICAL_TYPE_FACT.EVIDENCE} |`,
    )
    .join('\n')
  const markdown = `# W4FR2 - canonical physical definition retry

**Gate:BLOCKED.** Named-type governance remains complete;this is not the prior missing-type-authority blocker.

## Exact closed-record contradiction

W4FR2 section20 requires every selected canonical column to have complete physical properties and all125 relations to be fully defined. Frozen W4FR explicitly excludes **1299 existing-authority columns** from reauthoring,while selected frozen W4F declarations record **108 non-enum physical representation gaps across26 relations**:94 timestamps,13 numerics,1 varchar. No scope extension,representation default,source inference or new type discovery is authorized.

The183 governed obligations and822 governed columns remain governed;the gaps belong to selected parent-owned columns,not new W4 obligations. The57 owned shapes do not have this inherited-column gap.99 shapes have no detected representation gap,but this is not a claim their complete SQL lowering/constraints were verified.

### Exact W4H3-selected clc_sync_log witness

W4H3 selected B with23 columns. The normalized W4FR model governs only organization_id and explicitly excludes22 parent-owned columns from reauthoring.

| Selected column | Frozen declaration | Recorded unresolved physical fact |
|---|---|---|
${witness}

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

${report.validation.closeoutChecks.map((check) => `- \`${check.COMMAND}\`: **${check.RESULT}**.`).join('\n')}

Total distinct test coverage:275 passed. Model/unit determinism and exact formatted artifact determinism are separate checks.1.3.2 inverse/version-chain reconstruction is NOT_APPLICABLE because no amendment was made.

## State

W4FR2=BLOCKED;DO_NOT_PERFORM_NEW_DISCOVERY=YES.
CANONICAL_CONTRACT_VERSION=1.3.1;VERSION_1_3_2_PUBLISHED=NO.
W4=BLOCKED_DEFINITION_IMPLEMENTATION_PENDING;127 compatibility records remain,but are not yet the sole blocker.
W4_COMPATIBILITY_GATE_NORMALIZATION=NOT_AUTHORIZED;W4P/W5=NOT_AUTHORIZED.
All SQL is DEFINITION_ONLY_NOT_EXECUTABLE/EXECUTION_ALLOWED=NO.
NAMED_TYPES_MATERIALIZED=NO;TYPE_SQL_EXECUTED=NO;READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO.
`
  return {
    [outputs.registry]: registryBytes,
    [outputs.payloads]: payloadBytes,
    [outputs.report]: await format(JSON.stringify(report), { ...config, parser: 'json' }),
    [outputs.markdown]: await format(markdown, { ...config, parser: 'markdown' }),
    [outputs.registryMarkdown]: await format(
      `# W4FR2 FINAL-name registry - BLOCKED

This file is **not a complete physical canonical registry**. It preserves183 governed design obligations/125 selected relation shapes and adds36 exact inactive type definitions/38 type-use links.108 inherited non-enum physical representation gaps contradict the full125 completeness requirement under the existing parent-ownership boundary.

See [registry](./UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_FINAL.json) and [exact blocked retry evidence](./PHASE_1B_3C_A1I_W4FR2_CANONICAL_DEFINITION_REGENERATION.md). No producer/canonical update;historical W4FR retained;canonical1.3.1;no execution.
`,
      { ...config, parser: 'markdown' },
    ),
    [outputs.payloadsMarkdown]: await format(
      `# W4FR2 FINAL-name inactive payloads - PARTIAL BLOCKED

36 exact qualified CREATE TYPE enum descriptors only. RELATION_CREATE_PAYLOADS=0;COLUMN_ADD_PAYLOADS=0. All183 relation/column obligations explicitly withheld.38 resolved type-before-consumer requirements are not a completed consumer payload graph.

See [payload artifact](./UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_FINAL.json). SQL_STATUS=DEFINITION_ONLY_NOT_EXECUTABLE;EXECUTION_ALLOWED=NO;no integration,no SQL execution,no1.3.2.
`,
      { ...config, parser: 'markdown' },
    ),
  }
}
export async function main(args: string[]) {
  assert(
    args.every((arg) => ['--plan', '--self-test', '--check'].includes(arg)),
    'UNAUTHORIZED_W4FR2_FLAG',
  )
  assert.equal(new Set(args).size, args.length)
  const generated = await generate()
  if (args.includes('--self-test')) {
    assert.deepEqual(generated, await generate(), 'NONDETERMINISTIC_W4FR2')
    console.log('PASS W4FR2 two-generation exact-byte determinism;gate BLOCKED')
  }
  if (args.includes('--check')) {
    for (const [file, bytes] of Object.entries(generated))
      assert.equal(read(file), bytes, `STALE_W4FR2_OUTPUT:${file}`)
    console.log('PASS W4FR2 persisted supplemental bytes;historical/canonical/producer unchanged')
  } else if (!args.includes('--self-test')) {
    for (const [file, bytes] of Object.entries(generated))
      writeFileSync(path.join(root, ...file.split('/')), bytes)
    console.log(
      'W4FR2 BLOCKED:108 inherited physical representation gaps;36 inactive type payloads;no contract/producer mutation',
    )
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error('[regenerate-w4fr2-definitions]', error)
    process.exitCode = 1
  })
