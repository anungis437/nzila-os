import { describe, expect, it } from 'vitest'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { compileReplayComponents } from './replay-effect-registry'
import { FakeReplayCatalog } from './replay-fake-catalog'
import { inspectProceduralEffect, type ProceduralContext } from './replay-procedural-inspection'
import { replayHash } from './post-w4p-replay'
const { frozen, sourceBytes } = loadFrozenReplay()
const components = compileReplayComponents(
  frozen,
  sourceBytes,
  read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
)
const effects = components.effects.filter(
  (effect) =>
    effect.compiled.kind === 'PROCEDURAL' && effect.compiled.contract.geometry.kind === 'POLICIES',
)
const fixtures = [
  'CREATE TABLE public.message_threads (id uuid PRIMARY KEY NOT NULL, organization_id uuid);',
  'CREATE TABLE public.messages (id uuid PRIMARY KEY NOT NULL, thread_id uuid);',
  'CREATE TABLE public.message_read_receipts (id uuid PRIMARY KEY NOT NULL, message_id uuid);',
  'CREATE TABLE public.message_notifications (id uuid PRIMARY KEY NOT NULL, message_id uuid);',
  'CREATE TABLE public.grievances (id uuid PRIMARY KEY NOT NULL, organization_id uuid);',
  'CREATE TABLE public.grievance_deadlines (id uuid PRIMARY KEY NOT NULL, grievance_id uuid);',
  'CREATE TABLE public.cross_org_access_log (id uuid PRIMARY KEY NOT NULL);',
]
async function fixture(missing?: string) {
  const catalog = new FakeReplayCatalog({
    schemas: ['pg_catalog', 'public'],
    database: 'fake_replay',
    roles: ['fake_owner', 'union_eyes_runtime', 'union_eyes_system'],
    functionContext: {
      actor: 'fake_owner',
      creationSchema: 'public',
      searchPath: ['pg_catalog', 'public'],
      defaultAcl: [],
    },
  })
  for (const sql of fixtures.filter(
    (sql) => !missing || !sql.startsWith(`CREATE TABLE public.${missing} `),
  ))
    await catalog.applyFrozenUnit(sql, replayHash(sql))
  return catalog
}
function context(effect: (typeof effects)[number], catalog: FakeReplayCatalog): ProceduralContext {
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
    relations: Object.fromEntries(
      [
        'message_threads',
        'messages',
        'message_read_receipts',
        'message_notifications',
        'grievances',
        'grievance_deadlines',
        'cross_org_access_log',
      ].map((name) => [name, 'public']),
    ),
    catalogVisibility: { snapshotDigest, schemas: ['public'] },
  }
}
async function observe(effect: (typeof effects)[number], catalog: FakeReplayCatalog) {
  if (effect.compiled.kind !== 'PROCEDURAL') throw new Error('PROCEDURAL_REQUIRED')
  return inspectProceduralEffect(catalog, effect.compiled.contract, context(effect, catalog))
}
describe('four source-native guarded policy blocks;fixture physical parents,not whole107proof', () => {
  it('pins four actual policy blocks', () => expect(effects).toHaveLength(4))
  for (const effect of effects) {
    it(`actual mutable geometry, role and RLS comparison with stable repeat:${effect.effectId}`, async () => {
      const catalog = await fixture()
      expect((await observe(effect, catalog)).state).toBe('UNSATISFIED')
      await catalog.applyFrozenUnit(effect.source, effect.sourceHash)
      expect((await observe(effect, catalog)).state).toBe('EXACT')
      const before = catalog.digest()
      await catalog.applyFrozenUnit(effect.source, effect.sourceHash)
      expect(catalog.digest()).toBe(before)
    })
    it(`source absence guard skips without guessed parent execution:${effect.effectId}`, async () => {
      if (
        effect.compiled.kind !== 'PROCEDURAL' ||
        effect.compiled.contract.geometry.kind !== 'POLICIES'
      )
        throw new Error('POLICIES_REQUIRED')
      const catalog = await fixture(effect.compiled.contract.geometry.table),
        before = catalog.digest()
      await catalog.applyFrozenUnit(effect.source, effect.sourceHash)
      expect(catalog.digest()).toBe(before)
      expect((await observe(effect, catalog)).state).toBe('EXACT')
    })
    it(`commit failure removes real installed policies, RLS and staged receipt:${effect.effectId}`, async () => {
      const catalog = await fixture(),
        before = catalog.digest()
      await expect(
        catalog.transaction(async (working) => {
          await working.applyFrozenUnit(effect.source, effect.sourceHash)
          working.stageReceipt('policy', { sourceHash: effect.sourceHash })
        }, true),
      ).rejects.toThrow('FAKE_COMMIT_FAILED')
      expect(catalog.digest()).toBe(before)
      expect(catalog.readReceipt('policy')).toBeNull()
    })
  }
  it('denies missing parent columns without publishing earlier RLS enables or policy drops', async () => {
    const catalog = await fixture(),
      effect = effects[1]
    const parent = catalog.inspectTable('public', 'grievances')!
    parent.columns = parent.columns.filter((column) => column.name !== 'organization_id')
    catalog.replaceTable(parent)
    const before = catalog.digest()
    await expect(catalog.applyFrozenUnit(effect.source, effect.sourceHash)).rejects.toThrow(
      'FAKE_COLUMN_REQUIRED',
    )
    expect(catalog.digest()).toBe(before)
  })
  it('denies changed guard target and borrowed target owner without a partial policy', async () => {
    const effect = effects[0]
    for (const ownerFault of [false, true]) {
      const catalog = await fixture()
      let sql = effect.source
      if (ownerFault) {
        const target = catalog.inspectTable('public', 'message_read_receipts')!
        target.owner = 'borrowed_owner'
        catalog.replaceTable(target)
      } else sql = sql.replace('public.message_read_receipts', 'public.messages')
      const before = catalog.digest()
      await expect(catalog.applyFrozenUnit(sql, replayHash(sql))).rejects.toThrow()
      expect(catalog.digest()).toBe(before)
    }
  })
})
