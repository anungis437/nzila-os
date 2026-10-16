import { describe, expect, it } from 'vitest'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { compileReplayComponents } from './replay-effect-registry'
import { FakeReplayCatalog } from './replay-fake-catalog'
import {
  inspectProceduralEffect,
  proceduralQueries,
  type ProceduralContext,
} from './replay-procedural-inspection'
import { replayHash } from './post-w4p-replay'
const { frozen, sourceBytes } = loadFrozenReplay()
const components = compileReplayComponents(
  frozen,
  sourceBytes,
  read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
)
const connect = components.effects.find(
  (effect) =>
    effect.compiled.kind === 'PROCEDURAL' && effect.compiled.contract.geometry.kind === 'CONNECT',
)!
const trigger = components.effects.find(
  (effect) =>
    effect.compiled.kind === 'PROCEDURAL' && effect.compiled.contract.geometry.kind === 'TRIGGER',
)!
const fn = components.effects.find(
  (effect) =>
    effect.compiled.kind === 'FUNCTION' &&
    effect.compiled.contract.name === 'ue_enforce_workbook_credential_authority',
)!
const acl = [
  { grantor: 'fake_owner', grantee: 'fake_owner', privilege: 'EXECUTE' as const, grantable: false },
]
function fixture(
  database: string | undefined = 'fake_replay',
  roles = ['fake_owner', 'union_eyes_runtime', 'union_eyes_system'],
) {
  return new FakeReplayCatalog({
    schemas: ['pg_catalog', 'public'],
    roles,
    database,
    functionContext: {
      actor: 'fake_owner',
      creationSchema: 'public',
      searchPath: ['pg_catalog', 'public'],
      defaultAcl: acl,
    },
  })
}
function context(effect: typeof connect, catalog: FakeReplayCatalog): ProceduralContext {
  const snapshotDigest = catalog.digest()
  return {
    effectId: effect.effectId,
    sourceHash: effect.sourceHash,
    boundaryHash: effect.boundaryHash,
    ordinal: effect.ordinal,
    window: 'IMMEDIATE_PRE_SUCCESSOR',
    snapshotDigest,
    actor: 'fake_owner',
    database: 'fake_replay',
    searchPath: ['pg_catalog', 'public'],
    relations: { workbooks: 'public' },
    catalogVisibility: { snapshotDigest, schemas: ['public'] },
    databaseGrantor: 'fake_owner',
    triggerFunction: { sourceHash: fn.sourceHash, schema: 'public', owner: 'fake_owner', acl },
  }
}
async function observe(effect: typeof connect, catalog: FakeReplayCatalog) {
  if (effect.compiled.kind !== 'PROCEDURAL') throw new Error('PROCEDURAL_REQUIRED')
  return inspectProceduralEffect(catalog, effect.compiled.contract, context(effect, catalog))
}
async function table(catalog: FakeReplayCatalog) {
  const sql = 'CREATE TABLE public.workbooks (id uuid PRIMARY KEY NOT NULL);'
  await catalog.applyFrozenUnit(sql, replayHash(sql))
}
describe('independent CONNECT and trigger DO branches;not function-body execution or whole107proof', () => {
  it('executes actual database-name formatting and exact native explicit grants, with stable repeat', async () => {
    const catalog = fixture()
    expect((await observe(connect, catalog)).state).toBe('UNSATISFIED')
    await catalog.applyFrozenUnit(connect.source, connect.sourceHash)
    expect((await observe(connect, catalog)).state).toBe('EXACT')
    const before = catalog.digest()
    await catalog.applyFrozenUnit(connect.source, connect.sourceHash)
    expect(catalog.digest()).toBe(before)
  })
  it('denies missing database and grantee role without a partial first grant', async () => {
    for (const catalog of [
      fixture(''),
      fixture('fake_replay', ['fake_owner', 'union_eyes_runtime']),
    ]) {
      const before = catalog.digest()
      await expect(catalog.applyFrozenUnit(connect.source, connect.sourceHash)).rejects.toThrow()
      expect(catalog.digest()).toBe(before)
    }
  })
  it('does not accept substituted dynamic grant targets', async () => {
    const catalog = fixture(),
      before = catalog.digest()
    const sql = connect.source.replace('union_eyes_system', 'fake_owner')
    await expect(catalog.applyFrozenUnit(sql, replayHash(sql))).rejects.toThrow(
      'FAKE_CONNECT_SOURCE_UNSUPPORTED',
    )
    expect(catalog.digest()).toBe(before)
  })
  it('executes actual guarded trigger attachment with exact function/body/ACL comparator and repeat', async () => {
    const catalog = fixture()
    await table(catalog)
    await catalog.applyFrozenUnit(fn.source, fn.sourceHash)
    expect((await observe(trigger, catalog)).state).toBe('UNSATISFIED')
    await catalog.applyFrozenUnit(trigger.source, trigger.sourceHash)
    expect((await observe(trigger, catalog)).state).toBe('EXACT')
    const before = catalog.digest()
    await catalog.applyFrozenUnit(trigger.source, trigger.sourceHash)
    expect(catalog.digest()).toBe(before)
  })
  it('skips the absent unqualified table without demanding an unexecuted function lookup', async () => {
    const catalog = fixture(),
      before = catalog.digest()
    await catalog.applyFrozenUnit(trigger.source, trigger.sourceHash)
    expect(catalog.digest()).toBe(before)
    expect((await observe(trigger, catalog)).state).toBe('EXACT')
  })
  it('denies missing function, borrowed table ownership and wrong return type atomically', async () => {
    for (const fault of ['missing-function', 'borrowed-table', 'return-type']) {
      const catalog = fixture()
      await table(catalog)
      if (fault !== 'missing-function') await catalog.applyFrozenUnit(fn.source, fn.sourceHash)
      if (fault === 'borrowed-table') {
        const target = catalog.inspectTable('public', 'workbooks')!
        target.owner = 'borrowed_owner'
        catalog.replaceTable(target)
      }
      if (fault === 'return-type') {
        const native = catalog.inspectFunctions(
          'public',
          'ue_enforce_workbook_credential_authority',
        )[0]
        native.return_name = 'void'
        catalog.replaceFunction(native)
      }
      const before = catalog.digest()
      await expect(catalog.applyFrozenUnit(trigger.source, trigger.sourceHash)).rejects.toThrow()
      expect(catalog.digest()).toBe(before)
    }
  })
  it('records real restrictive function-drop dependency, not an inspector completion flag', async () => {
    const catalog = fixture()
    await table(catalog)
    await catalog.applyFrozenUnit(fn.source, fn.sourceHash)
    await catalog.applyFrozenUnit(trigger.source, trigger.sourceHash)
    const before = catalog.digest(),
      sql = 'DROP FUNCTION IF EXISTS ue_enforce_workbook_credential_authority();'
    await expect(catalog.applyFrozenUnit(sql, replayHash(sql))).rejects.toThrow()
    expect(catalog.digest()).toBe(before)
    expect(
      await catalog.query(proceduralQueries.trigger, [
        'public',
        'workbooks',
        'ue_workbook_credential_authority',
      ]),
    ).toHaveLength(1)
  })
  it.each([connect, trigger])(
    'commit failure retains neither state nor staged receipt: $effectId',
    async (effect) => {
      const catalog = fixture()
      await table(catalog)
      await catalog.applyFrozenUnit(fn.source, fn.sourceHash)
      const before = catalog.digest()
      await expect(
        catalog.transaction(async (working) => {
          await working.applyFrozenUnit(effect.source, effect.sourceHash)
          working.stageReceipt('do', { sourceHash: effect.sourceHash })
        }, true),
      ).rejects.toThrow('FAKE_COMMIT_FAILED')
      expect(catalog.digest()).toBe(before)
      expect(catalog.readReceipt('do')).toBeNull()
    },
  )
})
