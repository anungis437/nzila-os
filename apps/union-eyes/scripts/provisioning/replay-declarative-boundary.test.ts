import { describe, expect, it } from 'vitest'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { compileReplayUnitPlan } from './replay-unit-plan'
import { replayDigest } from './post-w4p-replay'
import { makeDeclarativeBoundaryHandler, declarativeQueries } from './replay-declarative-boundary'
import { originalRelationQueries } from './replay-original-relation'
import { createCatalogQueries } from './replay-create-inspection'
import { FakeReplayCatalog } from './replay-fake-catalog'
import type { ReplayPositionPin } from './replay-position-authority'
const { frozen, sourceBytes } = loadFrozenReplay()
const plan = compileReplayUnitPlan(
  frozen,
  sourceBytes,
  read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
  replayDigest('fake-supplement'),
)
const unit = plan.specification.units[0],
  effects = plan.components.effects.filter(
    (effect) => effect.boundaryId === unit.node.REPLAY_UNIT_ID,
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
    w4pVerificationDigest: replayDigest('fake-w4p'),
    supplementPlanDigest: plan.specification.supplementPlanDigest,
    supplementVerificationDigest: replayDigest('fake-keys'),
    exclusiveExecutionReference: 'fake-exclusive-only',
  },
}
const fake = (permissions = true, eventTriggers: { name: string; enabled: string }[] = []) =>
  new FakeReplayCatalog({
    schemas: ['pg_catalog', 'public'],
    roles: ['fake_admin'],
    database: 'fake_db',
    functionContext: {
      actor: 'fake_admin',
      creationSchema: 'public',
      searchPath: pin.searchPath,
      defaultAcl: [],
    },
    schemaPermissions: [{ schema: 'public', role: 'fake_admin', usage: true, create: permissions }],
    eventTriggers,
  })
const handler = makeDeclarativeBoundaryHandler(unit, effects, pin)
const declarativeUnits = plan.specification.units.filter((candidate) => {
  const entries = plan.components.effects.filter(
    (effect) => effect.boundaryId === candidate.node.REPLAY_UNIT_ID,
  )
  return (
    entries.length > 0 &&
    entries.every((effect) => ['RELATION', 'FOREIGN_KEY', 'INDEX'].includes(effect.compiled.kind))
  )
})
describe('actual first whole-boundary handler,not full107installation', () => {
  it('proves wholly absent fresh eligibility,stable presend,exact whole send and all net postconditions', async () => {
    const catalog = fake()
    const before = await handler.inspect(catalog, pin.execution, unit, null)
    expect(before.state).toBe('REPLAY_REQUIRED')
    expect(await handler.inspect(catalog, pin.execution, unit, null)).toEqual(before)
    await catalog.applyFrozenUnit(unit.sql, String(unit.node.EXACT_UNIT_SHA256))
    const after = await handler.inspect(catalog, pin.execution, unit, null)
    expect(after.state).toBe('ALREADY_COMPLETE')
    expect(catalog.trace).toEqual([`FAKE_UNIT_TRANSITION:${unit.node.EXACT_UNIT_SHA256}`])
    const current = catalog.digest(),
      trace = [...catalog.trace]
    expect(await handler.inspect(catalog, pin.execution, unit, null)).toEqual(after)
    expect(catalog.digest()).toBe(current)
    expect(catalog.trace).toEqual(trace)
  })
  describe('five actual declarative original boundaries;isolated source positions,not all23 or full107', () => {
    it('pins the genuine structural-only original-unit denominator', () =>
      expect(declarativeUnits).toHaveLength(5))
    for (const candidate of declarativeUnits) {
      it(`qualifies exact whole fresh/noop bytes:${candidate.node.REPLAY_UNIT_ID}`, async () => {
        const catalog = fake()
        for (const wrapper of plan.components.wrappers) {
          const original = plan.specification.units.find(
            (unit) => unit.node.REPLAY_UNIT_ID === wrapper.unitId,
          )!
          await catalog.applyFrozenUnit(original.sql, String(original.node.EXACT_UNIT_SHA256))
        }
        const entries = plan.components.effects.filter(
          (effect) => effect.boundaryId === candidate.node.REPLAY_UNIT_ID,
        )
        const actual = makeDeclarativeBoundaryHandler(candidate, entries, pin)
        expect((await actual.inspect(catalog, pin.execution, candidate, null)).state).toBe(
          'REPLAY_REQUIRED',
        )
        const traceLength = catalog.trace.length
        await catalog.applyFrozenUnit(candidate.sql, String(candidate.node.EXACT_UNIT_SHA256))
        const after = await actual.inspect(catalog, pin.execution, candidate, null)
        expect(after.state).toBe('ALREADY_COMPLETE')
        expect(catalog.trace.slice(traceLength)).toEqual([
          `FAKE_UNIT_TRANSITION:${candidate.node.EXACT_UNIT_SHA256}`,
        ])
        const state = catalog.digest()
        expect(await actual.inspect(catalog, pin.execution, candidate, null)).toEqual(after)
        expect(catalog.digest()).toBe(state)
        expect(catalog.trace).toHaveLength(traceLength + 1)
      })
    }
  })
  it('does not replay a partly present unguarded boundary', async () => {
    const catalog = fake(),
      first = effects[0]
    await catalog.applyFrozenUnit(first.source, first.sourceHash)
    const before = catalog.digest()
    expect((await handler.inspect(catalog, pin.execution, unit, null)).state).toBe(
      'PARTIAL_OR_AMBIGUOUS',
    )
    expect(catalog.digest()).toBe(before)
    expect(catalog.trace).toHaveLength(1)
  })
  it('denies creation privilege and unknown event-trigger side effects before any send', async () => {
    for (const catalog of [
      fake(false),
      fake(true, [{ name: 'unknown_ddl_effect', enabled: 'O' }]),
    ]) {
      expect((await handler.inspect(catalog, pin.execution, unit, null)).state).toBe(
        'PRECONDITION_MISSING',
      )
      expect(catalog.trace).toEqual([])
    }
  })
  it('binds actual database,actor,path and source plan rather than caller completion assertions', async () => {
    const catalog = fake()
    await expect(
      handler.inspect(catalog, { ...pin.execution, actorPrincipal: 'borrowed' }, unit, null),
    ).rejects.toThrow('REPLAY_DECLARATIVE_POSITION_BINDING_INVALID')
    await expect(
      handler.inspect(
        {
          async query() {
            return [{ complete: true }]
          },
        },
        pin.execution,
        unit,
        null,
      ),
    ).rejects.toThrow('REPLAY_DECLARATIVE_CATALOG_IDENTITY_DRIFT')
  })
  it('rejects omitted,reordered,substituted source effects and a changed exact-byte commitment', () => {
    for (const changed of [
      effects.slice(1),
      [...effects].reverse(),
      effects.map((effect, index) =>
        index === 0 ? { ...effect, sourceHash: replayDigest('substituted') } : effect,
      ),
    ]) {
      expect(() => makeDeclarativeBoundaryHandler(unit, changed, pin)).toThrow(
        'REPLAY_DECLARATIVE_BOUNDARY_SOURCE_BINDING_INVALID',
      )
    }
    expect(() =>
      makeDeclarativeBoundaryHandler(
        { ...unit, node: { ...unit.node, EXACT_UNIT_SHA256: replayDigest('substituted') } },
        effects,
        pin,
      ),
    ).toThrow('REPLAY_DECLARATIVE_BOUNDARY_SOURCE_BINDING_INVALID')
  })
  it('denies missing or shadowed source types and missing default-function provenance before send', async () => {
    for (const changed of [
      originalRelationQueries.type,
      declarativeQueries.resolvedType,
      createCatalogQueries.deployedRandom,
      createCatalogQueries.clock,
    ]) {
      const catalog = fake()
      const reader = {
        async query(sql: string, parameters: string[]) {
          return sql === changed ? [] : catalog.query(sql, parameters)
        },
      }
      expect((await handler.inspect(reader, pin.execution, unit, null)).state).toBe(
        'PRECONDITION_MISSING',
      )
      expect(catalog.trace).toEqual([])
    }
  })
  it('keeps verification digests stable when independent catalog reads complete in another order', async () => {
    const catalog = fake()
    await catalog.applyFrozenUnit(unit.sql, String(unit.node.EXACT_UNIT_SHA256))
    const expected = await handler.inspect(catalog, pin.execution, unit, null)
    const delayed = {
      async query(sql: string, parameters: string[]) {
        await new Promise((resolve) => setTimeout(resolve, parameters.join('').length % 3))
        return catalog.query(sql, parameters)
      },
    }
    expect(await handler.inspect(delayed, pin.execution, unit, null)).toEqual(expected)
  })
  it('rolls back actual full-boundary state on postcondition failure and produces no staged receipt', async () => {
    const catalog = fake(),
      before = catalog.digest()
    await expect(
      catalog.transaction(async (working) => {
        await working.applyFrozenUnit(unit.sql, String(unit.node.EXACT_UNIT_SHA256))
        const table = working.inspectTable('public', 'icra_anonymized_metrics')!
        table.columns[0].not_null = false
        working.replaceTable(table)
        const after = await handler.inspect(working, pin.execution, unit, null)
        if (after.state !== 'ALREADY_COMPLETE') throw new Error('QUALIFIED_POSTCONDITION_FAILED')
        working.stageReceipt(String(unit.node.REPLAY_UNIT_ID), after)
      }),
    ).rejects.toThrow('QUALIFIED_POSTCONDITION_FAILED')
    expect(catalog.digest()).toBe(before)
    expect(catalog.readReceipt(String(unit.node.REPLAY_UNIT_ID))).toBeNull()
  })
  it('does not publish state or a receipt when commit fails after complete real net-state inspection', async () => {
    const catalog = fake(),
      before = catalog.digest()
    await expect(
      catalog.transaction(async (working) => {
        await working.applyFrozenUnit(unit.sql, String(unit.node.EXACT_UNIT_SHA256))
        const after = await handler.inspect(working, pin.execution, unit, null)
        expect(after.state).toBe('ALREADY_COMPLETE')
        working.stageReceipt(String(unit.node.REPLAY_UNIT_ID), after)
      }, true),
    ).rejects.toThrow('FAKE_COMMIT_FAILED')
    expect(catalog.digest()).toBe(before)
    expect(catalog.readReceipt(String(unit.node.REPLAY_UNIT_ID))).toBeNull()
  })
})
