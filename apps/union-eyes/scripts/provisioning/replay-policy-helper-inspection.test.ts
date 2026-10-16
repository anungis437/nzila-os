import { describe, expect, it } from 'vitest'
import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import { replayDigest, replayHash } from './post-w4p-replay'
import { functionCatalogQueries } from './replay-function-inspection'
import { literalPolicyQueries } from './replay-literal-policy'
import {
  compilePolicyHelper,
  frozenHelperSources,
  helperCatalogQueries as q,
  helperExpression,
  inspectPolicyHelper,
  type FrozenHelperSource,
  type HelperEffect,
  type HelperExpression,
  type HelperPolicy,
  type HelperPositionContext,
} from './replay-policy-helper-inspection'
import type { CatalogReader } from './platform-baseline-promotion'

const frozen = frozenHelperSources()
function compile(call: FrozenHelperSource) {
  const name = sqlTokens(call.source)[1].value
  const fn = frozen.functions.find((s) => sqlTokens(s.source).some((t) => t.value === name))!
  return compilePolicyHelper(call, fn)
}
const specs = frozen.calls.map(compile)
const examples = [...new Map(specs.map((s) => [s.function.name, s])).values()]
const commands = { SELECT: 'r', INSERT: 'a', UPDATE: 'w', DELETE: 'd', ALL: '*' }
const builtinId = (name: string) => String(100 + [...name].reduce((a, c) => a + c.charCodeAt(0), 0))
const roleAcl = [
  {
    grantor: 'fixture_owner',
    grantee: 'fixture_owner',
    privilege: 'EXECUTE' as const,
    grantable: false,
  },
]
function context(s: HelperEffect): HelperPositionContext {
  const parentSchemas: Record<string, string> = {}
  const walk = (v: HelperExpression | null) => {
    if (!v) return
    if (v.kind === 'exists') {
      parentSchemas[v.table] = 'public'
      walk(v.where)
    } else if (v.kind === 'and' || v.kind === 'or') v.values.forEach(walk)
    else if (v.kind === 'equal') {
      walk(v.left)
      walk(v.right)
    } else if (v.kind === 'cast' || v.kind === 'any' || v.kind === 'null') walk(v.value)
  }
  s.policies.forEach((p) => {
    walk(p.using)
    walk(p.check)
  })
  return {
    effectId: s.call.effectId,
    sourceHash: s.call.sourceHash,
    functionHash: s.function.sourceHash,
    searchPath: ['pg_catalog', 'public'],
    executionRole: 'fixture_owner',
    targetSchema: 'public',
    parentSchemas,
    function: {
      sourceHash: s.function.sourceHash,
      schema: 'public',
      owner: 'fixture_owner',
      acl: roleAcl,
    },
  }
}

/** Independently written SQL oracle, not a rendering of the production IR. */
function oracle(s: HelperEffect) {
  const a = s.arguments.map(String),
    table = a[0],
    own = (col: string, user = false, cast = true) =>
      `${col}${cast ? '::text' : ''} = current_setting('app.current_${user ? 'user' : 'org'}_id', true)`
  const policies: {
    name: string
    command: HelperPolicy['command']
    using: string | null
    check: string | null
    role: string
  }[] = []
  const add = (
    name: string,
    command: HelperPolicy['command'],
    using: string | null,
    check: string | null,
    role = 'union_eyes_runtime',
  ) => policies.push({ name, command, using, check, role })
  const crud = (prefix: string, write: string, select = write, hasDelete = true) => {
    add(`${prefix}_select`, 'SELECT', select, null)
    add(`${prefix}_insert`, 'INSERT', null, write)
    add(`${prefix}_update`, 'UPDATE', write, write)
    if (hasDelete) add(`${prefix}_delete`, 'DELETE', write, null)
  }
  const parent = (parentTable: string, alias: string, fk: string, predicate: string) =>
    `EXISTS (SELECT 1 FROM ${parentTable} ${alias} WHERE ${alias}.id = ${table}.${fk} AND ${predicate})`
  switch (s.function.name) {
    case 'ue_create_direct_org_rls_policy':
      crud('ue_org_isolation', own(a[1], false, a[2] === 'false'))
      break
    case 'ue_create_parent_owned_rls_policy': {
      const e = parent('message_threads', 'mt', a[1], own('mt.organization_id'))
      add('ue_parent_org_isolation', 'ALL', e, e)
      break
    }
    case 'ue_create_user_self_rls_policy':
      crud('ue_user_isolation', `${own(a[1], true)} AND ${own(a[2])}`, undefined, false)
      break
    case 'ue_create_mixed_global_tenant_rls_policy':
      crud('ue_org_isolation', own(a[1]), `${a[1]} IS NULL OR ${own(a[1])}`)
      break
    case 'ue_create_multi_party_rls_policy':
      add('ue_multiparty_isolation_select', 'SELECT', `${own(a[1])} OR ${own(a[2])}`, null)
      break
    case 'ue_create_parent_owned_rls_policy_v2': {
      const e = parent(a[2], 'parent', a[1], own(`parent.${a[3]}`, false, a[4] === 'false'))
      add('ue_parent_org_isolation_v2', 'ALL', e, e)
      break
    }
    case 'ue_create_user_rls_policy':
      crud('ue_user_isolation', own(a[1], true))
      break
    case 'ue_create_parent_owned_via_user_rls_policy_v2': {
      const e = parent(a[2], 'parent', a[1], own(`parent.${a[3]}`, true))
      add('ue_parent_user_isolation_v2', 'ALL', e, e)
      break
    }
    case 'ue_create_shared_library_rls_policy':
      crud(
        'ue_shared_library',
        own(a[1]),
        `${own(a[1])} OR current_setting('app.current_org_id', true)::uuid = ANY(${a[3]}) OR ${a[2]} = 'public'`,
      )
      break
    case 'ue_create_shared_library_child_rls_policy': {
      const write = parent(
        'shared_clause_library',
        'parent',
        a[1],
        own('parent.source_organization_id'),
      )
      const read = parent(
        'shared_clause_library',
        'parent',
        a[1],
        `(${own('parent.source_organization_id')} OR current_setting('app.current_org_id', true)::uuid = ANY(parent.shared_with_org_ids) OR parent.sharing_level = 'public')`,
      )
      add('ue_shared_library_child_select', 'SELECT', read, null)
      add('ue_shared_library_child_write', 'ALL', write, write)
      break
    }
    default:
      throw new Error('Uncovered oracle')
  }
  add('ue_system_full_access', 'ALL', 'true', 'true', 'union_eyes_system')
  return policies
}
function functionRow(s: HelperEffect) {
  const f = s.function
  return {
    schema: 'public',
    name: f.name,
    kind: 'f',
    argument_types: f.arguments.map((a) => a.type),
    argument_names: f.arguments.map((a) => a.name),
    argument_modes: null,
    all_argument_types: null,
    argument_count: f.arguments.length,
    variadic: '0',
    default_count: f.arguments.filter((a) => a.default).length,
    defaults:
      f.arguments
        .filter((a) => a.default)
        .map((a) =>
          a.default!.kind === 'TEXT' ? `'${a.default!.value}'::text` : String(a.default!.value),
        )
        .join(', ') || null,
    return_schema: 'pg_catalog',
    return_name: 'void',
    return_kind: 'p',
    returns_set: false,
    language: 'plpgsql',
    security_definer: false,
    volatility: 'v',
    strict: false,
    parallel: 'u',
    leakproof: false,
    config: null,
    body: f.body,
    binary: null,
    cost: 100,
    rows: 0,
    support: '0',
    transforms: null,
    sql_body_absent: true,
    owner: 'fixture_owner',
    acl: roleAcl,
    dependents: [],
  }
}
type Mutation = (sql: string, args: string[], rows: Record<string, unknown>[]) => unknown[]
function fixture(s: HelperEffect, mutation?: Mutation, ctx = context(s)): CatalogReader {
  const o = oracle(s),
    tables = [s.table, ...Object.keys(ctx.parentSchemas)]
  const tableIds = new Map(tables.map((name, i) => [name, String(20000 + i)]))
  const allColumns = new Map<string, Set<string>>()
  const aliases = new Map<string, string>([[s.table, s.table]])
  const collect = (v: HelperExpression | null) => {
    if (!v) return
    if (v.kind === 'exists') {
      aliases.set(v.alias, v.table)
      collect(v.where)
    } else if (v.kind === 'column') {
      const table = v.relation ? aliases.get(v.relation)! : s.table
      if (!allColumns.has(table)) allColumns.set(table, new Set())
      allColumns.get(table)!.add(v.name)
    } else if (v.kind === 'and' || v.kind === 'or') v.values.forEach(collect)
    else if (v.kind === 'equal') {
      collect(v.left)
      collect(v.right)
    } else if (v.kind === 'cast' || v.kind === 'any' || v.kind === 'null') collect(v.value)
  }
  o.forEach((p) => {
    collect(p.using ? helperExpression(p.using) : null)
    collect(p.check ? helperExpression(p.check) : null)
  })
  const type = (name: string) =>
    name === 'shared_with_org_ids' ||
    (name === s.arguments[3] && s.function.name === 'ue_create_shared_library_rls_policy')
      ? '_uuid'
      : name === 'sharing_level' ||
          (name === s.arguments[2] && s.function.name === 'ue_create_shared_library_rls_policy')
        ? 'text'
        : 'uuid'
  const noCastColumns = new Set<string>()
  for (const p of o)
    for (const e of [p.using, p.check]) {
      const find = (v: HelperExpression | null) => {
        if (!v) return
        if (v.kind === 'equal' && v.left.kind === 'column' && v.right.kind === 'setting')
          noCastColumns.add(v.left.name)
        if (v.kind === 'exists') find(v.where)
        else if (v.kind === 'and' || v.kind === 'or') v.values.forEach(find)
      }
      find(e ? helperExpression(e) : null)
    }
  const columnType = (name: string) => (noCastColumns.has(name) ? 'text' : type(name))
  const ids: Record<string, string> = { text: '25', uuid: '2950', _uuid: '2951' }
  const columnNumber = (table: string, name: string) =>
    [...allColumns.get(table)!].indexOf(name) + 1
  return {
    async query(sql, args) {
      let rows: Record<string, unknown>[] = []
      if (sql === q.context) rows = [{ role: ctx.executionRole, search_path: ctx.searchPath }]
      else if (
        sql === functionCatalogQueries.namespace ||
        sql === functionCatalogQueries.owner ||
        sql === literalPolicyQueries.role
      )
        rows = [{ name: args[0] }]
      else if (sql === functionCatalogQueries.type)
        rows = [
          { schema: args[0], name: args[1], kind: args[1] === 'void' ? 'p' : 'b', visible: true },
        ]
      else if (sql === functionCatalogQueries.language)
        rows = [{ name: 'plpgsql', trusted: true, owner_usage: true }]
      else if (sql === functionCatalogQueries.functions) rows = [functionRow(s)]
      else if (sql === q.functionResolution)
        rows = [
          {
            oid: '18000',
            schema: 'public',
            name: s.function.name,
            visible: true,
            argument_oids: s.function.arguments
              .map((a) => (a.type.name === 'text' ? '25' : '16'))
              .join(' '),
          },
        ]
      else if (sql === q.relation)
        rows = [
          {
            oid: tableIds.get(args[1])!,
            schema: args[0],
            name: args[1],
            kind: 'r',
            enabled: true,
            forced: true,
            visible: true,
            inheritance: 0,
          },
        ]
      else if (sql === q.column) {
        const table = tables.find((n) => tableIds.get(n) === args[0])!,
          t = columnType(args[1])
        const input = t === 'text' ? 'textin' : t === 'uuid' ? 'uuid_in' : 'array_in'
        const output = t === 'text' ? 'textout' : t === 'uuid' ? 'uuid_out' : 'array_out'
        rows = [
          {
            name: args[1],
            schema: 'pg_catalog',
            type: t,
            kind: 'b',
            oid: ids[t],
            element: t === '_uuid' ? '2950' : '0',
            relation: args[0],
            number: columnNumber(table, args[1]),
            collation: t === 'text' ? '100' : '0',
            input_body: input,
            output_body: output,
            input_oid: builtinId(input),
            output_oid: builtinId(output),
          },
        ]
      } else if (sql === q.builtin) {
        const name = args[0].split('(')[0]
        const bodies: Record<string, string> = {
          current_setting: 'show_config_by_name_missing_ok',
          format: 'text_format',
          to_regclass: 'to_regclass',
        }
        const result = name.endsWith('out')
          ? 'cstring'
          : name === 'to_regclass'
            ? 'regclass'
            : name === 'uuid_in'
              ? 'uuid'
              : name === 'array_in'
                ? 'anyarray'
                : 'text'
        const argOids: Record<string, string> = {
          text: '25',
          boolean: '16',
          any: '2276',
          cstring: '2275',
          oid: '26',
          integer: '23',
          uuid: '2950',
          anyarray: '2277',
        }
        rows = [
          {
            oid: builtinId(name),
            schema: 'pg_catalog',
            name,
            body: bodies[name] ?? name,
            language: 'internal',
            kind: 'f',
            definer: false,
            config: null,
            argument_oids: args[0]
              .slice(name.length + 1, -1)
              .split(',')
              .map((v) => argOids[v.replaceAll('"', '')])
              .join(' '),
            variadic: name === 'format' ? '2276' : '0',
            result,
            visible: true,
          },
        ]
      } else if (sql === q.overloads) {
        rows = [
          {
            oid: builtinId(args[0]),
            schema: 'pg_catalog',
            name: args[0],
            argument_oids:
              args[0] === 'current_setting' ? '25 16' : args[0] === 'format' ? '25 2276' : '25',
            variadic: args[0] === 'format' ? '2276' : '0',
          },
        ]
      } else if (sql === q.operator)
        rows = [
          {
            oid: args[0] === '25' ? '98' : '2972',
            schema: 'pg_catalog',
            name: '=',
            left_type: args[0],
            right_type: args[0],
            result: '16',
            body: args[0] === '25' ? 'texteq' : 'uuid_eq',
            language: 'internal',
            visible: true,
            function_oid: builtinId(args[0] === '25' ? 'texteq' : 'uuid_eq'),
            function_schema: 'pg_catalog',
            argument_oids: `${args[0]} ${args[0]}`,
            function_result: '16',
            function_kind: 'f',
            definer: false,
            config: null,
          },
        ]
      else if (sql === q.cast) rows = []
      else if (sql === literalPolicyQueries.policy) {
        const p = o.find((p) => p.name === args[2])!
        rows = [
          {
            name: p.name,
            name_matches: true,
            command: commands[p.command],
            permissive: true,
            roles: [p.role],
            using_expression: p.using,
            check_expression: p.check,
          },
        ]
      } else if (sql === q.dependencies) {
        const p = o.find((p) => p.name === args[1])!
        rows = [{ catalog: 'pg_class', oid: args[0], subid: 0, kind: 'a' }]
        const required: { table: string; name: string }[] = []
        const walk = (v: HelperExpression | null) => {
          if (!v) return
          if (v.kind === 'column')
            required.push({ table: v.relation ? aliases.get(v.relation)! : s.table, name: v.name })
          else if (v.kind === 'exists') walk(v.where)
          else if (v.kind === 'and' || v.kind === 'or') v.values.forEach(walk)
          else if (v.kind === 'equal') {
            walk(v.left)
            walk(v.right)
          } else if (v.kind === 'cast' || v.kind === 'any' || v.kind === 'null') walk(v.value)
        }
        walk(p.using ? helperExpression(p.using) : null)
        walk(p.check ? helperExpression(p.check) : null)
        required.forEach((c) =>
          rows.push({
            catalog: 'pg_class',
            oid: tableIds.get(c.table)!,
            subid: columnNumber(c.table, c.name),
            kind: 'n',
          }),
        )
        rows = [...new Map(rows.map((r) => [replayDigest(r), r])).values()]
      } else throw new Error('Unexpected SQL')
      return mutation ? mutation(sql, args, structuredClone(rows)) : rows
    },
  }
}
const change =
  (query: string, field: string, value: unknown): Mutation =>
  (sql, _args, rows) => {
    if (sql === query && rows.length) rows[0][field] = value
    return rows
  }

describe('frozen policy helper compilation', () => {
  it('measures 320 calls, not 334 (334 includes 14 literal policies), ten exact bodies', () => {
    expect(frozen.calls).toHaveLength(320)
    expect(frozen.functions).toHaveLength(10)
    const counts = Object.fromEntries(
      examples.map((s) => [
        s.function.name,
        specs.filter((p) => p.function.name === s.function.name).length,
      ]),
    )
    expect(Object.values(counts)).toEqual([262, 3, 1, 2, 1, 35, 10, 4, 1, 1])
  })
  it.each(specs.map((s) => [s.call.effectId, s] as const))(
    'source + literal oracle %s',
    (_id, s) => {
      expect(s.call.sourceHash).toBe(replayHash(s.call.source))
      expect(s.policies).toEqual(
        oracle(s).map((p) => ({
          name: p.name,
          command: p.command,
          role: p.role,
          permissive: true,
          using: p.using ? helperExpression(p.using) : null,
          check: p.check ? helperExpression(p.check) : null,
        })),
      )
    },
  )
  it.each(examples.map((s) => [s.function.name, s] as const))(
    'rejects false body/source/default/identity %s',
    (_name, s) => {
      const fn = frozen.functions.find((v) => v.sourceHash === s.function.sourceHash)!
      for (const call of [
        { ...s.call, source: s.call.source + ' ' },
        { ...s.call, source: s.call.source.replace('SELECT', 'SELECT public.') },
        { ...s.call, ordinal: s.call.ordinal + 1 },
        { ...s.call, effectId: 'not-frozen' },
      ])
        expect(() => compilePolicyHelper(call, fn)).toThrow()
      const body = fn.source.replace('ENABLE', 'DISABLE')
      expect(() =>
        compilePolicyHelper(s.call, { ...fn, source: body, sourceHash: replayHash(body) }),
      ).toThrow()
      const other = frozen.functions.find((v) => v.sourceHash !== fn.sourceHash)!
      expect(() => compilePolicyHelper(s.call, other)).toThrow()
    },
  )
  it('keeps AND/OR/EXISTS/ANY, UUID settings and precedence distinct', () => {
    expect(helperExpression('a = b AND c = d OR e IS NULL').kind).toBe('or')
    expect(() => helperExpression("current_setting('app.current_org_id', false)")).toThrow()
    expect(() => helperExpression('a = ANY(b)::integer')).toThrow()
    expect(() => helperExpression('unknown_function(a)')).toThrow()
    expect(() => helperExpression('a OPERATOR(public.=) b')).toThrow()
  })
})

describe('guarded catalog helper comparators', () => {
  it.each(specs.map((s) => [s.call.effectId, s] as const))(
    'exact and role-drift for every frozen call %s',
    async (_id, s) => {
      const exact = await inspectPolicyHelper(fixture(s), s, context(s))
      expect(exact, exact.denial ?? '').toMatchObject({ definition: 'EXACT', denial: null })
      const drift = await inspectPolicyHelper(
        fixture(s, change(literalPolicyQueries.policy, 'roles', ['union_eyes_system'])),
        s,
        context(s),
      )
      expect(drift.definition).toBe('DRIFTED')
      expect(drift.stateDigest).not.toBe(exact.stateDigest)
    },
  )
  const negatives: [string, string, unknown][] = [
    [q.context, 'role', 'wrong_role'],
    [q.context, 'search_path', ['evil', 'public']],
    [q.context, 'search_path', 'public'],
    [q.relation, 'visible', false],
    [q.relation, 'enabled', false],
    [q.relation, 'forced', false],
    [q.relation, 'kind', 'p'],
    [q.relation, 'inheritance', 1],
    [q.relation, 'enabled', 'true'],
    [q.relation, 'oid', 'not-an-oid'],
    [q.column, 'schema', 'evil'],
    [q.column, 'type', 'bool'],
    [q.column, 'kind', 'd'],
    [q.column, 'relation', 'different'],
    [q.column, 'input_body', 'fake_input'],
    [q.column, 'number', -1],
    [q.column, 'input_oid', '9999'],
    [q.builtin, 'body', 'evil_function'],
    [q.builtin, 'schema', 'evil'],
    [q.builtin, 'visible', false],
    [q.builtin, 'language', 'plpgsql'],
    [q.builtin, 'definer', true],
    [q.builtin, 'config', ['search_path=evil']],
    [q.builtin, 'argument_oids', '25'],
    [q.builtin, 'variadic', '2276'],
    [q.overloads, 'schema', 'evil'],
    [q.overloads, 'argument_oids', '25 25'],
    [q.operator, 'body', 'different_equality'],
    [q.operator, 'visible', false],
    [q.operator, 'function_oid', '19000'],
    [q.operator, 'argument_oids', '25'],
    [q.operator, 'function_result', '25'],
    [q.operator, 'left_type', '16'],
    [q.operator, 'result', '25'],
    [q.functionResolution, 'visible', false],
    [q.functionResolution, 'schema', 'evil'],
    [q.functionResolution, 'argument_oids', '25'],
    [q.functionResolution, 'oid', 'bad'],
    [functionCatalogQueries.functions, 'body', 'BEGIN RETURN; END;'],
    [functionCatalogQueries.functions, 'owner', 'other_owner'],
    [functionCatalogQueries.functions, 'acl', []],
    [functionCatalogQueries.functions, 'defaults', "'evil'::text"],
    [literalPolicyQueries.policy, 'name', 'other_policy'],
    [literalPolicyQueries.policy, 'command', 'd'],
    [literalPolicyQueries.policy, 'permissive', false],
    [literalPolicyQueries.policy, 'roles', []],
    [literalPolicyQueries.policy, 'roles', ['union_eyes_runtime', 'public']],
    [literalPolicyQueries.policy, 'using_expression', 'false'],
    [literalPolicyQueries.policy, 'check_expression', 'true'],
    [literalPolicyQueries.policy, 'using_expression', '1 + 1'],
    [literalPolicyQueries.policy, 'name_matches', null],
  ]
  for (const s of examples) {
    describe(s.function.name, () => {
      for (const [query, field, value] of negatives)
        it(`denies ${Object.entries(q).find(([, v]) => v === query)?.[0] ?? 'function/policy'}.${field}=${JSON.stringify(value)}`, async () => {
          const result = await inspectPolicyHelper(
            fixture(s, change(query, field, value)),
            s,
            context(s),
          )
          expect(result.definition).not.toBe('EXACT')
          expect(result.denial).not.toBeNull()
        })
      it('denies missing context, false source claims and mutated IR', async () => {
        expect((await inspectPolicyHelper(fixture(s), s)).definition).toBe('PRECONDITION_MISSING')
        for (const ctx of [
          { ...context(s), sourceHash: '0'.repeat(64) },
          { ...context(s), functionHash: '0'.repeat(64) },
          { ...context(s), effectId: 'other-position' },
          { ...context(s), targetSchema: 'evil' },
        ]) {
          expect((await inspectPolicyHelper(fixture(s), s, ctx)).definition).not.toBe('EXACT')
        }
        expect(
          (await inspectPolicyHelper(fixture(s), { ...s, policies: [] }, context(s))).definition,
        ).toBe('DRIFTED')
      })
      it('denies partial/missing/duplicate/malformed readings, overloads and dependencies', async () => {
        for (const query of [
          q.context,
          q.relation,
          q.column,
          q.builtin,
          q.overloads,
          q.operator,
          q.functionResolution,
          functionCatalogQueries.functions,
          literalPolicyQueries.role,
          literalPolicyQueries.policy,
          q.dependencies,
        ]) {
          for (const mode of ['missing', 'duplicate', 'malformed']) {
            const reader = fixture(s, (sql, _args, rows) => {
              if (sql !== query) return rows
              return mode === 'missing' ? [] : mode === 'duplicate' ? [...rows, ...rows] : [{}]
            })
            const result = await inspectPolicyHelper(reader, s, context(s))
            expect(result.definition, `${query.slice(0, 60)} ${mode}`).not.toBe('EXACT')
          }
        }
        const reader = fixture(s, (sql, _args, rows) =>
          sql === q.dependencies
            ? [...rows, { catalog: 'pg_proc', oid: '19000', subid: 0, kind: 'n' }]
            : rows,
        )
        expect((await inspectPolicyHelper(reader, s, context(s))).definition).toBe('DRIFTED')
        expect(
          (
            await inspectPolicyHelper(
              {
                query: async () => {
                  throw new Error('offline')
                },
              },
              s,
              context(s),
            )
          ).definition,
        ).toBe('PRECONDITION_MISSING')
      })
    })
  }
  it('does not invent supersession for shared names', async () => {
    const self = examples.find((s) => s.function.name === 'ue_create_user_self_rls_policy')!
    const reader = fixture(self, (sql, _args, rows) => {
      if (sql === literalPolicyQueries.policy && rows[0]?.name === 'ue_user_isolation_select')
        rows[0].using_expression = "user_id::text = current_setting('app.current_user_id', true)"
      return rows
    })
    expect((await inspectPolicyHelper(reader, self, context(self))).definition).toBe('DRIFTED')
  })
  it('requires both the public existence guard and independently resolved unqualified target', async () => {
    const s = examples[0]
    const ctx = {
      ...context(s),
      searchPath: ['pg_catalog', 'tenant', 'public'],
      targetSchema: 'tenant',
    }
    const resolved = fixture(s, (sql, args, rows) => {
      if (sql === q.context) rows[0].search_path = ctx.searchPath
      if (sql === q.relation && args[0] === 'public')
        Object.assign(rows[0], { oid: '29000', visible: false })
      return rows
    })
    expect((await inspectPolicyHelper(resolved, s, ctx)).definition).toBe('EXACT')
    const missingGuard = fixture(s, (sql, args, rows) => {
      if (sql === q.context) rows[0].search_path = ctx.searchPath
      return sql === q.relation && args[0] === 'public' ? [] : rows
    })
    expect((await inspectPolicyHelper(missingGuard, s, ctx)).denial).toBe(
      'PUBLIC_EXISTENCE_GUARD_MISSING',
    )
    const shadowed = fixture(s, change(q.relation, 'visible', false))
    expect((await inspectPolicyHelper(shadowed, s, context(s))).denial).toBe(
      'UNQUALIFIED_RELATION_RESOLUTION_NOT_ESTABLISHED',
    )
  })
  it.each(
    examples
      .filter((s) => Object.keys(context(s).parentSchemas).length)
      .map((s) => [s.function.name, s] as const),
  )('observes literal parent.id and FK typing %s', async (_name, s) => {
    const reader = fixture(s, (sql, args, rows) => {
      if (sql === q.column && args[1] === 'id') {
        Object.assign(rows[0], {
          type: 'text',
          oid: '25',
          input_body: 'textin',
          output_body: 'textout',
          input_oid: builtinId('textin'),
          output_oid: builtinId('textout'),
          collation: '100',
        })
      }
      return rows
    })
    expect((await inspectPolicyHelper(reader, s, context(s))).definition).toBe('DRIFTED')
    expect((await inspectPolicyHelper(reader, s, context(s))).denial).toBe(
      'PARENT_ID_FK_TYPE_MISMATCH',
    )
    const missing = fixture(s, (sql, args, rows) =>
      sql === q.column && args[1] === 'id' ? [] : rows,
    )
    expect((await inspectPolicyHelper(missing, s, context(s))).definition).toBe(
      'PRECONDITION_MISSING',
    )
  })
  it('denies UUID ANY against a scalar and overridden IO cast', async () => {
    const s = examples.find((s) => s.function.name === 'ue_create_shared_library_rls_policy')!
    const reader = fixture(s, (sql, args, rows) => {
      if (sql === q.column && args[1] === s.arguments[3])
        Object.assign(rows[0], {
          type: 'uuid',
          oid: '2950',
          element: '0',
          input_body: 'uuid_in',
          output_body: 'uuid_out',
          input_oid: builtinId('uuid_in'),
          output_oid: builtinId('uuid_out'),
        })
      return rows
    })
    expect((await inspectPolicyHelper(reader, s, context(s))).definition).toBe('DRIFTED')
    expect((await inspectPolicyHelper(reader, s, context(s))).denial).toBe('ANY_ARRAY_TYPE_DRIFT')
    expect(
      (
        await inspectPolicyHelper(
          fixture(s, (sql, _args, rows) =>
            sql === q.cast ? [{ method: 'f', context: 'i', function: '19000' }] : rows,
          ),
          s,
          context(s),
        )
      ).definition,
    ).toBe('PRECONDITION_MISSING')
  })
})
