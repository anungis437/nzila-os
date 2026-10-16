import { describe, expect, it } from 'vitest'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { compileReplayUnitPlan } from './replay-unit-plan'
import { replayDigest, replayHash, replayText } from './post-w4p-replay'
import { ReplayPositionSession } from './replay-position-session'
import type { ReplayPositionPin } from './replay-position-authority'
import { FakeReplayCatalog, type FakeNativeStatementObservation } from './replay-fake-catalog'
import { originalRelationQueries } from './replay-original-relation'
import { qualifyFakeOriginalBoundary } from './replay-fake-boundary-execution'

const { frozen, sourceBytes } = loadFrozenReplay()
const plan = compileReplayUnitPlan(
  frozen,
  sourceBytes,
  read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
  replayDigest('native-position-fake-keys'),
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
const originals = plan.specification.units.filter(
  (unit) =>
    unit.node.REPLAY_UNIT_CLASS === 'FROZEN_MIGRATION_UNIT' &&
    unit.node.DATABASE_SCOPE === 'UE_OPERATIONAL',
)
const first = originals[0]
function observer(session: ReplayPositionSession, unit: typeof first) {
  const effects = plan.components.effects.filter(
    (effect) => effect.boundaryId === unit.node.REPLAY_UNIT_ID,
  )
  let at = 0
  return async (position: FakeNativeStatementObservation) => {
    const effect = effects[at++]
    expect(effect).toBeDefined()
    expect(position.source).toBe(effect.source)
    expect(position.sourceHash).toBe(effect.sourceHash)
    expect(position.byteRange).toEqual(effect.byteRange)
    expect(position.unitHash).toBe(effect.boundaryHash)
    expect(position.ordinal).toBe(effect.ordinal)
    expect(Object.keys(position.before)).toEqual(['query'])
    expect(Object.isFrozen(position.before)).toBe(true)
    await session.capture(effect.effectId, position.before)
    const verification = await session.verify(effect.effectId, position.after)
    expect(verification.observation.definition).toBe('EXACT')
  }
}

describe('actual native statement positions inside indivisible fake whole-unit sends', () => {
  it('qualifies the first actual boundary from native transitions without per-effect sends', async () => {
    const fake = catalog(),
      session = new ReplayPositionSession(plan, pin)
    await session.atomicBoundary(replayText(first.node.REPLAY_UNIT_ID), (beforeCommit) =>
      fake.transaction(async () => {
        await fake.applyObservedFrozenUnit(
          first.sql,
          replayHash(first.sql),
          observer(session, first),
        )
        expect(session.verifiedPositions()).toEqual([])
        beforeCommit()
      }),
    )
    expect(session.verifiedPositions()).toHaveLength(
      plan.components.effects.filter((effect) => effect.boundaryId === first.node.REPLAY_UNIT_ID)
        .length,
    )
    expect(fake.trace.filter((entry) => entry.startsWith('FAKE_UNIT_TRANSITION:'))).toEqual([
      `FAKE_UNIT_TRANSITION:${replayHash(first.sql)}`,
    ])
  })

  it('qualifies actual ordered positions through the six-unit relation evolution', async () => {
    const fake = catalog(),
      session = new ReplayPositionSession(plan, pin)
    for (const unit of originals.slice(0, 6))
      expect(await qualifyFakeOriginalBoundary(fake, session, plan, unit)).toMatchObject({
        unitId: unit.node.REPLAY_UNIT_ID,
        sourceHash: replayHash(unit.sql),
        wholeByteSends: 1,
        executionAuthorized: false,
        qualification: 'INDEPENDENT_FAKE_NATIVE_POSITIONS',
      })
    const ids = new Set(originals.slice(0, 6).map((unit) => unit.node.REPLAY_UNIT_ID))
    expect(session.verifiedPositions().map((position) => position.effectId)).toEqual(
      plan.components.effects
        .filter((effect) => ids.has(effect.boundaryId))
        .map((effect) => effect.effectId),
    )
    expect(fake.trace.filter((entry) => entry.startsWith('FAKE_UNIT_TRANSITION:'))).toHaveLength(6)
  })

  it.each(['observer', 'commit'] as const)(
    'revokes staged observations and restores actual native state after %s failure',
    async (failure) => {
      const fake = catalog(),
        session = new ReplayPositionSession(plan, pin)
      const before = fake.digest()
      await expect(
        session.atomicBoundary(replayText(first.node.REPLAY_UNIT_ID), (beforeCommit) =>
          fake.transaction(async () => {
            await fake.applyObservedFrozenUnit(
              first.sql,
              replayHash(first.sql),
              observer(session, first),
            )
            beforeCommit()
            if (failure === 'observer') throw new Error('NATIVE_OBSERVER_FAILURE')
          }, failure === 'commit'),
        ),
      ).rejects.toThrow(failure === 'commit' ? 'FAKE_COMMIT_FAILED' : 'NATIVE_OBSERVER_FAILURE')
      expect(fake.digest()).toBe(before)
      expect(session.verifiedPositions()).toEqual([])
      expect(session.nextEffectId).toBe(plan.components.effects[0].effectId)
      await qualifyFakeOriginalBoundary(fake, session, plan, first)
      expect(session.verifiedPositions().length).toBeGreaterThan(0)
    },
  )

  it('captures immutable actual predecessor and successor catalogs, not final-state copies', async () => {
    const fake = catalog()
    const source =
      'CREATE TABLE observed (id uuid PRIMARY KEY); ALTER TABLE observed ADD COLUMN label text;'
    let previous: FakeNativeStatementObservation | null = null
    await fake.applyObservedFrozenUnit(source, replayHash(source), async (position) => {
      if (position.ordinal === 1) {
        expect(
          await position.before.query(originalRelationQueries.relation, ['public', 'observed']),
        ).toEqual([])
        expect(
          await position.after.query(originalRelationQueries.columns, ['public', 'observed']),
        ).toHaveLength(1)
        previous = position
      } else {
        expect(position.beforeDigest).toBe(previous?.afterDigest)
        expect(
          await position.before.query(originalRelationQueries.columns, ['public', 'observed']),
        ).toHaveLength(1)
        expect(
          await position.after.query(originalRelationQueries.columns, ['public', 'observed']),
        ).toHaveLength(2)
        expect(
          await previous?.after.query(originalRelationQueries.columns, ['public', 'observed']),
        ).toHaveLength(1)
      }
    })
  })

  it('denies callback mutations rather than authenticating a substituted native transition', async () => {
    const fake = catalog(),
      before = fake.digest()
    const source = 'CREATE TABLE observed (id uuid PRIMARY KEY);'
    await expect(
      fake.applyObservedFrozenUnit(source, replayHash(source), async () => {
        fake.replaceTable({ ...fake.inspectTable('public', 'observed')!, enabled: true })
      }),
    ).rejects.toThrow('FAKE_NATIVE_OBSERVATION_MUTATION_DENIED')
    expect(fake.digest()).toBe(before)
    expect(fake.trace).toEqual([])
  })

  it('denies nested native sends and publishes no successful outer send', async () => {
    const fake = catalog(),
      before = fake.digest()
    const source = 'CREATE TABLE observed (id uuid PRIMARY KEY);'
    await expect(
      fake.applyObservedFrozenUnit(source, replayHash(source), async () => {
        await fake.applyFrozenUnit(
          'CREATE TABLE borrowed (id uuid);',
          replayHash('CREATE TABLE borrowed (id uuid);'),
        )
      }),
    ).rejects.toThrow('FAKE_NATIVE_UNIT_BUSY')
    expect(fake.digest()).toBe(before)
    expect(fake.trace).toEqual([])
  })

  it('denies incomplete boundary coverage and does not publish its partial verification', async () => {
    const fake = catalog(),
      session = new ReplayPositionSession(plan, pin),
      before = fake.digest()
    const effect = plan.components.effects[0]
    await expect(
      session.atomicBoundary(replayText(first.node.REPLAY_UNIT_ID), (beforeCommit) =>
        fake.transaction(async () => {
          await fake.applyObservedFrozenUnit(effect.source, effect.sourceHash, async (position) => {
            await session.capture(effect.effectId, position.before)
            await session.verify(effect.effectId, position.after)
          })
          beforeCommit()
        }),
      ),
    ).rejects.toThrow('REPLAY_POSITION_SESSION_BOUNDARY_COVERAGE_INCOMPLETE')
    expect(session.verifiedPositions()).toEqual([])
    expect(session.nextEffectId).toBe(effect.effectId)
    expect(fake.digest()).toBe(before)
  })

  it('rejects substituted unit source or contracts before native mutation', async () => {
    for (const unit of [
      { ...first, sql: first.sql + '\nSELECT 1;' },
      { ...first, contractDigest: replayDigest('borrowed') },
      { ...first, node: { ...first.node, EXACT_UNIT_SHA256: replayHash('borrowed') } },
    ]) {
      const fake = catalog(),
        session = new ReplayPositionSession(plan, pin),
        before = fake.digest()
      await expect(qualifyFakeOriginalBoundary(fake, session, plan, unit)).rejects.toThrow(
        'FAKE_BOUNDARY_EXECUTION_SOURCE_BINDING_INVALID',
      )
      expect(fake.digest()).toBe(before)
      expect(fake.trace).toEqual([])
      expect(session.verifiedPositions()).toEqual([])
    }
  })

  it('restores the prior committed position prefix when a later whole-unit commit fails', async () => {
    const fake = catalog(),
      session = new ReplayPositionSession(plan, pin)
    await qualifyFakeOriginalBoundary(fake, session, plan, first)
    const before = fake.digest(),
      positions = session.verifiedPositions()
    await expect(
      qualifyFakeOriginalBoundary(fake, session, plan, originals[1], true),
    ).rejects.toThrow('FAKE_COMMIT_FAILED')
    expect(fake.digest()).toBe(before)
    expect(session.verifiedPositions()).toEqual(positions)
    expect(session.nextEffectId).toBe(
      plan.components.effects.find(
        (effect) => effect.boundaryId === originals[1].node.REPLAY_UNIT_ID,
      )?.effectId,
    )
  })
})
