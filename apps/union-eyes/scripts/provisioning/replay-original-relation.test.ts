import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadFrozenReplay } from '../../../../scripts/ue/implement-w5b-post-w4p-replay'
import {
  replayDigest,
  replayHash,
  replayObject,
  replayRecords,
  replayStrings,
  replayText,
} from './post-w4p-replay'
import { compileEnumWrapper } from './replay-enum-inspection'
import type { NamedEnumAuthority } from './replay-create-inspection'
import {
  compileOriginalRelation,
  inspectOriginalRelation,
  originalRelationQueries,
  originalTypmod,
  type OriginalRelation,
  type OriginalCheck,
  type OriginalConstraint,
} from './replay-original-relation'

const root = resolve(__dirname, '..', '..', '..', '..')
const ledger = replayObject(
  JSON.parse(
    readFileSync(
      resolve(
        root,
        'docs',
        'union-eyes',
        'reality-remediation',
        'UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json',
      ),
      'utf8',
    ),
  ),
)
const { frozen, sourceBytes } = loadFrozenReplay()
const namedEnums: NamedEnumAuthority[] = replayRecords(
  frozen.input.promotionImplementation.registry,
).flatMap((entry) => {
  const invariant = replayObject(entry.MATCHING_INVARIANTS)
  return Array.isArray(invariant.enumMembers)
    ? [
        {
          schema: replayText(invariant.schema),
          name: replayText(invariant.name),
          members: replayStrings(invariant.enumMembers),
          definitionDigest: replayDigest(invariant),
        },
      ]
    : []
})
const wrappers = frozen.nodes.filter((node) => node.REPLAY_UNIT_CLASS === 'FROZEN_WRAPPER_UNIT')
for (const node of wrappers) {
  const binding = replayRecords(frozen.register.BOUND_REPLAY_RECORDS).find(
    (entry) => entry.REPLAY_UNIT_ID === node.REPLAY_UNIT_ID,
  )!
  const range = binding.SOURCE_RANGE as [number, number]
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
const effects = replayRecords(ledger.BOUNDARIES).flatMap((boundary) =>
  replayRecords(boundary.EFFECTS)
    .filter((effect) => effect.EFFECT_CLASS === 'RELATION_DDL')
    .map((effect) => {
      const source = replayText(replayObject(effect.COMPARATOR).EXACT_SOURCE_SEMANTICS)
      const hash = replayText(effect.EXACT_EFFECT_SHA256)
      const bytes = Buffer.from(sourceBytes[replayText(boundary.SOURCE_PATH)], 'utf8')
      const range = effect.SOURCE_BYTE_RANGE as [number, number]
      expect(bytes.subarray(range[0], range[1]).toString('utf8')).toBe(source)
      expect(replayHash(source)).toBe(hash)
      return { id: replayText(effect.EFFECT_ID), source, hash }
    }),
)
const originals = effects.filter((effect) => /CREATE TABLE/i.test(effect.source))
const specifications = originals.map((effect) => ({
  ...effect,
  spec: compileOriginalRelation(effect.source, effect.hash, namedEnums),
}))
const typeIdentities = [
  ...new Set(
    specifications.flatMap(({ spec }) =>
      spec.columns.map((column) => `${column.type.schema}.${column.type.name}`),
    ),
  ),
]
function typeInfo(column: OriginalRelation['columns'][number]) {
  const collatable = ['text', 'varchar', '_text'].includes(column.type.name)
  return {
    oid: String(typeIdentities.indexOf(`${column.type.schema}.${column.type.name}`) + 100),
    kind: column.type.enum ? 'e' : 'b',
    collation: collatable ? '100' : '0',
    members: column.type.enum?.members ?? null,
    element_schema: column.type.name === '_text' ? 'pg_catalog' : null,
    element_name: column.type.name === '_text' ? 'text' : null,
  }
}
function columnRows(spec: OriginalRelation) {
  return spec.columns.map((column) => ({
    name: column.name,
    type_oid: typeInfo(column).oid,
    typmod: originalTypmod(column),
    collation: typeInfo(column).collation,
    postgres_type: column.type.display,
    type_schema: column.type.schema,
    type_name: column.type.name,
    type_kind: column.type.enum ? 'e' : 'b',
    not_null: column.notNull,
    default_expression: column.defaultExpression,
    identity: '',
    generated: '',
    collation_default: true,
    acl: null,
  }))
}
function operator(name: string, type: string) {
  const equality: Record<string, string> = {
    uuid: 'uuid_eq',
    text: 'texteq',
    int4: 'int4eq',
    int8: 'int8eq',
    numeric: 'numeric_eq',
    timestamp: 'timestamp_eq',
    timestamptz: 'timestamptz_eq',
    anyenum: 'enum_eq',
  }
  return {
    schema: 'pg_catalog',
    name,
    function_schema: 'pg_catalog',
    function_name: name === '=' ? equality[type] : type === 'anyenum' ? 'enum_ne' : `${type}_gt`,
    function_language: 'internal',
    result_schema: 'pg_catalog',
    result_type: 'bool',
    left_schema: 'pg_catalog',
    left_type: type,
    right_schema: 'pg_catalog',
    right_type: type,
  }
}
function checkSql(check: OriginalCheck, columns?: OriginalRelation['columns']): string {
  if (check.op === 'AND' || check.op === 'OR')
    return `(${checkSql(check.left, columns)} ${check.op} ${checkSql(check.right, columns)})`
  if (check.op === 'IS NULL' || check.op === 'IS NOT NULL') {
    return `"${'column' in check.operand ? check.operand.column : ''}" ${check.op}`
  }
  if (check.op === '>' || check.op === '<>') {
    const operand = (value: typeof check.left) =>
      'column' in value ? `"${value.column}"` : `'${value.literal.replaceAll("'", "''")}'`
    const columnName = 'column' in check.left ? check.left.column : null
    const column =
      columnName !== null ? columns?.find((column) => column.name === columnName) : undefined
    const cast =
      'literal' in check.right && column?.type.enum
        ? `::"${column.type.schema}"."${column.type.name}"`
        : ''
    return `(${operand(check.left)} ${check.op} ${operand(check.right)}${cast})`
  }
  throw new Error('UNREACHABLE_CHECK')
}
function constraintSql(entry: OriginalConstraint): string {
  const columns = (values: string[]) => `(${values.map((name) => `"${name}"`).join(', ')})`
  if (entry.kind === 'p') return `PRIMARY KEY ${columns(entry.columns)}`
  if (entry.kind === 'u') return `UNIQUE ${columns(entry.columns)}`
  if (entry.kind === 'c') return `CHECK (${checkSql(entry.check!)})`
  return `FOREIGN KEY ${columns(entry.columns)} REFERENCES "${entry.parent!.schema}"."${entry.parent!.name}"${columns(entry.parent!.columns)}${entry.deleteAction === 'CASCADE' ? ' ON DELETE CASCADE' : ''}`
}
function constraintRows(spec: OriginalRelation) {
  return spec.constraints.map((entry, index) => ({
    // Unnamed constraints deliberately have arbitrary names, never naming-convention authority.
    name: entry.name ?? `catalog_selected_${index}`,
    index_oid: ['p', 'u'].includes(entry.kind)
      ? String(
          Number.parseInt(replayHash(`${spec.schema}.${spec.name}:${index}`).slice(0, 8), 16) + 1,
        )
      : '0',
    kind: entry.kind,
    validated: true,
    deferrable: false,
    deferred: false,
    local: true,
    inherited: 0,
    no_inherit: entry.kind !== 'c',
    definition: constraintSql(entry),
    columns: entry.columns,
    parent_schema: entry.parent?.schema ?? null,
    parent_name: entry.parent?.name ?? null,
    parent_columns: entry.parent?.columns ?? [],
    delete_action: entry.kind === 'f' ? (entry.deleteAction === 'CASCADE' ? 'c' : 'a') : ' ',
    update_action: entry.kind === 'f' ? 'a' : ' ',
    match_type: entry.kind === 'f' ? 's' : ' ',
    non_native_dependencies: [],
    operators:
      entry.kind === 'f'
        ? Array.from({ length: 3 }, () =>
            entry.columns.map((name) => {
              const column = spec.columns.find((column) => column.name === name)!
              return operator(
                '=',
                column.type.enum
                  ? 'anyenum'
                  : column.type.name === 'varchar'
                    ? 'text'
                    : column.type.name,
              )
            }),
          ).flat()
        : null,
    backing: ['p', 'u'].includes(entry.kind)
      ? {
          unique: true,
          valid: true,
          ready: true,
          live: true,
          primary: entry.kind === 'p',
          exclusion: false,
          immediate: true,
          key_count: entry.columns.length,
          total_count: entry.columns.length,
          nulls_not_distinct: false,
          predicate: null,
          expressions: null,
          method: 'btree',
          keys: entry.columns.map((name) => {
            const column = spec.columns.find((column) => column.name === name)!
            return {
              name,
              option: 0,
              collation: typeInfo(column).collation,
              opclass_schema: 'pg_catalog',
              family_schema: 'pg_catalog',
              family: ['int4', 'int8'].includes(column.type.name)
                ? 'integer_ops'
                : ['timestamp', 'timestamptz'].includes(column.type.name)
                  ? 'datetime_ops'
                  : column.type.enum
                    ? 'enum_ops'
                    : column.type.name === 'varchar' || column.type.name === 'text'
                      ? 'text_ops'
                      : `${column.type.name}_ops`,
              opclass: column.type.enum
                ? 'enum_ops'
                : column.type.name === 'varchar' || column.type.name === 'text'
                  ? 'text_ops'
                  : `${column.type.name}_ops`,
            }
          }),
        }
      : null,
  }))
}
function fixture(spec: OriginalRelation) {
  const columns = columnRows(spec)
  const constraints = constraintRows(spec)
  const parents = new Map(
    spec.constraints
      .filter((entry) => entry.parent)
      .map((entry) => {
        const parent = entry.parent!
        const declared = specifications.find(
          ({ spec }) => spec.schema === parent.schema && spec.name === parent.name,
        )?.spec
        const parentSpec = declared ?? {
          ...spec,
          schema: parent.schema,
          name: parent.name,
          columns: parent.columns.map((name, index) => ({
            ...spec.columns.find((column) => column.name === entry.columns[index])!,
            name,
            primary: true,
            notNull: true,
          })),
          constraints: [
            { ...entry, kind: 'p' as const, name: null, columns: parent.columns, parent: null },
          ],
        }
        return [
          `${parent.schema}.${parent.name}`,
          {
            columns: columnRows(parentSpec),
            constraints: constraintRows(parentSpec),
          },
        ]
      }),
  )
  for (const [index, entry] of spec.constraints.entries()) {
    if (!entry.parent) continue
    const parent = parents.get(`${entry.parent.schema}.${entry.parent.name}`)!
    const key = parent.constraints.find(
      (key) =>
        ['p', 'u'].includes(key.kind) &&
        replayDigest(key.columns) === replayDigest(entry.parent!.columns),
    )!
    constraints[index].index_oid = key.index_oid
    constraints[index].backing = structuredClone(key.backing)
  }
  const query = async (sql: string, parameters: string[]) => {
    if (sql === originalRelationQueries.namespace) return [{ name: parameters[0] }]
    if (sql === originalRelationQueries.type) {
      const column = spec.columns.find(
        (column) => column.type.schema === parameters[0] && column.type.name === parameters[1],
      )!
      return [typeInfo(column)]
    }
    if (sql === originalRelationQueries.random || sql === originalRelationQueries.deployedRandom)
      return [{ schema: 'pg_catalog', origin: 'POSTGRES_BUILTIN', executable: true }]
    if (sql === originalRelationQueries.clock)
      return [
        {
          schema: 'pg_catalog',
          name: 'now',
          language: 'internal',
          result: 'timestamptz',
          executable: true,
        },
      ]
    if (sql === originalRelationQueries.operator) return [operator(parameters[0], parameters[1])]
    const parent = parents.get(`${parameters[0]}.${parameters[1]}`)
    if (sql === originalRelationQueries.relation) return [{ kind: 'r', standalone: true }]
    if (sql === originalRelationQueries.columns) return parent?.columns ?? columns
    if (sql === originalRelationQueries.constraints) return parent?.constraints ?? constraints
    throw new Error(`UNEXPECTED_READ:${sql}`)
  }
  return { query, columns, constraints, parents }
}

describe('frozen original relation CREATE components (offline only)', () => {
  it('binds all 78 relation effects: 2 schemas and 76 exact original table sources, with 41 wrapper authorities', () => {
    expect(effects).toHaveLength(78)
    expect(originals).toHaveLength(76)
    expect(wrappers).toHaveLength(41)
    expect(specifications).toHaveLength(76)
    expect(new Set(specifications.map(({ spec }) => spec.schema))).toEqual(
      new Set(['public', 'user_management', 'audit_security']),
    )
    expect(specifications.some(({ spec }) => spec.columns.some((column) => column.type.enum))).toBe(
      true,
    )
    expect(
      specifications.some(({ spec }) =>
        spec.columns.some((column) => column.type.name === '_text'),
      ),
    ).toBe(true)
  })
  for (const { id, source, hash, spec } of specifications) {
    describe(id, () => {
      it('compares the entire exact owned original component', async () => {
        expect((await inspectOriginalRelation(fixture(spec), spec)).definition).toBe('EXACT')
      })
      it('preserves source hashes, source guards and full-token consumption', () => {
        expect(() => compileOriginalRelation(`${source}\n`, hash, namedEnums)).toThrow()
        for (const suffix of [' SELECT 1;', ' WITH (fillfactor=70);', ' garbage;']) {
          const changed = source.replace(/;\s*$/, '') + suffix
          expect(() => compileOriginalRelation(changed, replayHash(changed), namedEnums)).toThrow()
        }
        expect(spec.guarded).toBe(/CREATE TABLE IF NOT EXISTS/i.test(source))
        const changed = source.replace(
          /CREATE TABLE(?: IF NOT EXISTS)?/i,
          spec.guarded ? 'CREATE TABLE' : 'CREATE TABLE IF NOT EXISTS',
        )
        expect(
          compileOriginalRelation(changed, replayHash(changed), namedEnums).contractDigest,
        ).not.toBe(spec.contractDigest)
      })
      it('rejects every owned column metadata mutation, missing columns, and extras', async () => {
        const mutations = {
          name: 'not_source_column',
          type_oid: '999999',
          typmod: 42,
          collation: '999999',
          postgres_type: 'text_wrong',
          type_schema: 'shadow',
          type_name: 'shadow_type',
          type_kind: 'd',
          not_null: !spec.columns[0].notNull,
          default_expression: '42',
          identity: 'a',
          generated: 's',
          collation_default: false,
          acl: '{x=r/x}',
        }
        for (const [key, value] of Object.entries(mutations)) {
          const fake = fixture(spec)
          Object.assign(fake.columns[0], { [key]: value })
          expect((await inspectOriginalRelation(fake, spec)).definition, key).toBe('DRIFTED')
        }
        for (const mutate of [
          (fake: ReturnType<typeof fixture>) => fake.columns.pop(),
          (fake: ReturnType<typeof fixture>) =>
            fake.columns.push({ ...fake.columns[0], name: 'later_approved_but_not_authenticated' }),
          (fake: ReturnType<typeof fixture>) =>
            fake.constraints.push({ ...fake.constraints[0], name: 'extra_constraint' }),
        ]) {
          const fake = fixture(spec)
          mutate(fake)
          expect((await inspectOriginalRelation(fake, spec)).definition).toBe('DRIFTED')
        }
      })
      it('denies malformed catalog rows and duplicate singleton results', async () => {
        const fake = fixture(spec)
        Object.assign(fake.columns[0], { not_null: 'false' })
        await expect(inspectOriginalRelation(fake, spec)).rejects.toThrow(
          'ORIGINAL_RELATION_CATALOG_MALFORMED',
        )
        await expect(
          inspectOriginalRelation(
            { query: async () => [{ name: spec.schema }, { name: spec.schema }] },
            spec,
          ),
        ).rejects.toThrow('ORIGINAL_RELATION_CATALOG_CARDINALITY')
      })
      it('rejects shadow native operator procedures and result types', async () => {
        for (const patch of [
          { function_name: 'shadow_equals' },
          { function_language: 'sql' },
          { result_schema: 'public' },
          { result_type: 'text' },
        ]) {
          const fake = fixture(spec)
          const reader = {
            query: async (sql: string, parameters: string[]) => {
              const rows = await fake.query(sql, parameters)
              return sql === originalRelationQueries.operator ? [{ ...rows[0], ...patch }] : rows
            },
          }
          expect((await inspectOriginalRelation(reader, spec)).definition).toBe('DRIFTED')
        }
      })
      if (spec.constraints.some((entry) => entry.kind === 'c'))
        it('accepts catalog CHECK parentheses and source-authorized enum casts, not semantic changes', async () => {
          for (const [index, entry] of spec.constraints.entries()) {
            if (!entry.check) continue
            const fake = fixture(spec)
            fake.constraints[index].definition = `CHECK ((${checkSql(entry.check, spec.columns)}))`
            expect((await inspectOriginalRelation(fake, spec)).definition).toBe('EXACT')
            fake.constraints[index].definition = fake.constraints[index].definition
              .replace(/IS NOT NULL/, 'IS NULL')
              .replace(/ OR /, ' AND ')
              .replace(/ > /, ' < ')
            expect((await inspectOriginalRelation(fake, spec)).definition).toBe('DRIFTED')
          }
        })
      it('distinguishes absent target from missing namespace/type/operator/function prerequisites', async () => {
        const fake = fixture(spec)
        const reader = (target: string) => ({
          query: async (sql: string, parameters: string[]) =>
            sql === target ? [] : fake.query(sql, parameters),
        })
        expect(
          (await inspectOriginalRelation(reader(originalRelationQueries.namespace), spec))
            .definition,
        ).toBe('PRECONDITION_MISSING')
        expect(
          (await inspectOriginalRelation(reader(originalRelationQueries.type), spec)).definition,
        ).toBe('PRECONDITION_MISSING')
        expect(
          (await inspectOriginalRelation(reader(originalRelationQueries.operator), spec))
            .definition,
        ).toBe('PRECONDITION_MISSING')
        if (
          spec.columns.some(
            (column) =>
              column.normalizedDefault.kind === 'FUNCTION' &&
              column.normalizedDefault.name === 'canonical.gen_random_uuid',
          )
        )
          expect(
            (await inspectOriginalRelation(reader(originalRelationQueries.random), spec))
              .definition,
          ).toBe('PRECONDITION_MISSING')
        if (
          spec.columns.some(
            (column) =>
              column.normalizedDefault.kind === 'FUNCTION' &&
              column.normalizedDefault.name === 'pg_catalog.now',
          )
        )
          expect(
            (await inspectOriginalRelation(reader(originalRelationQueries.clock), spec)).definition,
          ).toBe('PRECONDITION_MISSING')
        const absent = {
          query: async (sql: string, parameters: string[]) =>
            sql === originalRelationQueries.relation &&
            parameters[0] === spec.schema &&
            parameters[1] === spec.name
              ? []
              : fake.query(sql, parameters),
        }
        expect((await inspectOriginalRelation(absent, spec)).definition).toBe('ABSENT')
      })
      it('rejects partial or altered constraints, invalid backing indexes, and non-native dependencies', async () => {
        for (const [index, entry] of spec.constraints.entries()) {
          for (const patch of [
            { validated: false },
            { deferrable: true },
            { deferred: true },
            { local: false },
            { inherited: 1 },
            { no_inherit: entry.kind === 'c' },
            { definition: 'UNIQUE ("not_a_column")' },
            { non_native_dependencies: [{ class: 'pg_operator', schema: 'public', name: '>' }] },
            ...(entry.name ? [{ name: 'renamed_explicit_constraint' }] : []),
          ]) {
            const fake = fixture(spec)
            Object.assign(fake.constraints[index], patch)
            expect((await inspectOriginalRelation(fake, spec)).definition).toBe('DRIFTED')
          }
          const fake = fixture(spec)
          fake.constraints.splice(index, 1)
          expect((await inspectOriginalRelation(fake, spec)).definition).toBe('DRIFTED')
          if (entry.kind === 'p' || entry.kind === 'u') {
            for (const patch of [
              { unique: false },
              { valid: false },
              { ready: false },
              { live: false },
              { primary: entry.kind !== 'p' },
              { exclusion: true },
              { immediate: false },
              { key_count: 2 },
              { total_count: 2 },
              { nulls_not_distinct: true },
              { predicate: 'true' },
              { expressions: 'id' },
              { method: 'hash' },
            ]) {
              const fake = fixture(spec)
              Object.assign(fake.constraints[index].backing!, patch)
              expect((await inspectOriginalRelation(fake, spec)).definition).toBe('DRIFTED')
            }
            for (const patch of [
              { name: 'wrong_key' },
              { option: 1 },
              { collation: '999' },
              { opclass_schema: 'public' },
              { family_schema: 'public' },
              { family: 'shadow_ops' },
              { opclass: 'shadow_ops' },
            ]) {
              const fake = fixture(spec)
              Object.assign(fake.constraints[index].backing!.keys[0], patch)
              expect((await inspectOriginalRelation(fake, spec)).definition).toBe('DRIFTED')
            }
          }
        }
      })
      if (spec.columns.some((column) => column.type.enum))
        it('requires caller-authorized W4/wrapper enum definitions and exact deployed members', async () => {
          expect(() => compileOriginalRelation(source, hash)).toThrow(
            'REPLAY_CREATE_NAMED_TYPE_AUTHORITY_REQUIRED',
          )
          const fake = fixture(spec)
          const reader = {
            query: async (sql: string, parameters: string[]) => {
              const rows = await fake.query(sql, parameters)
              if (
                sql === originalRelationQueries.type &&
                spec.columns.some(
                  (column) => column.type.enum && column.type.name === parameters[1],
                )
              )
                return [{ ...rows[0], members: ['invented'] }]
              return rows
            },
          }
          expect((await inspectOriginalRelation(reader, spec)).definition).toBe('DRIFTED')
        })
      if (spec.constraints.some((entry) => entry.parent))
        it('requires real parent columns, proper parent keys, and exact FK actions/native operators', async () => {
          for (const [index, entry] of spec.constraints.entries()) {
            if (!entry.parent) continue
            const key = `${entry.parent.schema}.${entry.parent.name}`
            for (const mutate of [
              (fake: ReturnType<typeof fixture>) => {
                fake.parents.get(key)!.columns[0].type_oid = '999'
              },
              (fake: ReturnType<typeof fixture>) => {
                fake.parents.get(key)!.constraints.length = 0
              },
            ]) {
              const fake = fixture(spec)
              mutate(fake)
              expect((await inspectOriginalRelation(fake, spec)).definition).toBe(
                'PRECONDITION_MISSING',
              )
            }
            for (const patch of [
              { parent_schema: 'shadow' },
              { parent_name: 'wrong_parent' },
              { parent_columns: ['wrong_column'] },
              { delete_action: 'n' },
              { update_action: 'c' },
              { match_type: 'f' },
              { index_oid: '999999999' },
              { backing: null },
              { operators: [operator('=', 'text')] },
            ]) {
              const fake = fixture(spec)
              Object.assign(fake.constraints[index], patch)
              expect((await inspectOriginalRelation(fake, spec)).definition).toBe('DRIFTED')
            }
            for (const patch of [{ valid: false }, { method: 'hash' }, { immediate: false }]) {
              const fake = fixture(spec)
              Object.assign(fake.constraints[index].backing!, patch)
              expect((await inspectOriginalRelation(fake, spec)).definition).toBe('DRIFTED')
            }
          }
        })
    })
  }
})
