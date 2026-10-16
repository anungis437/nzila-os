import { describe, expect, it } from 'vitest'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import {
  replayDigest,
  replayText,
  replayRecords,
  replayHash,
  replayObject,
  replayStrings,
} from './post-w4p-replay'
import { parentKeyQueries, genRandomUuidQuery } from './parent-key-supplement'
import {
  compileCreateStatement,
  makeCreateReplayHandler,
  createCatalogQueries,
  normalizeCreateDefault,
  type NamedEnumAuthority,
} from './replay-create-inspection'
import { compileEnumWrapper } from './replay-enum-inspection'
import { frozenStatements } from '../../../../scripts/ue/close-w5a-replay-graph'
import type { ReplayExecutionUnit, ReplayExecutionContext } from './post-w4p-execution'
const { frozen, sourceBytes } = loadFrozenReplay()
const nodes = frozen.nodes.filter((node) => node.REPLAY_UNIT_CLASS === 'FROZEN_STATEMENT_UNIT')
const namedEnums: NamedEnumAuthority[] = replayRecords(
  frozen.input.promotionImplementation.registry,
).flatMap((entry) => {
  const invariant = replayObject(entry.MATCHING_INVARIANTS)
  if (!Array.isArray(invariant.enumMembers)) return []
  return [
    {
      schema: replayText(invariant.schema),
      name: replayText(invariant.name),
      members: replayStrings(invariant.enumMembers),
      definitionDigest: replayDigest(invariant),
    },
  ]
})
for (const node of frozen.nodes.filter(
  (node) => node.REPLAY_UNIT_CLASS === 'FROZEN_WRAPPER_UNIT',
)) {
  const binding = replayRecords(frozen.register.BOUND_REPLAY_RECORDS).find(
    (entry) => entry.REPLAY_UNIT_ID === node.REPLAY_UNIT_ID,
  )!
  const range = binding.SOURCE_RANGE
  if (!Array.isArray(range) || typeof range[0] !== 'number' || typeof range[1] !== 'number')
    throw new Error('EXACT_RANGE_REQUIRED')
  const contract = compileEnumWrapper(
    sourceBytes[replayText(node.SOURCE_FILE)].slice(range[0], range[1]),
    replayText(node.EXACT_UNIT_SHA256),
  )
  namedEnums.push({
    schema: contract.schema,
    name: contract.name,
    members: contract.members,
    definitionDigest: contract.contractDigest,
  })
}
const context: ReplayExecutionContext = {
  scope: 'UE_OPERATIONAL',
  actorClass: 'MIGRATION_ADMIN',
  actorPrincipal: 'fake-only',
  targetDigest: replayDigest('fake'),
  w4pPlanDigest: replayText(frozen.input.promotionPlan.PLAN_DIGEST),
  w4pVerificationDigest: replayDigest('fake-w4p'),
  supplementPlanDigest: replayDigest('fake-pk-plan'),
  supplementVerificationDigest: replayDigest('fake-pk'),
  exclusiveExecutionReference: 'fake-only',
}
function specification(node: (typeof nodes)[number]) {
  const binding = replayRecords(frozen.register.BOUND_REPLAY_RECORDS).find(
    (entry) => entry.REPLAY_UNIT_ID === node.REPLAY_UNIT_ID,
  )!
  const range = binding.SOURCE_RANGE
  if (!Array.isArray(range) || typeof range[0] !== 'number' || typeof range[1] !== 'number')
    throw new Error('EXACT_RANGE_REQUIRED')
  const sql = sourceBytes[replayText(node.SOURCE_FILE)].slice(range[0], range[1])
  const contract = compileCreateStatement(sql, replayText(node.EXACT_UNIT_SHA256), namedEnums)
  const unit: ReplayExecutionUnit = {
    node,
    sql,
    contractDigest: contract.contractDigest,
    transactionClass: 'TRANSACTION_COMPATIBLE',
    predecessors: frozen.edges
      .filter((edge) => edge.TO === node.REPLAY_UNIT_ID)
      .map((edge) => replayText(edge.FROM)),
  }
  return { unit, contract }
}
function readerFor(contract: ReturnType<typeof compileCreateStatement>, absent = false) {
  const columns: Record<string, unknown>[] = contract.columns.map((column) => ({
    name: column.name,
    postgres_type: column.type.display,
    type_schema: column.type.schema,
    type_name: column.type.name,
    type_kind: column.type.schema === 'public' ? 'e' : 'b',
    not_null: column.notNull,
    default_expression: column.defaultExpression,
    identity: '',
    generated: '',
    collation_default: true,
    acl: null,
  }))
  const uniques: Record<string, unknown>[] = contract.uniqueConstraints.map((constraint) => ({
    columns: constraint.columns,
    kind: 'u',
    validated: true,
    deferrable: false,
    deferred: false,
    local: true,
    inherited: 0,
    unique: true,
    valid: true,
    ready: true,
    live: true,
    primary: false,
    exclusion: false,
    nulls_not_distinct: false,
    predicate: null,
    expressions: null,
    key_count: constraint.columns.length,
    total_count: constraint.columns.length,
  }))
  return {
    columns,
    uniques,
    async query(sql: string, parameters: string[]) {
      if (sql === parentKeyQueries.relation) return absent ? [] : [{ kind: 'r', standalone: true }]
      if (sql === createCatalogQueries.namespace) return [{ name: 'public' }]
      if (sql === genRandomUuidQuery)
        return [{ schema: 'pg_catalog', origin: 'POSTGRES_BUILTIN', executable: true }]
      if (sql === createCatalogQueries.deployedRandom)
        return [{ schema: 'pg_catalog', origin: 'POSTGRES_BUILTIN', executable: true }]
      if (sql === createCatalogQueries.clock)
        return [
          {
            schema: 'pg_catalog',
            name: 'now',
            language: 'internal',
            result: 'timestamptz',
            executable: true,
          },
        ]
      if (sql === createCatalogQueries.columns) return columns
      if (sql === createCatalogQueries.unique) return uniques
      if (sql === createCatalogQueries.typePrerequisite)
        return [
          {
            kind: parameters[0] === 'public' ? 'e' : 'b',
            members:
              contract.columns.find(
                (column) =>
                  column.type.schema === parameters[0] && column.type.name === parameters[1],
              )?.type.enum?.members ?? [],
          },
        ]
      if (sql === parentKeyQueries.primary)
        return contract.primaryKey.length
          ? [
              {
                columns: contract.primaryKey,
                validated: true,
                deferrable: false,
                valid: true,
                ready: true,
                live: true,
              },
            ]
          : []
      throw new Error('FAKE_UNBOUND_QUERY')
    },
  }
}
describe('all43exactCREATEsource-owned field and key comparators', () => {
  it('binds the original benchmark UNIQUE clause to all backing-constraint postconditions;not a whole-boundary qualification', async () => {
    const original = Object.values(sourceBytes)
      .flatMap(frozenStatements)
      .find((statement) =>
        statement.TEXT.includes('CONSTRAINT "icra_benchmark_groups_slug_unique"'),
      )!
    const contract = compileCreateStatement(original.TEXT, original.SHA256, namedEnums)
    expect(
      contract.uniqueConstraints.map((constraint) => ({
        name: constraint.name,
        columns: constraint.columns,
      })),
    ).toEqual([{ name: 'icra_benchmark_groups_slug_unique', columns: ['slug'] }])
    const unit: ReplayExecutionUnit = {
      node: {
        REPLAY_UNIT_ID: 'fake-original-CREATE-component-not-a-boundary-handler',
        DATABASE_SCOPE: 'UE_OPERATIONAL',
        REPLAY_UNIT_CLASS: 'FROZEN_STATEMENT_UNIT',
        EXACT_UNIT_SHA256: original.SHA256,
      },
      sql: original.TEXT,
      contractDigest: contract.contractDigest,
      predecessors: [],
      transactionClass: 'TRANSACTION_COMPATIBLE',
    }
    const handler = makeCreateReplayHandler(unit, namedEnums)
    expect((await handler.inspect(readerFor(contract), context, unit, null)).state).toBe(
      'ALREADY_COMPLETE',
    )
    const absent = readerFor(contract)
    absent.uniques.length = 0
    expect((await handler.inspect(absent, context, unit, null)).state).toBe('DRIFTED')
    for (const change of [
      { columns: ['wrong'] },
      { kind: 'p' },
      { validated: false },
      { deferrable: true },
      { deferred: true },
      { local: false },
      { inherited: 1 },
      { unique: false },
      { valid: false },
      { ready: false },
      { live: false },
      { primary: true },
      { exclusion: true },
      { nulls_not_distinct: true },
      { predicate: 'unapproved' },
      { expressions: 'unapproved' },
      { key_count: 2 },
      { total_count: 2 },
    ]) {
      const reader = readerFor(contract)
      Object.assign(reader.uniques[0], change)
      expect((await handler.inspect(reader, context, unit, null)).state).toBe('DRIFTED')
    }
    const bad = original.TEXT.replace('UNIQUE("slug")', 'UNIQUE("slug",)')
    expect(() => compileCreateStatement(bad, replayHash(bad), namedEnums)).toThrow(
      'REPLAY_CREATE_UNIQUE_GRAMMAR_UNSUPPORTED',
    )
  })
  it('compiles source-native timestamp and text-array types without inventing named-enum authority', () => {
    for (const [source, name, display] of [
      ['timestamp', 'timestamp', 'timestamp without time zone'],
      ['timestamp without time zone', 'timestamp', 'timestamp without time zone'],
      ['text[]', '_text', 'text[]'],
    ]) {
      const sql = `CREATE TABLE public.exact_component ("value" ${source});`
      const column = compileCreateStatement(sql, replayHash(sql)).columns[0]
      expect(column.type).toEqual({ schema: 'pg_catalog', name, display, enum: null })
    }
    expect(normalizeCreateDefault("'{}'::text[]", 'text[]')).toEqual(
      normalizeCreateDefault("'{}'", 'text[]'),
    )
  })
  it('compiles exactly43frozen whole CREATE units without discovering producers', () => {
    expect(nodes).toHaveLength(43)
    expect(new Set(nodes.map((node) => node.REPLAY_UNIT_ID)).size).toBe(43)
  })
  for (const node of nodes) {
    const { unit, contract } = specification(node)
    it(`all declared fields/types/defaults/nullability/PK:${node.REPLAY_UNIT_ID}`, async () => {
      const reader = readerFor(contract),
        handler = makeCreateReplayHandler(unit, namedEnums)
      expect((await handler.inspect(reader, context, unit, null)).state).toBe('ALREADY_COMPLETE')
      expect(replayHash(unit.sql)).toBe(unit.node.EXACT_UNIT_SHA256)
      expect((await handler.inspect(readerFor(contract, true), context, unit, null)).state).toBe(
        'REPLAY_REQUIRED',
      )
    })
    it(`existing relation cannot be mistaken for complete with missing/drifted fields:${node.REPLAY_UNIT_ID}`, async () => {
      const handler = makeCreateReplayHandler(unit, namedEnums)
      for (const mutate of [
        'missing',
        'type',
        'default',
        'nullable',
        'identity',
        'generated',
        'collation',
        'acl',
      ] as const) {
        const reader = readerFor(contract)
        if (mutate === 'missing') reader.columns.pop()
        if (mutate === 'type') reader.columns[0].postgres_type = 'bigint'
        if (mutate === 'default') reader.columns[0].default_expression = "'unapproved'"
        if (mutate === 'nullable') reader.columns[0].not_null = !reader.columns[0].not_null
        if (mutate === 'identity') reader.columns[0].identity = 'a'
        if (mutate === 'generated') reader.columns[0].generated = 's'
        if (mutate === 'collation') reader.columns[0].collation_default = false
        if (mutate === 'acl') reader.columns[0].acl = 'unapproved'
        expect((await handler.inspect(reader, context, unit, null)).state).toBe('DRIFTED')
      }
    })
  }
  it('normalizes only PostgreSQL type-compatible constant casts,not arbitrary expressions', () => {
    expect(normalizeCreateDefault("'CAD'::character varying", 'character varying(3)')).toEqual(
      normalizeCreateDefault("'CAD'", 'character varying(3)'),
    )
    expect(normalizeCreateDefault("'0'::numeric", 'numeric(15,2)')).toEqual(
      normalizeCreateDefault('0', 'numeric(15,2)'),
    )
    expect(normalizeCreateDefault(`'["csv", "json"]'::jsonb`, 'jsonb')).toEqual(
      normalizeCreateDefault(`'["csv","json"]'::jsonb`, 'jsonb'),
    )
    expect(
      normalizeCreateDefault(
        "'pending'::public.ai_triage_status",
        'ai_triage_status',
        ['pg_catalog'],
        'public',
      ),
    ).toEqual(normalizeCreateDefault("'pending'", 'ai_triage_status'))
    expect(normalizeCreateDefault("'CAD'::text", 'character varying(3)')).not.toEqual(
      normalizeCreateDefault("'CAD'", 'character varying(3)'),
    )
    expect(normalizeCreateDefault('uuid_generate_v4()', 'uuid')).not.toEqual(
      normalizeCreateDefault('gen_random_uuid()', 'uuid'),
    )
  })
  it('validates namespace/type/function prerequisites and complete primary key state', async () => {
    const { unit, contract } = specification(nodes[0]),
      handler = makeCreateReplayHandler(unit, namedEnums)
    const reader = readerFor(contract)
    const invalid = {
      async query(sql: string, parameters: string[]) {
        return sql === parentKeyQueries.primary
          ? [
              {
                columns: ['organization_id'],
                validated: true,
                deferrable: false,
                valid: true,
                ready: true,
                live: true,
              },
            ]
          : reader.query(sql, parameters)
      },
    }
    expect((await handler.inspect(invalid, context, unit, null)).state).toBe('DRIFTED')
    expect(
      (
        await handler.inspect(
          {
            async query() {
              return []
            },
          },
          context,
          unit,
          null,
        )
      ).state,
    ).toBe('PRECONDITION_MISSING')
    await expect(
      handler.inspect(
        {
          async query() {
            return [{ complete: true }]
          },
        },
        context,
        unit,
        null,
      ),
    ).rejects.toThrow('REPLAY_CREATE_CATALOG_ROW_INVALID')
  })
})
