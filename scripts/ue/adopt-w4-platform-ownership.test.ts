import { describe, expect, it } from 'vitest'
import {
  adoptionModel,
  files,
  generate,
  inverse,
  main,
  object,
  outputs,
  requiredFields,
  restore,
  validateHeldUniverse,
} from './adopt-w4-platform-ownership'
import { digest, exactIds, read, sha, type buildProducerContract } from './w4-physical-producers'
import type { buildAdjudication } from './adjudicate-w4-ownership'

type W4D = Awaited<ReturnType<typeof buildAdjudication>>
type Producer = ReturnType<typeof buildProducerContract>
const accepted: W4D = JSON.parse(read(files.w4d))
const producer: Producer = JSON.parse(read(files.w4))
const model = adoptionModel(accepted, producer)

describe('W4G prospective governance only', () => {
  it('adopts exact310 decisions while preserving269/41 and127/183 partitions', () => {
    exactIds(
      model.adoption.map((d) => d.DECISION_ID),
      accepted.decisionAdjudication.map((d) => d.DECISION_ID),
    )
    expect(model.adoption).toHaveLength(310)
    expect(
      model.adoption.filter((d) => ['RELATION', 'COLUMN'].includes(d.OBJECT_KIND)),
    ).toHaveLength(269)
    expect(model.adoption.filter((d) => d.OBJECT_KIND === 'TYPE')).toHaveLength(41)
    expect(model.lateDefinitions).toHaveLength(127)
    expect(model.definitions).toHaveLength(183)
    expect(
      model.adoption.every(
        (d) =>
          d.OWNERSHIP_DECISION === 'APPROVED' &&
          d.OWNERSHIP_AUTHORITY === 'HUMAN_GOVERNANCE_W4G' &&
          d.OWNERSHIP_STATUS === 'PLATFORM_BASELINE_GOVERNANCE_ADOPTED',
      ),
    ).toBe(true)
  })
  it('uses no generic definition state and does not approve implementation', () => {
    expect(
      model.adoption.every(
        (d) =>
          ['EXACT_LATE_FROZEN_DEFINITION_AVAILABLE', 'NEW_CANONICAL_DEFINITION_REQUIRED'].includes(
            d.DEFINITION_STATUS,
          ) &&
          d.W4_IMPLEMENTATION_COMPLETE === 'NO' &&
          d.PRODUCER_ACTIVATED === 'NO' &&
          d.RUNTIME_PROVEN === 'NO',
      ),
    ).toBe(true)
  })
  it('preserves every127 exact source/hash/definition/migration/order without rewriting', () => {
    for (const d of model.lateDefinitions) {
      const original = accepted.decisionAdjudication.find((a) => a.DECISION_ID === d.DECISION_ID)!
      const source = d.CANONICAL_DEFINITION_SOURCE!
      const prior = original.ACTIVE_DEFINITION_CANDIDATES[0]
      expect(source.ACCEPTED_W4D_CANDIDATE).toEqual(prior)
      expect(source.SOURCE_FILE).toBe(prior.SOURCE_FILE)
      expect(source.SOURCE_SHA256).toBe(prior.SOURCE_FILE_SHA256)
      expect(source.SOURCE_LINE_OR_RANGE[0]).toBe(prior.SOURCE_LINE)
      expect(sha(source.EXACT_DEFINITION_EVIDENCE.EXACT_CREATE_CLAUSE)).toBe(
        source.EXACT_DEFINITION_DIGEST,
      )
      expect(source.FROZEN_MIGRATION_ID).toBe(prior.FROZEN_MIGRATION_ID)
      expect(source.FROZEN_POSITION).toBe(prior.FROZEN_PRODUCER_POSITION)
      expect(d.DEFINITION_REWRITTEN).toBe('NO')
    }
  })
  it('creates183 unique bounded authoring obligations, no type/enum/function invention', () => {
    expect(new Set(model.definitions.map((d) => d.DEFINITION_OBLIGATION_ID)).size).toBe(183)
    exactIds(
      model.definitions.map((d) => d.SOURCE_W4_DECISION_ID),
      accepted.decisionAdjudication
        .filter((d) => !d.ACTIVE_DEFINITION_CANDIDATES.length)
        .map((d) => d.DECISION_ID),
    )
    expect(
      model.definitions.every(
        (d) =>
          d.CURRENT_DEFINITION_STATUS === 'NOT_AUTHORED' &&
          d.DEFINITION_REVIEW_REQUIRED === 'YES' &&
          d.DDL_AUTHORIZED === 'NO' &&
          d.DEFINITION_AUTHORING_OWNER === 'W4F_CANONICAL_DEFINITION_AUTHORING',
      ),
    ).toBe(true)
  })
  it('requires every explicit relation/column physical field and prohibits inference', () => {
    for (const d of model.definitions) {
      expect(d.FORBIDDEN_INFERENCE_CLASSES).toHaveLength(8)
      expect(d.REQUIRED_OUTPUT_FIELDS).toEqual(
        d.OBJECT_KIND === 'RELATION' ? requiredFields.RELATION : requiredFields.COLUMN,
      )
      expect(d.AVAILABLE_CONSUMER_EVIDENCE.REQUIRED_BEFORE_CONSUMER_IDS.length).toBeGreaterThan(0)
    }
    expect(requiredFields.TYPE).toContain('complete enum members or underlying definition')
    expect(requiredFields.FUNCTION).toContain('PUBLIC EXECUTE posture')
  })
  it('does not assume precreation idempotency or authorize W5/W4P', () => {
    expect(model.compatibility).toHaveLength(127)
    expect(new Set(model.compatibility.map((d) => d.COMPATIBILITY_OBLIGATION_ID)).size).toBe(127)
    expect(
      model.compatibility.every(
        (d) =>
          d.LATE_PRODUCER_COMPATIBILITY === 'UNRESOLVED_PENDING_W5' &&
          d.W5_AUTHORIZED === 'NO' &&
          d.W4P_AUTHORIZED === 'NO',
      ),
    ).toBe(true)
    expect(
      model.compatibility.every((d) =>
        d.REQUIRED_W5_DISPOSITIONS.includes('DUPLICATE_CREATE_CONFLICT'),
      ),
    ).toBe(true)
  })
  it('updates only producer governance metadata, preserving every original field', () => {
    for (const p of producer.platformProducerRegistry) {
      const updated = model.registry.find((u) => u.PRODUCER_ID === p.PRODUCER_ID)!
      for (const [key, value] of Object.entries(p)) expect(Reflect.get(updated, key)).toEqual(value)
      expect(updated.CANONICAL_OWNER).toBe('PLATFORM_BASELINE')
      expect(updated.MUTATING_OPERATIONS).toEqual([])
      expect(updated.EXECUTION_ALLOWED).toBe('NO')
    }
  })
  it('retains exact86 W5 IDs and no final position/activation claim', () => {
    exactIds(
      model.ordering.map((d) => d.ORDERING_RECORD_ID),
      accepted.w5OrderingHandoff.map((d) => d.ORDERING_RECORD_ID),
    )
    for (const d of model.ordering) {
      expect(d.W5_AUTHORIZED).toBe('NO')
      if (d.DECISION_ID) {
        expect(d.W4_CREATION_AUTHORITY).toBe('PLATFORM_BASELINE')
        expect(d.PRODUCER_ID).toBeNull()
        expect(d.PRODUCER_POSITION_CLASS).toContain('NOT_ESTABLISHED')
      }
    }
  })
  it('preserves118 opaque records unchanged when accepted evidence has no intersection', () => {
    expect(model.opaque).toHaveLength(118)
    expect(model.opaque).toEqual(producer.w6OpaqueBindingHandoff)
    expect(
      model.opaque.every((d) => d.W6_SEMANTIC_BINDING_REQUIRED === 'YES' && d.W6_STARTED === 'NO'),
    ).toBe(true)
  })
  it('updates only physical ownership metadata for a real opaque intersection', () => {
    const changed = structuredClone(producer)
    const target = changed.platformProducerRegistry[0]
    changed.w6OpaqueBindingHandoff[0] = {
      ...changed.w6OpaqueBindingHandoff[0],
      W4_INTERSECTION: 'YES',
      W4_PHYSICAL_PRODUCER_ID: target.PRODUCER_ID,
      PHYSICAL_OBJECT_IDENTITY: target.PHYSICAL_IDENTITIES[0],
    }
    const projected = adoptionModel(accepted, changed)
    expect(projected.opaque[0]).toEqual({
      ...changed.w6OpaqueBindingHandoff[0],
      CANONICAL_PHYSICAL_OWNER: 'PLATFORM_BASELINE',
      W6_SEMANTIC_BINDING_REQUIRED: 'YES',
    })
  })
  it('preserves768 original closure IDs and downstream runtime boundaries', () => {
    exactIds(
      model.linkage.map((d) => d.OBLIGATION_ID),
      accepted.obligationLinkage.map((d) => d.OBLIGATION_ID),
    )
    expect(model.linkage).toHaveLength(768)
    expect(model.linkage.every((d) => d.RUNTIME_PROVEN === 'NO')).toBe(true)
  })
  it.each(['lost', 'duplicate', 'financial', 'conflict', 'hash', 'earlier'] as const)(
    'rejects %s drift before governance adoption',
    (kind) => {
      const changed = structuredClone(accepted)
      if (kind === 'lost') changed.decisionAdjudication.pop()
      if (kind === 'duplicate') changed.decisionAdjudication[1] = changed.decisionAdjudication[0]
      if (kind === 'financial')
        changed.decisionAdjudication[0].DATABASE_SCOPE_ID = 'FINANCIAL_SERVICE'
      if (kind === 'conflict') changed.summary.TOTAL.HELD_CONFLICTING_AUTHORITY = 1
      const late = changed.decisionAdjudication.find((d) => d.ACTIVE_DEFINITION_CANDIDATES.length)!
      if (kind === 'hash')
        late.ACTIVE_DEFINITION_CANDIDATES[0].DEFINITION_EVIDENCE!.EXACT_CREATE_CLAUSE += 'changed'
      if (kind === 'earlier')
        late.ACTIVE_DEFINITION_CANDIDATES[0].PRODUCER_PRECEDES_FIRST_CONSUMER = 'YES'
      expect(() => validateHeldUniverse(changed, producer)).toThrow()
    },
  )
  it('rejects attempts to reassign Django-owned physical identities', () => {
    const changed = structuredClone(producer)
    changed.djangoProducerRegistry[0].PREREQUISITE_ID =
      accepted.decisionAdjudication[0].PREREQUISITE_ID
    expect(() => validateHeldUniverse(accepted, changed)).toThrow(
      'DJANGO_OWNERSHIP_MUST_NOT_BE_REASSIGNED',
    )
  })
})

describe('W4G inverse preservation and persistent output', () => {
  it('reconstructs objects,removed keys,arrays and key order exactly', () => {
    const before = { key: { old: 1, tail: 2 }, list: [1, 2], old: true }
    const after = { key: { added: 3, tail: 2 }, list: [9], added: true }
    expect(JSON.stringify(restore(after, inverse(before, after)))).toBe(JSON.stringify(before))
  })
  it('preserves root replacement and false/null values', () => {
    expect(restore({ current: true }, inverse(null, { current: true }))).toBeNull()
    expect(restore({ value: true }, inverse({ value: false }, { value: true }))).toEqual({
      value: false,
    })
  })
  it('rejects invalid JSON record input', () => {
    expect(() => object([])).toThrow('EXPECTED_JSON_RECORD')
  })
  it('checks persistent governance metadata,not rewritten frozen reports', async () => {
    const result = await generate()
    for (const [file, bytes] of Object.entries(result)) expect(read(file)).toBe(bytes)
    const report = object(JSON.parse(result[outputs.report]))
    expect(report.CONTRACT_VERSION).toBe('1.3.1')
    const phase = object(report.phaseStatus)
    expect(phase.W4).toBe('BLOCKED_IMPLEMENTATION_PENDING')
    expect(phase.W4F).toBe('AUTHORIZED_NOT_STARTED')
    expect(phase.W5).toBe('NOT_AUTHORIZED')
    expect(phase.W4D).toBe('BLOCKED')
    expect(phase.PHASE_1B_3C_A1I_W4_GATE).toBe('BLOCKED')
    const preservation = object(report.preservation)
    expect(preservation[files.w4]).toBe(sha(read(files.w4)))
    expect(preservation[files.w4d]).toBe(sha(read(files.w4d)))
    expect(digest(producer.djangoProducerRegistry)).toBe(
      object(report.acceptedSectionDigests).DJANGO_372,
    )
  }, 240000)
  it.each([['--apply'], ['--execute'], ['--unknown'], ['--check', '--check']])(
    'rejects mutation/unknown/duplicate flags %j',
    async (...args) => {
      await expect(main(args)).rejects.toThrow()
    },
  )
})
