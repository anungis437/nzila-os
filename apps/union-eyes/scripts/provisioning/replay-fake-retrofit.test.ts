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
    effect.compiled.kind === 'PROCEDURAL' && effect.compiled.contract.geometry.kind === 'RETROFIT',
)
async function fixture(table: string, includeTarget = true) {
  const catalog = new FakeReplayCatalog({
    schemas: ['pg_catalog', 'public'],
    roles: ['fake_owner'],
    database: 'fake_replay',
    functionContext: {
      actor: 'fake_owner',
      creationSchema: 'public',
      searchPath: ['pg_catalog', 'public'],
      defaultAcl: [],
    },
  })
  for (const name of includeTarget ? ['organizations', table] : ['organizations']) {
    const sql = `CREATE TABLE public.${name} (id uuid PRIMARY KEY NOT NULL);`
    await catalog.applyFrozenUnit(sql, replayHash(sql))
  }
  return catalog
}
function context(
  effect: (typeof effects)[number],
  catalog: FakeReplayCatalog,
  table: string,
): ProceduralContext {
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
    relations: { [table]: 'public', organizations: 'public' },
    catalogVisibility: { snapshotDigest, schemas: ['public'] },
    dataVisibility: {
      [`public.${table}`]: {
        snapshotDigest,
        basis: 'source-created-empty-fixture-full-row-inventory',
      },
    },
  }
}
describe('19 independent source-native retrofit branches;fixture parents,not whole107proof', () => {
  it('pins nineteen original blocks', () => expect(effects).toHaveLength(19))
  for (const effect of effects) {
    it(`fresh, guarded repeat and actual comparator:${effect.effectId}`, async () => {
      if (
        effect.compiled.kind !== 'PROCEDURAL' ||
        effect.compiled.contract.geometry.kind !== 'RETROFIT'
      )
        throw new Error('RETROFIT_REQUIRED')
      const table = effect.compiled.contract.geometry.table,
        contract = effect.compiled.contract
      const catalog = await fixture(table)
      expect(
        (await inspectProceduralEffect(catalog, contract, context(effect, catalog, table))).state,
      ).toBe('UNSATISFIED')
      await catalog.applyFrozenUnit(effect.source, effect.sourceHash)
      expect(
        (await inspectProceduralEffect(catalog, contract, context(effect, catalog, table))).state,
      ).toBe('EXACT')
      const before = catalog.digest()
      await catalog.applyFrozenUnit(effect.source, effect.sourceHash)
      expect(catalog.digest()).toBe(before)
    })
    it(`actual missing-table guard executes no authority DDL:${effect.effectId}`, async () => {
      if (
        effect.compiled.kind !== 'PROCEDURAL' ||
        effect.compiled.contract.geometry.kind !== 'RETROFIT'
      )
        throw new Error('RETROFIT_REQUIRED')
      const catalog = await fixture(effect.compiled.contract.geometry.table, false),
        before = catalog.digest()
      await catalog.applyFrozenUnit(effect.source, effect.sourceHash)
      expect(catalog.digest()).toBe(before)
      expect(
        (
          await inspectProceduralEffect(
            catalog,
            effect.compiled.contract,
            context(effect, catalog, effect.compiled.contract.geometry.table),
          )
        ).state,
      ).toBe('EXACT')
    })
    it(`nonempty source target aborts without partial columns or indexes:${effect.effectId}`, async () => {
      if (
        effect.compiled.kind !== 'PROCEDURAL' ||
        effect.compiled.contract.geometry.kind !== 'RETROFIT'
      )
        throw new Error('RETROFIT_REQUIRED')
      const table = effect.compiled.contract.geometry.table,
        catalog = await fixture(table)
      const target = catalog.inspectTable('public', table)!
      target.rows.push({ id: '11111111-1111-4111-8111-111111111111' })
      catalog.replaceTable(target)
      const before = catalog.digest()
      await expect(catalog.applyFrozenUnit(effect.source, effect.sourceHash)).rejects.toThrow(
        'FAKE_RETROFIT_NONEMPTY_WITHOUT_AUTHORITY',
      )
      expect(catalog.digest()).toBe(before)
    })
  }
  it('rolls back first authority column when a later statement or commit fails', async () => {
    const effect = effects[0]
    if (
      effect.compiled.kind !== 'PROCEDURAL' ||
      effect.compiled.contract.geometry.kind !== 'RETROFIT'
    )
      throw new Error('RETROFIT_REQUIRED')
    const catalog = await fixture(effect.compiled.contract.geometry.table),
      before = catalog.digest()
    await expect(
      catalog.transaction(async (working) => {
        await working.applyFrozenUnit(effect.source, effect.sourceHash)
        working.stageReceipt('retrofit', { sourceHash: effect.sourceHash })
      }, true),
    ).rejects.toThrow('FAKE_COMMIT_FAILED')
    expect(catalog.digest()).toBe(before)
    expect(catalog.readReceipt('retrofit')).toBeNull()
    const changed = `${effect.source}\nDROP TABLE public.organizations;`
    await expect(catalog.applyFrozenUnit(changed, replayHash(changed))).rejects.toThrow(
      'FAKE_SOURCE_TRANSITION_UNSUPPORTED',
    )
    expect(catalog.digest()).toBe(before)
  })
  it('rejects unsupported guard substitution even when an absent target would skip execution', async () => {
    const effect = effects[0]
    for (const change of [
      effect.source.replace("table_schema='public'", "table_schema='invented'"),
      effect.source.replace('IF NOT EXISTS', 'IF EXISTS'),
      effect.source.replace('LIMIT 1', 'LIMIT 2'),
      effect.source.replace('END $$;', 'END $$;\nDO $$ BEGIN RETURN; END $$;'),
    ]) {
      expect(change).not.toBe(effect.source)
      const catalog = await fixture('unused_target', false),
        before = catalog.digest()
      await expect(catalog.applyFrozenUnit(change, replayHash(change))).rejects.toThrow()
      expect(catalog.digest()).toBe(before)
    }
  })
  it('denies missing full-row visibility before an authority addition', async () => {
    const effect = effects[0]
    if (
      effect.compiled.kind !== 'PROCEDURAL' ||
      effect.compiled.contract.geometry.kind !== 'RETROFIT'
    )
      throw new Error('RETROFIT_REQUIRED')
    const table = effect.compiled.contract.geometry.table,
      catalog = await fixture(table)
    const target = catalog.inspectTable('public', table)!
    target.rowCountVisible = false
    catalog.replaceTable(target)
    const before = catalog.digest()
    await expect(catalog.applyFrozenUnit(effect.source, effect.sourceHash)).rejects.toThrow(
      'FAKE_RETROFIT_ROW_VISIBILITY_REQUIRED',
    )
    expect(catalog.digest()).toBe(before)
  })
  it('rolls back the first of two source additions if the second cannot resolve its native type', async () => {
    const effect = effects.find((effect) => effect.effectId.endsWith(':E020'))!
    const catalog = await fixture('shared_clause_library'),
      before = catalog.digest()
    const source = effect.source.replace(
      'shared_with_org_ids uuid[]',
      'shared_with_org_ids nonexistent_type',
    )
    expect(source).not.toBe(effect.source)
    await expect(catalog.applyFrozenUnit(source, replayHash(source))).rejects.toThrow(
      'FAKE_NAMED_TYPE_REQUIRED',
    )
    expect(catalog.digest()).toBe(before)
  })
})
