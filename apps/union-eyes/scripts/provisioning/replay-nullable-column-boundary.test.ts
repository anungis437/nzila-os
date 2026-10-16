import { describe, expect, it } from 'vitest'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { replayDigest } from './post-w4p-replay'
import { compileReplayUnitPlan } from './replay-unit-plan'
import {
  makeNullableColumnBoundaryHandler,
  nullableColumnQueries,
} from './replay-nullable-column-boundary'
import { FakeReplayCatalog } from './replay-fake-catalog'
import type { ReplayPositionPin } from './replay-position-authority'
const { frozen, sourceBytes } = loadFrozenReplay()
const plan = compileReplayUnitPlan(
  frozen,
  sourceBytes,
  read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
  replayDigest('fake-keys'),
)
const pin: ReplayPositionPin = {
  database: 'fake_db',
  searchPath: ['pg_catalog', 'public'],
  execution: {
    scope: 'UE_OPERATIONAL',
    actorClass: 'MIGRATION_ADMIN',
    actorPrincipal: 'fake_owner',
    targetDigest: replayDigest('fake-target'),
    w4pPlanDigest: plan.specification.w4pPlanDigest,
    w4pVerificationDigest: replayDigest('fake-w4p'),
    supplementPlanDigest: plan.specification.supplementPlanDigest,
    supplementVerificationDigest: replayDigest('fake-keys-verified'),
    exclusiveExecutionReference: 'fake-only',
  },
}
const ids = [
  'UE-W5A-MIGRATION-b297d9e886d9a202',
  'UE-W5A-MIGRATION-13554c6eb3f1c0eb',
  'UE-W5A-MIGRATION-ca1bae17a0893cc8',
]
async function prior() {
  const catalog = new FakeReplayCatalog({
    schemas: ['pg_catalog', 'public'],
    roles: ['fake_owner'],
    database: 'fake_db',
    functionContext: {
      actor: 'fake_owner',
      creationSchema: 'public',
      searchPath: pin.searchPath,
      defaultAcl: [],
    },
  })
  for (const unit of plan.specification.units.slice(0, 2))
    await catalog.applyFrozenUnit(unit.sql, String(unit.node.EXACT_UNIT_SHA256))
  return catalog
}
describe('three genuine nullable-column original boundaries;not full23temporal net-state', () => {
  for (const id of ids) {
    const unit = plan.specification.units.find((unit) => unit.node.REPLAY_UNIT_ID === id)!
    const effects = plan.components.effects.filter((effect) => effect.boundaryId === id)
    const handler = makeNullableColumnBoundaryHandler(unit, effects, pin)
    it(`actual whole-byte fresh and stable noop:${id}`, async () => {
      const catalog = await prior(),
        before = catalog.trace.length
      expect((await handler.inspect(catalog, pin.execution, unit, null)).state).toBe(
        'REPLAY_REQUIRED',
      )
      await catalog.applyFrozenUnit(unit.sql, String(unit.node.EXACT_UNIT_SHA256))
      const after = await handler.inspect(catalog, pin.execution, unit, null)
      expect(after.state).toBe('ALREADY_COMPLETE')
      const state = catalog.digest()
      expect(await handler.inspect(catalog, pin.execution, unit, null)).toEqual(after)
      expect(catalog.digest()).toBe(state)
      expect(catalog.trace.slice(before)).toEqual([
        `FAKE_UNIT_TRANSITION:${unit.node.EXACT_UNIT_SHA256}`,
      ])
    })
    it(`denies unknown ALTER ownership and unqualified source target before send:${id}`, async () => {
      const catalog = await prior(),
        before = catalog.digest()
      const reader = {
        async query(sql: string, parameters: string[]) {
          return sql === nullableColumnQueries.target
            ? [{ kind: 'r', standalone: true, visible: true, alterable: false }]
            : catalog.query(sql, parameters)
        },
      }
      expect((await handler.inspect(reader, pin.execution, unit, null)).state).toBe(
        'PRECONDITION_MISSING',
      )
      expect(catalog.digest()).toBe(before)
      expect(catalog.trace).toHaveLength(2)
    })
    it(`rolls back real added columns,indexes and staged receipt on commit failure:${id}`, async () => {
      const catalog = await prior(),
        before = catalog.digest()
      await expect(
        catalog.transaction(async (working) => {
          await working.applyFrozenUnit(unit.sql, String(unit.node.EXACT_UNIT_SHA256))
          const after = await handler.inspect(working, pin.execution, unit, null)
          expect(after.state).toBe('ALREADY_COMPLETE')
          working.stageReceipt(id, after)
        }, true),
      ).rejects.toThrow('FAKE_COMMIT_FAILED')
      expect(catalog.digest()).toBe(before)
      expect(catalog.readReceipt(id)).toBeNull()
    })
  }
})
