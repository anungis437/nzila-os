import { describe, expect, it } from 'vitest'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { compileReplayComponents } from './replay-effect-registry'
import { FakeReplayCatalog } from './replay-fake-catalog'
import { fakeGuardIlike } from './replay-fake-guard'
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
    effect.compiled.kind === 'PROCEDURAL' && effect.compiled.contract.geometry.kind === 'GUARD',
)
async function fixture(effect: (typeof effects)[number], present = true) {
  if (effect.compiled.kind !== 'PROCEDURAL' || effect.compiled.contract.geometry.kind !== 'GUARD')
    throw new Error('GUARD_REQUIRED')
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
  const g = effect.compiled.contract.geometry
  if (present) {
    const tables = [...new Set([...g.tables, ...g.parents, ...g.columns.map(([table]) => table)])]
    for (const table of tables) {
      const columns = [
        ...new Set([
          'id',
          ...g.columns.filter(([name]) => name === table).map(([, column]) => column),
        ]),
      ]
      const sql = `CREATE TABLE public.${table} (${columns.map((column) => `${column} uuid${column === 'id' ? ' PRIMARY KEY NOT NULL' : ''}`).join(', ')});`
      await catalog.applyFrozenUnit(sql, replayHash(sql))
    }
  }
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
    relations: {},
    catalogVisibility: { snapshotDigest, schemas: ['public'], allSchemas: true },
  }
}
async function observe(effect: (typeof effects)[number], catalog: FakeReplayCatalog) {
  if (effect.compiled.kind !== 'PROCEDURAL') throw new Error('PROCEDURAL_REQUIRED')
  return inspectProceduralEffect(catalog, effect.compiled.contract, context(effect, catalog))
}
describe('five frozen read-only source guards on real mutable fixture catalog,not full107proof', () => {
  it('pins five exact guard programs', () => expect(effects).toHaveLength(5))
  for (const effect of effects) {
    it(`actual native condition execution and production comparison:${effect.effectId}`, async () => {
      const catalog = await fixture(effect),
        before = catalog.digest()
      await catalog.applyFrozenUnit(effect.source, effect.sourceHash)
      expect(catalog.digest()).toBe(before)
      expect((await observe(effect, catalog)).state).toBe('EXACT')
    })
    it(`source NOTICE skips differ from required-relation exceptions:${effect.effectId}`, async () => {
      const catalog = await fixture(effect, false),
        before = catalog.digest()
      if (effect.effectId === 'UE-W5A-MIGRATION-c1a4ed09468e3478:E001') {
        await expect(catalog.applyFrozenUnit(effect.source, effect.sourceHash)).rejects.toThrow(
          'FAKE_GUARD_REQUIRED_RELATION_ABSENT',
        )
        expect((await observe(effect, catalog)).state).toBe('MISSING_PREREQUISITE')
      } else {
        await catalog.applyFrozenUnit(effect.source, effect.sourceHash)
        expect((await observe(effect, catalog)).state).toBe('EXACT')
      }
      expect(catalog.digest()).toBe(before)
    })
  }
  it('checks actual special metadata columns rather than a source-guard completion flag', async () => {
    for (const suffix of ['ba9c377aa3ffde74:E001', '910f017958a83d90:E001']) {
      const effect = effects.find((effect) => effect.effectId.endsWith(suffix))!,
        catalog = await fixture(effect)
      if (
        effect.compiled.kind !== 'PROCEDURAL' ||
        effect.compiled.contract.geometry.kind !== 'GUARD'
      )
        throw new Error('GUARD_REQUIRED')
      const [table, column] = effect.compiled.contract.geometry.columns[0],
        native = catalog.inspectTable('public', table)!
      native.columns = native.columns.filter((field) => field.name !== column)
      catalog.replaceTable(native)
      const before = catalog.digest()
      await expect(catalog.applyFrozenUnit(effect.source, effect.sourceHash)).rejects.toThrow(
        'FAKE_GUARD_REQUIRED_COLUMN_ABSENT',
      )
      expect(catalog.digest()).toBe(before)
      expect((await observe(effect, catalog)).state).toBe('MISSING_PREREQUISITE')
    }
  })
  it('checks physical canonical policy command and role conflicts, not all existing policy names', async () => {
    const effect = effects[0],
      catalog = await fixture(effect)
    for (const [command, role] of [
      ['SELECT', 'union_eyes_system'],
      ['UPDATE', 'union_eyes_runtime'],
    ]) {
      const sql = `DROP POLICY IF EXISTS ue_org_isolation_select ON organizations;
        CREATE POLICY ue_org_isolation_select ON organizations FOR ${command} TO ${role} USING (true);`
      await catalog.applyFrozenUnit(sql, replayHash(sql))
      const before = catalog.digest()
      await expect(catalog.applyFrozenUnit(effect.source, effect.sourceHash)).rejects.toThrow(
        'FAKE_GUARD_POLICY_CONFLICT',
      )
      expect(catalog.digest()).toBe(before)
      expect((await observe(effect, catalog)).state).toBe('DRIFTED')
    }
  })
  it('matches SQL ILIKE underscore wildcards and NULL semantics independently', () => {
    expect(fakeGuardIlike(null, '%current_org_id%')).toBeNull()
    expect(fakeGuardIlike('CURRENTXORGYID', '%current_org_id%')).toBe(true)
    expect(fakeGuardIlike('unrelated', '%current_org_id%')).toBe(false)
    expect(() => fakeGuardIlike('unsupported_é', '%current_org_id%')).toThrow(
      'FAKE_GUARD_COLLATION_OR_ESCAPE_UNSUPPORTED',
    )
  })
  it('executes actual prohibition on arbitrary existing policy names and any schema inventory', async () => {
    const effect = effects[1],
      catalog = await fixture(effect)
    const sql =
      "CREATE POLICY legacy_policy ON organizations FOR SELECT TO union_eyes_runtime USING (current_setting('app.current_org_id', true) IS NOT NULL);"
    await catalog.applyFrozenUnit(sql, replayHash(sql))
    const native = catalog.inspectPolicy('public', 'organizations', 'legacy_policy')!
    native.using_expression = "current_setting('app.current_org_id', true) IS NULL"
    catalog.replacePolicy(native)
    const before = catalog.digest()
    await expect(catalog.applyFrozenUnit(effect.source, effect.sourceHash)).rejects.toThrow(
      'FAKE_GUARD_SOURCE_PROHIBITION',
    )
    expect(catalog.digest()).toBe(before)
    expect((await observe(effect, catalog)).state).toBe('DRIFTED')
  })
  it('refuses a changed guard program instead of allowing unknown conditions', async () => {
    const effect = effects[0],
      catalog = await fixture(effect),
      before = catalog.digest()
    const source = effect.source.replace('r.cmd <> expected_cmd', 'r.cmd = expected_cmd')
    expect(source).not.toBe(effect.source)
    await expect(catalog.applyFrozenUnit(source, replayHash(source))).rejects.toThrow(
      'FAKE_GUARD_UNFROZEN_SOURCE',
    )
    expect(catalog.digest()).toBe(before)
  })
})
