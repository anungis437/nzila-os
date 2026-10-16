import { beforeAll, describe, expect, it } from 'vitest'
import {
  buildImplementation,
  files,
  fixedHashes,
  generate,
  jsonBytes,
  loadSpecification,
  main,
  originalInputs,
  outputs,
} from './implement-w4p-platform-promotion'
import { object, restore } from './adopt-w4-platform-ownership'
import { digest, read, sha } from './w4-physical-producers'

let model: Awaited<ReturnType<typeof buildImplementation>>
beforeAll(async () => {
  model = await buildImplementation()
}, 120000)

describe('W4P offline implementation governance integration', () => {
  it('consumes the eight exact authorized handoffs and preserves corrected downstream cut', async () => {
    const { specification, input } = await loadSpecification()
    expect(Object.keys(files)).toHaveLength(8)
    expect(specification.invariants).toHaveLength(162)
    expect(specification.obligationIds).toHaveLength(183)
    expect(model.report.summary).toMatchObject({
      POST_W4P_REPLAY_RECORDS: 127,
      POST_W4P_ORDERING_HANDOFFS: 86,
      POST_W4P_DEFERRED_CONSTRAINTS: 7,
      UNRESOLVED_DOWNSTREAM_OPERAND_BINDINGS: 9,
      POST_W4P_ITEMS_IN_PROMOTION_PRECONDITION_GRAPH: 0,
    })
    expect(digest(input.cut)).toBe(specification.dependencyCutDigest)
    expect(sha(read(files.downstream))).toBe(specification.downstreamObligationDigest)
  })
  it('links every183 obligation exactly once without payload loss', () => {
    const links = model.implementation.registry.flatMap(
      (record) => record.DEFINITION_OBLIGATION_IDS,
    )
    expect(links).toHaveLength(183)
    expect(new Set(links).size).toBe(183)
    expect(model.implementation.registry).toHaveLength(162)
    expect(new Set(model.implementation.registry.map((record) => record.PAYLOAD_ID)).size).toBe(162)
    expect(model.implementation.coverage).toEqual({
      TYPE_HANDLERS: 36,
      RELATION_CREATE_HANDLERS: 57,
      ADD_COLUMN_HANDLERS: 69,
      TOTAL: 162,
      OBLIGATION_LINKS: 183,
      UNLINKED: 0,
      MULTI_LINKED: 0,
    })
  })
  it.each(Array.from({ length: 162 }, (_, index) => index))(
    'records all exact handlers,positions and SQL hashes for payload index:%s',
    (index) => {
      const record = model.implementation.registry[index]
      const invariant = model.specification.invariants.find(
        (invariant) => invariant.payload.PAYLOAD_ID === record.PAYLOAD_ID,
      )!
      expect(record.PLAN_POSITION).toBe(index + 1)
      expect(record.IMPLEMENTATION_HANDLER).toContain('#applyPromotion')
      expect(record.INSPECTION_HANDLER).toContain('#inspectPayload')
      expect(record.VERIFICATION_HANDLER).toContain('#verifyBaseline')
      expect(record.SQL_SHA256).toBe(invariant.payload.SQL_SHA256)
      expect(record.DEPENDENCY_IDS).toEqual(invariant.payload.DEPENDENCY_PAYLOAD_IDS)
      expect(record.EXECUTION_STATUS).toBe('IMPLEMENTED_NOT_EXECUTED')
      expect(record.EXECUTION_ALLOWED).toBe('NO')
    },
  )
  it('records the absent canonical concurrency helper as a denied future adapter residual', () => {
    expect(model.implementation.CONCURRENCY_GUARD).toBe('EXPLICIT_IMPLEMENTATION_RESIDUAL')
    expect(model.implementation.CONCURRENCY_RESIDUAL).toContain('apply is denied')
    expect(model.implementation.authorization.DEFAULT_EXECUTION_AUTHORIZATION).toBe('DENY')
    expect(model.implementation.authorization.CURRENT_EXECUTION_ALLOWED).toBe('NO')
  })
  it('does not mislabel offline planning as authenticated inspection or a runtime receipt', () => {
    expect(model.plan.PER_PAYLOAD_INSPECTION_RESULT).toHaveLength(162)
    expect(
      model.plan.PER_PAYLOAD_INSPECTION_RESULT.every(
        (result) => result.STATE === 'PRECONDITION_MISSING',
      ),
    ).toBe(true)
    expect(
      model.plan.PER_PAYLOAD_PLANNED_ACTION.every((result) => result.ACTION === 'FAIL_CLOSED'),
    ).toBe(true)
    expect(model.plan.PLAN_STATE).toBe('OFFLINE_IMPLEMENTATION_PLAN_NOT_RUNTIME_INSPECTION')
    expect(model.plan.DAG).toMatchObject({
      PAYLOAD_NODES: 162,
      CYCLE_COUNT: 0,
      UNRESOLVED_DEPENDENCY_EDGES: 0,
    })
  })
  it('amends only implementation metadata and preserves exact inverse1.3.2 contracts', async () => {
    const original = await originalInputs()
    const amendedCanonical = object(JSON.parse(model.canonicalBytes))
    const amendedProducer = object(JSON.parse(model.producerBytes))
    expect(amendedCanonical.CONTRACT_VERSION).toBe('1.3.3')
    expect(object(amendedCanonical.platformBaselinePromotionImplementation)).toMatchObject({
      AMENDMENT: 'PLATFORM_BASELINE_PROMOTION_IMPLEMENTATION',
      DEFINITION_COMPLETE: 'YES',
      PROMOTION_IMPLEMENTATION_COMPLETE: 'YES',
      PROMOTION_EXECUTED: 'NO',
      MATERIALIZATION_EXECUTED: 'NO',
      RUNTIME_PROOF_COMPLETE: 'NO',
    })
    expect(
      await jsonBytes(
        restore(
          amendedCanonical,
          model.report.versionAmendment.PRIOR_JSON_INVERSE_PATCHES.canonical,
        ),
      ),
    ).toBe(original.canonicalBytes)
    expect(
      await jsonBytes(
        restore(amendedProducer, model.report.versionAmendment.PRIOR_JSON_INVERSE_PATCHES.producer),
      ),
    ).toBe(original.producerBytes)
    const oldProducer: { platformProducerRegistry: Record<string, unknown>[] } = JSON.parse(
      original.producerBytes,
    )
    const newProducer: { platformProducerRegistry: Record<string, unknown>[] } = JSON.parse(
      model.producerBytes,
    )
    let changed = 0
    for (let index = 0; index < oldProducer.platformProducerRegistry.length; index++) {
      const old = oldProducer.platformProducerRegistry[index],
        current = newProducer.platformProducerRegistry[index]
      if (old.DEFINITION_SOURCE_CLASS === 'GOVERNED_W4FR4') {
        changed++
        const added = Object.fromEntries(
          Object.entries(current).filter(([key]) => !key.startsWith('W4P_')),
        )
        expect(added).toEqual(old)
        expect(current.W4P_IMPLEMENTATION_STATUS).toBe('COMPLETE_NOT_EXECUTED')
      } else expect(current).toEqual(old)
    }
    expect(changed).toBe(183)
  })
  it('proves the full1.3.3-to1.0 chain with exact historical hashes', () => {
    expect(
      model.report.versionAmendment.VERSION_CHAIN_RECONSTRUCTION.map((step) => step.VERSION),
    ).toEqual(['1.3.3', '1.3.2', '1.3.1', '1.3', '1.2', '1.1', '1.0'])
    expect(
      model.report.versionAmendment.VERSION_CHAIN_RECONSTRUCTION.every((step) =>
        /^[a-f0-9]{64}$/.test(step.SHA256),
      ),
    ).toBe(true)
    expect(sha(model.canonicalBytes)).toBe(model.report.versionAmendment.VERSION_1_3_3_SHA256)
    expect(model.report.versionAmendment.VERSION_1_3_2_SHA256).toBe(fixedHashes[files.canonical])
  })
  it('preserves original canonical/producer Markdown and adds current nonruntime truth only', () => {
    expect(model.amendedMarkdown.canonical.startsWith(model.report.priorMarkdown.canonical)).toBe(
      true,
    )
    expect(model.amendedMarkdown.producer.startsWith(model.report.priorMarkdown.producer)).toBe(
      true,
    )
    expect(sha(model.amendedMarkdown.canonical)).toBe(model.report.amendedMarkdownSha.canonical)
    expect(sha(model.amendedMarkdown.producer)).toBe(model.report.amendedMarkdownSha.producer)
  })
  it.each(Object.entries(fixedHashes))(
    'verifies exact upstream/reconstructed bytes:%s',
    async (file, expected) => {
      const original = await originalInputs()
      const bytes =
        file === files.canonical
          ? original.canonicalBytes
          : file === files.producer
            ? original.producerBytes
            : read(file)
      expect(sha(bytes)).toBe(expected)
    },
  )
  it('retains all activation flags denied recursively', () => {
    const check = (value: unknown): void => {
      if (!value || typeof value !== 'object') return
      for (const [key, child] of Object.entries(value)) {
        if (key === 'EXECUTION_ALLOWED') expect(child).toBe('NO')
        if (key === 'MUTATING_OPERATIONS') expect(child).toEqual([])
        check(child)
      }
    }
    check(JSON.parse(model.canonicalBytes))
    check(JSON.parse(model.producerBytes))
    expect(model.report.proofBoundaries).toMatchObject({
      W4P_EXECUTED: 'NO',
      SQL_EXECUTED: 0,
      PRODUCERS_ACTIVATED: 0,
      W5_EXECUTED: 'NO',
      READY_FOR_RUNTIME_PROOF: 0,
      PRODUCT_READY: 'NO',
    })
    expect(model.report.phaseStatus).toMatchObject({
      W4: 'PASS',
      W5: 'AUTHORIZED_NOT_STARTED',
      W4P_RUNTIME_EXECUTION: 'NOT_AUTHORIZED',
      CANONICAL_CONTRACT_VERSION: '1.3.3',
    })
  })
  it('generates exact deterministic artifact/contract bytes without invoking DB adapters', async () => {
    expect(digest(await buildImplementation())).toBe(digest(model))
    const first = await generate()
    expect(first).toEqual(await generate())
    expect(Object.keys(first)).toHaveLength(10)
    expect(first[outputs.plan]).toBe(await jsonBytes(model.plan))
    expect(first[files.canonical]).toBe(model.canonicalBytes)
    expect(first[files.producer]).toBe(model.producerBytes)
  }, 120000)
  it.each([
    '--apply',
    '--execute',
    '--inspect',
    '--database',
    '--w5',
    '--publish',
    '--rewrite',
    '--discover',
  ])('rejects unauthorized CLI mode:%s', async (flag) => {
    await expect(main([flag])).rejects.toThrow('UNAUTHORIZED_W4P_FLAG')
  })
})
