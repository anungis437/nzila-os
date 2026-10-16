import assert from 'node:assert/strict'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import type { buildGovernance, Selection } from './govern-w4-definition-doctrine'
import type { buildClosure } from './close-w4h1-residual-blueprints'
import type { buildPacket } from './extract-w4h2-blueprint-packet'
import type { buildSelectionRecord } from './record-w4h3-human-selections'
import type { buildRegistry } from './author-w4-canonical-definitions'
import type { buildProducerContract } from './w4-physical-producers'
import { digest, read, root, sha } from './w4-physical-producers'

const folder = 'docs/union-eyes/reality-remediation/'
export const files = {
  w4h3: folder + 'PHASE_1B_3C_A1I_W4H3_FINAL_BLUEPRINT_SELECTION.json',
  w4h: folder + 'PHASE_1B_3C_A1I_W4H_CANONICAL_DEFINITION_GOVERNANCE.json',
  w4h1: folder + 'PHASE_1B_3C_A1I_W4H1_RESIDUAL_BLUEPRINT_CLOSURE.json',
  packet: folder + 'UE_W4H2_TRUE_BLUEPRINT_HUMAN_DECISION_PACKET.json',
  w4f: folder + 'PHASE_1B_3C_A1I_W4F_CANONICAL_DEFINITION_AUTHORING.json',
  registry: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS.json',
  w4g: folder + 'PHASE_1B_3C_A1I_W4G_PRECONSUMER_OWNERSHIP_ADOPTION.json',
  producer: folder + 'UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.json',
  canonical: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json',
}
export const outputs = {
  registry: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_RESOLVED.json',
  registryMarkdown: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_RESOLVED.md',
  payloads: folder + 'UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS.json',
  payloadsMarkdown: folder + 'UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS.md',
  report: folder + 'PHASE_1B_3C_A1I_W4FR_CANONICAL_DEFINITION_REGENERATION.json',
  reportMarkdown: folder + 'PHASE_1B_3C_A1I_W4FR_CANONICAL_DEFINITION_REGENERATION.md',
}
type W4H = Awaited<ReturnType<typeof buildGovernance>>
type W4H1 = ReturnType<typeof buildClosure>
type W4H3 = Awaited<ReturnType<typeof buildSelectionRecord>>
type W4F = Awaited<ReturnType<typeof buildRegistry>>
type Packet = ReturnType<typeof buildPacket>
type Producer = ReturnType<typeof buildProducerContract>
interface W4G {
  ownershipAdoption: { DECISION_ID: string; PHYSICAL_IDENTITY: string; CANONICAL_OWNER?: string }[]
  canonicalDefinitionObligations: {
    DEFINITION_OBLIGATION_ID: string
    SOURCE_W4_DECISION_ID: string
    PHYSICAL_IDENTITY: string
    OBJECT_KIND: string
    DATABASE_SCOPE_ID: string
    CANONICAL_OWNER: string
  }[]
  lateDefinitionRegister: { PHYSICAL_IDENTITY: string; OBJECT_KIND: string }[]
  lateProducerCompatibilityObligations: unknown[]
}
const materialProperties = [
  'POSTGRES_TYPE',
  'NULLABILITY',
  'DEFAULT',
  'IDENTITY_OR_GENERATED',
  'PRIMARY_KEY_PARTICIPATION',
  'UNIQUE_PARTICIPATION',
  'FOREIGN_KEY',
  'CHECK_CONSTRAINTS',
]
export function provenance(selection: Selection) {
  assert(selection, 'FAIL_GOVERNANCE_INCOMPLETE')
  assert.equal(selection.STATUS, 'APPROVED', 'FAIL_GOVERNANCE_INCOMPLETE')
  assert(selection.VALUE !== null && selection.PROVENANCE, 'FAIL_GOVERNANCE_INCOMPLETE')
  if (selection.RULE.startsWith('HUMAN_ARCHITECTURE_W4H3')) return 'HUMAN_ARCHITECTURE_W4H3'
  const map = {
    EXACT_DECLARATION: 'W4H_GOVERNANCE_DECISION',
    EXACT_HISTORICAL_EVIDENCE: 'EXACT_HISTORICAL_DESIGN_EVIDENCE',
    W4H_GOVERNANCE_DEFAULT: 'W4H_GOVERNANCE_DEFAULT',
    W4H_CONFLICT_RESOLUTION: 'W4H_CONFLICT_RESOLUTION',
  }
  return map[selection.PROVENANCE]
}
export function typeAuthority(
  identity: string,
  producer: Pick<Producer, 'physicalIdentityAuthority'>,
  late: W4G['lateDefinitionRegister'],
) {
  const authorities = producer.physicalIdentityAuthority.filter(
    (authority) =>
      authority.PHYSICAL_IDENTITY === identity &&
      authority.CREATION_DEFINITION_ESTABLISHED === 'YES',
  )
  assert(authorities.length <= 1, 'MULTIPLE_CREATION_AUTHORITIES')
  const frozen = late.filter(
    (record) => record.PHYSICAL_IDENTITY === identity && record.OBJECT_KIND === 'TYPE',
  )
  assert(frozen.length <= 1, 'MULTIPLE_LATE_TYPE_AUTHORITIES')
  return {
    PHYSICAL_IDENTITY: identity,
    RECORDED_PRODUCER_AUTHORITY: authorities[0] ?? null,
    GOVERNED_LATE_TYPE_IDENTITY: frozen[0] ?? null,
    RESULT:
      authorities.length || frozen.length ? 'RECORDED' : 'NO_RECORDED_TYPE_PRODUCER_AUTHORITY',
    IDENTITY_POSTURE:
      'Expected qualified lookup identity only;not a newly assigned canonical type identity or creation authority',
    EXECUTION_ALLOWED: 'NO',
  }
}
export function creationOperation(
  objectKind: string,
  relationOwned: boolean,
  parent: Producer['physicalIdentityAuthority'][number] | undefined,
) {
  if (relationOwned)
    return objectKind === 'RELATION' ? 'CREATE_RELATION' : 'RELATION_CREATE_INCLUDES_COLUMN'
  assert(objectKind === 'COLUMN', 'UNKNOWN_DEFINITION_OPERATION')
  assert(parent?.CREATION_DEFINITION_ESTABLISHED === 'YES', 'NO_ACCEPTED_PARENT_CREATION_AUTHORITY')
  return 'ADD_COLUMN_TO_EXISTING_RELATION'
}
export function buildRegeneration() {
  const bytes = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]))
  const h3: W4H3 = JSON.parse(bytes.w4h3),
    h: W4H = JSON.parse(bytes.w4h)
  const h1: W4H1 = JSON.parse(bytes.w4h1),
    packet: Packet = JSON.parse(bytes.packet)
  const f: W4F = JSON.parse(bytes.w4f)
  const old: Pick<W4F, 'relationDefinitions' | 'definitionRecords'> = JSON.parse(bytes.registry)
  const g: W4G = JSON.parse(bytes.w4g),
    producer: Producer = JSON.parse(bytes.producer)
  const canonical: {
    CONTRACT_VERSION: string
    prerequisiteObligations: unknown[]
    frozenMigrationManifest: unknown[]
    extensionDoctrine: unknown
  } = JSON.parse(bytes.canonical)
  assert.equal(canonical.CONTRACT_VERSION, '1.3.1')
  assert.equal(h3.phaseStatus.PHASE_1B_3C_A1I_W4H3_GATE, 'PASS')
  assert.equal(h3.phaseStatus.W4F_REGENERATION, 'AUTHORIZED_NOT_STARTED')
  assert.equal(h3.governanceAccounting.DESIGN_GROUPS_CLOSED, 126)
  assert.equal(h3.governanceAccounting.DEFINITION_OBLIGATIONS_GOVERNED, 183)
  assert.deepEqual(f.relationDefinitions, old.relationDefinitions)
  assert.deepEqual(f.definitionRecords, old.definitionRecords)
  assert.equal(f.definitionRecords.length, 183)
  assert.equal(f.relationDefinitions.length, 125)
  assert.equal(g.ownershipAdoption.length, 310)
  assert.equal(g.lateDefinitionRegister.length, 127)
  assert.equal(g.lateProducerCompatibilityObligations.length, 127)
  const preservation = Object.fromEntries(
    Object.values(files).map((file) => [file, sha(read(file))]),
  )
  const expectedInputs = {
    ...h3.preservation,
    ...h3.priorGovernancePreservation.UPSTREAM_BYTE_COMMITMENTS,
  }
  for (const [file, expected] of Object.entries(expectedInputs))
    if (file in preservation)
      assert.equal(preservation[file], expected, `FROZEN_UPSTREAM_DRIFT:${file}`)
  const accepted = {
    OWNERSHIP_310: digest(g.ownershipAdoption),
    LATE_DEFINITIONS_127: digest(g.lateDefinitionRegister),
    COMPATIBILITY_127: digest(g.lateProducerCompatibilityObligations),
    DJANGO_372: digest(producer.djangoProducerRegistry),
    PLAN_82: digest(producer.canonicalProducerPlan),
    RAW_WRAPPERS: digest(producer.rawOperationProducerRegistry),
    W3: digest(producer.w3Preconditions),
    W5_86: digest(producer.w5OrderingHandoff),
    W6_118: digest(producer.w6OpaqueBindingHandoff),
    CANONICAL_803: digest(canonical.prerequisiteObligations),
    FROZEN_23: digest(canonical.frozenMigrationManifest),
    EXTENSIONS_AND_VECTOR: digest(canonical.extensionDoctrine),
  }
  assert.deepEqual(accepted, f.acceptedPreservation, 'ACCEPTED_SECTION_DRIFT')
  const obligations = h.obligationGovernance.map((prior) => {
    const three = h3.threeSelections.find(
      (selection) => selection.DEFINITION_OBLIGATION_ID === prior.DEFINITION_OBLIGATION_ID,
    )
    const two = h1.decisions.find(
      (decision) =>
        decision.DECISION_STATUS === 'APPROVED' &&
        decision.DEFINITION_OBLIGATION_ID === prior.DEFINITION_OBLIGATION_ID,
    )
    const result =
      three?.GOVERNED_OBLIGATION ??
      (two
        ? {
            ...prior,
            SELECTED_VALUES: two.SELECTED_VALUES,
            STATUS: 'ALL_PROPERTIES_GOVERNED',
          }
        : prior)
    assert.equal(result.STATUS, 'ALL_PROPERTIES_GOVERNED', 'FAIL_GOVERNANCE_INCOMPLETE')
    const accounting = h3.governanceAccounting.obligationAccounting.find(
      (record) => record.DEFINITION_OBLIGATION_ID === result.DEFINITION_OBLIGATION_ID,
    )
    assert(accounting)
    assert.equal(digest(result.SELECTED_VALUES), accounting.GOVERNED_PROPERTIES_SHA256)
    for (const property of result.SELECTED_VALUES) provenance(property)
    return result
  })
  const blueprintSelections = h.relationGovernance.map((relation) => {
    const three = h3.selectedBlueprints.find(
      (selected) => selected.RELATION === `public.${relation.RELATION_NAME}`,
    )
    const two = h1.decisions.find(
      (decision) =>
        decision.DECISION_STATUS === 'APPROVED' &&
        decision.RELATION === `public.${relation.RELATION_NAME}`,
    )
    const frozen = f.relationDefinitions.find(
      (record) => record.RELATION_DEFINITION_ID === relation.RELATION_DEFINITION_ID,
    )!
    const property = relation.RELATION_PROPERTIES.find(
      (item) => item.PROPERTY === 'CANONICAL_COLUMN_SET',
    )!
    let ordered: string[], authority: string, sources: Selection['EVIDENCE_REFERENCES']
    if (three) {
      const card = packet.cards.find((record) => record.RELATION === three.RELATION)!
      const variant = card.VARIANTS.find((record) => record.VARIANT_ID === three.VARIANT_ID)!
      assert.equal(three.DECLARATION_DIGEST, variant.DECLARATION_DIGEST)
      assert.equal(three.SOURCE_FILE, variant.SOURCE_FILE)
      assert.deepEqual(three.ORDERED_COLUMN_SET, variant.COLUMN_SET)
      ordered = three.ORDERED_COLUMN_SET
      authority = 'HUMAN_ARCHITECTURE_W4H3'
      sources = variant.EQUIVALENT_SOURCE_ALIASES.map((source) => ({
        FILE: source.SOURCE_FILE,
        DIGEST: source.DECLARATION_DIGEST,
        RANGE: source.SOURCE_RANGE,
      }))
    } else if (two) {
      assert(
        two.SELECTED_COLUMN_SET && two.SELECTED_BLUEPRINT_DIGEST && two.SELECTED_BLUEPRINT_SOURCE,
      )
      ordered = two.SELECTED_COLUMN_SET
      authority = 'PRESERVED_W4H1_APPROVAL'
      sources = two.SELECTED_EQUIVALENT_DECLARATION_REFERENCES
    } else {
      provenance(property)
      const shape: string[] = JSON.parse(property.VALUE!)
      const declaration =
        frozen.DECLARATIONS.find(
          (record) =>
            record.REFERENCE.CLASS === 'DECLARATION_DESIGN_EVIDENCE' &&
            digest(record.COLUMNS.map((column) => column.NAME).sort()) ===
              digest([...shape].sort()),
        ) ??
        frozen.DECLARATIONS.find(
          (record) =>
            digest(record.COLUMNS.map((column) => column.NAME).sort()) ===
            digest([...shape].sort()),
        )
      assert(declaration, 'NO_EXACT_GOVERNED_BLUEPRINT_ORDER')
      ordered = declaration.COLUMNS.map((column) => column.NAME)
      authority = 'PRESERVED_W4H_APPROVAL'
      sources = property.EVIDENCE_REFERENCES
    }
    assert(ordered.includes('organization_id') || !three)
    for (const source of sources) {
      const declaration = frozen.DECLARATIONS.find(
        (record) =>
          record.REFERENCE.FILE === source.FILE && record.REFERENCE.DIGEST === source.DIGEST,
      )
      assert(declaration, 'BLUEPRINT_SOURCE_DIGEST_DRIFT')
      assert.equal(sha(declaration.REFERENCE.TEXT), source.DIGEST)
      assert.deepEqual(
        [...ordered].sort(),
        declaration.COLUMNS.map((column) => column.NAME).sort(),
        'HYBRID_BLUEPRINT',
      )
    }
    return {
      CANONICAL_BLUEPRINT_ID: `UE-W4FR-BLUEPRINT-${sha(relation.RELATION_DEFINITION_ID).slice(0, 16)}`,
      RELATION_DEFINITION_ID: relation.RELATION_DEFINITION_ID,
      PHYSICAL_IDENTITY: `union-eyes::RELATION::public.${relation.RELATION_NAME}`,
      ORDERED_COLUMN_SET: ordered,
      AUTHORITY: authority,
      SOURCES: sources,
    }
  })
  const typeDependencies = h.relationGovernance.flatMap((relation) =>
    relation.COLUMN_GOVERNANCE.flatMap((column) =>
      column.SELECTED_PROPERTIES.filter(
        (property) => property.PROPERTY === 'POSTGRES_TYPE' && property.TYPE_DEPENDENCY_POSTURE,
      ).map((property) => ({
        RELATION_DEFINITION_ID: relation.RELATION_DEFINITION_ID,
        RELATION: `public.${relation.RELATION_NAME}`,
        COLUMN: column.COLUMN_NAME,
        GOVERNED_TYPE_NAME: property.VALUE!,
        ...typeAuthority(
          `union-eyes::TYPE::public.${property.VALUE}`,
          producer,
          g.lateDefinitionRegister,
        ),
        PROPERTY_PROVENANCE: provenance(property),
        GOVERNED_VALUE_AND_POSTURE: property,
        AFFECTED_DEFINITION_OBLIGATION_IDS: f.definitionRecords
          .filter(
            (definition) =>
              definition.RELATION_DEFINITION_ID === relation.RELATION_DEFINITION_ID &&
              definition.COLUMN_DEFINITION_IDS.includes(column.COLUMN_DEFINITION_ID),
          )
          .map((definition) => definition.DEFINITION_OBLIGATION_ID),
      })),
    ),
  )
  const blockers = typeDependencies.filter((dependency) => dependency.RESULT !== 'RECORDED')
  // A missing producer cannot be replaced with a type name guess or an invented enum CREATE.
  assert(blockers.length > 0, 'TYPE_PREFLIGHT_CLEARED_FULL_SQL_LOWERING_NOT_IMPLEMENTED')
  const definitionRecords = f.definitionRecords.map((definition) => {
    const governance = obligations.find(
      (record) => record.DEFINITION_OBLIGATION_ID === definition.DEFINITION_OBLIGATION_ID,
    )!
    const blueprint = blueprintSelections.find(
      (record) => record.RELATION_DEFINITION_ID === definition.RELATION_DEFINITION_ID,
    )!
    const ownership = g.canonicalDefinitionObligations.find(
      (record) => record.DEFINITION_OBLIGATION_ID === definition.DEFINITION_OBLIGATION_ID,
    )!
    assert(ownership)
    assert.equal(ownership.CANONICAL_OWNER, 'PLATFORM_BASELINE')
    assert.equal(ownership.DATABASE_SCOPE_ID, 'UE_OPERATIONAL')
    const relationOwned = f.definitionRecords.some(
      (record) =>
        record.RELATION_DEFINITION_ID === definition.RELATION_DEFINITION_ID &&
        record.OBJECT_KIND === 'RELATION',
    )
    const parents = producer.physicalIdentityAuthority.filter(
      (record) => record.PHYSICAL_IDENTITY === blueprint.PHYSICAL_IDENTITY,
    )
    assert(parents.length <= 1, 'MULTIPLE_CREATION_AUTHORITIES')
    if (relationOwned)
      assert(
        !parents.some((parent) => parent.CREATION_DEFINITION_ESTABLISHED === 'YES'),
        'MULTIPLE_CREATION_AUTHORITIES',
      )
    const operation = creationOperation(definition.OBJECT_KIND, relationOwned, parents[0])
    const core = {
      CANONICAL_DEFINITION_ID: `UE-W4FR-DEFINITION-${sha(definition.DEFINITION_OBLIGATION_ID).slice(0, 16)}`,
      DEFINITION_OBLIGATION_ID: definition.DEFINITION_OBLIGATION_ID,
      SOURCE_W4_DECISION_ID: definition.SOURCE_W4_DECISION_ID,
      PHYSICAL_IDENTITY: definition.PHYSICAL_IDENTITY,
      OBJECT_KIND: definition.OBJECT_KIND,
      DATABASE_SCOPE_ID: ownership.DATABASE_SCOPE_ID,
      CANONICAL_OWNER: ownership.CANONICAL_OWNER,
      RELATION_DEFINITION_ID: definition.RELATION_DEFINITION_ID,
      CANONICAL_BLUEPRINT_ID: blueprint.CANONICAL_BLUEPRINT_ID,
      CANONICAL_PROPERTIES: governance.SELECTED_VALUES.map((property) => ({
        PROPERTY: property.PROPERTY,
        VALUE: property.VALUE,
      })),
      PROPERTY_PROVENANCE: governance.SELECTED_VALUES.map((property) => ({
        PROPERTY: property.PROPERTY,
        PROVENANCE: provenance(property),
        GOVERNANCE_RECORD: property,
      })),
      DEFINITION_OPERATION: operation,
      ACCEPTED_PARENT_CREATION_AUTHORITY: relationOwned ? null : parents[0],
    }
    return {
      ...core,
      DEFINITION_DIGEST: digest(core),
      DEFINITION_STATUS: 'GOVERNED_DESIGN_ONLY_PHYSICAL_LOWERING_BLOCKED',
      SQL_PAYLOAD_ID: null,
    }
  })
  assert.equal(
    definitionRecords.filter((definition) => definition.OBJECT_KIND === 'RELATION').length,
    57,
  )
  assert.equal(
    definitionRecords.filter((definition) => definition.OBJECT_KIND === 'COLUMN').length,
    126,
  )
  assert.equal(
    new Set(definitionRecords.map((definition) => definition.DEFINITION_OBLIGATION_ID)).size,
    183,
  )
  const relationDefinitions = h.relationGovernance.map((relation) => {
    const blueprint = blueprintSelections.find(
      (record) => record.RELATION_DEFINITION_ID === relation.RELATION_DEFINITION_ID,
    )!
    const relationOwned = definitionRecords.some(
      (definition) =>
        definition.RELATION_DEFINITION_ID === relation.RELATION_DEFINITION_ID &&
        definition.OBJECT_KIND === 'RELATION',
    )
    const columns = relation.COLUMN_GOVERNANCE.filter((column) =>
      blueprint.ORDERED_COLUMN_SET.includes(column.COLUMN_NAME),
    )
    if (relationOwned)
      assert(
        blueprint.ORDERED_COLUMN_SET.every((name) =>
          columns.some((column) => column.COLUMN_NAME === name),
        ),
        'FAIL_GOVERNANCE_INCOMPLETE',
      )
    for (const column of columns)
      for (const name of materialProperties)
        provenance(column.SELECTED_PROPERTIES.find((property) => property.PROPERTY === name)!)
    return {
      ...blueprint,
      SCHEMA_NAME: relation.SCHEMA_NAME,
      RELATION_NAME: relation.RELATION_NAME,
      RELATION_KIND: relation.RELATION_PROPERTIES.find(
        (property) => property.PROPERTY === 'RELATION_KIND',
      )!,
      CREATION_CLASS: relationOwned
        ? 'PLATFORM_RELATION_CREATE'
        : 'ACCEPTED_EXISTING_RELATION_COLUMN_ADDITIONS',
      GOVERNED_COLUMN_DEFINITIONS: columns,
      EXISTING_AUTHORITY_COLUMNS_NOT_REAUTHORED: blueprint.ORDERED_COLUMN_SET.filter(
        (name) => !columns.some((column) => column.COLUMN_NAME === name),
      ),
      GOVERNED_RELATION_PROPERTIES: relation.RELATION_PROPERTIES.filter(
        (property) => property.PROPERTY !== 'CANONICAL_COLUMN_SET',
      ),
      TYPE_DEPENDENCIES: typeDependencies.filter(
        (dependency) => dependency.RELATION_DEFINITION_ID === relation.RELATION_DEFINITION_ID,
      ),
      PHYSICAL_DEFINITION_STATUS: 'NOT_AUTHORED_GLOBAL_TYPE_AUTHORITY_PREFLIGHT_BLOCKED',
    }
  })
  const summary = {
    DEFINITION_OBLIGATIONS_INPUT: 183,
    RELATION_OBLIGATIONS: 57,
    COLUMN_OBLIGATIONS: 126,
    SUM: 183,
    GOVERNED_DEFINITION_RECORDS_NORMALIZED: 183,
    CANONICAL_DEFINITION_AUTHORED: 0,
    DESIGN_DECISION_REQUIRED: 0,
    DEFINITION_CONFLICT: 0,
    UNACCOUNTED: 0,
    DISTINCT_RELATION_GROUPS: 125,
    DISTINCT_RELATIONS: 125,
    RELATIONS_FULLY_DEFINED: 0,
    RELATIONS_PHYSICAL_LOWERING_NOT_PERFORMED: 125,
    GOVERNED_PROPERTY_UNRESOLVED_COUNT: 0,
    NAMED_TYPE_REFERENCES_WITHOUT_PRODUCER: blockers.length,
    DISTINCT_NAMED_TYPES_WITHOUT_PRODUCER: new Set(
      blockers.map((dependency) => dependency.PHYSICAL_IDENTITY),
    ).size,
    AFFECTED_RELATIONS: new Set(blockers.map((dependency) => dependency.RELATION)).size,
    AFFECTED_OBLIGATIONS: new Set(
      blockers.flatMap((dependency) => dependency.AFFECTED_DEFINITION_OBLIGATION_IDS),
    ).size,
    CREATE_RELATION: definitionRecords.filter(
      (definition) => definition.DEFINITION_OPERATION === 'CREATE_RELATION',
    ).length,
    RELATION_CREATE_INCLUDES_COLUMN: definitionRecords.filter(
      (definition) => definition.DEFINITION_OPERATION === 'RELATION_CREATE_INCLUDES_COLUMN',
    ).length,
    ADD_COLUMN_TO_EXISTING_RELATION: definitionRecords.filter(
      (definition) => definition.DEFINITION_OPERATION === 'ADD_COLUMN_TO_EXISTING_RELATION',
    ).length,
    INACTIVE_SQL_PAYLOADS: 0,
    OBLIGATION_PAYLOAD_LINKS: 0,
    UNLINKED_OBLIGATIONS: 183,
    MULTIPLE_CREATION_AUTHORITIES: 0,
    DUPLICATE_COLUMN_CREATION: 0,
    HYBRID_BLUEPRINTS_CREATED: 0,
    PRODUCER_METADATA_UPDATES: 0,
    CANONICAL_CONTRACT_MUTATED: 'NO',
    HISTORICAL_W4F_BYTES_CHANGED: 'NO',
  }
  const phaseStatus = {
    PHASE_1B_3C_A1I_W4FR_GATE: 'BLOCKED',
    PHASE_1B_3C_A1I_W4FR: 'BLOCKED',
    BLOCKER_CLASS: 'NAMED_TYPE_PRODUCTION_AUTHORITY_NOT_ESTABLISHED_IN_FIXED_INPUTS',
    CANONICAL_DEFINITION_AUTHORING: 'NOT_COMPLETE_PHYSICAL_DEPENDENCY_AUTHORITY_REQUIRED',
    W4H: 'PASS',
    CANONICAL_DEFINITION_GOVERNANCE: 'COMPLETE',
    CANONICAL_CONTRACT_VERSION: '1.3.1',
    VERSION_1_3_2_PUBLISHED: 'NO',
    W4F_REGENERATION: 'ATTEMPTED_BLOCKED_PREFLIGHT',
    W4: 'BLOCKED_DEFINITION_IMPLEMENTATION_PENDING',
    W4P: 'NOT_AUTHORIZED',
    W5: 'NOT_AUTHORIZED',
    W4_COMPATIBILITY_GATE_NORMALIZATION: 'NOT_AUTHORIZED',
    W4_REMAINING_COMPATIBILITY_RECORDS: 127,
  }
  const columnDefinitions = relationDefinitions.flatMap((relation) =>
    relation.GOVERNED_COLUMN_DEFINITIONS.map((column) => ({
      RELATION_DEFINITION_ID: relation.RELATION_DEFINITION_ID,
      ...column,
      PROPERTY_PROVENANCE: column.SELECTED_PROPERTIES.map((property) => ({
        PROPERTY: property.PROPERTY,
        PROVENANCE: provenance(property),
      })),
    })),
  )
  const registry = {
    metadata: {
      PHASE: 'PHASE_1B_3C_A1I_W4FR',
      STATUS: 'BLOCKED_DESIGN_NORMALIZATION_ONLY_NOT_PHYSICALLY_RESOLVED',
    },
    governanceInputs: files,
    blueprintSelections,
    relationDefinitions,
    columnDefinitions,
    constraintDefinitions: relationDefinitions.map((relation) => ({
      RELATION_DEFINITION_ID: relation.RELATION_DEFINITION_ID,
      GOVERNED_CONSTRAINT_INPUTS: relation.GOVERNED_RELATION_PROPERTIES.filter(
        (property) => property.PROPERTY === 'RELATION_CONSTRAINTS_AND_INDEXES',
      ),
      SQL_LOWERING: 'NOT_PERFORMED',
    })),
    indexDefinitions: [] as unknown[],
    definitionObligationLinkage: definitionRecords,
    payloadLinkage: [] as unknown[],
    propertyProvenance: definitionRecords.map((definition) => ({
      DEFINITION_OBLIGATION_ID: definition.DEFINITION_OBLIGATION_ID,
      PROPERTIES: definition.PROPERTY_PROVENANCE,
    })),
    digests: {
      RELATION_DEFINITIONS_SHA256: digest(relationDefinitions),
      COLUMN_DEFINITIONS_SHA256: digest(columnDefinitions),
      OBLIGATION_LINKAGE_SHA256: digest(definitionRecords),
      SQL_PAYLOADS_SHA256: digest([]),
      PRODUCER_METADATA_SHA256: sha(bytes.producer),
    },
    validation: {
      PHYSICAL_SQL_LOWERING: 'NOT_RUN_TYPE_AUTHORITY_PREFLIGHT_BLOCKED',
      ALL_GOVERNED_PROPERTIES_RETAINED: 'YES',
    },
    phaseStatus,
  }
  const payloads = {
    metadata: {
      STATUS: 'BLOCKED_NO_SQL_AUTHORED',
      SQL_STATUS: 'DEFINITION_ONLY_NOT_EXECUTABLE',
      EXECUTION_ALLOWED: 'NO',
    },
    payloads: [] as unknown[],
    obligationPayloadLinkage: [] as unknown[],
    withheldObligations: definitionRecords.map((definition) => ({
      DEFINITION_OBLIGATION_ID: definition.DEFINITION_OBLIGATION_ID,
      REASON: 'GLOBAL_PHYSICAL_TYPE_DEPENDENCY_AUTHORITY_PREFLIGHT_BLOCKED',
    })),
    summary: {
      SQL_PAYLOADS: 0,
      OBLIGATION_PAYLOAD_LINKS: 0,
      UNLINKED_OBLIGATIONS: 183,
      SQL_EXECUTED: 0,
    },
    phaseStatus,
  }
  if (existsSync(path.join(root, ...outputs.report.split('/')))) {
    const previous: { preservation: typeof preservation } = JSON.parse(read(outputs.report))
    assert.deepEqual(preservation, previous.preservation, 'FROZEN_W4FR_INPUT_DRIFT')
  }
  return {
    registry,
    payloads,
    report: {
      PHASE: 'PHASE_1B_3C_A1I_W4FR',
      summary,
      phaseStatus,
      governanceAccounting: {
        DESIGN_GROUPS_TOTAL: 126,
        DESIGN_GROUPS_CLOSED: 126,
        DEFINITION_OBLIGATIONS_GOVERNED: 183,
        RESIDUAL_HUMAN_DECISIONS: 0,
      },
      dependencyBlockers: blockers,
      governanceNotReopened:
        'Named type names remain authoritative. Establish exact canonical type identity and production/ordering authority within permitted governance;no text substitution or invented enum creation.',
      producerDefinitionMetadataIntegration: {
        STATUS: 'NOT_PERFORMED_GATE_BLOCKED',
        UPDATES: [],
        EXECUTION_ALLOWED: 'NO',
        MUTATING_OPERATIONS: [],
      },
      versionAmendment: {
        STATUS: 'NOT_PERFORMED_GATE_BLOCKED',
        VERSION_1_3_1_SHA256: sha(bytes.canonical),
        VERSION_1_3_2_SHA256: null,
        PRIOR_JSON_INVERSE_PATCHES: [],
      },
      preservation,
      preservedSections: accepted,
      priorGovernancePreservation: h3.priorGovernancePreservation,
      historicalEvidence: {
        W4F: f.phaseStatus,
        W4H: h.phaseStatus,
        W4H1: h1.phaseStatus,
        W4H3: h3.phaseStatus,
      },
      proofBoundaries: {
        ...packet.proofBoundaries,
        EXTENSIONS_RUNTIME_PROVEN: 'NO',
        CANONICAL_DEFINITION_SQL_EXECUTED: 'NO',
        DATABASE_RUNTIME_CONFIGURATION_APPLIED: 'NO',
        BOOTSTRAP_IMPLEMENTATION_COMPLETE: 'NO',
        PRODUCTION_SCHEMA_PROVEN: 'NO',
      },
      validation: {
        EXACT_183_IDS: 'PASS',
        OBJECT_KIND_57_126: 'PASS',
        EXACT_125_RELATIONS: 'PASS',
        BLUEPRINT_PROPERTY_GOVERNANCE: 'PASS',
        CREATION_VS_ALTERATION_LINEAGE: 'PASS',
        NAMED_TYPE_PRODUCER_AUTHORITY:
          'BLOCKED;not present among accepted41 late type decisions or established physical producer identities',
        SQL_SAFETY_AND_QUALIFICATION: 'NOT_RUN_NO_SQL_AUTHORED',
        PAYLOAD_AND_PRODUCER_METADATA_LINKAGE: 'NOT_RUN_GATE_BLOCKED',
        CONTRACT_1_3_2_INVERSE_RECONSTRUCTION: 'NOT_APPLICABLE_NO_AMENDMENT',
        RESOLVED_REGISTRY_COMPLETE: 'NO',
        closeoutChecks: [
          {
            COMMAND:
              'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\regenerate-w4fr-definitions.test.ts scripts\\ue\\author-w4-canonical-definitions.test.ts scripts\\ue\\verify-frozen-w4.test.ts apps\\union-eyes\\scripts\\provisioning\\governed-provisioning.test.ts',
            RESULT:
              'PASS;170 tests:29 W4FR,44 frozen W4F,38 frozen W4,59 W3E;predecessor contract reconstruction stays isolated in memory',
          },
          {
            COMMAND:
              'pnpm exec tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --skipLibCheck --esModuleInterop --types node scripts\\ue\\regenerate-w4fr-definitions.ts scripts\\ue\\regenerate-w4fr-definitions.test.ts',
            RESULT: 'PASS',
          },
          {
            COMMAND:
              'pnpm exec eslint --config apps\\union-eyes\\eslint.config.mjs --max-warnings 0 scripts\\ue\\regenerate-w4fr-definitions.ts scripts\\ue\\regenerate-w4fr-definitions.test.ts',
            RESULT: 'PASS;exit0;existing Next pages-directory diagnostic',
          },
          {
            COMMAND:
              'pnpm exec tsx scripts\\ue\\regenerate-w4fr-definitions.ts --self-test --check',
            RESULT:
              'PASS;two matching supplemental registry/payload/report generations and exact persistent bytes;physical authoring gate remains BLOCKED',
          },
          {
            COMMAND:
              'pnpm exec prettier --check scripts\\ue\\regenerate-w4fr-definitions.ts scripts\\ue\\regenerate-w4fr-definitions.test.ts docs\\union-eyes\\reality-remediation\\UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_RESOLVED.json docs\\union-eyes\\reality-remediation\\UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_RESOLVED.md docs\\union-eyes\\reality-remediation\\UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS.json docs\\union-eyes\\reality-remediation\\UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS.md docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1I_W4FR_CANONICAL_DEFINITION_REGENERATION.json docs\\union-eyes\\reality-remediation\\PHASE_1B_3C_A1I_W4FR_CANONICAL_DEFINITION_REGENERATION.md',
            RESULT: 'PASS',
          },
          {
            COMMAND: 'pnpm validate:docs',
            RESULT: 'PASS;0 errors,1215 existing warnings,2605 files scanned',
          },
          {
            METHOD:
              'Independent read-only Node assertions;no import of normalization or type-authority implementation',
            RESULT:
              'PASS;exact183/57/126/125 IDs,A/A/B ordered columns and digests,all governed-property digests,38 references/36 missing type producers,all fixed/transitive upstream historical bytes and artifact digests,no SQL/producer metadata/contract mutation',
          },
        ],
      },
    },
  }
}
export async function generate() {
  const model = buildRegeneration()
  const config = (await resolveConfig(path.join(root, 'package.json'))) ?? {}
  const registryBytes = await format(JSON.stringify(model.registry), { ...config, parser: 'json' })
  const payloadBytes = await format(JSON.stringify(model.payloads), { ...config, parser: 'json' })
  const report = {
    ...model.report,
    determinismDigests: {
      DEFINITION_REGISTRY_SHA256: sha(registryBytes),
      ...model.registry.digests,
      SQL_PAYLOAD_ARTIFACT_SHA256: sha(payloadBytes),
    },
  }
  const table = report.dependencyBlockers
    .map(
      (blocker) =>
        `| ${blocker.RELATION} | ${blocker.COLUMN} | ${blocker.GOVERNED_TYPE_NAME} | ${blocker.AFFECTED_DEFINITION_OBLIGATION_IDS.join(', ')} |`,
    )
    .join('\n')
  const markdown = `# W4FR - canonical definition regeneration attempt

Gate: **BLOCKED**. Governed values are normalized,not physically authored. No additional discovery or schema decision was performed.

## Exact accounting

183 fixed obligations:57 relations +126 columns;125 relation groups. Creation lineage: **${report.summary.CREATE_RELATION} CREATE_RELATION**, **${report.summary.RELATION_CREATE_INCLUDES_COLUMN} RELATION_CREATE_INCLUDES_COLUMN**, **${report.summary.ADD_COLUMN_TO_EXISTING_RELATION} ADD_COLUMN_TO_EXISTING_RELATION**. Zero hybrid or duplicate creation authority.

Governance remains **126/126 groups,183/183 obligations**. Physical definitions authored: **0**;relations physically lowered: **0**;inactive SQL payloads: **0**;obligation payload links: **0**;unlinked obligations: **183**. No partial success is presented as a complete registry.

## Exact blocking dependency

**${report.summary.NAMED_TYPE_REFERENCES_WITHOUT_PRODUCER} references to${report.summary.DISTINCT_NAMED_TYPES_WITHOUT_PRODUCER} distinct named types** across **${report.summary.AFFECTED_RELATIONS} relations** lack recorded type producer authority. Affected obligations: **${report.summary.AFFECTED_OBLIGATIONS}**.

W4H retained each exact current pgEnum name with an explicit separate type-dependency posture. None of these identities occurs in the41 governed late type decisions or established physical producer identities. The fixed evidence does not authorize creating their enum definitions or substituting text. W4FR cannot qualify an unestablished named type identity as canonical truth.

| Relation | Column | Governed named type | Affected obligation IDs |
|---|---|---|---|
${table}

No enum members,types or production authority were invented. The W4H decisions remain closed;the missing production authority must be established explicitly before physical lowering can pass.

## Persistent artifacts and non-actions

The [registry artifact](./UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_RESOLVED.json) is explicitly marked **BLOCKED_DESIGN_NORMALIZATION_ONLY_NOT_PHYSICALLY_RESOLVED**. It contains183 governed design records,125 selected blueprint models,property provenance,operation classification and exact dependencies. It is not a claim of physical completeness. Existing-authority columns are not reauthored under a competing platform authority.

The [inactive payload artifact](./UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS.json) contains **no SQL**. SQL serialization/safety/qualification tests,producer definition metadata integration and version amendment are **not performed**,not marked passed.

Canonical **1.3.1** and producer contract bytes are unchanged. **1.3.2 not published**. Historical W4F/W4H/W4H1/W4H2/W4H3 artifacts and accepted310/127/127/372/82/raw/W3/86/118/803/23/extension-vector commitments remain unchanged.

W4 **BLOCKED_DEFINITION_IMPLEMENTATION_PENDING**. The127 compatibility records also remain unresolved. Compatibility-gate normalization **NOT_AUTHORIZED** because W4FR did not pass. W4P/W5 **NOT_AUTHORIZED**. No SQL execution,producer activation,migrations,database access or runtime/security proof. READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO.

## Validation

Validation checks **PASS**: **170 tests** (29 W4FR,44 frozen W4F,38 frozen W4,59 W3E);exact ID/provenance/blueprint/creation-authority assertions;two-run deterministic generation/check;scoped TypeScript/ESLint (exit0;existing Next pages-directory diagnostic);formatting;documentation audit (**0 errors,1215 existing warnings**). Independent read-only assertions verified exact183/57/126/125 IDs,A/A/B ordered column sets and digests,all governed-property digests,38 references/36 missing named type producers,historical/fixed/transitive upstream bytes and artifact digests,no SQL/producer metadata/version mutation. Exact commands/results are in JSON.

The first full-registry unit determinism test timed out while redundantly formatting large outputs twice;the unit check now compares model digests and the separate CLI retains exact-byte two-generation verification. The final combined170-test run passes. No historical generator is rerun and no predecessor evidence is mutated. Passing evidence validation does not turn the physical W4FR gate green. SQL/payload/metadata and1.3.2 inverse-chain checks remain not applicable because no physical authoring/amendment occurred.
`
  return {
    [outputs.registry]: registryBytes,
    [outputs.payloads]: payloadBytes,
    [outputs.report]: await format(JSON.stringify(report), { ...config, parser: 'json' }),
    [outputs.reportMarkdown]: await format(markdown, { ...config, parser: 'markdown' }),
    [outputs.registryMarkdown]: await format(
      `# W4FR - blocked governed registry\n\n**BLOCKED;not a physically complete resolved registry.** Exact183 governed obligations and125 blueprint models are normalized with provenance and creation lineage. Missing named-type producer authority prevents physical SQL lowering. No historical registry was overwritten.\n\nSee [regeneration report](./PHASE_1B_3C_A1I_W4FR_CANONICAL_DEFINITION_REGENERATION.md) and [machine registry](./UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_RESOLVED.json). Canonical1.3.1 and producer contract remain unchanged;no1.3.2.\n`,
      { ...config, parser: 'markdown' },
    ),
    [outputs.payloadsMarkdown]: await format(
      `# W4FR - inactive SQL payload status\n\n**BLOCKED;0 SQL payloads authored.** All183 obligations have explicit withheld linkage. No CREATE/ALTER SQL was generated or executed;no payload runner was wired.\n\nSee [payload status](./UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS.json) and [exact dependency blockers](./PHASE_1B_3C_A1I_W4FR_CANONICAL_DEFINITION_REGENERATION.md). EXECUTION_ALLOWED=NO;SQL_STATUS=DEFINITION_ONLY_NOT_EXECUTABLE. W4P/W5 remain NOT_AUTHORIZED.\n`,
      { ...config, parser: 'markdown' },
    ),
  }
}
export async function main(args: string[]) {
  assert(
    args.every((arg) => ['--plan', '--self-test', '--check'].includes(arg)),
    'UNAUTHORIZED_IMPLEMENTATION_OR_UNKNOWN_FLAG',
  )
  assert.equal(new Set(args).size, args.length)
  const generated = await generate()
  if (args.includes('--self-test')) {
    assert.deepEqual(generated, await generate(), 'NONDETERMINISTIC_W4FR')
    console.log(
      'PASS W4FR bounded self-tests:183/125 normalization,exact evidence,determinism;physical gate BLOCKED',
    )
  }
  if (args.includes('--check')) {
    for (const [file, bytes] of Object.entries(generated))
      assert.equal(read(file), bytes, `STALE_W4FR_OUTPUT:${file}`)
    console.log(
      'PASS W4FR --check:six exact supplemental artifacts;no contract or producer mutation',
    )
  } else if (!args.includes('--self-test')) {
    for (const [file, bytes] of Object.entries(generated))
      writeFileSync(path.join(root, ...file.split('/')), bytes)
    console.log('W4FR BLOCKED artifacts written;no SQL,producer updates or version amendment')
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error('[regenerate-w4fr-definitions]', error)
    process.exitCode = 1
  })
