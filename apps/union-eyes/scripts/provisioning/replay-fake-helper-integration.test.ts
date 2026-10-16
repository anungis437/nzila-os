import { describe, expect, it } from 'vitest'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import { replayHash, replayObject, replayRecords, replayText } from './post-w4p-replay'
import { FakeReplayCatalog } from './replay-fake-catalog'
import { rlsPrimitiveQueries } from './replay-rls-primitives'
import { buildSupplement } from '../../../../scripts/ue/implement-w5bpk-parent-key-supplement'
import {
  applyParentKeySupplement,
  inspectParentKey,
  readParentKeyCatalog,
  supplementAuthorityDigest,
  supplementPlanDigest,
  type SupplementContext,
  type SupplementAuthorization,
  type ParentKeyAdapter,
} from './parent-key-supplement'
import { replayDigest } from './post-w4p-replay'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import { compileReplayComponents } from './replay-effect-registry'
import {
  inspectPolicyHelper,
  type HelperPositionContext,
  type HelperEffect,
} from './replay-policy-helper-inspection'
const payloads = replayObject(
  JSON.parse(
    read(
      'docs/union-eyes/reality-remediation/UE_PLATFORM_BASELINE_INACTIVE_SQL_PAYLOADS_W4FR4.json',
    ),
  ),
)
const relations = replayRecords(payloads.RELATION_CREATE_PAYLOADS)
const nativeTypes = replayRecords(payloads.TYPE_PAYLOADS)
const ledger = replayObject(
  JSON.parse(
    read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
  ),
)
const firstBoundary = replayRecords(ledger.BOUNDARIES).find((boundary) =>
  replayRecords(boundary.EFFECTS).some(
    (effect) => effect.EFFECT_ID === 'UE-W5A-MIGRATION-d264f77905daf432:E047',
  ),
)!
const effects = replayRecords(firstBoundary.EFFECTS)
const source = (effect: (typeof effects)[number]) =>
  replayText(replayObject(effect.COMPARATOR).EXACT_SOURCE_SEMANTICS)
const functionEffect = effects.find(
  (effect) => effect.EFFECT_ID === 'UE-W5A-MIGRATION-d264f77905daf432:E047',
)!
const calls = replayRecords(ledger.BOUNDARIES)
  .flatMap((boundary) => replayRecords(boundary.EFFECTS))
  .filter((effect) => {
    const tokens = sqlTokens(source(effect))
    return (
      tokens[0]?.value.toUpperCase() === 'SELECT' &&
      tokens[1]?.value === 'ue_create_direct_org_rls_policy' &&
      relations.some(
        (relation) => sqlTokens(replayText(relation.SQL))[4]?.value === tokens[3]?.value,
      )
    )
  })
async function baseline(searchPath = ['pg_catalog', 'public']) {
  const catalog = new FakeReplayCatalog({
    schemas: ['pg_catalog', 'public'],
    roles: ['fake_owner', 'ue_runtime', 'union_eyes_runtime', 'union_eyes_system'],
    functionContext: {
      actor: 'fake_owner',
      creationSchema: 'public',
      searchPath,
      defaultAcl: [
        { grantor: 'fake_owner', grantee: 'PUBLIC', privilege: 'EXECUTE', grantable: false },
        { grantor: 'fake_owner', grantee: 'fake_owner', privilege: 'EXECUTE', grantable: false },
      ],
    },
  })
  for (const payload of [...nativeTypes, ...relations])
    await catalog.applyFrozenUnit(replayText(payload.SQL), replayText(payload.SQL_SHA256))
  await catalog.applyFrozenUnit(
    source(functionEffect),
    replayText(functionEffect.EXACT_EFFECT_SHA256),
  )
  return catalog
}
const specification = buildSupplement().plan.SPECIFICATION
const supplementContext: SupplementContext = {
  targetDigest: replayDigest('fake-target'),
  scope: 'UE_OPERATIONAL',
  actorClass: 'MIGRATION_ADMIN',
  actorPrincipal: 'fake_owner',
  w4pVerificationDigest: replayDigest('fake-parent-shape-verification'),
  w4pPlanDigest: specification.parentW4pDigest,
  w4pVerified: true,
  exclusiveExecutionReference: 'fake-only',
}
const authorization: SupplementAuthorization = {
  purpose: 'PRE_W5_PARENT_KEY_SUPPLEMENT',
  planDigest: supplementPlanDigest(specification),
  authorityDigest: supplementAuthorityDigest(specification),
  graphDigest: specification.graphDigest,
  targetDigest: supplementContext.targetDigest,
  actorPrincipal: supplementContext.actorPrincipal,
  w4pVerificationDigest: supplementContext.w4pVerificationDigest,
  executionApproved: true,
}
const { frozen, sourceBytes } = loadFrozenReplay()
const components = compileReplayComponents(
  frozen,
  sourceBytes,
  read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
)
function helperContract(id: string) {
  const component = components.effects.find((effect) => effect.effectId === id)
  if (component?.compiled.kind !== 'POLICY_HELPER')
    throw new Error('ACTUAL_HELPER_COMPONENT_REQUIRED')
  return component.compiled.contract
}
function helperContext(
  catalog: FakeReplayCatalog,
  contract: HelperEffect,
  parentSchemas: Record<string, string> = {},
): HelperPositionContext {
  const fn = catalog.inspectFunctions('public', contract.function.name)[0]
  if (!fn) throw new Error('ACTUAL_SOURCE_PRODUCED_FUNCTION_REQUIRED')
  return {
    effectId: contract.call.effectId,
    sourceHash: contract.call.sourceHash,
    functionHash: contract.function.sourceHash,
    executionRole: 'fake_owner',
    searchPath: ['pg_catalog', 'public'],
    targetSchema: 'public',
    parentSchemas,
    function: {
      sourceHash: contract.function.sourceHash,
      schema: fn.schema,
      owner: fn.owner,
      acl: fn.acl,
    },
  }
}
describe('actual mutable helper integration from accepted raw baseline declarations;not full W4P or107 proof', () => {
  it('seeds all36 enums and57 relation payloads from exact raw source,not expected inspector outputs', async () => {
    const catalog = await baseline()
    expect(catalog.trace).toHaveLength(94)
    expect(
      catalog.inspectTable('public', 'committee_meetings')?.columns.map((column) => column.name),
    ).toEqual(['organization_id'])
  })
  it('executes source-native direct helpers against actual raw W4P-owned relations', async () => {
    expect(calls).toHaveLength(45)
    const catalog = await baseline()
    for (const effect of calls) {
      const name = sqlTokens(source(effect))[3].value
      await catalog.applyFrozenUnit(source(effect), replayText(effect.EXACT_EFFECT_SHA256))
      const table = catalog.inspectTable('public', name)!
      expect(table.enabled).toBe(true)
      expect(table.forced).toBe(true)
      expect(table.policies.length).toBeGreaterThan(0)
      const contract = helperContract(replayText(effect.EFFECT_ID))
      const observation = await inspectPolicyHelper(
        catalog,
        contract,
        helperContext(catalog, contract),
      )
      expect(observation, JSON.stringify(observation)).toMatchObject({
        definition: 'EXACT',
        denial: null,
      })
      const state = catalog.digest()
      await catalog.applyFrozenUnit(source(effect), replayText(effect.EXACT_EFFECT_SHA256))
      expect(catalog.digest()).toBe(state)
    }
  })
  describe('twelve formerly blocked0014effect transitions after actual ten-key supplement;not whole0014 eligibility', () => {
    const ids = [
      'E086',
      'E087',
      'E088',
      'E089',
      'E090',
      'E091',
      'E092',
      'E094',
      'E096',
      'E099',
      'E100',
      'E101',
    ].map((suffix) => `UE-W5A-MIGRATION-c1a4ed09468e3478:${suffix}`)
    const allEffects = replayRecords(ledger.BOUNDARIES).flatMap((boundary) =>
      replayRecords(boundary.EFFECTS),
    )
    const declaration = allEffects.find(
      (effect) => effect.EFFECT_ID === 'UE-W5A-MIGRATION-910f017958a83d90:E021',
    )!
    for (const id of ids) {
      it(`observes actual parent-key-dependent emitted policies with the real comparator:${id}`, async () => {
        const catalog = await baseline()
        for (const definition of specification.definitions)
          await catalog.applyFrozenUnit(definition.sql, definition.sqlDigest)
        await catalog.applyFrozenUnit(
          source(declaration),
          replayText(declaration.EXACT_EFFECT_SHA256),
        )
        const effect = allEffects.find((effect) => effect.EFFECT_ID === id)!
        const tokens = sqlTokens(source(effect))
        const parent = tokens.filter((token) => token.kind === 'STRING')[2].value
        const contract = helperContract(id),
          context = helperContext(catalog, contract, { [parent]: 'public' })
        await catalog.applyFrozenUnit(source(effect), replayText(effect.EXACT_EFFECT_SHA256))
        const observation = await inspectPolicyHelper(catalog, contract, context)
        expect(observation, JSON.stringify(observation)).toMatchObject({
          definition: 'EXACT',
          denial: null,
        })
        const state = catalog.digest()
        await catalog.applyFrozenUnit(source(effect), replayText(effect.EXACT_EFFECT_SHA256))
        expect(catalog.digest()).toBe(state)
        expect((await inspectPolicyHelper(catalog, contract, context)).definition).toBe('EXACT')
      })
      it(`denies actual missing parent-id state without publishing partial helper mutations:${id}`, async () => {
        const catalog = await baseline()
        await catalog.applyFrozenUnit(
          source(declaration),
          replayText(declaration.EXACT_EFFECT_SHA256),
        )
        const effect = allEffects.find((effect) => effect.EFFECT_ID === id)!
        const state = catalog.digest(),
          traceLength = catalog.trace.length
        await expect(
          catalog.applyFrozenUnit(source(effect), replayText(effect.EXACT_EFFECT_SHA256)),
        ).rejects.toThrow()
        expect(catalog.digest()).toBe(state)
        expect(catalog.trace).toHaveLength(traceLength)
      })
    }
  })
  it('rolls back source-emitted RLS changes and prior policy drops if a later emitted CREATE fails', async () => {
    const catalog = await baseline()
    const effect = calls[0],
      name = sqlTokens(source(effect))[3].value
    const table = catalog.inspectTable('public', name)!
    table.columns = table.columns.filter((column) => column.name !== 'organization_id')
    catalog.replaceTable(table)
    const before = catalog.digest()
    await expect(
      catalog.applyFrozenUnit(source(effect), replayText(effect.EXACT_EFFECT_SHA256)),
    ).rejects.toThrow()
    expect(catalog.digest()).toBe(before)
    expect(catalog.inspectTable('public', name)?.enabled).toBe(false)
  })
  it('rejects namespace-qualified columns masquerading as native functions', async () => {
    const catalog = await baseline()
    const sql =
      'CREATE POLICY invalid_native_column ON public.committee_meetings FOR SELECT TO ue_runtime USING (pg_catalog.organization_id IS NOT NULL);'
    await expect(catalog.applyFrozenUnit(sql, replayHash(sql))).rejects.toThrow(
      'FAKE_POLICY_EXPRESSION_UNSUPPORTED',
    )
    expect(
      await catalog.query(rlsPrimitiveQueries.table, ['public', 'committee_meetings']),
    ).toHaveLength(1)
  })
  it('keeps a successful public existence guard separate from the actual unqualified nonpublic DDL target', async () => {
    const catalog = await baseline(['pg_catalog', 'tenant', 'public'])
    const effect = calls[0],
      name = sqlTokens(source(effect))[3].value
    for (const sql of [
      'CREATE SCHEMA tenant;',
      `CREATE TABLE tenant."${name}" (organization_id uuid NOT NULL);`,
    ]) {
      await catalog.applyFrozenUnit(sql, replayHash(sql))
    }
    await catalog.applyFrozenUnit(source(effect), replayText(effect.EXACT_EFFECT_SHA256))
    expect(catalog.inspectTable('tenant', name)?.enabled).toBe(true)
    expect(catalog.inspectTable('tenant', name)?.forced).toBe(true)
    expect(catalog.inspectTable('public', name)?.enabled).toBe(false)
    expect(catalog.inspectTable('public', name)?.policies).toEqual([])
  })
  it('denies borrowed table ownership before changing actual RLS or policy state', async () => {
    const catalog = await baseline(),
      effect = calls[0],
      name = sqlTokens(source(effect))[3].value
    const table = catalog.inspectTable('public', name)!
    table.owner = 'unrelated_owner'
    catalog.replaceTable(table)
    const state = catalog.digest(),
      traceLength = catalog.trace.length
    await expect(
      catalog.applyFrozenUnit(source(effect), replayText(effect.EXACT_EFFECT_SHA256)),
    ).rejects.toThrow()
    expect(catalog.digest()).toBe(state)
    expect(catalog.trace).toHaveLength(traceLength)
  })
  it('observes all ten authorized keys absent then exact after their actual raw source SQL,without manufacturing metadata', async () => {
    const catalog = await baseline()
    expect(specification.definitions).toHaveLength(10)
    for (const definition of specification.definitions)
      expect(
        inspectParentKey(
          definition,
          await readParentKeyCatalog(catalog, definition),
          supplementContext,
        ),
      ).toBe('KEY_ABSENT_SAFE_TO_CREATE')
    const before = catalog.trace.length
    for (const definition of specification.definitions) {
      await catalog.applyFrozenUnit(definition.sql, definition.sqlDigest)
      expect(
        inspectParentKey(
          definition,
          await readParentKeyCatalog(catalog, definition),
          supplementContext,
        ),
      ).toBe('KEY_PRESENT_EXACT')
    }
    expect(catalog.trace).toHaveLength(before + 10)
  })
  it('runs the real ten-key producer with actual source-backed observations and obtains ten noop producers on repeat', async () => {
    const catalog = await baseline()
    const adapter: ParentKeyAdapter = {
      withExclusiveTransaction: (work) =>
        catalog.transaction(async (working) =>
          work({
            context: async () => supplementContext,
            query: (sql: string, parameters: string[]) => working.query(sql, parameters),
            execute: (sql: string) => working.applyFrozenUnit(sql, replayHash(sql)),
          }),
        ),
    }
    const first = await applyParentKeySupplement(
      specification,
      supplementContext,
      adapter,
      authorization,
    )
    expect(first.EXECUTED_PRODUCER_IDS).toHaveLength(10)
    expect(first.KEY_STATE_DIGESTS).toHaveLength(10)
    const state = catalog.digest(),
      transitions = catalog.trace.filter((entry) =>
        entry.startsWith('FAKE_UNIT_TRANSITION:'),
      ).length
    const second = await applyParentKeySupplement(
      specification,
      supplementContext,
      adapter,
      authorization,
    )
    expect(second.EXECUTED_PRODUCER_IDS).toEqual([])
    expect(catalog.digest()).toBe(state)
    expect(catalog.trace.filter((entry) => entry.startsWith('FAKE_UNIT_TRANSITION:'))).toHaveLength(
      transitions,
    )
  })
  it('does not regenerate missing identities in a populated parent or install a second primary key', async () => {
    for (const mutation of ['POPULATED', 'EXISTING_PRIMARY'] as const) {
      const catalog = await baseline(),
        definition = specification.definitions[0]
      const table = catalog.inspectTable('public', definition.relation)!
      if (mutation === 'POPULATED')
        table.rows.push({ organization_id: '00000000-0000-0000-0000-000000000001' })
      else table.primaryKey = ['organization_id']
      catalog.replaceTable(table)
      const state = catalog.digest()
      await expect(catalog.applyFrozenUnit(definition.sql, definition.sqlDigest)).rejects.toThrow(
        'FAKE_ADDED_PRIMARY_KEY_PRECONDITION_UNSUPPORTED',
      )
      expect(catalog.digest()).toBe(state)
    }
  })
  it('rolls back all ten real key transitions and a staged producer receipt when commit fails', async () => {
    const catalog = await baseline(),
      before = catalog.digest()
    const adapter: ParentKeyAdapter = {
      withExclusiveTransaction: (work) =>
        catalog.transaction(async (working) => {
          const result = await work({
            context: async () => supplementContext,
            query: (sql, parameters) => working.query(sql, parameters),
            execute: (sql) => working.applyFrozenUnit(sql, replayHash(sql)),
          })
          working.stageReceipt(specification.supplementId, result)
          return result
        }, true),
    }
    await expect(
      applyParentKeySupplement(specification, supplementContext, adapter, authorization),
    ).rejects.toThrow('FAKE_COMMIT_FAILED')
    expect(catalog.digest()).toBe(before)
    expect(catalog.readReceipt(specification.supplementId)).toBeNull()
    for (const definition of specification.definitions)
      expect(
        inspectParentKey(
          definition,
          await readParentKeyCatalog(catalog, definition),
          supplementContext,
        ),
      ).toBe('KEY_ABSENT_SAFE_TO_CREATE')
  })
})
