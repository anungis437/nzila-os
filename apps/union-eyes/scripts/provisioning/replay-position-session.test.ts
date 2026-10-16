import { describe, expect, it } from 'vitest'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { compileReplayUnitPlan } from './replay-unit-plan'
import { replayDigest } from './post-w4p-replay'
import { ReplayPositionSession } from './replay-position-session'
import { positionAuthorityQueries, type ReplayPositionPin } from './replay-position-authority'
import { FakeReplayCatalog } from './replay-fake-catalog'
import { proceduralQueries } from './replay-procedural-inspection'
import { originalRelationQueries } from './replay-original-relation'
const { frozen, sourceBytes } = loadFrozenReplay()
const plan = compileReplayUnitPlan(
  frozen,
  sourceBytes,
  read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
  replayDigest('fake-plan-only'),
)
const pin: ReplayPositionPin = {
  database: 'fake_db',
  searchPath: ['pg_catalog', 'public'],
  execution: {
    scope: 'UE_OPERATIONAL',
    actorClass: 'MIGRATION_ADMIN',
    actorPrincipal: 'fake_admin',
    targetDigest: replayDigest('fake-target'),
    w4pPlanDigest: plan.specification.w4pPlanDigest,
    w4pVerificationDigest: replayDigest('fake-w4p-verification'),
    supplementPlanDigest: plan.specification.supplementPlanDigest,
    supplementVerificationDigest: replayDigest('fake-keys'),
    exclusiveExecutionReference: 'fake-only',
  },
}
function catalog() {
  return new FakeReplayCatalog({
    schemas: ['pg_catalog', 'public'],
    roles: ['fake_admin'],
    database: pin.database,
    functionContext: {
      actor: 'fake_admin',
      creationSchema: 'public',
      searchPath: [...pin.searchPath],
      defaultAcl: [],
    },
  })
}
describe('position authority/source-order integration,not full boundary or execution proof', () => {
  it('keeps frozen effect order and denies substituted ordinal before any catalog access', async () => {
    const session = new ReplayPositionSession(plan, pin)
    expect(session.nextEffectId).toBe(plan.components.effects[0].effectId)
    await expect(
      session.capture('not-the-next-effect', {
        async query() {
          throw new Error('MUST_NOT_READ')
        },
      }),
    ).rejects.toThrow('REPLAY_POSITION_SESSION_ORDER_DRIFT')
    expect(session.verifiedPositions()).toEqual([])
  })
  it('denies verification without the required capture rather than minting an observation', async () => {
    const session = new ReplayPositionSession(plan, pin)
    await expect(
      session.verify(session.nextEffectId!, {
        async query() {
          throw new Error('MUST_NOT_READ')
        },
      }),
    ).rejects.toThrow('REPLAY_POSITION_SESSION_CAPTURE_REQUIRED')
    expect(session.verifiedPositions()).toEqual([])
  })
  it('does not infer financial effects from an empty immutable source', () => {
    const session = new ReplayPositionSession(plan, {
      ...pin,
      execution: { ...pin.execution, scope: 'FINANCIAL_SERVICE' },
    })
    expect(session.nextEffectId).toBeNull()
    const views = session.verifiedPositions()
    expect(views).toEqual([])
    expect(Object.isFrozen(views)).toBe(true)
  })
  it('rejects unbound W4P/supplement prerequisites before using a catalog', () => {
    for (const mutation of [
      { w4pPlanDigest: replayDigest('wrong') },
      { supplementPlanDigest: replayDigest('wrong') },
      { targetDigest: '' },
      { w4pVerificationDigest: '' },
      { supplementVerificationDigest: '' },
      { exclusiveExecutionReference: '' },
    ]) {
      expect(
        () =>
          new ReplayPositionSession(plan, { ...pin, execution: { ...pin.execution, ...mutation } }),
      ).toThrow('REPLAY_POSITION_SESSION_BASELINE_PIN_REQUIRED')
    }
  })
  it('requires an actual database/effective-path pin even for an empty scope', () => {
    for (const overrides of [
      { database: '' },
      { searchPath: [] },
      { searchPath: ['public', 'public'] },
      { searchPath: [''] },
    ])
      expect(
        () =>
          new ReplayPositionSession(plan, {
            ...pin,
            ...overrides,
            execution: { ...pin.execution, scope: 'FINANCIAL_SERVICE' },
          }),
      ).toThrow('REPLAY_POSITION_SESSION_BASELINE_PIN_REQUIRED')
  })
  it('does not retain a mutable caller-owned plan or context', () => {
    const cloned = structuredClone(plan),
      copied = structuredClone(pin)
    const session = new ReplayPositionSession(cloned, copied),
      first = session.nextEffectId
    cloned.components.effects.length = 0
    cloned.specification.units.length = 0
    copied.execution.scope = 'FINANCIAL_SERVICE'
    expect(session.nextEffectId).toBe(first)
    expect(session.verifiedPositions()).toEqual([])
  })
  it('does not mistake missing or substituted frozen effect coverage for a finished observation sequence', () => {
    for (const mutate of [
      (plan: ReturnType<typeof compileReplayUnitPlan>) => {
        plan.components.effects.pop()
      },
      (plan: ReturnType<typeof compileReplayUnitPlan>) => {
        plan.components.effects[0].source = 'forged source'
      },
      (plan: ReturnType<typeof compileReplayUnitPlan>) => {
        plan.components.effects[0].boundaryId = 'borrowed-boundary'
      },
      (plan: ReturnType<typeof compileReplayUnitPlan>) => {
        plan.components.effects[0].ordinal = 999
      },
    ]) {
      const changed = structuredClone(plan)
      mutate(changed)
      expect(() => new ReplayPositionSession(changed, pin)).toThrow(
        'REPLAY_POSITION_SESSION_EFFECT_COVERAGE_INVALID',
      )
    }
  })
  it('observes the first real frozen relation effect from independent source/catalog transitions', async () => {
    const session = new ReplayPositionSession(plan, pin),
      fake = catalog(),
      first = plan.components.effects[0]
    await fake.applyFrozenUnit(first.source, first.sourceHash)
    const captured = await session.capture(first.effectId, fake.snapshot())
    expect(captured.predecessorDigest).toMatch(/^[a-f0-9]{64}$/)
    const verified = await session.verify(first.effectId, fake)
    expect(verified.observation.definition).toBe('EXACT')
    expect(
      verified.inspectionReads.some((read) => read.sql === originalRelationQueries.columns),
    ).toBe(true)
    expect(
      verified.inspectionReads.some((read) => read.sql === originalRelationQueries.constraints),
    ).toBe(true)
    expect(verified.inspectionReadSetDigest).toBe(replayDigest(verified.inspectionReads))
    expect(verified.authorityReadSetDigest).not.toBe(verified.finalAuthorityReadSetDigest)
    for (const reads of [verified.authorityReads, verified.finalAuthorityReads]) {
      const normalized = reads.map((read) =>
        read.sql !== positionAuthorityQueries.snapshot
          ? read
          : { ...read, rows: [{ backend: '1' }] },
      )
      expect(verified.authoritySemanticReadSetDigest).toBe(replayDigest(normalized))
    }
    expect(verified.predecessorVerificationDigest).toBeNull()
    expect(session.verifiedPositions()).toEqual([verified])
    expect(session.nextEffectId).not.toBe(first.effectId)
    expect(Object.isFrozen(verified.inspectionReads)).toBe(true)
    expect(
      verified.inspectionReads.every(
        (read) =>
          Object.isFrozen(read) &&
          Object.isFrozen(read.rows) &&
          read.rows.every((row) =>
            row !== null && typeof row === 'object' ? Object.isFrozen(row) : true,
          ),
      ),
    ).toBe(true)
  })
  it('retains order and publishes no observation when actual relation state is absent', async () => {
    const session = new ReplayPositionSession(plan, pin),
      fake = catalog(),
      first = plan.components.effects[0]
    await session.capture(first.effectId, fake.snapshot())
    await expect(session.verify(first.effectId, fake)).rejects.toThrow(
      'REPLAY_POSITION_SESSION_POSTCONDITION_DENIED',
    )
    expect(session.nextEffectId).toBe(first.effectId)
    expect(session.verifiedPositions()).toEqual([])
    await expect(session.capture(first.effectId, fake)).rejects.toThrow(
      'REPLAY_POSITION_SESSION_POSITION_ALREADY_PENDING',
    )
  })
  it('detects catalog principal changes during actual inspection instead of sealing borrowed authority', async () => {
    const session = new ReplayPositionSession(plan, pin),
      fake = catalog(),
      first = plan.components.effects[0]
    await fake.applyFrozenUnit(first.source, first.sourceHash)
    await session.capture(first.effectId, fake.snapshot())
    let inspected = false
    await expect(
      session.verify(first.effectId, {
        async query(sql, parameters) {
          if (sql === originalRelationQueries.columns) inspected = true
          if (inspected && sql === proceduralQueries.identity)
            return [{ actor: 'wrong_actor', database: pin.database, search_path: pin.searchPath }]
          return fake.query(sql, parameters)
        },
      }),
    ).rejects.toThrow()
    expect(inspected).toBe(true)
    expect(session.nextEffectId).toBe(first.effectId)
    expect(session.verifiedPositions()).toEqual([])
  })
  it('denies concurrent and duplicate captures without issuing any observation', async () => {
    const session = new ReplayPositionSession(plan, pin),
      fake = catalog(),
      first = plan.components.effects[0]
    await fake.applyFrozenUnit(first.source, first.sourceHash)
    const before = fake.snapshot()
    let unblock: () => void = () => {
      throw new Error('EXPECTED_CAPTURE_WAIT')
    }
    const wait = new Promise<void>((resolve) => {
      unblock = resolve
    })
    const capturing = session.capture(first.effectId, {
      async query(sql, parameters) {
        await wait
        return before.query(sql, parameters)
      },
    })
    await expect(session.capture(first.effectId, before)).rejects.toThrow(
      'REPLAY_POSITION_SESSION_POSITION_ALREADY_PENDING',
    )
    await expect(session.verify(first.effectId, fake)).rejects.toThrow(
      'REPLAY_POSITION_SESSION_CONCURRENT_ACCESS_DENIED',
    )
    unblock()
    await capturing
    await expect(session.capture(first.effectId, before)).rejects.toThrow(
      'REPLAY_POSITION_SESSION_POSITION_ALREADY_PENDING',
    )
    expect(session.verifiedPositions()).toEqual([])
    await session.verify(first.effectId, fake)
    expect(session.verifiedPositions()).toHaveLength(1)
  })
  it('does not pass a borrowed mutable predecessor reader off as an independent after-position view', async () => {
    const session = new ReplayPositionSession(plan, pin),
      fake = catalog(),
      first = plan.components.effects[0]
    await fake.applyFrozenUnit(first.source, first.sourceHash)
    await session.capture(first.effectId, fake)
    await expect(session.verify(first.effectId, fake)).rejects.toThrow()
    expect(session.verifiedPositions()).toEqual([])
    expect(session.nextEffectId).toBe(first.effectId)
  })
  it('retains backend affinity while allowing new observation timestamps', async () => {
    const session = new ReplayPositionSession(plan, pin),
      fake = catalog(),
      first = plan.components.effects[0]
    await fake.applyFrozenUnit(first.source, first.sourceHash)
    await session.capture(first.effectId, fake.snapshot())
    let inspected = false
    await expect(
      session.verify(first.effectId, {
        async query(sql, parameters) {
          if (sql === originalRelationQueries.columns) inspected = true
          const rows = await fake.query(sql, parameters)
          return inspected && sql === positionAuthorityQueries.snapshot
            ? [{ snapshot: '1:1:', observed_at: 'independent-fake-after-clock', backend: '2' }]
            : rows
        },
      }),
    ).rejects.toThrow('REPLAY_POSITION_SESSION_AUTHORITY_CHANGED_DURING_INSPECTION')
    expect(session.verifiedPositions()).toEqual([])
    expect(session.nextEffectId).toBe(first.effectId)
  })
})
