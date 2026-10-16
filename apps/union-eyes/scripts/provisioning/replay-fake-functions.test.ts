import { describe, expect, it } from 'vitest'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { replayHash, replayObject, replayRecords, replayText } from './post-w4p-replay'
import { FakeReplayCatalog } from './replay-fake-catalog'
import {
  compileFunctionEffect,
  inspectFunctionEffect,
  functionCatalogQueries,
} from './replay-function-inspection'
import { compileReplayComponents } from './replay-effect-registry'
import { inspectReplayEffect } from './replay-effect-inspection'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import type { FakeFunctionContext } from './replay-fake-functions'
const sources = replayRecords(
  replayObject(
    JSON.parse(
      read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
    ),
  ).BOUNDARIES,
)
  .flatMap((boundary) => replayRecords(boundary.EFFECTS))
  .filter((effect) => effect.EFFECT_CLASS === 'FUNCTION_OR_PROCEDURE')
  .map((effect) => ({
    id: replayText(effect.EFFECT_ID),
    source: replayText(replayObject(effect.COMPARATOR).EXACT_SOURCE_SEMANTICS),
    hash: replayText(effect.EXACT_EFFECT_SHA256),
  }))
const { frozen, sourceBytes } = loadFrozenReplay()
const components = compileReplayComponents(
  frozen,
  sourceBytes,
  read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
)
const context: FakeFunctionContext = {
  actor: 'fake_owner',
  creationSchema: 'public',
  searchPath: ['pg_catalog', 'public'],
  defaultAcl: [
    { grantor: 'fake_owner', grantee: 'fake_owner', privilege: 'EXECUTE', grantable: false },
    { grantor: 'fake_owner', grantee: 'PUBLIC', privilege: 'EXECUTE', grantable: false },
  ],
}
const fake = () =>
  new FakeReplayCatalog({
    schemas: ['pg_catalog', 'public'],
    roles: ['fake_owner', 'fake_other'],
    functionContext: context,
  })
const declaration = (body = 'BEGIN RETURN; END;') =>
  `CREATE OR REPLACE FUNCTION proof_function(p_name TEXT DEFAULT 'first',p_allow BOOLEAN DEFAULT false)
  RETURNS VOID LANGUAGE plpgsql AS $$${body}$$;`
const apply = (catalog: FakeReplayCatalog, source: string) =>
  catalog.applyFrozenUnit(source, replayHash(source))
describe('independent source-native function transitions;opaque bodies,not execution or full107proof', () => {
  it('pins the complete13function effect denominator', () => expect(sources).toHaveLength(13))
  for (const { id, source, hash } of sources) {
    it(`actual frozen function comparator after independent transition:${id}`, async () => {
      const catalog = fake(),
        contract = compileFunctionEffect(source, hash)
      await catalog.applyFrozenUnit(source, hash)
      const authority = {
        sourceHash: hash,
        schema: 'public',
        owner: context.actor,
        acl: context.defaultAcl,
      }
      expect((await inspectFunctionEffect(catalog, contract, authority)).definition).toBe(
        contract.action === 'DROP_IF_EXISTS' ? 'ABSENT' : 'EXACT',
      )
      const effect = components.effects.find((effect) => effect.effectId === id)!
      expect(
        (
          await inspectReplayEffect(catalog, effect, {
            effectId: id,
            sourceHash: hash,
            function: authority,
          })
        ).definition,
      ).toBe('EXACT')
      if (contract.action === 'CREATE_OR_REPLACE') {
        const rows = catalog.inspectFunctions('public', contract.name)
        expect(rows.length).toBe(1)
        rows[0].body += '--independent drift'
        catalog.replaceFunction(rows[0])
        expect((await inspectFunctionEffect(catalog, contract, authority)).definition).toBe(
          'DRIFTED',
        )
      }
    })
  }
  it('replacements preserve observed ownership,ACL and dependencies rather than reusing creation defaults', async () => {
    const catalog = fake(),
      source = declaration()
    await apply(catalog, source)
    const row = catalog.inspectFunctions('public', 'proof_function')[0]
    row.acl.push({
      grantor: 'fake_owner',
      grantee: 'fake_other',
      privilege: 'EXECUTE',
      grantable: true,
    })
    row.dependents.push({ class_id: '2620', object_id: '999', sub_id: 0, kind: 'n' })
    catalog.replaceFunction(row)
    const snapshot = catalog.snapshot()
    await apply(catalog, declaration('BEGIN RETURN; /*replacement*/ END;'))
    const after = catalog.inspectFunctions('public', 'proof_function')[0]
    expect(after.owner).toBe(row.owner)
    expect(after.acl).toEqual(row.acl)
    expect(after.dependents).toEqual(row.dependents)
    expect(after.body).not.toBe(row.body)
    expect(
      await snapshot.query(functionCatalogQueries.functions, ['public', 'proof_function']),
    ).toEqual([row])
  })
  it('DROP uses the observed search path and actual argument signature,not a public fallback', async () => {
    const catalog = new FakeReplayCatalog({
      schemas: ['pg_catalog', 'public', 'selected'],
      roles: ['fake_owner'],
      functionContext: {
        ...context,
        creationSchema: 'selected',
        searchPath: ['selected', 'public', 'pg_catalog'],
      },
    })
    await apply(catalog, declaration())
    await apply(catalog, 'DROP FUNCTION IF EXISTS proof_function(TEXT,BOOLEAN);')
    expect(catalog.inspectFunctions('selected', 'proof_function')).toEqual([])
  })
  it('keeps an overload outside the exact DROP signature', async () => {
    const catalog = fake()
    await apply(catalog, declaration())
    await apply(catalog, 'DROP FUNCTION IF EXISTS proof_function(TEXT);')
    expect(catalog.inspectFunctions('public', 'proof_function')).toHaveLength(1)
  })
  it('denies missing independent creation context', async () => {
    const catalog = new FakeReplayCatalog({ schemas: ['public'] })
    await expect(apply(catalog, declaration())).rejects.toThrow('FAKE_FUNCTION_CONTEXT_REQUIRED')
  })
  it('denies shadowed unqualified native types rather than inventing a pg_catalog binding', async () => {
    const catalog = new FakeReplayCatalog({
      schemas: ['pg_catalog', 'public'],
      roles: ['fake_owner'],
      enums: [{ schema: 'public', name: 'text', members: ['shadow'] }],
      functionContext: { ...context, searchPath: ['public', 'pg_catalog'] },
    })
    const before = catalog.digest()
    await expect(apply(catalog, declaration())).rejects.toThrow(
      'FAKE_FUNCTION_NATIVE_TYPE_SHADOWED',
    )
    expect(catalog.digest()).toBe(before)
    expect(await catalog.query(functionCatalogQueries.type, ['pg_catalog', 'text'])).toEqual([
      { schema: 'pg_catalog', name: 'text', kind: 'b', visible: false },
    ])
  })
  it('does not fabricate dependency clearance for RESTRICT drops', async () => {
    const catalog = fake()
    await apply(catalog, declaration())
    const row = catalog.inspectFunctions('public', 'proof_function')[0]
    row.dependents.push({ class_id: '2620', object_id: '999', sub_id: 0, kind: 'n' })
    catalog.replaceFunction(row)
    const before = catalog.digest()
    await expect(
      apply(catalog, 'DROP FUNCTION IF EXISTS proof_function(TEXT,BOOLEAN);'),
    ).rejects.toThrow('FAKE_FUNCTION_RESTRICT_DEPENDENCY')
    expect(catalog.digest()).toBe(before)
  })
  it('rejects forbidden replacement ownership,return shape and argument rename without leaking changes', async () => {
    for (const mutation of ['owner', 'return', 'argument']) {
      const catalog = fake()
      await apply(catalog, declaration())
      if (mutation === 'owner') {
        const row = catalog.inspectFunctions('public', 'proof_function')[0]
        row.owner = 'fake_other'
        catalog.replaceFunction(row)
      }
      const before = catalog.digest(),
        source =
          mutation === 'return'
            ? declaration().replace('RETURNS VOID', 'RETURNS BOOLEAN')
            : mutation === 'argument'
              ? declaration().replace('p_name', 'other_name')
              : declaration('BEGIN RETURN; END;')
      await expect(apply(catalog, source)).rejects.toThrow(
        mutation === 'owner'
          ? 'FAKE_FUNCTION_OWNER_REQUIRED'
          : mutation === 'return'
            ? 'FAKE_FUNCTION_RETURN_CHANGE_DENIED'
            : 'FAKE_FUNCTION_ARGUMENT_RENAME_DENIED',
      )
      expect(catalog.digest()).toBe(before)
    }
  })
  it('rolls back real function state and staged receipts on enclosing commit failure', async () => {
    const catalog = fake(),
      before = catalog.digest()
    await expect(
      catalog.transaction(async (current) => {
        await apply(current, declaration())
        current.stageReceipt('unit', { fake: true })
      }, true),
    ).rejects.toThrow('FAKE_COMMIT_FAILED')
    expect(catalog.digest()).toBe(before)
    expect(catalog.readReceipt('unit')).toBeNull()
    expect(catalog.inspectFunctions('public', 'proof_function')).toEqual([])
  })
  it('rolls back function creation when a later unsupported statement occurs within an indivisible unit', async () => {
    const catalog = fake(),
      before = catalog.digest()
    await expect(apply(catalog, declaration() + '\nTRUNCATE anything;')).rejects.toThrow(
      'FAKE_SOURCE_TRANSITION_UNSUPPORTED',
    )
    expect(catalog.digest()).toBe(before)
  })
  for (const source of [
    declaration().replace('LANGUAGE plpgsql', 'LANGUAGE plpgsql SECURITY DEFINER'),
    declaration().replace("DEFAULT 'first'", "DEFAULT current_setting('anything')"),
    declaration().replace('RETURNS VOID', 'RETURNS SETOF TEXT'),
    declaration().replace('p_allow BOOLEAN DEFAULT false', 'p_allow BOOLEAN'),
    'DROP FUNCTION IF EXISTS proof_function(TEXT,BOOLEAN) CASCADE;',
  ]) {
    it('denies unsupported declaration semantics without partial state', async () => {
      const catalog = fake(),
        before = catalog.digest()
      await expect(apply(catalog, source)).rejects.toThrow('FAKE_FUNCTION_SOURCE_UNSUPPORTED')
      expect(catalog.digest()).toBe(before)
    })
  }
})
