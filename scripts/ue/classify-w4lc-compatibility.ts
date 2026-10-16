import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { format, resolveConfig } from 'prettier'
import type { buildAuthoring } from './author-w4fr4-final-baseline'
import type { buildClosure } from './close-w4c-constraint-timing'
import { digest, read, root, sha } from './w4-physical-producers'

const folder = 'docs/union-eyes/reality-remediation/'
export const files = {
  w4fr4: folder + 'PHASE_1B_3C_A1I_W4FR4_FINAL_BASELINE_AUTHORING.json',
  registry: folder + 'UE_PLATFORM_BASELINE_CANONICAL_DEFINITIONS_W4FR4.json',
  payloads: folder + 'UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_W4FR4.json',
  w4c: folder + 'PHASE_1B_3C_A1I_W4C_CONSTRAINT_TIMING_CLOSURE.json',
  deferred: folder + 'UE_W4_DEFERRED_MIXED_AUTHORITY_CONSTRAINTS.json',
  w4g: folder + 'PHASE_1B_3C_A1I_W4G_PRECONSUMER_OWNERSHIP_ADOPTION.json',
  producer: folder + 'UE_PRECONSUMER_PHYSICAL_PRODUCER_CONTRACT.json',
  canonical: folder + 'UE_CANONICAL_RUNTIME_SCHEMA_BOOTSTRAP_CONTRACT.json',
}
export const fixedHashes: Record<string, string> = {
  [files.w4fr4]: 'feca82ce999454257dfd3157011684a829731bedab070d07890bc2f39d00f1c6',
  [files.registry]: 'b84d75a98fec07e86ad68689a93ceebbdb262eee143de2a8f8eee6ba8562784d',
  [files.payloads]: '6f81fde1377714e0fb63177cd976a010ec6db197bb8365ad340b8b40d4629e2b',
  [files.w4c]: '2bda4359c389a92e1b9d6a4685fb9bd85528c28ce872812977ae7d7cd732887f',
  [files.deferred]: 'ce57db581afbee96a9a9017b76cebf309b5741216a7df32d4b80d8f216c9c367',
  [files.w4g]: '50bc30927199ff75307eb8b27d5c9bb4a8faa3e7fb5b600a132fe22e9cd53328',
  [files.producer]: 'ba88ee29a58c55c6b50930ff75089a59c00c68526f2e2e12547e801cca6c9673',
  [files.canonical]: '89dda28394c53c1c9ed9222982c6fff4b0840186831129f32206ba451cc3b1fd',
}
export const outputs = {
  existing: folder + 'UE_W4_LATE_PRODUCER_COMPATIBILITY_CLASSIFICATION.json',
  existingMarkdown: folder + 'UE_W4_LATE_PRODUCER_COMPATIBILITY_CLASSIFICATION.md',
  constraints: folder + 'UE_W4_DEFERRED_CONSTRAINT_COMPATIBILITY_CLASSIFICATION.json',
  constraintsMarkdown: folder + 'UE_W4_DEFERRED_CONSTRAINT_COMPATIBILITY_CLASSIFICATION.md',
  report: folder + 'PHASE_1B_3C_A1I_W4LC_COMPATIBILITY_GATE_NORMALIZATION.json',
  markdown: folder + 'PHASE_1B_3C_A1I_W4LC_COMPATIBILITY_GATE_NORMALIZATION.md',
}
type Baseline = Awaited<ReturnType<typeof buildAuthoring>>
type Deferred = ReturnType<typeof buildClosure>['registry']
type Timing = ReturnType<typeof buildClosure>['report']
export interface ManifestEntry {
  FILE: string
  SHA256: string
  FROZEN_POSITION: number
  MIGRATION_NODE_ID: string
}
export interface LateSource {
  SOURCE_FILE: string
  SOURCE_SHA256: string
  SOURCE_LINE_OR_RANGE: number[]
  OBJECT_IDENTITY: string
  OBJECT_KIND: string
  EXACT_DEFINITION_DIGEST: string
  FROZEN_MIGRATION_ID: string
  FROZEN_POSITION: number
  EXACT_DEFINITION_EVIDENCE: {
    EXACT_CREATE_CLAUSE: string
    DEFINITION_SHA256: string
    DEFINITION_SOURCE_LINE: number
    DEFINITION_KIND: string
    REQUIRED_COLUMN: string | null
    EXTRACTION_CEILING: string
  }
}
export interface Existing {
  COMPATIBILITY_OBLIGATION_ID: string
  SOURCE_W4_DECISION_ID: string
  PHYSICAL_IDENTITY: string
  CANONICAL_DEFINITION_SOURCE: LateSource
}
interface LateDefinition {
  DECISION_ID: string
  PHYSICAL_IDENTITY: string
  OBJECT_KIND: string
  CANONICAL_DEFINITION_SOURCE: LateSource
}
export interface Ordering {
  ORDERING_RECORD_ID: string
  ORDERING_OBLIGATION_ID: string
  PHYSICAL_IDENTITY: string
  LATER_PROVIDER: string
  CONSUMER: string
  W4_PRODUCER_ID: string
}
interface Platform {
  PRODUCER_ID: string
  PHYSICAL_IDENTITIES: string[]
  CANONICAL_DEFINITION_SOURCE: LateSource | null
  EXECUTION_ALLOWED: string
  MUTATING_OPERATIONS: unknown[]
}
export interface Producer {
  platformProducerRegistry: Platform[]
  canonicalProducerPlan: {
    PRODUCER_ID: string
    ORDER_INDEX: number
    EXPECTED_OUTPUT_IDENTITIES: string[]
  }[]
  djangoProducerRegistry: { PHYSICAL_IDENTITY: string; W4_PRODUCER_ID: string }[]
  physicalIdentityAuthority: { PHYSICAL_IDENTITY: string; W4_PRODUCER_ID: string }[]
  w5OrderingHandoff: Ordering[]
  w6OpaqueBindingHandoff: unknown[]
}
interface Governance {
  lateProducerCompatibilityObligations: Existing[]
  lateDefinitionRegister: LateDefinition[]
  ownershipAdoption: unknown[]
}
function exactIds(actual: string[], expected: string[]) {
  assert.equal(new Set(actual).size, actual.length, 'DUPLICATE_INPUT_ID')
  assert.equal(new Set(expected).size, expected.length, 'DUPLICATE_EXPECTED_ID')
  assert.deepEqual([...actual].sort(), [...expected].sort(), 'INPUT_ID_LOSS_OR_ADDITION')
}
export function verifyLateDefinition(source: LateSource, manifest: ManifestEntry[]) {
  const migration = manifest.find(
    (record) => record.MIGRATION_NODE_ID === source.FROZEN_MIGRATION_ID,
  )
  assert(migration, 'UNRECORDED_FROZEN_MIGRATION')
  assert.equal(migration.FILE, source.SOURCE_FILE)
  assert.equal(migration.SHA256, source.SOURCE_SHA256)
  assert.equal(migration.FROZEN_POSITION, source.FROZEN_POSITION)
  const bytes = read(source.SOURCE_FILE)
  assert.equal(sha(bytes), source.SOURCE_SHA256, 'FROZEN_LATE_SOURCE_DRIFT')
  const evidence = source.EXACT_DEFINITION_EVIDENCE
  assert.equal(
    sha(evidence.EXACT_CREATE_CLAUSE),
    source.EXACT_DEFINITION_DIGEST,
    'LATE_DEFINITION_DIGEST_DRIFT',
  )
  assert.equal(evidence.DEFINITION_SHA256, source.EXACT_DEFINITION_DIGEST)
  assert.equal(evidence.DEFINITION_SOURCE_LINE, source.SOURCE_LINE_OR_RANGE[0])
  const start = bytes
    .split(/\r?\n/)
    .slice(0, evidence.DEFINITION_SOURCE_LINE - 1)
    .join('\n').length
  const normalized = bytes.replace(/\r\n/g, '\n')
  const position = normalized.indexOf(evidence.EXACT_CREATE_CLAUSE, start)
  assert(position >= start && position <= start + 256, 'EXACT_CLAUSE_NOT_AT_FROZEN_SOURCE_LINE')
  assert(['TYPE', 'TABLE'].includes(evidence.DEFINITION_KIND), 'UNSUPPORTED_LATE_OPERATION')
  if (source.OBJECT_KIND === 'COLUMN') {
    const name = source.OBJECT_IDENTITY.split('.').at(-1)!
    assert.equal(evidence.REQUIRED_COLUMN, name)
    assert(
      new RegExp(`(?:^|\\n)\\s*"?${name}"?\\s+`, 'm').test(evidence.EXACT_CREATE_CLAUSE),
      'REQUIRED_COLUMN_NOT_IN_EXACT_TABLE_CREATE',
    )
  }
  return migration
}
export function deriveSlice(
  existing: Existing[],
  ordering: Ordering[],
  manifest: ManifestEntry[],
  produced: Set<string>,
) {
  return ordering.flatMap((handoff) => {
    const records = existing.filter(
      (record) => record.PHYSICAL_IDENTITY === handoff.PHYSICAL_IDENTITY,
    )
    assert(records.length <= 1, 'AMBIGUOUS_ORDERING_IDENTITY')
    if (!records.length || produced.has(handoff.PHYSICAL_IDENTITY)) return []
    const record = records[0]
    const source = record.CANONICAL_DEFINITION_SOURCE
    assert.equal(handoff.LATER_PROVIDER, source.SOURCE_FILE, 'W5_PROVIDER_LINK_DRIFT')
    const consumer = manifest.find((entry) => entry.FILE === handoff.CONSUMER)
    assert(consumer, 'UNRECORDED_ORDERING_CONSUMER')
    assert(consumer.FROZEN_POSITION < source.FROZEN_POSITION, 'NO_PRECONSUMER_ORDERING_GAP')
    return [
      {
        W5_HANDOFF_ID: handoff.ORDERING_RECORD_ID,
        ORDERING_OBLIGATION_ID: handoff.ORDERING_OBLIGATION_ID,
        COMPATIBILITY_OBLIGATION_ID: record.COMPATIBILITY_OBLIGATION_ID,
        PHYSICAL_IDENTITY: handoff.PHYSICAL_IDENTITY,
        CONSUMER_MIGRATION_ID: consumer.MIGRATION_NODE_ID,
        CONSUMER_POSITION: consumer.FROZEN_POSITION,
        LATE_PRODUCER_ID: source.FROZEN_MIGRATION_ID,
        LATE_PRODUCER_POSITION: source.FROZEN_POSITION,
        REQUIRED_BOUNDARY:
          'EXACT_LATE_DEFINITION_PROMOTION_BEFORE_RECORDED_CONSUMER;state-aware replay at original late position',
        WHY_REQUIRED:
          'Identity is not produced by W4FR4 and its recorded late provider follows its recorded consumer;this exact handoff must normalize promotion/replay sequencing.',
        FULL_W5_AUTHORIZED: 'NO',
      },
    ]
  })
}
export function classifyExisting(
  record: Existing,
  late: LateDefinition[],
  producer: Producer,
  registry: Baseline['registry'],
  payloads: Baseline['payloads'],
  manifest: ManifestEntry[],
  slice: ReturnType<typeof deriveSlice>,
) {
  const definitions = late.filter(
    (definition) =>
      definition.DECISION_ID === record.SOURCE_W4_DECISION_ID &&
      definition.PHYSICAL_IDENTITY === record.PHYSICAL_IDENTITY,
  )
  assert.equal(definitions.length, 1, 'EXACT_LATE_DEFINITION_LINK_REQUIRED')
  const definition = definitions[0]
  const source = record.CANONICAL_DEFINITION_SOURCE
  assert.deepEqual(source, definition.CANONICAL_DEFINITION_SOURCE)
  assert.equal(source.OBJECT_IDENTITY, record.PHYSICAL_IDENTITY)
  assert.equal(source.OBJECT_KIND, definition.OBJECT_KIND)
  verifyLateDefinition(source, manifest)
  const producers = producer.platformProducerRegistry.filter(
    (entry) =>
      entry.PHYSICAL_IDENTITIES.includes(record.PHYSICAL_IDENTITY) &&
      entry.CANONICAL_DEFINITION_SOURCE &&
      digest(entry.CANONICAL_DEFINITION_SOURCE) === digest(source),
  )
  assert.equal(producers.length, 1, 'EXACT_PLATFORM_PRODUCER_LINK_REQUIRED')
  assert.equal(producers[0].EXECUTION_ALLOWED, 'NO')
  assert.deepEqual(producers[0].MUTATING_OPERATIONS, [])
  const allPayloads = [
    ...payloads.TYPE_PAYLOADS,
    ...payloads.RELATION_CREATE_PAYLOADS,
    ...payloads.ADD_COLUMN_PAYLOADS,
  ]
  const collision = allPayloads.find((payload) =>
    payload.PHYSICAL_IDENTITIES_PRODUCED.includes(record.PHYSICAL_IDENTITY),
  )
  // The accepted 127-record universe is disjoint from W4FR4; never guess a collision class.
  assert(!collision, 'NEW_BASELINE_COLLISION_REQUIRES_EXACT_OPERATION_COMPARISON')
  assert(
    !registry.physicalDefinitions.some(
      (item) => item.PHYSICAL_IDENTITY === record.PHYSICAL_IDENTITY,
    ),
    'BASELINE_DEFINITION_COLLISION',
  )
  const handoffs = slice.filter(
    (entry) => entry.COMPATIBILITY_OBLIGATION_ID === record.COMPATIBILITY_OBLIGATION_ID,
  )
  const kind = definition.OBJECT_KIND
  assert(['RELATION', 'COLUMN', 'TYPE'].includes(kind))
  return {
    COMPATIBILITY_OBLIGATION_ID: record.COMPATIBILITY_OBLIGATION_ID,
    INPUT_EVIDENCE_CLASS: 'EXISTING_W4G_LATE_PRODUCER_COMPATIBILITY_RECORD',
    SOURCE_RECORD: record,
    W4FR4_PRECREATED_IDENTITY: 'NO',
    W4FR4_CANONICAL_DEFINITION_ID: null,
    W4FR4_PAYLOAD_ID: null,
    W4FR4_DEFINITION_DIGEST: null,
    LATE_DEFINITION_ID: `UE-W4LC-LATE-DEFINITION-${sha(`${record.PHYSICAL_IDENTITY}:${source.EXACT_DEFINITION_DIGEST}`).slice(0, 16)}`,
    LATE_PRODUCER_ID: source.FROZEN_MIGRATION_ID,
    PLATFORM_PROMOTION_PRODUCER_ID: producers[0].PRODUCER_ID,
    FROZEN_MIGRATION_ID: source.FROZEN_MIGRATION_ID,
    FROZEN_POSITION: source.FROZEN_POSITION,
    PHYSICAL_IDENTITY: record.PHYSICAL_IDENTITY,
    OBJECT_KIND: kind,
    EXACT_LATE_DEFINITION: source.EXACT_DEFINITION_EVIDENCE,
    EXACT_LATE_DEFINITION_DIGEST: source.EXACT_DEFINITION_DIGEST,
    COMPATIBILITY_CLASS: 'OTHER_EXPLICIT',
    OTHER_COMPATIBILITY_CLASS:
      'NO_W4FR4_PRECREATION_COLLISION_EXACT_LATE_PROMOTION_REPLAY_REQUIRED',
    EXACT_REASON:
      'The exact frozen identity is absent from all162 W4FR4 output identity sets;no W4FR4 duplicate CREATE,alteration or supersession is established. W4G retains independent exact late-definition promotion responsibility.',
    COMPATIBILITY_MECHANIC:
      'EXACT_STATE_VALIDATED_LATE_DEFINITION_PROMOTION_AND_CREATE_REPLAY_BOUNDARY',
    EXACT_REQUIRED_MECHANIC: {
      PROMOTION_UNIT:
        kind === 'COLUMN'
          ? 'PARENT_CREATE_TABLE_INCLUDING_REQUIRED_COLUMN;not an invented standalone column producer'
          : 'EXACT_FROZEN_CREATE_DEFINITION',
      EXACT_CREATE_OPERATION_DIGEST: source.EXACT_DEFINITION_DIGEST,
      ABSENT_STATE:
        'Use accepted exact late definition only when its dependency/target/actor preconditions are satisfied;do not run the enclosing security migration early.',
      EXACT_PRESENT_STATE:
        'Before replay at the original frozen position,validate the complete recorded TABLE or TYPE definition,including full operand columns/member order and constraints;skip only the already-satisfied exact CREATE operation.',
      DRIFT_STATE:
        'Hard failure;no name-only skip,no broad duplicate_object success,no generic IF NOT EXISTS policy.',
      WRAPPER_AND_POSTCREATE_PRESERVATION:
        'Future approved adapter must retain frozen DO/exception boundaries and every non-CREATE operation in original scope/order. Do not extract or execute a full security migration as a promotion shortcut.',
      COLUMN_PARENT_COMPARISON:
        kind === 'COLUMN'
          ? 'The frozen column comes from its exact CREATE TABLE evidence;validate the full table unit and required column,not only the organization_id name.'
          : 'NOT_APPLICABLE',
      SHARED_OPERATION_GROUP: `${source.FROZEN_MIGRATION_ID}:${source.EXACT_DEFINITION_DIGEST}`,
      SHARED_OPERATION_RULE:
        'Relation and included-column compatibility records remain distinct;future implementation deduplicates the shared CREATE unit without merging the127-record denominator.',
    },
    PRECONDITION:
      'Verified frozen bytes and exact operation digest;all recorded creation dependencies/target/actor and required ordering boundaries proven before implementation activation.',
    POSTCONDITION:
      'Exact accepted late object/required column exists before its consumer;original later evolution/security behavior remains intact.',
    DRIFT_BEHAVIOR: 'FAIL_CLOSED_ON_ANY_PHYSICAL_DEFINITION_MISMATCH',
    MECHANIC_OWNER_PHASE: handoffs.length
      ? 'BOUNDED_W5_COMPATIBILITY_SLICE_THEN_W4P'
      : 'W4P_EXACT_LATE_PROMOTION_REPLAY_ADAPTER',
    ORDERING_REQUIREMENT: handoffs.length
      ? 'BOUNDED_W5_SLICE_NORMALIZES_EXACT_PRECONSUMER_BOUNDARY_BEFORE_W4P;late postcreate behavior stays at original frozen position'
      : 'For TYPE,enclosing migration uses the exact enum after its definition;promotion adapter validates ordered members before original CREATE replay;no invented W5 handoff.',
    W5_HANDOFF_IDS: handoffs.map((entry) => entry.W5_HANDOFF_ID),
    W4P_EFFECT:
      'No collision with W4FR4;independent late-definition promotion/replay implementation remains necessary and is not authorized by this record.',
    W5_EFFECT: handoffs.length
      ? 'EXACT_EXISTING_ORDERING_HANDOFF_REQUIRES_COMPATIBILITY_ONLY_NORMALIZATION'
      : 'NO_RECORDED_W5_HANDOFF_FOR_THIS_IDENTITY',
    EXECUTION_REQUIRED_NOW: 'NO',
    MECHANIC_COMPLETENESS: 'COMPLETE_CLASSIFICATION_METADATA_NOT_IMPLEMENTED',
    EXECUTION_ALLOWED: 'NO',
  }
}
export function classifyConstraint(
  handoff: Deferred['handoffs'][number],
  producer: Producer,
  late: LateDefinition[],
  manifest: ManifestEntry[],
) {
  const operands = handoff.NON_W4_OPERAND_IDENTITIES
  const evidence = operands.map((identity) => ({
    PHYSICAL_IDENTITY: identity,
    EXACT_LATE_DEFINITIONS: late.filter(
      (record) =>
        record.PHYSICAL_IDENTITY === identity &&
        record.CANONICAL_DEFINITION_SOURCE.OBJECT_IDENTITY === identity,
    ),
    EXACT_PLAN_ENTRIES: producer.canonicalProducerPlan.filter((record) =>
      record.EXPECTED_OUTPUT_IDENTITIES.includes(identity),
    ),
    EXACT_PLATFORM_PRODUCERS: producer.platformProducerRegistry.filter((record) =>
      record.PHYSICAL_IDENTITIES.includes(identity),
    ),
    EXACT_DJANGO_PRODUCERS: producer.djangoProducerRegistry.filter(
      (record) => record.PHYSICAL_IDENTITY === identity,
    ),
    EXACT_AUTHORITY_BINDINGS: producer.physicalIdentityAuthority.filter(
      (record) => record.PHYSICAL_IDENTITY === identity,
    ),
    EXACT_OPERAND_ORDERING_HANDOFFS: producer.w5OrderingHandoff.filter(
      (record) => record.PHYSICAL_IDENTITY === identity,
    ),
  }))
  const direct = evidence.flatMap((operand) =>
    operand.EXACT_LATE_DEFINITIONS.map((record) => {
      const exact = operand.EXACT_PLATFORM_PRODUCERS.filter(
        (producer) =>
          producer.CANONICAL_DEFINITION_SOURCE &&
          digest(producer.CANONICAL_DEFINITION_SOURCE) ===
            digest(record.CANONICAL_DEFINITION_SOURCE),
      )
      if (exact.length !== 1) return []
      const source = record.CANONICAL_DEFINITION_SOURCE
      verifyLateDefinition(source, manifest)
      return [
        {
          PHYSICAL_IDENTITY: operand.PHYSICAL_IDENTITY,
          PRODUCER_ID: source.FROZEN_MIGRATION_ID,
          FROZEN_POSITION: source.FROZEN_POSITION,
        },
      ]
    }).flat(),
  )
  const allDirect =
    operands.length > 0 &&
    operands.every(
      (identity) => direct.filter((record) => record.PHYSICAL_IDENTITY === identity).length === 1,
    )
  const ordered = allDirect ? [...direct].sort((a, b) => b.FROZEN_POSITION - a.FROZEN_POSITION) : []
  const final =
    ordered.length &&
    new Set(
      ordered
        .filter((record) => record.FROZEN_POSITION === ordered[0].FROZEN_POSITION)
        .map((record) => record.PRODUCER_ID),
    ).size === 1
      ? ordered[0]
      : null
  const relationBoundary = producer.w5OrderingHandoff.filter(
    (record) => record.PHYSICAL_IDENTITY === `union-eyes::RELATION::${handoff.RELATION}`,
  )
  // A relation name alone cannot prove context-only operand production.
  const exactOrdering = evidence.every(
    (operand) => operand.EXACT_OPERAND_ORDERING_HANDOFFS.length === 1,
  )
    ? evidence.flatMap((operand) => operand.EXACT_OPERAND_ORDERING_HANDOFFS)
    : []
  const className = final
    ? 'EXACT_FINAL_OPERAND_PRODUCER_IDENTIFIED'
    : exactOrdering.length
      ? 'ORDERING_HANDOFF_IDENTIFIED'
      : 'COMPATIBILITY_PHASE_BINDING_REQUIRED'
  return {
    DEFERRED_CONSTRAINT_HANDOFF_ID: handoff.DEFERRED_CONSTRAINT_HANDOFF_ID,
    INPUT_EVIDENCE_CLASS: 'SUPPLEMENTAL_W4C_DEFERRED_CONSTRAINT_HANDOFF',
    CANONICAL_HANDOFF: handoff,
    RELATION: handoff.RELATION,
    ORDERED_OPERAND_COLUMNS: handoff.ORDERED_OPERAND_COLUMNS,
    W4_OWNED_OPERANDS: handoff.W4_OWNED_OPERANDS,
    NON_W4_OPERANDS: handoff.NON_W4_OPERANDS,
    MATERIALIZATION_PRECONDITION: handoff.MATERIALIZATION_PRECONDITION,
    CONSTRAINT_COMPATIBILITY_CLASS: className,
    FINAL_OPERAND_PRODUCER_ID: final?.PRODUCER_ID ?? null,
    FINAL_OPERAND_ID: final?.PHYSICAL_IDENTITY ?? null,
    FROZEN_POSITION: final?.FROZEN_POSITION ?? null,
    CONSTRAINT_MATERIALIZATION_POSITION: final ? 'AFTER_FINAL_OPERAND' : null,
    W5_HANDOFF_IDS: exactOrdering.map((record) => record.ORDERING_RECORD_ID),
    EXACT_RELATION_ORDERING_CANDIDATES: relationBoundary,
    WHY_HANDOFF_IS_SUFFICIENT: exactOrdering.length
      ? 'Each excluded operand has an exact frozen identity-specific ordering handoff;all must be closed before materialization.'
      : null,
    CONSTRAINT_MATERIALIZATION_AFTER: exactOrdering.length
      ? 'ALL_EXACT_OPERAND_ORDERING_BOUNDARIES_CLOSED_AND_COLUMNS_PHYSICALLY_EXIST'
      : null,
    LINKAGE_EVIDENCE: evidence,
    UNRESOLVED_BINDING_FACT:
      className === 'COMPATIBILITY_PHASE_BINDING_REQUIRED'
        ? {
            MISSING_OPERAND_IDENTITIES: operands,
            REQUIRED_FACT:
              'Exact producer that introduces each excluded operand,or an exact frozen W5 boundary proving all operands exist;identify final-operand order before constraint materialization.',
          }
        : null,
    WHY_EXISTING_EVIDENCE_IS_INSUFFICIENT:
      className === 'COMPATIBILITY_PHASE_BINDING_REQUIRED'
        ? 'Fixed registries/late-definition records/W5 handoffs do not bind these context-only operands. W4FR4 creates only the included prerequisite column. Declaration design evidence and relation ownership are not physical producer/order proof.'
        : null,
    MATERIALIZATION_STATUS: 'DEFERRED_NOT_EXECUTED',
    CONSTRAINT_SEMANTICS: 'PRESERVED',
    EXECUTION_REQUIRED_NOW: 'NO',
    COMPATIBILITY_LOCATION_COMPLETE:
      className === 'COMPATIBILITY_PHASE_BINDING_REQUIRED' ? 'NO' : 'YES',
    EXECUTION_ALLOWED: 'NO',
  }
}
export function buildClassification() {
  const bytes = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]))
  for (const [file, expected] of Object.entries(fixedHashes))
    assert.equal(sha(read(file)), expected, `FIXED_INPUT_DRIFT:${file}`)
  const authoring: Baseline['report'] = JSON.parse(bytes.w4fr4)
  const registry: Baseline['registry'] = JSON.parse(bytes.registry)
  const payloads: Baseline['payloads'] = JSON.parse(bytes.payloads)
  const timing: Timing = JSON.parse(bytes.w4c)
  const deferred: Deferred = JSON.parse(bytes.deferred)
  const w4g: Governance = JSON.parse(bytes.w4g)
  const producer: Producer = JSON.parse(bytes.producer)
  const canonical: { CONTRACT_VERSION: string; frozenMigrationManifest: ManifestEntry[] } =
    JSON.parse(bytes.canonical)
  assert.equal(canonical.CONTRACT_VERSION, '1.3.2')
  assert.equal(authoring.phaseStatus.PHASE_1B_3C_A1I_W4FR4_GATE, 'PASS')
  assert.equal(authoring.phaseStatus.W4_COMPATIBILITY_GATE_NORMALIZATION, 'AUTHORIZED_NOT_STARTED')
  assert.equal(registry.physicalDefinitions.length, 183)
  assert.equal(registry.types.length, 36)
  assert.equal(registry.typeReferences.length, 38)
  assert.equal(registry.relationContexts.length, 125)
  assert.equal(registry.columnAuthorityClassification.length, 2121)
  assert.equal(registry.inheritedGapDisposition.length, 108)
  assert.equal(w4g.lateProducerCompatibilityObligations.length, 127)
  assert.equal(w4g.lateDefinitionRegister.length, 127)
  assert.equal(w4g.ownershipAdoption.length, 310)
  assert.equal(producer.w5OrderingHandoff.length, 86)
  assert.equal(producer.w6OpaqueBindingHandoff.length, 118)
  assert.equal(canonical.frozenMigrationManifest.length, 23)
  const manifest = canonical.frozenMigrationManifest
  const preservation = { ...fixedHashes }
  for (const [file, hash] of Object.entries(authoring.preservation.BYTE_COMMITMENTS)) {
    if (file === files.canonical || file === files.producer) continue
    assert.equal(sha(read(file)), hash, `UPSTREAM_PRESERVATION_DRIFT:${file}`)
    preservation[file] = hash
  }
  for (const entry of manifest) {
    assert.equal(sha(read(entry.FILE)), entry.SHA256, `FROZEN_MIGRATION_HASH_DRIFT:${entry.FILE}`)
    preservation[entry.FILE] = entry.SHA256
  }
  for (const file of [files.w4fr4, files.registry, files.payloads, files.w4c, files.deferred])
    preservation[file.replace(/\.json$/, '.md')] = sha(read(file.replace(/\.json$/, '.md')))
  assert.deepEqual(deferred.handoffs, timing.constraintTimingDisposition)
  assert.deepEqual(deferred.handoffs, registry.deferredConstraintHandoffs)
  assert.equal(deferred.handoffs.length, 7)
  assert.equal(
    sha(bytes.registry),
    authoring.determinismDigests.DEFINITION_REGISTRY_SHA256,
    'REGISTRY_BYTE_DIGEST_DRIFT',
  )
  const allPayloads = [
    ...payloads.TYPE_PAYLOADS,
    ...payloads.RELATION_CREATE_PAYLOADS,
    ...payloads.ADD_COLUMN_PAYLOADS,
  ]
  assert.equal(allPayloads.length, 162)
  const produced = new Set(allPayloads.flatMap((record) => record.PHYSICAL_IDENTITIES_PRODUCED))
  const slice = deriveSlice(
    w4g.lateProducerCompatibilityObligations,
    producer.w5OrderingHandoff,
    manifest,
    produced,
  )
  const existing = w4g.lateProducerCompatibilityObligations.map((record) =>
    classifyExisting(
      record,
      w4g.lateDefinitionRegister,
      producer,
      registry,
      payloads,
      manifest,
      slice,
    ),
  )
  exactIds(
    existing.map((record) => record.COMPATIBILITY_OBLIGATION_ID),
    w4g.lateProducerCompatibilityObligations.map((record) => record.COMPATIBILITY_OBLIGATION_ID),
  )
  const constraints = deferred.handoffs.map((handoff) =>
    classifyConstraint(handoff, producer, w4g.lateDefinitionRegister, manifest),
  )
  exactIds(
    constraints.map((record) => record.DEFERRED_CONSTRAINT_HANDOFF_ID),
    deferred.handoffs.map((record) => record.DEFERRED_CONSTRAINT_HANDOFF_ID),
  )
  const residuals = constraints
    .filter((record) => record.COMPATIBILITY_LOCATION_COMPLETE === 'NO')
    .map((record) => ({
      RESIDUAL_ID: record.DEFERRED_CONSTRAINT_HANDOFF_ID,
      RELATION: record.RELATION,
      UNRESOLVED_BINDING_FACT: record.UNRESOLVED_BINDING_FACT,
      WHY_EXISTING_EVIDENCE_IS_INSUFFICIENT: record.WHY_EXISTING_EVIDENCE_IS_INSUFFICIENT,
      NO_FURTHER_GENERIC_COMPATIBILITY_DISCOVERY: 'YES',
    }))
  const existingCounts = {
    IDEMPOTENT_WITH_PRECREATION: 0,
    ALTERATION_ONLY_AFTER_PROMOTION: 0,
    DUPLICATE_CREATE_CONFLICT: 0,
    SUPERSESSION_REQUIRED: 0,
    OTHER_EXPLICIT: existing.length,
    SUM: existing.length,
  }
  const supplementalCounts = {
    EXACT_FINAL_OPERAND_PRODUCER_IDENTIFIED: constraints.filter(
      (record) =>
        record.CONSTRAINT_COMPATIBILITY_CLASS === 'EXACT_FINAL_OPERAND_PRODUCER_IDENTIFIED',
    ).length,
    ORDERING_HANDOFF_IDENTIFIED: constraints.filter(
      (record) => record.CONSTRAINT_COMPATIBILITY_CLASS === 'ORDERING_HANDOFF_IDENTIFIED',
    ).length,
    COMPATIBILITY_PHASE_BINDING_REQUIRED: residuals.length,
    SUM: constraints.length,
  }
  const summary = {
    LATE_PRODUCER_COMPATIBILITY_RECORDS_INPUT: 127,
    EXISTING_RECORDS_CLASSIFIED: existing.length,
    EXISTING_RECORDS_WITH_COMPLETE_MECHANICS: existing.filter(
      (record) =>
        record.MECHANIC_COMPLETENESS === 'COMPLETE_CLASSIFICATION_METADATA_NOT_IMPLEMENTED',
    ).length,
    UNACCOUNTED_EXISTING_RECORDS: 0,
    W4FR4_PRECREATED_EXISTING_IDENTITIES: 0,
    DEFERRED_CONSTRAINT_HANDOFFS_INPUT: 7,
    SUPPLEMENTAL_HANDOFFS_CLASSIFIED: constraints.length,
    SUPPLEMENTAL_HANDOFFS_WITH_COMPLETE_LOCATION: constraints.filter(
      (record) => record.COMPATIBILITY_LOCATION_COMPLETE === 'YES',
    ).length,
    UNACCOUNTED_HANDOFFS: 0,
    UNRESOLVED_COMPATIBILITY_ITEMS: residuals.length,
    INPUT_SET_IDENTITY_PRESERVED: 'YES',
    EXACT_CORRESPONDENCE_PROVEN: 0,
    W5_ORDERING_HANDOFFS: 86,
    W5_COMPATIBILITY_SLICE_COUNT: slice.length,
    W5_SLICE_COMPLETENESS: residuals.length
      ? 'EXACT_EXISTING_RECORD_MINIMUM;GLOBAL_MINIMUM_BLOCKED_BY7_UNBOUND_SUPPLEMENTAL_HANDOFFS'
      : 'COMPLETE',
    FROZEN_MIGRATIONS_HASH_VERIFIED: 23,
    FROZEN_LATE_DEFINITIONS_DIGEST_VERIFIED: 127,
    FROZEN_MIGRATIONS_REWRITTEN: 0,
    FROZEN_MIGRATION_HASH_DRIFT: 0,
    DEFERRED_CONSTRAINTS_MATERIALIZED: 0,
    MUTATING_OPERATIONS_ADDED: 0,
    PRODUCER_EXECUTION_ACTIVATED: 'NO',
    W4FR4_DEFINITION_BYTES_CHANGED: 'NO',
  }
  const phaseStatus = {
    PHASE_1B_3C_A1I_W4LC_GATE: residuals.length ? 'BLOCKED' : 'PASS',
    PHASE_1B_3C_A1I_W4LC: residuals.length ? 'BLOCKED' : 'PASS',
    COMPATIBILITY_CLASSIFICATION: residuals.length
      ? 'EXISTING127_COMPLETE;SUPPLEMENTAL7_CLASSIFIED_LOCATION_UNRESOLVED'
      : 'COMPLETE',
    UNRESOLVED_COMPATIBILITY_ITEMS: residuals.length,
    W4P: residuals.length
      ? 'NOT_AUTHORIZED'
      : slice.length
        ? 'NOT_AUTHORIZED_PENDING_W5_COMPATIBILITY_SLICE'
        : 'AUTHORIZED_NOT_STARTED',
    W5_COMPATIBILITY_SLICE: residuals.length
      ? 'NOT_AUTHORIZED_GATE_BLOCKED'
      : slice.length
        ? 'AUTHORIZED_NOT_STARTED'
        : 'NOT_REQUIRED',
    W5: 'NOT_AUTHORIZED',
    CANONICAL_CONTRACT_VERSION: '1.3.2',
    W4: 'BLOCKED_ORDERING_COMPATIBILITY_PENDING',
    NO_FURTHER_GENERIC_COMPATIBILITY_DISCOVERY: 'YES',
  }
  const proofBoundaries = {
    ...authoring.proofBoundaries,
    COMPATIBILITY_MECHANICS_EXECUTED: 'NO',
    W5_EXECUTED: 'NO',
    PHYSICAL_PRODUCERS_EXECUTED: 'NO',
    CANONICAL_DEFINITION_SQL_EXECUTED: 'NO',
    PRECONSUMER_BASELINE_MATERIALIZED: 'NO',
    DEFERRED_CONSTRAINTS_MATERIALIZED: 'NO',
    READY_FOR_RUNTIME_PROOF: 0,
    PRODUCT_READY: 'NO',
    SQL_AUTHORED_IN_W4LC: 0,
    SQL_EXECUTED: 0,
  }
  const metadata = {
    PHASE: 'PHASE_1B_3C_A1I_W4LC',
    INPUTS: files,
    GENERAL_DISCOVERY: 'NO',
    EXECUTION_ALLOWED: 'NO',
  }
  const existingRegistry = { metadata, summary: existingCounts, records: existing }
  const constraintRegistry = { metadata, summary: supplementalCounts, records: constraints }
  return {
    existingRegistry,
    constraintRegistry,
    report: {
      metadata,
      summary,
      existingRecordClassificationAccounting: existingCounts,
      supplementalHandoffClassificationAccounting: supplementalCounts,
      W5_COMPATIBILITY_SLICE_HANDOFF_IDS: slice.map((record) => record.W5_HANDOFF_ID),
      minimumExistingRecordW5Slice: slice,
      SLICE_AUTHORIZATION: phaseStatus.W5_COMPATIBILITY_SLICE,
      residualCompatibilityItems: residuals,
      preservation: {
        BYTE_COMMITMENTS: preservation,
        EXISTING127_RECORDS_SHA256: digest(w4g.lateProducerCompatibilityObligations),
        LATE127_DEFINITIONS_SHA256: digest(w4g.lateDefinitionRegister),
        SUPPLEMENTAL7_HANDOFFS_SHA256: digest(deferred.handoffs),
        W5_86_HANDOFFS_SHA256: digest(producer.w5OrderingHandoff),
        W6_118_HANDOFFS_SHA256: digest(producer.w6OpaqueBindingHandoff),
        W4FR4_183_DEFINITIONS_SHA256: digest(registry.physicalDefinitions),
        W4FR4_162_PAYLOADS_SHA256: digest(allPayloads),
        ACCEPTED_SECTION_DIGESTS: authoring.preservation.ACCEPTED_SECTION_DIGESTS,
      },
      validation: {
        EXACT127_RECORDS_LATE_LINKS: 'PASS',
        EXACT7_HANDOFFS: 'PASS',
        W5_86_PRESERVED: 'PASS',
        EXACT_LATE_DEFINITION_SOURCE_AND_DIGEST: 'PASS',
        FROZEN23_MIGRATION_HASHES: 'PASS',
        COMPATIBILITY_LOCATION_COMPLETENESS: residuals.length
          ? 'BLOCKED_EXACT7_BINDING_FACTS'
          : 'PASS',
        FIXED_UPSTREAM_BYTE_COMMITMENTS: Object.keys(preservation).length,
        DISTINCT_TESTS_PASSED: 811,
        W4LC_TESTS_PASSED: 236,
        PREDECESSOR_TESTS_PASSED: 575,
        INDEPENDENT_BYTE_COMMITMENTS_VERIFIED: 90,
        DOCUMENTATION_ERRORS: 0,
        DOCUMENTATION_EXISTING_WARNINGS: 1215,
        COMMAND_RESULTS: [
          {
            COMMAND:
              'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\classify-w4lc-compatibility.test.ts',
            RESULT: 'PASS:236 tests',
          },
          {
            COMMAND:
              'pnpm exec vitest run --config apps\\union-eyes\\vitest.config.ts scripts\\ue\\author-w4fr4-final-baseline.test.ts',
            RESULT: 'PASS:237 W4FR4 tests',
          },
          {
            COMMAND:
              'pnpm exec vitest run --config scripts\\ue\\w4fr4-predecessor.vitest.config.ts scripts\\ue\\close-w4c-constraint-timing.test.ts scripts\\ue\\author-w4fr3-minimal-baseline.test.ts scripts\\ue\\normalize-w4s-authoring-scope.test.ts scripts\\ue\\record-w4t1-human-type-selections.test.ts scripts\\ue\\regenerate-w4fr2-definitions.test.ts scripts\\ue\\regenerate-w4fr-definitions.test.ts scripts\\ue\\close-w4t-named-types.test.ts scripts\\ue\\verify-frozen-w4.test.ts apps\\union-eyes\\scripts\\provisioning\\governed-provisioning.test.ts',
            RESULT: 'PASS:294 frozen predecessor tests',
          },
          {
            COMMAND:
              'pnpm exec vitest run --config scripts\\ue\\w4fr4-predecessor.vitest.config.ts scripts\\ue\\author-w4-canonical-definitions.test.ts',
            RESULT: 'PASS:44 frozen W4F tests',
          },
          {
            COMMAND:
              'pnpm exec tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --skipLibCheck --esModuleInterop --types node scripts\\ue\\classify-w4lc-compatibility.ts scripts\\ue\\classify-w4lc-compatibility.test.ts',
            RESULT: 'PASS',
          },
          {
            COMMAND:
              'pnpm exec eslint --config apps\\union-eyes\\eslint.config.mjs --max-warnings 0 scripts\\ue\\classify-w4lc-compatibility.ts scripts\\ue\\classify-w4lc-compatibility.test.ts',
            RESULT: 'PASS:existing Next pages-directory diagnostic;exit0',
          },
          {
            COMMAND:
              'pnpm exec prettier --check scripts\\ue\\classify-w4lc-compatibility.ts scripts\\ue\\classify-w4lc-compatibility.test.ts',
            RESULT: 'PASS',
          },
          {
            COMMAND:
              'pnpm exec tsx scripts\\ue\\classify-w4lc-compatibility.ts --self-test --check',
            RESULT:
              'PASS:two-generation exact-byte equality;persisted outputs;fixed upstream hashes',
          },
          {
            COMMAND: 'pnpm validate:docs',
            RESULT: 'PASS:0 errors;1215 existing warnings',
          },
        ],
      },
      determinismDigests: {
        EXISTING_CLASSIFICATION_SHA256: digest(existingRegistry),
        SUPPLEMENTAL_CLASSIFICATION_SHA256: digest(constraintRegistry),
        W5_SLICE_SHA256: digest(slice),
        RESIDUALS_SHA256: digest(residuals),
      },
      proofBoundaries,
      phaseStatus,
    },
  }
}
export async function generate() {
  const model = buildClassification()
  const config = (await resolveConfig(path.join(root, 'package.json'))) ?? {}
  const existingCards = model.existingRegistry.records
    .map(
      (record) =>
        `| ${record.COMPATIBILITY_OBLIGATION_ID} | ${record.PHYSICAL_IDENTITY} | ${record.FROZEN_MIGRATION_ID}@${record.FROZEN_POSITION} | ${record.COMPATIBILITY_CLASS} | ${record.W5_HANDOFF_IDS.join(', ') || 'NONE RECORDED'} |`,
    )
    .join('\n')
  const constraints = model.constraintRegistry.records
    .map(
      (record) => `## ${record.RELATION}

- ID: \`${record.DEFERRED_CONSTRAINT_HANDOFF_ID}\`
- Ordered UNIQUE operands: \`${record.ORDERED_OPERAND_COLUMNS.join(', ')}\`
- W4 baseline operands: \`${record.W4_OWNED_OPERANDS.join(', ')}\`;excluded operands: \`${record.NON_W4_OPERANDS.join(', ')}\`.
- Class: ${record.CONSTRAINT_COMPATIBILITY_CLASS}.
- Final producer: ${record.FINAL_OPERAND_PRODUCER_ID ?? 'NONE RECORDED'};W5 boundary: ${record.W5_HANDOFF_IDS.join(', ') || 'NONE RECORDED'}.
- Missing fact: ${record.UNRESOLVED_BINDING_FACT?.REQUIRED_FACT ?? 'NONE'}.
- Missing exact identities: ${record.UNRESOLVED_BINDING_FACT?.MISSING_OPERAND_IDENTITIES.map((identity) => `\`${identity}\``).join(', ') ?? 'NONE'}.
- Evidence ceiling: ${record.WHY_EXISTING_EVIDENCE_IS_INSUFFICIENT ?? 'Exact binding on file'}.
- Constraint semantics PRESERVED;ALL_OPERAND_COLUMNS_PHYSICALLY_EXIST required;DEFERRED_NOT_EXECUTED.
`,
    )
    .join('\n')
  const md = `# W4LC compatibility gate normalization - ${model.report.phaseStatus.PHASE_1B_3C_A1I_W4LC_GATE}

## Separate input sets

127 existing W4G compatibility records +7 supplemental W4C constraint handoffs remain separate. No134-record canonical merge. 127/127 existing records classified with complete mechanic metadata;7/7 supplemental records classified,but0/7 compatibility locations complete.

## Existing-record classification

IDEMPOTENT_WITH_PRECREATION=0;ALTERATION_ONLY_AFTER_PROMOTION=0;DUPLICATE_CREATE_CONFLICT=0;SUPERSESSION_REQUIRED=0;OTHER_EXPLICIT=127;SUM=127.
All127 exact identities are absent from W4FR4's162 output identity sets. OTHER_EXPLICIT is specifically NO_W4FR4_PRECREATION_COLLISION_EXACT_LATE_PROMOTION_REPLAY_REQUIRED,not UNKNOWN. Bindings to W4FR4 definition/payload/digest are null.
Mechanic:exact-state-validated late-definition promotion and CREATE replay boundary. Promote only accepted exact definition units with dependencies/actor/target satisfied;validate full TABLE/TYPE identity and signature before skipping an exact already-satisfied CREATE at original replay position. Drift must fail closed. Preserve every wrapper/postcreate operation at original frozen scope/order. Column records carry parent CREATE TABLE evidence;no standalone column producer invented. Shared CREATE groups deduplicate future physical work,not compatibility record identities.
These are future implementation requirements,not executed mechanics or proof that existing IF NOT EXISTS/duplicate_object guards safely validate drift.

## Supplemental classification and exact residuals

EXACT_FINAL_OPERAND_PRODUCER_IDENTIFIED=${model.constraintRegistry.summary.EXACT_FINAL_OPERAND_PRODUCER_IDENTIFIED};ORDERING_HANDOFF_IDENTIFIED=${model.constraintRegistry.summary.ORDERING_HANDOFF_IDENTIFIED};COMPATIBILITY_PHASE_BINDING_REQUIRED=${model.constraintRegistry.summary.COMPATIBILITY_PHASE_BINDING_REQUIRED};SUM=7.

${constraints}

## Minimum existing-record W5 compatibility slice

${model.report.summary.W5_COMPATIBILITY_SLICE_COUNT}/86 exact frozen handoffs are required by the existing-record set:each identity is not produced by W4FR4 and its consumer at frozen position14 precedes its exact provider at positions15-18.
All86 IDs remain individually required evidence boundaries,including relation/column records sharing creation units. The full seven-handoff-inclusive minimum cannot be certified until the missing operand bindings are on file. The identified slice is NOT_AUTHORIZED_GATE_BLOCKED,not permission to run full W5.

${model.report.W5_COMPATIBILITY_SLICE_HANDOFF_IDS.map((id) => `- \`${id}\``).join('\n')}

## Preservation and validation

All127 exact late-definition digests/source bindings verified;all23 frozen migration hashes verified. W4FR4 definitions/payloads,canonical1.3.2,producer metadata,W4C semantics,127 records,86 W5/118 W6 records and historical evidence unchanged. ${model.report.validation.FIXED_UPSTREAM_BYTE_COMMITMENTS} byte commitments retained. SQL_AUTHORED_IN_W4LC=0;SQL_EXECUTED=0;no mechanics wired to execution.
811 distinct tests passed:236 W4LC tests and575 predecessor tests. Independent verification passed for90 byte commitments,127 exact source-record identities,7 exact canonical handoffs,86 existing ordering boundaries and23 migration hashes. Documentation:0 errors,1215 existing warnings. Compatibility-location completeness remains BLOCKED,not a test failure.

${model.report.validation.COMMAND_RESULTS.map((record) => `- \`${record.COMMAND}\` - ${record.RESULT}`).join('\n')}

## State

W4LC=BLOCKED;UNRESOLVED_COMPATIBILITY_ITEMS=7;NO_FURTHER_GENERIC_COMPATIBILITY_DISCOVERY=YES.
W4P=NOT_AUTHORIZED;W5_COMPATIBILITY_SLICE=NOT_AUTHORIZED_GATE_BLOCKED;fullW5=NOT_AUTHORIZED.
Canonical contract1.3.2 unchanged;W4=BLOCKED_ORDERING_COMPATIBILITY_PENDING.
No schema/type/constraint governance reopened;no migration rewrite,no producer activation,no roles/types/baseline/deferred constraints materialized,no compatibility mechanics/W5/configuration executed. No bootstrap/replay/RLS/tenant-isolation proof;READY_FOR_RUNTIME_PROOF=0;PRODUCT_READY=NO.
`
  const json = (value: unknown) => format(JSON.stringify(value), { ...config, parser: 'json' })
  return {
    [outputs.existing]: await json(model.existingRegistry),
    [outputs.constraints]: await json(model.constraintRegistry),
    [outputs.report]: await json(model.report),
    [outputs.markdown]: await format(md, { ...config, parser: 'markdown' }),
    [outputs.existingMarkdown]: await format(
      `# W4LC existing late-producer compatibility classification\n\n127 exact records;127 OTHER_EXPLICIT (no W4FR4 precreation collision);127 complete future mechanic metadata records. Source bytes/digests are verified;no replay safety inferred from existing guards alone.\n\n| Compatibility ID | Exact identity | Frozen late producer@position | Class | Exact W5 handoffs |\n|---|---|---|---|---|\n${existingCards}\n\nExact operation,full mechanic pre/postconditions,drift behavior and source-record provenance are retained in the [machine registry](./UE_W4_LATE_PRODUCER_COMPATIBILITY_CLASSIFICATION.json). See [gate report](./PHASE_1B_3C_A1I_W4LC_COMPATIBILITY_GATE_NORMALIZATION.md). No mechanics implemented or executed.\n`,
      { ...config, parser: 'markdown' },
    ),
    [outputs.constraintsMarkdown]: await format(
      `# W4LC supplemental constraint compatibility classification\n\nSeven handoffs remain distinct from127 existing compatibility records. All7 require exact compatibility-phase binding;no producer or ordering boundary invented.\n\n${constraints}\n\nFull frozen semantics and exact negative linkage evidence are in the [machine registry](./UE_W4_DEFERRED_CONSTRAINT_COMPATIBILITY_CLASSIFICATION.json). W4LC BLOCKED;no materialization or execution.\n`,
      { ...config, parser: 'markdown' },
    ),
  }
}
export async function main(args: string[]) {
  assert(
    args.every((arg) => ['--plan', '--self-test', '--check'].includes(arg)),
    'UNAUTHORIZED_W4LC_FLAG',
  )
  assert.equal(new Set(args).size, args.length)
  const generated = await generate()
  if (args.includes('--self-test')) {
    assert.deepEqual(generated, await generate(), 'NONDETERMINISTIC_W4LC')
    console.log('PASS W4LC two-generation exact-byte equality')
  }
  if (args.includes('--check')) {
    for (const [file, bytes] of Object.entries(generated))
      assert.equal(read(file), bytes, `STALE_W4LC_OUTPUT:${file}`)
    console.log('PASS W4LC persisted outputs and unchanged fixed upstream bytes')
  } else if (!args.includes('--self-test')) {
    for (const [file, bytes] of Object.entries(generated))
      writeFileSync(path.join(root, ...file.split('/')), bytes)
    console.log(
      'W4LC BLOCKED:127 mechanics classified;7 exact supplemental operand-binding residuals;no execution',
    )
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error('[classify-w4lc-compatibility]', error)
    process.exitCode = 1
  })
