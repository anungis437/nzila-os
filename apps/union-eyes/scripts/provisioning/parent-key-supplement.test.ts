import { describe, expect, it } from 'vitest'
import { replayDigest, replayHash } from './post-w4p-replay'
import {
  authorizedParentRelations,
  parentKeySql,
  inspectParentKey,
  validateSupplement,
  applyParentKeySupplement,
  supplementAuthorityDigest,
  supplementPlanDigest,
  verifySupplementReceipt,
  readParentKeyCatalog,
  parentKeyQueries,
  type ParentKeyCatalog,
  type ParentKeyAdapter,
  type SupplementContext,
  type SupplementSpecification,
  type SupplementAuthorization,
} from './parent-key-supplement'

const baselineColumns = [
  {
    name: 'organization_id',
    postgresType: 'uuid',
    notNull: true,
    defaultExpression: null,
    identity: '',
    generated: '',
  },
]
const specification: SupplementSpecification = {
  supplementId: 'UE_PRE_W5_PARENT_KEYS_V1',
  graphDigest: replayDigest('graph'),
  parentW4pDigest: replayDigest('w4p-plan'),
  definitions: authorizedParentRelations.map((relation) => ({
    relation,
    authorityDigest: replayDigest(relation),
    sql: parentKeySql(relation),
    sqlDigest: replayHash(parentKeySql(relation)),
    expectedBaselineDigest: replayDigest(baselineColumns),
    expectedBaselineColumns: ['organization_id'],
  })),
}
const context: SupplementContext = {
  targetDigest: replayDigest('target'),
  scope: 'UE_OPERATIONAL',
  actorClass: 'MIGRATION_ADMIN',
  actorPrincipal: 'fake-only-admin',
  w4pVerificationDigest: replayDigest('verified-w4p'),
  w4pPlanDigest: specification.parentW4pDigest,
  w4pVerified: true,
  exclusiveExecutionReference: 'fake-pinned-exclusive',
}
const authorization: SupplementAuthorization = {
  purpose: 'PRE_W5_PARENT_KEY_SUPPLEMENT',
  planDigest: supplementPlanDigest(specification),
  authorityDigest: supplementAuthorityDigest(specification),
  graphDigest: specification.graphDigest,
  targetDigest: context.targetDigest,
  actorPrincipal: context.actorPrincipal,
  w4pVerificationDigest: context.w4pVerificationDigest,
  executionApproved: true,
}
const exactColumn: NonNullable<ParentKeyCatalog['column']> = {
  postgresType: 'uuid',
  notNull: true,
  defaultExpression: 'gen_random_uuid()',
  defaultFunctionSchema: 'pg_catalog',
  defaultFunctionName: 'gen_random_uuid',
  defaultFunctionProvenance: 'POSTGRES_BUILTIN',
  identity: '',
  generated: '',
  collation: null,
  foreignKeys: [],
  explicitAcl: [],
}
function catalog(exact = false): ParentKeyCatalog[] {
  return specification.definitions.map((definition) => ({
    relation: definition.relation,
    scope: 'UE_OPERATIONAL',
    relationExists: true,
    baselineDigest: definition.expectedBaselineDigest,
    freshShapeMatches: true,
    rowCount: '0',
    primaryKeyColumns: exact ? ['id'] : [],
    primaryKeyValidated: exact,
    primaryIndexValid: exact,
    primaryIndexReady: exact,
    primaryIndexLive: exact,
    primaryKeyDeferrable: false,
    conflictingUniqueOnId: false,
    defaultFunctionAvailable: true,
    column: exact ? structuredClone(exactColumn) : null,
  }))
}
function rows(states: ParentKeyCatalog[], sql: string, parameters: string[]): unknown[] {
  const entry = states.find(
    (entry) => entry.relation === parameters[1] || sql === parentKeyQueries.count(entry.relation),
  )
  if (!entry) throw new Error('FAKE_UNBOUND_READER')
  if (sql === parentKeyQueries.relation)
    return entry.relationExists ? [{ kind: 'r', standalone: true }] : []
  if (sql === parentKeyQueries.columns) {
    const columns: Record<string, unknown>[] = baselineColumns.map((column) => ({
      name: column.name,
      postgres_type: column.postgresType,
      not_null: column.notNull,
      default_expression: column.defaultExpression,
      identity: column.identity,
      generated: column.generated,
    }))
    if (entry.column)
      columns.push({
        name: 'id',
        postgres_type: entry.column.postgresType,
        not_null: entry.column.notNull,
        default_expression: entry.column.defaultExpression,
        identity: entry.column.identity,
        generated: entry.column.generated,
      })
    return columns
  }
  if (sql === parentKeyQueries.count(entry.relation)) return [{ count: entry.rowCount }]
  if (sql === parentKeyQueries.primary)
    return entry.primaryKeyColumns.length
      ? [
          {
            columns: entry.primaryKeyColumns,
            validated: entry.primaryKeyValidated,
            deferrable: entry.primaryKeyDeferrable,
            valid: entry.primaryIndexValid,
            ready: entry.primaryIndexReady,
            live: entry.primaryIndexLive,
          },
        ]
      : []
  if (sql === parentKeyQueries.metadata)
    return [
      {
        function_available: entry.defaultFunctionAvailable,
        row_count_visible: true,
        collation: entry.column?.collation ?? 0,
        acl: entry.column?.explicitAcl.length ? entry.column.explicitAcl.join(',') : null,
        foreign_keys: entry.column?.foreignKeys.length ? entry.column.foreignKeys : null,
        other_unique: entry.conflictingUniqueOnId,
        default_function_schema: entry.column?.defaultFunctionSchema ?? null,
        default_function_provenance: entry.column?.defaultFunctionProvenance ?? null,
        resolved_function_schema: 'pg_catalog',
        resolved_function_provenance: 'POSTGRES_BUILTIN',
      },
    ]
  throw new Error('FAKE_UNBOUND_QUERY')
}
function fake(start: ParentKeyCatalog[], failVerify = false, failCommit = false) {
  let state = structuredClone(start)
  const trace: string[] = []
  let send = 0
  const adapter: ParentKeyAdapter = {
    async withExclusiveTransaction(work) {
      const before = structuredClone(state)
      trace.push('begin')
      try {
        const result = await work({
          async context() {
            return { ...context }
          },
          async query(sql, parameters) {
            return structuredClone(rows(state, sql, parameters))
          },
          async execute(sql) {
            trace.push(sql)
            send++
            const index = specification.definitions.findIndex((entry) => entry.sql === sql)
            if (index < 0) throw new Error('FAKE_UNBOUND_SQL')
            state[index] = {
              ...catalog(true)[index],
              column: { ...exactColumn, notNull: !failVerify },
            }
          },
        })
        if (failCommit) throw new Error('FAKE_COMMIT_FAILED')
        trace.push('commit')
        return result
      } catch (error) {
        state = before
        trace.push('rollback')
        throw error
      }
    },
  }
  return { adapter, trace, states: () => state, sends: () => send }
}
describe('ten-key prospective state inspectors and definition verifiers', () => {
  it('accepts a catalog-attested pgcrypto default without inventing a pg_catalog-only version policy', async () => {
    const state = catalog(true)
    state[0].column = {
      ...exactColumn,
      defaultExpression: 'crypto.gen_random_uuid()',
      defaultFunctionSchema: 'crypto',
      defaultFunctionProvenance: 'PGCRYPTO_EXTENSION',
    }
    const reader = {
      async query(sql: string, parameters: string[]) {
        const result = rows(state, sql, parameters)
        if (sql !== parentKeyQueries.metadata) return result
        return result.map((entry) => {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry))
            throw new Error('FAKE_INVALID_METADATA')
          return {
            ...entry,
            resolved_function_schema: 'crypto',
            resolved_function_provenance: 'PGCRYPTO_EXTENSION',
          }
        })
      },
    }
    const key = await readParentKeyCatalog(reader, specification.definitions[0])
    expect(inspectParentKey(specification.definitions[0], key, context)).toBe('KEY_PRESENT_EXACT')
    expect(
      inspectParentKey(
        specification.definitions[0],
        { ...key, column: { ...state[0].column, defaultFunctionProvenance: 'UNPROVEN' } },
        context,
      ),
    ).toBe('KEY_PRESENT_DRIFTED')
  })
  it('reads actual projected catalog rows and guards missing/partitioned/malformed relations', async () => {
    const state = catalog(true)
    const reader = {
      async query(sql: string, parameters: string[]) {
        return rows(state, sql, parameters)
      },
    }
    expect(await readParentKeyCatalog(reader, specification.definitions[0])).toEqual(state[0])
    await expect(
      readParentKeyCatalog(
        {
          async query() {
            return [{ kind: 'r', standalone: false }]
          },
        },
        specification.definitions[0],
      ),
    ).rejects.toThrow('PARENT_KEY_TARGET_RELATION_REQUIRED')
    await expect(
      readParentKeyCatalog(
        {
          async query() {
            return []
          },
        },
        specification.definitions[0],
      ),
    ).rejects.toThrow('PARENT_KEY_TARGET_RELATION_REQUIRED')
    await expect(
      readParentKeyCatalog(
        {
          async query(sql, parameters) {
            return sql === parentKeyQueries.columns
              ? [{ name: 'id' }]
              : reader.query(sql, parameters)
          },
        },
        specification.definitions[0],
      ),
    ).rejects.toThrow('PARENT_KEY_INVALID_CATALOG_STRING')
  })
  it('existing exact ID accepts legitimate additional legacy columns but missing ID requires exact fresh shape', async () => {
    const state = catalog(true)
    const reader = {
      async query(sql: string, parameters: string[]) {
        const result = rows(state, sql, parameters)
        return sql === parentKeyQueries.columns
          ? [
              ...result,
              {
                name: 'legacy_field',
                postgres_type: 'text',
                not_null: false,
                default_expression: null,
                identity: '',
                generated: '',
              },
            ]
          : result
      },
    }
    const key = await readParentKeyCatalog(reader, specification.definitions[0])
    expect(key.freshShapeMatches).toBe(false)
    expect(inspectParentKey(specification.definitions[0], key, context)).toBe('KEY_PRESENT_EXACT')
    state[0].column = null
    state[0].primaryKeyColumns = []
    expect(
      inspectParentKey(
        specification.definitions[0],
        await readParentKeyCatalog(reader, specification.definitions[0]),
        context,
      ),
    ).toBe('KEY_PRESENT_DRIFTED')
  })
  for (const definition of specification.definitions) {
    const index = specification.definitions.indexOf(definition)
    it(`fresh and complete path:${definition.relation}`, () => {
      expect(inspectParentKey(definition, catalog()[index], context)).toBe(
        'KEY_ABSENT_SAFE_TO_CREATE',
      )
      expect(inspectParentKey(definition, catalog(true)[index], context)).toBe('KEY_PRESENT_EXACT')
    })
  }
  const mutations: [string, Partial<NonNullable<ParentKeyCatalog['column']>>][] = [
    ['wrong type', { postgresType: 'bigint' }],
    ['wrong default', { defaultExpression: 'uuid_generate_v4()' }],
    ['nullable', { notNull: false }],
    ['identity', { identity: 'a' }],
    ['generated', { generated: 's' }],
    ['foreign key', { foreignKeys: ['unapproved_fk'] }],
    ['column ACL', { explicitAcl: ['unapproved_acl'] }],
    ['wrong default function schema', { defaultFunctionSchema: 'public' }],
  ]
  for (const [name, change] of mutations) {
    it(`rejects ${name}`, () => {
      const key = catalog(true)[0]
      key.column = { ...exactColumn, ...change }
      expect(inspectParentKey(specification.definitions[0], key, context)).toBe(
        'KEY_PRESENT_DRIFTED',
      )
    })
  }
  it('denies wrong/missing PK,conflicting primary key and relation shape drift', () => {
    for (const change of [
      { primaryKeyColumns: ['organization_id'] },
      { primaryKeyColumns: [] },
      { primaryIndexValid: false },
      { primaryIndexReady: false },
      { primaryKeyValidated: false },
      { primaryKeyDeferrable: true },
      { baselineDigest: 'wrong' },
      { conflictingUniqueOnId: true },
    ]) {
      expect(
        inspectParentKey(specification.definitions[0], { ...catalog(true)[0], ...change }, context),
      ).toBe('KEY_PRESENT_DRIFTED')
    }
  })
  it('never generates historical business identity for a populated missing-key relation', () => {
    expect(
      inspectParentKey(specification.definitions[0], { ...catalog()[0], rowCount: '100' }, context),
    ).toBe('KEY_ABSENT_AMBIGUOUS_DATA_STATE')
  })
  it('explicitly denies invalid data counts,missing W4P,wrong scope and missing relations', () => {
    expect(() =>
      inspectParentKey(specification.definitions[0], { ...catalog()[0], rowCount: '-1' }, context),
    ).toThrow('PARENT_KEY_INVALID_ROW_COUNT')
    expect(
      inspectParentKey(specification.definitions[0], catalog()[0], {
        ...context,
        w4pVerified: false,
      }),
    ).toBe('PRECONDITION_MISSING')
    expect(
      inspectParentKey(
        specification.definitions[0],
        { ...catalog()[0], scope: 'FINANCIAL_SERVICE' },
        context,
      ),
    ).toBe('PRECONDITION_MISSING')
    expect(
      inspectParentKey(
        specification.definitions[0],
        { ...catalog()[0], relationExists: false },
        context,
      ),
    ).toBe('PRECONDITION_MISSING')
  })
})
describe('future authenticated/pinned supplement apply using fake adapters only', () => {
  it('missing authoritative default-function resolution denies all sends', async () => {
    const before = catalog()
    before[9].defaultFunctionAvailable = false
    const harness = fake(before)
    await expect(
      applyParentKeySupplement(specification, context, harness.adapter, authorization),
    ).rejects.toThrow('PARENT_KEY_PREFLIGHT_DENIED')
    expect(harness.sends()).toBe(0)
  })
  it('an RLS-filtered zero count is not accepted as proof of an empty relation', async () => {
    const harness = fake(catalog())
    const adapter: ParentKeyAdapter = {
      withExclusiveTransaction(work) {
        return harness.adapter.withExclusiveTransaction((client) =>
          work({
            ...client,
            async query(sql, parameters) {
              const result = await client.query(sql, parameters)
              return sql === parentKeyQueries.metadata
                ? result.map((value) => {
                    if (!value || typeof value !== 'object' || Array.isArray(value))
                      throw new Error('FAKE_INVALID_METADATA')
                    return { ...value, row_count_visible: false }
                  })
                : result
            },
          }),
        )
      },
    }
    await expect(
      applyParentKeySupplement(specification, context, adapter, authorization),
    ).rejects.toThrow('PARENT_KEY_ROW_COUNT_VISIBILITY_NOT_PROVEN')
    expect(harness.sends()).toBe(0)
  })
  it('failed commit cannot issue a usable receipt and restores all fake state', async () => {
    const before = catalog(),
      harness = fake(before, false, true)
    await expect(
      applyParentKeySupplement(specification, context, harness.adapter, authorization),
    ).rejects.toThrow('FAKE_COMMIT_FAILED')
    expect(harness.sends()).toBe(10)
    expect(harness.states()).toEqual(before)
    expect(harness.trace.at(-1)).toBe('rollback')
  })
  it('immediate pre-send reread detects a newly populated missing-key parent and rolls back', async () => {
    const harness = fake(catalog())
    let counts = 0
    const adapter: ParentKeyAdapter = {
      withExclusiveTransaction(work) {
        return harness.adapter.withExclusiveTransaction((client) =>
          work({
            ...client,
            async query(sql, parameters) {
              if (sql === parentKeyQueries.count('allocation_rules') && ++counts === 2)
                harness.states()[0].rowCount = '1'
              return client.query(sql, parameters)
            },
          }),
        )
      },
    }
    await expect(
      applyParentKeySupplement(specification, context, adapter, authorization),
    ).rejects.toThrow('PARENT_KEY_PRE_SEND_DRIFT')
    expect(harness.sends()).toBe(0)
    expect(harness.trace.at(-1)).toBe('rollback')
  })
  it('pinned context drift denies before any catalog query or send', async () => {
    const harness = fake(catalog())
    const adapter: ParentKeyAdapter = {
      withExclusiveTransaction(work) {
        return harness.adapter.withExclusiveTransaction((client) =>
          work({
            ...client,
            async context() {
              return { ...context, targetDigest: 'different' }
            },
          }),
        )
      },
    }
    await expect(
      applyParentKeySupplement(specification, context, adapter, authorization),
    ).rejects.toThrow('PARENT_KEY_PINNED_CONTEXT_DRIFT')
    expect(harness.sends()).toBe(0)
  })
  it('binds verified key definitions,not row counts that legitimate later writes can change', async () => {
    const harness = fake(catalog())
    const receipt = await applyParentKeySupplement(
      specification,
      context,
      harness.adapter,
      authorization,
    )
    harness.states()[0].rowCount = '100'
    expect(verifySupplementReceipt(receipt, specification, context, harness.states())).toBe(true)
  })
  it('models10 sends/10 verified keys and a bound supplement receipt', async () => {
    const harness = fake(catalog())
    const receipt = await applyParentKeySupplement(
      specification,
      context,
      harness.adapter,
      authorization,
    )
    expect(harness.sends()).toBe(10)
    expect(harness.trace.at(-1)).toBe('commit')
    expect(receipt.EXECUTED_PRODUCER_IDS).toHaveLength(10)
    expect(verifySupplementReceipt(receipt, specification, context, harness.states())).toBe(true)
  })
  it('models full supplement noop with zero sends', async () => {
    const harness = fake(catalog(true))
    const receipt = await applyParentKeySupplement(
      specification,
      context,
      harness.adapter,
      authorization,
    )
    expect(harness.sends()).toBe(0)
    expect(receipt.EXECUTED_PRODUCER_IDS).toEqual([])
  })
  it('inspects all10 before any send;last-key ambiguity denies the entire supplement', async () => {
    const before = catalog()
    before[9].rowCount = '1'
    const harness = fake(before)
    await expect(
      applyParentKeySupplement(specification, context, harness.adapter, authorization),
    ).rejects.toThrow('PARENT_KEY_PREFLIGHT_DENIED')
    expect(harness.sends()).toBe(0)
    expect(harness.trace).toEqual(['begin', 'rollback'])
  })
  it('verification failure rolls back all fake mutations and produces no receipt', async () => {
    const before = catalog(),
      harness = fake(before, true)
    await expect(
      applyParentKeySupplement(specification, context, harness.adapter, authorization),
    ).rejects.toThrow('PARENT_KEY_POSTCONDITION_FAILED')
    expect(harness.sends()).toBe(1)
    expect(harness.states()).toEqual(before)
    expect(harness.trace.at(-1)).toBe('rollback')
  })
  it('never invokes a client without explicit authorization and a concrete exclusive adapter', async () => {
    await expect(
      applyParentKeySupplement(specification, context, undefined, authorization),
    ).rejects.toThrow('PARENT_KEY_EXCLUSIVE_ADAPTER_REQUIRED')
    await expect(
      applyParentKeySupplement(specification, context, fake(catalog()).adapter, undefined),
    ).rejects.toThrow('PARENT_KEY_EXECUTION_NOT_AUTHORIZED')
  })
  for (const binding of [
    'planDigest',
    'authorityDigest',
    'graphDigest',
    'targetDigest',
    'actorPrincipal',
    'w4pVerificationDigest',
  ] as const)
    it(`denies wrong future authorization:${binding}`, async () => {
      const harness = fake(catalog())
      await expect(
        applyParentKeySupplement(specification, context, harness.adapter, {
          ...authorization,
          [binding]: 'wrong',
        }),
      ).rejects.toThrow('PARENT_KEY_AUTHORIZATION_BINDING_MISMATCH')
      expect(harness.trace).toEqual([])
    })
  it('rejects receipt drift,duplicate key state and fake complete state with wrong default', async () => {
    const harness = fake(catalog())
    const receipt = await applyParentKeySupplement(
      specification,
      context,
      harness.adapter,
      authorization,
    )
    expect(
      verifySupplementReceipt(
        { ...receipt, PLAN_DIGEST: 'wrong' },
        specification,
        context,
        harness.states(),
      ),
    ).toBe(false)
    expect(
      verifySupplementReceipt(receipt, specification, context, [
        ...harness.states().slice(0, 9),
        harness.states()[0],
      ]),
    ).toBe(false)
    const wrong = harness.states()
    wrong[0].column = { ...exactColumn, defaultExpression: 'NULL' }
    expect(verifySupplementReceipt(receipt, specification, context, wrong)).toBe(false)
  })
  it('rejects eleventh/duplicate key,source SQL drift and unbound authority digest', () => {
    expect(() =>
      validateSupplement({
        ...specification,
        definitions: [...specification.definitions, specification.definitions[0]],
      }),
    ).toThrow('PARENT_KEY_EXACT_TEN_REQUIRED')
    expect(() =>
      validateSupplement({
        ...specification,
        definitions: specification.definitions.map((entry) => ({
          ...entry,
          relation: 'allocation_rules',
        })),
      }),
    ).toThrow('PARENT_KEY_AUTHORIZED_IDENTITY_DRIFT')
    expect(() =>
      validateSupplement({
        ...specification,
        definitions: specification.definitions.map((entry) => ({ ...entry, sql: entry.sql + ' ' })),
      }),
    ).toThrow('PARENT_KEY_SQL_AUTHORITY_DRIFT')
  })
})
