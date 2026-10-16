import { describe, expect, it } from 'vitest'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { compileReplayComponents } from './replay-effect-registry'
import { FakeReplayCatalog } from './replay-fake-catalog'
import {
  inspectProceduralEffect,
  type ProceduralContext,
  type ProceduralPredecessor,
} from './replay-procedural-inspection'
import { replayDigest, replayHash } from './post-w4p-replay'
const { frozen, sourceBytes } = loadFrozenReplay()
const components = compileReplayComponents(
  frozen,
  sourceBytes,
  read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
)
const effects = components.effects.filter(
  (effect) =>
    effect.compiled.kind === 'PROCEDURAL' && effect.compiled.contract.geometry.kind === 'DEFAULTS',
)
let observation = 0
async function fixture(
  definition = 'id uuid, member_category text',
  claims = 'id uuid, update_id uuid',
) {
  const catalog = new FakeReplayCatalog({
    schemas: ['pg_catalog', 'public'],
    database: 'fake_replay',
    roles: ['fake_owner'],
    functionContext: {
      actor: 'fake_owner',
      creationSchema: 'public',
      searchPath: ['pg_catalog', 'public'],
      defaultAcl: [],
    },
  })
  for (const sql of [
    `CREATE TABLE public.organization_members (${definition});`,
    `CREATE TABLE public.claim_updates (${claims});`,
  ])
    await catalog.applyFrozenUnit(sql, replayHash(sql))
  return catalog
}
function snapshot(catalog: FakeReplayCatalog): ProceduralPredecessor {
  const snapshotDigest = replayDigest({ catalog: catalog.digest(), observation: ++observation })
  return {
    reader: catalog.snapshot(),
    snapshotDigest,
    dataVisibility: {
      'public.organization_members': {
        snapshotDigest,
        basis: 'independent-fixture-full-row-inventory',
      },
    },
  }
}
function context(effect: (typeof effects)[number], catalog: FakeReplayCatalog): ProceduralContext {
  const snapshotDigest = replayDigest({ catalog: catalog.digest(), observation: ++observation })
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
    relations: { organization_members: 'public', claim_updates: 'public' },
    catalogVisibility: { snapshotDigest, schemas: ['pg_catalog', 'public'] },
    dataVisibility: {
      'public.organization_members': {
        snapshotDigest,
        basis: 'independent-fixture-full-row-inventory',
      },
    },
  }
}
async function observe(
  effect: (typeof effects)[number],
  catalog: FakeReplayCatalog,
  predecessor: ProceduralPredecessor,
) {
  if (effect.compiled.kind !== 'PROCEDURAL') throw new Error('PROCEDURAL_REQUIRED')
  return inspectProceduralEffect(
    catalog,
    effect.compiled.contract,
    context(effect, catalog),
    predecessor,
  )
}
describe('three independent frozen default subtransaction programs;fixture types,not whole107proof', () => {
  it('pins three actual default blocks', () => expect(effects).toHaveLength(3))
  for (const effect of effects) {
    it(`actual source default mutation, native comparison and stable repeat:${effect.effectId}`, async () => {
      const catalog = await fixture(),
        before = snapshot(catalog)
      await catalog.applyFrozenUnit(effect.source, effect.sourceHash)
      expect((await observe(effect, catalog, before)).state).toBe('EXACT')
      const digest = catalog.digest(),
        repeated = snapshot(catalog)
      await catalog.applyFrozenUnit(effect.source, effect.sourceHash)
      expect(catalog.digest()).toBe(digest)
      expect((await observe(effect, catalog, repeated)).state).toBe('EXACT')
    })
    it(`real default change and staged receipt are removed by commit failure:${effect.effectId}`, async () => {
      const catalog = await fixture(),
        before = catalog.digest()
      await expect(
        catalog.transaction(async (working) => {
          await working.applyFrozenUnit(effect.source, effect.sourceHash)
          working.stageReceipt('default', { sourceHash: effect.sourceHash })
        }, true),
      ).rejects.toThrow('FAKE_COMMIT_FAILED')
      expect(catalog.digest()).toBe(before)
      expect(catalog.readReceipt('default')).toBeNull()
    })
  }
  it('actually updates NULL categories and retains nonnull values and row cardinality', async () => {
    const effect = effects.find((effect) => effect.effectId.endsWith(':E025'))!,
      catalog = await fixture()
    const table = catalog.inspectTable('public', 'organization_members')!
    table.rows.push(
      { id: 'first', member_category: null },
      { id: 'second', member_category: 'associate' },
    )
    catalog.replaceTable(table)
    const before = snapshot(catalog)
    await catalog.applyFrozenUnit(effect.source, effect.sourceHash)
    expect(catalog.inspectTable('public', 'organization_members')!.rows).toEqual([
      { id: 'first', member_category: 'full_member' },
      { id: 'second', member_category: 'associate' },
    ])
    expect((await observe(effect, catalog, before)).state).toBe('EXACT')
  })
  it('catches each missing column independently without swallowing a missing table or an invalid literal', async () => {
    const claims = effects.find((effect) => effect.effectId.endsWith(':E010'))!
    const catalog = await fixture('id uuid', 'update_id uuid'),
      before = snapshot(catalog)
    await catalog.applyFrozenUnit(claims.source, claims.sourceHash)
    expect(catalog.inspectTable('public', 'claim_updates')!.columns[0].default_expression).toBe(
      'gen_random_uuid()',
    )
    expect((await observe(claims, catalog, before)).state).toBe('EXACT')
    const category = effects.find((effect) => effect.effectId.endsWith(':E025'))!
    const absent = await fixture('id uuid'),
      absentBefore = snapshot(absent)
    await absent.applyFrozenUnit(category.source, category.sourceHash)
    expect((await observe(category, absent, absentBefore)).state).toBe('EXACT')
    const invalid = await fixture('id uuid, member_category uuid'),
      invalidBefore = invalid.digest()
    await expect(invalid.applyFrozenUnit(category.source, category.sourceHash)).rejects.toThrow(
      'FAKE_DEFAULT_UNCAUGHT_INVALID_TEXT_REPRESENTATION',
    )
    expect(invalid.digest()).toBe(invalidBefore)
  })
  it('catches source datatype mismatch without changing the prior default and still applies the second assignment', async () => {
    const effect = effects.find((effect) => effect.effectId.endsWith(':E010'))!,
      catalog = await fixture('id uuid', 'id boolean DEFAULT true, update_id uuid')
    const before = snapshot(catalog)
    await catalog.applyFrozenUnit(effect.source, effect.sourceHash)
    expect(
      catalog
        .inspectTable('public', 'claim_updates')!
        .columns.map((column) => column.default_expression),
    ).toEqual(['true', 'gen_random_uuid()'])
    expect((await observe(effect, catalog, before)).state).toBe('EXACT')
  })
  it('source public-id guard preserves an existing default instead of repairing or replacing it', async () => {
    const effect = effects.find((effect) => effect.effectId.endsWith(':E022'))!,
      catalog = await fixture("id uuid DEFAULT '11111111-1111-4111-8111-111111111111'")
    const before = snapshot(catalog),
      digest = catalog.digest()
    await catalog.applyFrozenUnit(effect.source, effect.sourceHash)
    expect(catalog.digest()).toBe(digest)
    expect((await observe(effect, catalog, before)).state).toBe('EXACT')
  })
  it('models native UUID-to-text/varchar assignment IO and typmod dependencies without inventing casts', async () => {
    const effect = effects.find((effect) => effect.effectId.endsWith(':E010'))!,
      catalog = await fixture('id uuid', 'id text, update_id varchar(64)')
    const before = snapshot(catalog)
    await catalog.applyFrozenUnit(effect.source, effect.sourceHash)
    expect((await observe(effect, catalog, before)).state).toBe('EXACT')
  })
  it('denies unsupported row side effects and restores the earlier successful SET DEFAULT', async () => {
    const effect = effects.find((effect) => effect.effectId.endsWith(':E025'))!,
      catalog = await fixture()
    const table = catalog.inspectTable('public', 'organization_members')!
    table.rowCountVisible = false
    table.rows.push({ id: 'first', member_category: null })
    catalog.replaceTable(table)
    const before = catalog.digest()
    await expect(catalog.applyFrozenUnit(effect.source, effect.sourceHash)).rejects.toThrow(
      'FAKE_COMPLETE_ROW_VISIBILITY_REQUIRED',
    )
    expect(catalog.digest()).toBe(before)
  })
})
