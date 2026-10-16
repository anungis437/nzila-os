import { describe, expect, it } from 'vitest'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import { replayDigest, replayText } from './post-w4p-replay'
import {
  applyReplayScope,
  executionPlanDigest,
  verifyUnitReceipt,
  type ReplayExecutionSpecification,
  type ReplayExecutionContext,
  type ReplayExecutionAuthorization,
  type ReplayExclusiveAdapter,
  type ReplayExecutionClient,
  type ReplayUnitHandler,
  type ReplayUnitReceipt,
} from './post-w4p-execution'

const loaded = loadFrozenReplay()
const frozen = loaded.frozen
const specification: ReplayExecutionSpecification = {
  frozen,
  graphDigest: replayDigest(frozen.input.graph),
  topologyDigest: replayDigest(frozen.input.topology),
  w4pPlanDigest: replayText(frozen.input.promotionPlan.PLAN_DIGEST),
  supplementPlanDigest: replayDigest('fake-supplement'),
  units: frozen.order.map((ordered) => {
    const node = frozen.nodes.find((node) => node.REPLAY_UNIT_ID === ordered.REPLAY_UNIT_ID)!
    const record = frozen.register.BOUND_REPLAY_RECORDS
    if (!Array.isArray(record)) throw new Error('FAKE_REGISTER_REQUIRED')
    const witness = record.find(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        !Array.isArray(entry) &&
        entry.REPLAY_UNIT_ID === node.REPLAY_UNIT_ID,
    )
    const file = replayText(node.SOURCE_FILE),
      source = loaded.sourceBytes[file]
    let sql = source
    if (witness && typeof witness === 'object' && !Array.isArray(witness)) {
      const range = witness.SOURCE_RANGE
      if (!Array.isArray(range) || typeof range[0] !== 'number' || typeof range[1] !== 'number')
        throw new Error('FAKE_RANGE_REQUIRED')
      sql = source.slice(range[0], range[1])
    }
    return {
      node,
      sql,
      predecessors: frozen.edges
        .filter((edge) => edge.TO === node.REPLAY_UNIT_ID)
        .map((edge) => replayText(edge.FROM)),
      contractDigest: replayDigest([
        'FAKE_CONTROL_FLOW_CONTRACT_NOT_A_REAL_CATALOG_COMPARATOR',
        node,
      ]),
      transactionClass: 'TRANSACTION_COMPATIBLE',
    }
  }),
}
const context: ReplayExecutionContext = {
  scope: 'UE_OPERATIONAL',
  actorClass: 'MIGRATION_ADMIN',
  actorPrincipal: 'fake-admin',
  targetDigest: replayDigest('fake-op-target'),
  w4pPlanDigest: specification.w4pPlanDigest,
  w4pVerificationDigest: replayDigest('fake-w4p-verification'),
  supplementPlanDigest: specification.supplementPlanDigest,
  supplementVerificationDigest: replayDigest('fake-supplement-verification'),
  exclusiveExecutionReference: 'fake-only-transaction',
}
const authorization: ReplayExecutionAuthorization = {
  purpose: 'POST_W4P_REPLAY',
  executionApproved: true,
  planDigest: executionPlanDigest(specification),
  graphDigest: specification.graphDigest,
  scope: context.scope,
  targetDigest: context.targetDigest,
  actorPrincipal: context.actorPrincipal,
  w4pVerificationDigest: context.w4pVerificationDigest,
  supplementVerificationDigest: context.supplementVerificationDigest,
}
function harness(complete = false, failAt = 0, failCommit = false) {
  const pinnedContext = { ...context }
  const initial = specification.units.filter((unit) => unit.node.DATABASE_SCOPE === context.scope)
  const state = new Set<string>(
    complete ? initial.map((unit) => replayText(unit.node.REPLAY_UNIT_ID)) : [],
  )
  const receipts = new Map<string, ReplayUnitReceipt>()
  const trace: string[] = []
  const handlers: ReplayUnitHandler[] = specification.units.map((unit) => ({
    unitId: replayText(unit.node.REPLAY_UNIT_ID),
    contractDigest: unit.contractDigest,
    async inspect() {
      return {
        state: state.has(replayText(unit.node.REPLAY_UNIT_ID))
          ? 'ALREADY_COMPLETE'
          : 'REPLAY_REQUIRED',
        ownedStateDigest: replayDigest([unit.node.REPLAY_UNIT_ID, 'fake-owned-definition']),
        verificationDigest: replayDigest([unit.node.REPLAY_UNIT_ID, 'fake-verification']),
      }
    },
  }))
  const adapter: ReplayExclusiveAdapter = {
    async withExclusiveTransaction(work) {
      const before = new Set(state),
        previous = new Map(receipts)
      trace.push('begin')
      try {
        const client: ReplayExecutionClient = {
          async context() {
            return { ...pinnedContext }
          },
          async query() {
            throw new Error('FAKE_HANDLERS_HAVE_NO_REAL_CATALOG_READER')
          },
          async readReceipt(id) {
            return receipts.get(id) ?? null
          },
          async stageReceipt(receipt) {
            trace.push('receipt:' + receipt.UNIT_ID)
            receipts.set(receipt.UNIT_ID, receipt)
          },
          async execute(sql) {
            const unit = specification.units.find((unit) => unit.sql === sql)
            if (!unit) throw new Error('FAKE_SOURCE_BYTES_CHANGED')
            trace.push('send:' + replayText(unit.node.REPLAY_UNIT_ID))
            if (failAt && trace.filter((entry) => entry.startsWith('send:')).length === failAt)
              throw new Error('FAKE_SEND_FAILED')
            state.add(replayText(unit.node.REPLAY_UNIT_ID))
          },
        }
        const result = await work(client)
        if (failCommit) throw new Error('FAKE_COMMIT_FAILED')
        trace.push('commit')
        return result
      } catch (error) {
        state.clear()
        before.forEach((id) => state.add(id))
        receipts.clear()
        previous.forEach((receipt, id) => receipts.set(id, receipt))
        trace.push('rollback')
        throw error
      }
    },
  }
  return { adapter, handlers, trace, state, receipts, pinnedContext }
}
describe('replay orchestration control-flow model;not107real-handler coverage proof', () => {
  it('authenticates a complete historical predecessor chain before refreshing it in a new transaction', async () => {
    const fake = harness()
    const first = await applyReplayScope(
      specification,
      context,
      fake.handlers,
      fake.adapter,
      authorization,
    )
    const nextContext = {
      ...context,
      exclusiveExecutionReference: 'different-fake-only-transaction',
    }
    fake.pinnedContext.exclusiveExecutionReference = nextContext.exclusiveExecutionReference
    fake.trace.length = 0
    const next = await applyReplayScope(
      specification,
      nextContext,
      fake.handlers,
      fake.adapter,
      authorization,
    )
    expect(next.REPLAYED).toBe(0)
    expect(next.NOOP).toBe(106)
    expect(next.FINAL_UNIT_VERIFICATIONS.map((entry) => entry.UNIT_ID)).toEqual(
      first.UNIT_RECEIPTS.map((entry) => entry.UNIT_ID),
    )
    expect(
      next.UNIT_RECEIPTS.every(
        (entry) => entry.EXCLUSIVE_EXECUTION_REFERENCE === nextContext.exclusiveExecutionReference,
      ),
    ).toBe(true)
    expect(fake.trace.some((entry) => entry.startsWith('send:'))).toBe(false)
  })
  it('rejects a self-consistent receipt whose claimed historical predecessor was forged', async () => {
    const fake = harness()
    const result = await applyReplayScope(
      specification,
      context,
      fake.handlers,
      fake.adapter,
      authorization,
    )
    const receipt = result.UNIT_RECEIPTS.find(
      (entry) => entry.PREDECESSOR_RECEIPT_DIGESTS.length > 0,
    )!
    const { RECEIPT_DIGEST, ...body } = receipt
    expect(RECEIPT_DIGEST).toBe(replayDigest(body))
    const changed = {
      ...body,
      PREDECESSOR_RECEIPT_DIGESTS: body.PREDECESSOR_RECEIPT_DIGESTS.map((entry) => ({
        ...entry,
        DIGEST: replayDigest('forged-predecessor'),
      })),
    }
    fake.receipts.set(receipt.UNIT_ID, { ...changed, RECEIPT_DIGEST: replayDigest(changed) })
    fake.trace.length = 0
    await expect(
      applyReplayScope(specification, context, fake.handlers, fake.adapter, authorization),
    ).rejects.toThrow('REPLAY_STORED_PREDECESSOR_RECEIPT_INVALID')
    expect(fake.trace).toEqual(['begin', 'rollback'])
  })
  it('does not rerun an authenticated receipted unit when its owned effects disappear', async () => {
    const fake = harness()
    const result = await applyReplayScope(
      specification,
      context,
      fake.handlers,
      fake.adapter,
      authorization,
    )
    fake.state.delete(result.UNIT_RECEIPTS[0].UNIT_ID)
    fake.trace.length = 0
    await expect(
      applyReplayScope(specification, context, fake.handlers, fake.adapter, authorization),
    ).rejects.toThrow('REPLAY_RECEIPTED_EFFECT_MISSING')
    expect(fake.trace).toEqual(['begin', 'rollback'])
    expect(fake.receipts.size).toBe(106)
  })
  it('denies an unknown scope and a detached frozen view before touching the adapter', async () => {
    const fake = harness()
    const unknownContext = { ...context }
    Reflect.set(unknownContext, 'scope', 'UNKNOWN')
    await expect(
      applyReplayScope(specification, unknownContext, fake.handlers, fake.adapter, authorization),
    ).rejects.toThrow('REPLAY_DATABASE_SCOPE_INVALID')
    const detached = structuredClone(specification)
    detached.frozen.register = { ...detached.frozen.register, NOT_AUTHORIZED_CHANGE: true }
    await expect(
      applyReplayScope(detached, context, fake.handlers, fake.adapter, authorization),
    ).rejects.toThrow('REPLAY_EXECUTION_FROZEN_VIEW_DRIFT')
    expect(fake.trace).toEqual([])
  })
  it('does not treat rewritten semantic commitments as accepted frozen authority', async () => {
    const fake = harness()
    const forged = structuredClone(specification)
    forged.frozen.input.graph.NOT_AUTHORIZED_CHANGE = true
    forged.graphDigest = replayDigest(forged.frozen.input.graph)
    const commitments = forged.frozen.input.w5a.determinismDigests
    if (!commitments || typeof commitments !== 'object' || Array.isArray(commitments))
      throw new Error('FAKE_COMMITMENTS_REQUIRED')
    commitments.REPLAY_GRAPH_SHA256 = forged.graphDigest
    await expect(
      applyReplayScope(forged, context, fake.handlers, fake.adapter, authorization),
    ).rejects.toThrow('REPLAY_EXECUTION_FROZEN_AUTHORITY_DRIFT')
    expect(fake.trace).toEqual([])
  })
  it('rejects complete-shaped noop observations when the owned state changes between reads', async () => {
    const fake = harness(true)
    const first = fake.handlers[0],
      original = first.inspect
    let calls = 0
    first.inspect = async (...parameters) => {
      const observation = await original(...parameters)
      return { ...observation, ownedStateDigest: replayDigest(['unapproved-noop-drift', ++calls]) }
    }
    await expect(
      applyReplayScope(specification, context, fake.handlers, fake.adapter, authorization),
    ).rejects.toThrow('REPLAY_NOOP_OWNED_STATE_DRIFT')
    expect(fake.receipts.size).toBe(0)
    expect(fake.trace).toEqual(['begin', 'rollback'])
  })
  it('supplies only authenticated historical and completed receipts to inspections', async () => {
    const fake = harness()
    const phases = new Set<string>()
    for (const handler of fake.handlers) {
      const original = handler.inspect
      handler.inspect = async (...parameters) => {
        const witness = parameters[4]
        expect(witness).toBeDefined()
        phases.add(witness!.phase)
        expect(witness!.historicalReceipts.size).toBe(0)
        expect(witness!.planDigest).toBe(authorization.planDigest)
        const unit = parameters[2]
        for (const id of unit.predecessors) expect(witness!.verifiedReceipts.has(id)).toBe(true)
        return original(...parameters)
      }
    }
    const result = await applyReplayScope(
      specification,
      context,
      fake.handlers,
      fake.adapter,
      authorization,
    )
    expect(result.FINAL_UNIT_VERIFICATIONS).toHaveLength(106)
    expect(phases).toEqual(new Set(['BEFORE', 'PRE_SEND', 'POST_SEND', 'FINAL_SCOPE']))
  })
  it('uses the106operational IDs in exact frozen order and preserves repeated predecessor provenance', async () => {
    const fake = harness()
    const result = await applyReplayScope(
      specification,
      context,
      fake.handlers,
      fake.adapter,
      authorization,
    )
    expect(result.REPLAYED).toBe(106)
    expect(result.NOOP).toBe(0)
    expect(result.UNIT_RECEIPTS.map((entry) => entry.UNIT_ID)).toEqual(
      specification.units
        .filter((unit) => unit.node.DATABASE_SCOPE === context.scope)
        .map((unit) => unit.node.REPLAY_UNIT_ID),
    )
    expect(fake.trace.at(-1)).toBe('commit')
    expect(fake.trace.filter((entry) => entry.startsWith('send:'))).toHaveLength(106)
  })
  it('fake complete-state traversal sends nothing;does not certify actual catalog comparators', async () => {
    const fake = harness(true)
    const result = await applyReplayScope(
      specification,
      context,
      fake.handlers,
      fake.adapter,
      authorization,
    )
    expect(result.REPLAYED).toBe(0)
    expect(result.NOOP).toBe(106)
    expect(fake.trace.some((entry) => entry.startsWith('send:'))).toBe(false)
  })
  it('send failure stops the traversal,rolls back every earlier fake effect and stages no durable receipt', async () => {
    const fake = harness(false, 5)
    await expect(
      applyReplayScope(specification, context, fake.handlers, fake.adapter, authorization),
    ).rejects.toThrow('FAKE_SEND_FAILED')
    expect(fake.trace.filter((entry) => entry.startsWith('send:'))).toHaveLength(5)
    expect(fake.state.size).toBe(0)
    expect(fake.receipts.size).toBe(0)
    expect(fake.trace.at(-1)).toBe('rollback')
  })
  it('failed commit never returns a successful scope receipt', async () => {
    const fake = harness(false, 0, true)
    await expect(
      applyReplayScope(specification, context, fake.handlers, fake.adapter, authorization),
    ).rejects.toThrow('FAKE_COMMIT_FAILED')
    expect(fake.state.size).toBe(0)
    expect(fake.receipts.size).toBe(0)
  })
  it('missing verifier/handler coverage fails before an adapter invocation', async () => {
    const fake = harness()
    await expect(
      applyReplayScope(specification, context, fake.handlers.slice(1), fake.adapter, authorization),
    ).rejects.toThrow('REPLAY_EXACT_HANDLER_COVERAGE_REQUIRED')
    expect(fake.trace).toEqual([])
  })
  it('wrong source bytes,handler contract,authorization and missing exclusive adapter deny', async () => {
    const fake = harness()
    const changed = {
      ...specification,
      units: specification.units.map((unit, index) =>
        index ? unit : { ...unit, sql: unit.sql + ' ' },
      ),
    }
    await expect(
      applyReplayScope(changed, context, fake.handlers, fake.adapter, authorization),
    ).rejects.toThrow('REPLAY_UNIT_SOURCE_BYTES_DRIFT')
    await expect(
      applyReplayScope(
        specification,
        context,
        fake.handlers.map((handler, index) =>
          index ? handler : { ...handler, contractDigest: 'wrong' },
        ),
        fake.adapter,
        authorization,
      ),
    ).rejects.toThrow('REPLAY_HANDLER_CONTRACT_DRIFT')
    await expect(
      applyReplayScope(specification, context, fake.handlers, undefined, authorization),
    ).rejects.toThrow('REPLAY_EXCLUSIVE_ADAPTER_REQUIRED')
    await expect(
      applyReplayScope(specification, context, fake.handlers, fake.adapter, {
        ...authorization,
        targetDigest: 'wrong',
      }),
    ).rejects.toThrow('REPLAY_AUTHORIZATION_BINDING_MISMATCH')
    expect(fake.trace).toEqual([])
  })
  it('immediate postverify rejects a success-shaped send with no actual fake state change', async () => {
    const fake = harness()
    const adapter: ReplayExclusiveAdapter = {
      withExclusiveTransaction(work) {
        return fake.adapter.withExclusiveTransaction((client) =>
          work({
            ...client,
            async execute() {
              fake.trace.push('lying-send')
            },
          }),
        )
      },
    }
    await expect(
      applyReplayScope(specification, context, fake.handlers, adapter, authorization),
    ).rejects.toThrow('REPLAY_IMMEDIATE_POSTCONDITION_FAILED')
    expect(fake.receipts.size).toBe(0)
    expect(fake.trace.at(-1)).toBe('rollback')
  })
  it('unit receipts bind the target,scope,actor,source,plan,graph and verified predecessors', async () => {
    const fake = harness()
    const result = await applyReplayScope(
      specification,
      context,
      fake.handlers,
      fake.adapter,
      authorization,
    )
    const unit = specification.units.find(
      (unit) => unit.node.REPLAY_UNIT_ID === result.UNIT_RECEIPTS[0].UNIT_ID,
    )!
    expect(verifyUnitReceipt(result.UNIT_RECEIPTS[0], unit, specification, context)).toBe(true)
    expect(
      verifyUnitReceipt(
        { ...result.UNIT_RECEIPTS[0], TARGET_DIGEST: 'wrong' },
        unit,
        specification,
        context,
      ),
    ).toBe(false)
    expect(
      verifyUnitReceipt(result.UNIT_RECEIPTS[0], unit, specification, {
        ...context,
        actorPrincipal: 'wrong',
      }),
    ).toBe(false)
  })
})
