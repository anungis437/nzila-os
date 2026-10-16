import { describe, expect, it } from 'vitest'
import {
  buildClassification,
  classifyConstraint,
  classifyExisting,
  deriveSlice,
  files,
  generate,
  main,
  verifyLateDefinition,
  type Existing,
  type ManifestEntry,
  type Producer,
} from './classify-w4lc-compatibility'
import type { buildAuthoring } from './author-w4fr4-final-baseline'
import type { buildClosure } from './close-w4c-constraint-timing'
import { digest, read, sha } from './w4-physical-producers'

const model = buildClassification()
const governance: {
  lateProducerCompatibilityObligations: Existing[]
  lateDefinitionRegister: Parameters<typeof classifyExisting>[1]
} = JSON.parse(read(files.w4g))
const producer: Producer = JSON.parse(read(files.producer))
const canonical: { frozenMigrationManifest: ManifestEntry[] } = JSON.parse(read(files.canonical))
const registry: Awaited<ReturnType<typeof buildAuthoring>>['registry'] = JSON.parse(
  read(files.registry),
)
const payloads: Awaited<ReturnType<typeof buildAuthoring>>['payloads'] = JSON.parse(
  read(files.payloads),
)
const deferred: ReturnType<typeof buildClosure>['registry'] = JSON.parse(read(files.deferred))
const produced = new Set(
  [
    ...payloads.TYPE_PAYLOADS,
    ...payloads.RELATION_CREATE_PAYLOADS,
    ...payloads.ADD_COLUMN_PAYLOADS,
  ].flatMap((p) => p.PHYSICAL_IDENTITIES_PRODUCED),
)

describe('W4LC exact disjoint compatibility universes', () => {
  it.each(governance.lateProducerCompatibilityObligations)(
    'classifies exact existing record:$COMPATIBILITY_OBLIGATION_ID',
    (input) => {
      const record = model.existingRegistry.records.find(
        (record) => record.COMPATIBILITY_OBLIGATION_ID === input.COMPATIBILITY_OBLIGATION_ID,
      )!
      expect(record.SOURCE_RECORD).toEqual(input)
      expect(record.EXACT_LATE_DEFINITION_DIGEST).toBe(
        input.CANONICAL_DEFINITION_SOURCE.EXACT_DEFINITION_DIGEST,
      )
      expect(record.EXACT_LATE_DEFINITION).toEqual(
        input.CANONICAL_DEFINITION_SOURCE.EXACT_DEFINITION_EVIDENCE,
      )
      expect(record.W4FR4_PRECREATED_IDENTITY).toBe('NO')
      expect(produced.has(record.PHYSICAL_IDENTITY)).toBe(false)
      expect(record.W4FR4_CANONICAL_DEFINITION_ID).toBeNull()
      expect(record.W4FR4_PAYLOAD_ID).toBeNull()
      expect(record.W4FR4_DEFINITION_DIGEST).toBeNull()
      expect(record.COMPATIBILITY_CLASS).toBe('OTHER_EXPLICIT')
      expect(record.OTHER_COMPATIBILITY_CLASS).toBe(
        'NO_W4FR4_PRECREATION_COLLISION_EXACT_LATE_PROMOTION_REPLAY_REQUIRED',
      )
      expect(record.MECHANIC_COMPLETENESS).toBe('COMPLETE_CLASSIFICATION_METADATA_NOT_IMPLEMENTED')
      expect(record.LATE_PRODUCER_ID).toBe(input.CANONICAL_DEFINITION_SOURCE.FROZEN_MIGRATION_ID)
      expect(record.EXECUTION_REQUIRED_NOW).toBe('NO')
      expect(record.EXACT_REQUIRED_MECHANIC.DRIFT_STATE).toContain('Hard failure')
      expect(record.EXACT_REQUIRED_MECHANIC.WRAPPER_AND_POSTCREATE_PRESERVATION).toContain(
        'every non-CREATE operation',
      )
      expect(record.PRECONDITION).toBeTruthy()
      expect(record.POSTCONDITION).toBeTruthy()
      expect(record.MECHANIC_OWNER_PHASE).toBeTruthy()
      expect(record.W4P_EFFECT).toBeTruthy()
      expect(record.W5_EFFECT).toBeTruthy()
      expect(
        verifyLateDefinition(input.CANONICAL_DEFINITION_SOURCE, canonical.frozenMigrationManifest)
          .MIGRATION_NODE_ID,
      ).toBe(record.LATE_PRODUCER_ID)
    },
  )
  it.each(deferred.handoffs)(
    'retains exact constraint semantics and blocking operand facts:$DEFERRED_CONSTRAINT_HANDOFF_ID',
    (input) => {
      const record = model.constraintRegistry.records.find(
        (record) => record.DEFERRED_CONSTRAINT_HANDOFF_ID === input.DEFERRED_CONSTRAINT_HANDOFF_ID,
      )!
      expect(record.CANONICAL_HANDOFF).toEqual(input)
      expect(record.ORDERED_OPERAND_COLUMNS).toEqual(input.ORDERED_OPERAND_COLUMNS)
      expect(record.W4_OWNED_OPERANDS).toEqual(input.W4_OWNED_OPERANDS)
      expect(record.NON_W4_OPERANDS).toEqual(input.NON_W4_OPERANDS)
      expect(record.CONSTRAINT_COMPATIBILITY_CLASS).toBe('COMPATIBILITY_PHASE_BINDING_REQUIRED')
      expect(record.FINAL_OPERAND_PRODUCER_ID).toBeNull()
      expect(record.FINAL_OPERAND_ID).toBeNull()
      expect(record.FROZEN_POSITION).toBeNull()
      expect(record.W5_HANDOFF_IDS).toEqual([])
      expect(record.COMPATIBILITY_LOCATION_COMPLETE).toBe('NO')
      expect(record.UNRESOLVED_BINDING_FACT?.MISSING_OPERAND_IDENTITIES).toEqual(
        input.NON_W4_OPERAND_IDENTITIES,
      )
      expect(record.MATERIALIZATION_STATUS).toBe('DEFERRED_NOT_EXECUTED')
      expect(record.CONSTRAINT_SEMANTICS).toBe('PRESERVED')
      for (const evidence of record.LINKAGE_EVIDENCE) {
        expect(evidence.EXACT_LATE_DEFINITIONS).toEqual([])
        expect(evidence.EXACT_PLAN_ENTRIES).toEqual([])
        expect(evidence.EXACT_PLATFORM_PRODUCERS).toEqual([])
        expect(evidence.EXACT_DJANGO_PRODUCERS).toEqual([])
        expect(evidence.EXACT_AUTHORITY_BINDINGS).toEqual([])
        expect(evidence.EXACT_OPERAND_ORDERING_HANDOFFS).toEqual([])
      }
    },
  )
  it('keeps127 existing and7 supplemental denominators separate', () => {
    expect(model.existingRegistry.records).toHaveLength(127)
    expect(model.constraintRegistry.records).toHaveLength(7)
    expect(model.report.existingRecordClassificationAccounting).toEqual({
      IDEMPOTENT_WITH_PRECREATION: 0,
      ALTERATION_ONLY_AFTER_PROMOTION: 0,
      DUPLICATE_CREATE_CONFLICT: 0,
      SUPERSESSION_REQUIRED: 0,
      OTHER_EXPLICIT: 127,
      SUM: 127,
    })
    expect(model.report.supplementalHandoffClassificationAccounting).toEqual({
      EXACT_FINAL_OPERAND_PRODUCER_IDENTIFIED: 0,
      ORDERING_HANDOFF_IDENTIFIED: 0,
      COMPATIBILITY_PHASE_BINDING_REQUIRED: 7,
      SUM: 7,
    })
    expect(model.report.summary).toMatchObject({
      INPUT_SET_IDENTITY_PRESERVED: 'YES',
      UNACCOUNTED_EXISTING_RECORDS: 0,
      UNACCOUNTED_HANDOFFS: 0,
      EXISTING_RECORDS_WITH_COMPLETE_MECHANICS: 127,
      SUPPLEMENTAL_HANDOFFS_WITH_COMPLETE_LOCATION: 0,
    })
  })
  it.each(producer.w5OrderingHandoff)(
    'retains exact required ordering boundary:$ORDERING_RECORD_ID',
    (input) => {
      const record = model.report.minimumExistingRecordW5Slice.find(
        (record) => record.W5_HANDOFF_ID === input.ORDERING_RECORD_ID,
      )!
      expect(record).toBeDefined()
      expect(record.PHYSICAL_IDENTITY).toBe(input.PHYSICAL_IDENTITY)
      expect(record.CONSUMER_POSITION).toBeLessThan(record.LATE_PRODUCER_POSITION)
      const compatibility = governance.lateProducerCompatibilityObligations.find(
        (r) => r.PHYSICAL_IDENTITY === input.PHYSICAL_IDENTITY,
      )!
      expect(record.COMPATIBILITY_OBLIGATION_ID).toBe(compatibility.COMPATIBILITY_OBLIGATION_ID)
      expect(record.LATE_PRODUCER_ID).toBe(
        compatibility.CANONICAL_DEFINITION_SOURCE.FROZEN_MIGRATION_ID,
      )
      expect(record.FULL_W5_AUTHORIZED).toBe('NO')
    },
  )
  it('does not certify a global minimum or authorize a slice while7 locations remain unresolved', () => {
    expect(model.report.W5_COMPATIBILITY_SLICE_HANDOFF_IDS).toEqual(
      producer.w5OrderingHandoff.map((record) => record.ORDERING_RECORD_ID),
    )
    expect(model.report.summary.W5_SLICE_COMPLETENESS).toContain('GLOBAL_MINIMUM_BLOCKED')
    expect(model.report.phaseStatus).toMatchObject({
      PHASE_1B_3C_A1I_W4LC_GATE: 'BLOCKED',
      W4P: 'NOT_AUTHORIZED',
      W5_COMPATIBILITY_SLICE: 'NOT_AUTHORIZED_GATE_BLOCKED',
      W5: 'NOT_AUTHORIZED',
      CANONICAL_CONTRACT_VERSION: '1.3.2',
      W4: 'BLOCKED_ORDERING_COMPATIBILITY_PENDING',
    })
    expect(model.report.residualCompatibilityItems.map((record) => record.RESIDUAL_ID)).toEqual(
      deferred.handoffs.map((record) => record.DEFERRED_CONSTRAINT_HANDOFF_ID),
    )
  })
  it('derives relevance by exact identity and provider ordering,not a blanket86 requirement', () => {
    const input = governance.lateProducerCompatibilityObligations
    expect(
      deriveSlice(
        input,
        producer.w5OrderingHandoff,
        canonical.frozenMigrationManifest,
        new Set(input.map((record) => record.PHYSICAL_IDENTITY)),
      ),
    ).toEqual([])
    expect(
      deriveSlice([], producer.w5OrderingHandoff, canonical.frozenMigrationManifest, new Set()),
    ).toEqual([])
    expect(
      deriveSlice(
        input,
        [producer.w5OrderingHandoff[0]],
        canonical.frozenMigrationManifest,
        new Set(),
      ),
    ).toHaveLength(1)
    const invalid = structuredClone(producer.w5OrderingHandoff[0])
    invalid.LATER_PROVIDER = 'invented.sql'
    expect(() =>
      deriveSlice(input, [invalid], canonical.frozenMigrationManifest, new Set()),
    ).toThrow('W5_PROVIDER_LINK_DRIFT')
  })
  it('does not treat a relation-only handoff or similarly named operand as production proof', () => {
    const copy = structuredClone(producer)
    const h = deferred.handoffs[0]
    copy.w5OrderingHandoff.push({
      ...copy.w5OrderingHandoff[0],
      PHYSICAL_IDENTITY: `union-eyes::RELATION::${h.RELATION}`,
    })
    copy.canonicalProducerPlan.push({
      PRODUCER_ID: 'unbound',
      ORDER_INDEX: 999,
      EXPECTED_OUTPUT_IDENTITIES: [`${h.NON_W4_OPERAND_IDENTITIES[0]}_similar`],
    })
    const result = classifyConstraint(
      h,
      copy,
      governance.lateDefinitionRegister,
      canonical.frozenMigrationManifest,
    )
    expect(result.CONSTRAINT_COMPATIBILITY_CLASS).toBe('COMPATIBILITY_PHASE_BINDING_REQUIRED')
    expect(result.FINAL_OPERAND_PRODUCER_ID).toBeNull()
    expect(result.EXACT_RELATION_ORDERING_CANDIDATES).toHaveLength(1)
  })
  it('rejects an unproved new collision instead of name-based idempotence', () => {
    const input = governance.lateProducerCompatibilityObligations[0]
    const copy = structuredClone(payloads)
    copy.ADD_COLUMN_PAYLOADS[0].PHYSICAL_IDENTITIES_PRODUCED.push(input.PHYSICAL_IDENTITY)
    expect(() =>
      classifyExisting(
        input,
        governance.lateDefinitionRegister,
        producer,
        registry,
        copy,
        canonical.frozenMigrationManifest,
        [],
      ),
    ).toThrow('NEW_BASELINE_COLLISION_REQUIRES_EXACT_OPERATION_COMPARISON')
  })
  it('rejects drifted late definition and unlinked producer evidence', () => {
    const source = structuredClone(
      governance.lateProducerCompatibilityObligations[0].CANONICAL_DEFINITION_SOURCE,
    )
    source.EXACT_DEFINITION_EVIDENCE.EXACT_CREATE_CLAUSE += ' changed'
    expect(() => verifyLateDefinition(source, canonical.frozenMigrationManifest)).toThrow(
      'LATE_DEFINITION_DIGEST_DRIFT',
    )
    const copy = structuredClone(producer)
    copy.platformProducerRegistry = []
    expect(() =>
      classifyExisting(
        governance.lateProducerCompatibilityObligations[0],
        governance.lateDefinitionRegister,
        copy,
        registry,
        payloads,
        canonical.frozenMigrationManifest,
        [],
      ),
    ).toThrow('EXACT_PLATFORM_PRODUCER_LINK_REQUIRED')
  })
  it('verifies all23 frozen migration bytes and fixed upstream definition/contract bytes', () => {
    for (const record of canonical.frozenMigrationManifest)
      expect(sha(read(record.FILE))).toBe(record.SHA256)
    for (const [file, hash] of Object.entries(model.report.preservation.BYTE_COMMITMENTS))
      expect(sha(read(file))).toBe(hash)
    expect(model.report.preservation.W5_86_HANDOFFS_SHA256).toBe(digest(producer.w5OrderingHandoff))
    expect(model.report.preservation.SUPPLEMENTAL7_HANDOFFS_SHA256).toBe(digest(deferred.handoffs))
  })
  it('does not activate producer operations or materialize constraints', () => {
    expect(model.report.summary).toMatchObject({
      FROZEN_MIGRATIONS_REWRITTEN: 0,
      FROZEN_MIGRATION_HASH_DRIFT: 0,
      DEFERRED_CONSTRAINTS_MATERIALIZED: 0,
      MUTATING_OPERATIONS_ADDED: 0,
      PRODUCER_EXECUTION_ACTIVATED: 'NO',
      W4FR4_DEFINITION_BYTES_CHANGED: 'NO',
    })
    expect(model.report.proofBoundaries).toMatchObject({
      COMPATIBILITY_MECHANICS_EXECUTED: 'NO',
      W5_EXECUTED: 'NO',
      PHYSICAL_PRODUCERS_EXECUTED: 'NO',
      SQL_EXECUTED: 0,
      READY_FOR_RUNTIME_PROOF: 0,
      PRODUCT_READY: 'NO',
    })
    for (const record of producer.platformProducerRegistry) {
      expect(record.EXECUTION_ALLOWED).toBe('NO')
      expect(record.MUTATING_OPERATIONS).toEqual([])
    }
  })
  it('is deterministic across complete model and exact formatted outputs', async () => {
    expect(digest(buildClassification())).toBe(digest(model))
    expect(await generate()).toEqual(await generate())
  }, 120000)
  it.each(['--execute', '--discover', '--activate', '--rewrite', '--w4p', '--w5', '--publish'])(
    'rejects unauthorized flag:%s',
    async (flag) => {
      await expect(main([flag])).rejects.toThrow('UNAUTHORIZED_W4LC_FLAG')
    },
  )
})
