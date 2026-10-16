import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import { applyFakeFunctionSource, type FakeFunctionRow } from './replay-fake-functions'
import {
  formatFakeHelperSql,
  interpretFakeHelperCall,
  type FakeHelperEnvironment,
  type FakeHelperNativeType,
  type FakeHelperProgram,
  type FakeHelperRelation,
} from './replay-fake-helper-program'

const sha = (source: string) => createHash('sha256').update(source).digest('hex')
interface FrozenEffect {
  EFFECT_ID: string
  EFFECT_CLASS: string
  EXACT_EFFECT_SHA256: string
  COMPARATOR: { EXACT_SOURCE_SEMANTICS: string }
}
const ledgerBytes = readFileSync(
  new URL(
    '../../../../docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json',
    import.meta.url,
  ),
  'utf8',
)
const effects = (
  JSON.parse(ledgerBytes) as { BOUNDARIES: { EFFECTS: FrozenEffect[] }[] }
).BOUNDARIES.flatMap((boundary) => boundary.EFFECTS)
const calls = effects.filter((effect) => {
  const tokens = sqlTokens(effect.COMPARATOR.EXACT_SOURCE_SEMANTICS)
  return (
    effect.EFFECT_CLASS === 'POLICY_OR_RLS' &&
    tokens[0]?.value === 'SELECT' &&
    tokens[1]?.value.startsWith('ue_create_')
  )
})
const declarations = effects.filter(
  (effect) =>
    effect.EFFECT_CLASS === 'FUNCTION_OR_PROCEDURE' &&
    sqlTokens(effect.COMPARATOR.EXACT_SOURCE_SEMANTICS)[0]?.value === 'CREATE' &&
    effect.COMPARATOR.EXACT_SOURCE_SEMANTICS.includes('ue_create_'),
)
const actor = 'offline_invoker'
const functionRows: FakeFunctionRow[] = []
for (const declaration of declarations)
  applyFakeFunctionSource(
    declaration.COMPARATOR.EXACT_SOURCE_SEMANTICS,
    {
      actor: 'declaration_owner',
      creationSchema: 'helpers',
      searchPath: ['pg_catalog', 'helpers'],
      defaultAcl: [
        { grantor: 'declaration_owner', grantee: actor, privilege: 'EXECUTE', grantable: false },
      ],
    },
    functionRows,
    () => true,
  )
function fn(source: string) {
  const name = sqlTokens(source)[1].value
  return structuredClone(functionRows.find((row) => row.name === name)!)
}
const builtin = (name: string): FakeHelperNativeType => ({ schema: 'pg_catalog', name, kind: 'b' })
/**
 * Synthetic physical fixtures, independent of any policy compiler/IR/catalog
 * expectation. Every table has this explicitly declared shape; the set of
 * relation identities comes from literal call arguments, not emitted DDL.
 * These fixtures do NOT assert the real replay-position database has them.
 */
const columns: Record<string, FakeHelperNativeType> = Object.fromEntries(
  [
    'id',
    'organization_id',
    'org_id',
    'source_organization_id',
    'union_local_id',
    'verified_organization_id',
    'user_id',
    'claimed_by_user_id',
    'from_organization_id',
    'to_organization_id',
    'thread_id',
    'message_id',
    'session_id',
    'alert_rule_id',
    'grievance_id',
    'negotiation_id',
    'packet_id',
    'claim_id',
    'document_id',
    'list_id',
    'campaign_id',
    'rule_id',
    'run_id',
    'meeting_id',
    'contract_id',
    'correspondence_id',
    'request_id',
    'clause_id',
    'group_id',
    'employer_id',
    'batch_id',
    'payment_id',
    'invoice_id',
    'workbook_id',
  ].map((name) => [name, builtin('uuid')]),
)
columns.sharing_level = builtin('text')
columns.shared_with_org_ids = builtin('_uuid')
const fixtureNames = new Set([
  'message_threads',
  'shared_clause_library',
  ...calls.flatMap((call) =>
    sqlTokens(call.COMPARATOR.EXACT_SOURCE_SEMANTICS)
      .filter((token) => token.kind === 'STRING')
      .map((token) => token.value),
  ),
])
function environment(source: string, schema = 'tenant_fixture'): FakeHelperEnvironment {
  const relations = new Map<string, FakeHelperRelation>()
  for (const name of fixtureNames)
    for (const namespace of ['public', schema])
      relations.set(`${namespace}.${name}`, {
        schema: namespace,
        name,
        columns,
      })
  return {
    sourceHash: sha(source),
    actor,
    executionRoles: [actor],
    searchPath: ['pg_catalog', 'helpers', schema, 'public'],
    creationSchema: 'helpers',
    relation: (namespace, name) => relations.get(`${namespace}.${name}`) ?? null,
    resolveFunction: (name) => ({ schema: 'helpers', name }),
    resolveNative: (name) => ({ schema: 'pg_catalog', name }),
    roleExists: (name) => ['union_eyes_runtime', 'union_eyes_system'].includes(name),
    canAlterRelation: (relation, currentActor) =>
      relation.schema === schema && currentActor === actor,
  }
}
function run(source: string, env = environment(source), row = fn(source)) {
  return interpretFakeHelperCall(source, row, env)
}
const direct = "SELECT ue_create_direct_org_rls_policy('claims');"
const parent =
  "SELECT ue_create_parent_owned_rls_policy_v2('chat_messages', 'session_id', 'chat_sessions');"
const examples = functionRows.map((row) => ({
  name: row.name,
  source: calls.find((call) => fn(call.COMPARATOR.EXACT_SOURCE_SEMANTICS).name === row.name)!
    .COMPARATOR.EXACT_SOURCE_SEMANTICS,
}))

describe('independent offline source-native helper interpreter; not full107 proof', () => {
  it('pins 762 effects, 320 original calls and ten raw source programs without policy compilation', () => {
    expect(sha(ledgerBytes)).toBe(
      '41ff4487e83c831dd94c6dbc50a2fe48de3f26af6b3c31453a188e975e423787',
    )
    expect(effects).toHaveLength(762)
    expect(calls).toHaveLength(320)
    expect(declarations).toHaveLength(10)
    expect(functionRows).toHaveLength(10)
    expect(new Set(calls.map((call) => fn(call.COMPARATOR.EXACT_SOURCE_SEMANTICS).name)).size).toBe(
      10,
    )
  })
  for (const call of calls) {
    it(`genuine stored-source emissions for frozen call ${call.EFFECT_ID}`, () => {
      const source = call.COMPARATOR.EXACT_SOURCE_SEMANTICS,
        program = run(source)
      expect(sha(source)).toBe(call.EXACT_EFFECT_SHA256)
      expect(program.sourceHash).toBe(call.EXACT_EFFECT_SHA256)
      expect(program.declarationHash).toBe(
        declarations.find((d) =>
          d.COMPARATOR.EXACT_SOURCE_SEMANTICS.includes(`FUNCTION ${fn(source).name}(`),
        )!.EXACT_EFFECT_SHA256,
      )
      expect(program.bodyHash).toBe(sha(fn(source).body))
      expect(program.guard.exists).toBe(true)
      expect(program.emissions[0].action).toBe('ENABLE_RLS')
      expect(program.emissions[1].action).toBe('FORCE_RLS')
      expect(program.emissions.at(-1)?.sql).toContain(
        'FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
      )
      for (const emission of program.emissions) {
        expect(emission.actor).toBe(actor)
        expect(emission.target.schema).toBe('tenant_fixture')
        expect(
          emission.references.every((reference) => reference.schema === 'tenant_fixture'),
        ).toBe(true)
        expect(emission.sql).not.toContain('tenant_fixture.')
      }
    })
  }
  it('measures 3,576 ordered DDL emissions and 87 resolved parent references across all320 calls', () => {
    const programs = calls.map((call) => run(call.COMPARATOR.EXACT_SOURCE_SEMANTICS))
    expect(programs.flatMap((program) => program.emissions)).toHaveLength(3576)
    expect(
      programs.flatMap((program) => program.emissions.flatMap((emission) => emission.references)),
    ).toHaveLength(87)
  })
  it('returns no emission only when the source public guard is genuinely absent', () => {
    const env = environment(direct),
      original = env.relation
    env.relation = (schema, name) => (schema === 'public' ? null : original(schema, name))
    expect(run(direct, env).guard).toEqual({ schema: 'public', name: 'claims', exists: false })
    expect(run(direct, env).emissions).toEqual([])
  })
  it.each(examples)(
    'executes the true missing-table RETURN in each source body: $name',
    ({ source }) => {
      const env = environment(source),
        original = env.relation
      env.relation = (schema, name) => (schema === 'public' ? null : original(schema, name))
      env.canAlterRelation = () => {
        throw new Error('RETURN must not reach dynamic DDL')
      }
      env.roleExists = () => {
        throw new Error('RETURN must not bind a CREATE POLICY role')
      }
      expect(run(source, env).emissions).toEqual([])
    },
  )
  it('does not evaluate unreachable dynamic format expressions after RETURN', () => {
    const source = `SELECT ue_create_direct_org_rls_policy('claims', '${'x'.repeat(64)}');`,
      env = environment(source),
      original = env.relation
    expect(() => run(source, env)).toThrow('FAKE_HELPER_IDENTIFIER_TRUNCATION_UNSUPPORTED')
    env.relation = (schema, name) => (schema === 'public' ? null : original(schema, name))
    expect(run(source, env).emissions).toEqual([])
  })
  it('does not substitute the public probe for a missing unqualified dynamic target', () => {
    const env = environment(direct),
      original = env.relation
    env.searchPath = ['pg_catalog', 'helpers', 'tenant_fixture']
    env.relation = (schema, name) => (schema === 'tenant_fixture' ? null : original(schema, name))
    expect(() => run(direct, env)).toThrow('FAKE_HELPER_RELATION_UNRESOLVED')
  })
  it('resolves parent and target independently through the exact effective path', () => {
    const env = environment(parent),
      original = env.relation
    env.searchPath = ['pg_catalog', 'helpers', 'parent_fixture', 'tenant_fixture', 'public']
    env.relation = (schema, name) => {
      if (schema === 'parent_fixture')
        return name === 'chat_sessions' ? { schema, name, columns: structuredClone(columns) } : null
      return original(schema, name)
    }
    const program = run(parent, env)
    expect(program.emissions.every((emission) => emission.target.schema === 'tenant_fixture')).toBe(
      true,
    )
    expect(program.emissions.flatMap((emission) => emission.references)).toEqual([
      { schema: 'parent_fixture', name: 'chat_sessions' },
      { schema: 'parent_fixture', name: 'chat_sessions' },
    ])
  })
  it('interprets the actual v_cast CASE and independently denies a flag/type mismatch', () => {
    const source = "SELECT ue_create_direct_org_rls_policy('claims', 'organization_id', TRUE);",
      env = environment(source),
      original = env.relation
    expect(() => run(source, env)).toThrow('FAKE_HELPER_TYPE_DENIED')
    env.relation = (schema, name) => {
      const relation = original(schema, name)
      return relation
        ? { ...relation, columns: { ...relation.columns, organization_id: builtin('text') } }
        : null
    }
    expect(
      run(source, env).emissions.find((emission) => emission.action === 'CREATE_POLICY')?.sql,
    ).toContain('organization_id = current_setting')
    const cast = run(direct).emissions.find((emission) => emission.action === 'CREATE_POLICY')!
    expect(cast.sql).toContain('organization_id::text = current_setting')
  })
  it('preserves the parent-text CASE branch too', () => {
    const source = parent.replace("chat_sessions');", "chat_sessions', 'organization_id', TRUE);"),
      env = environment(source),
      original = env.relation
    env.relation = (schema, name) => {
      const relation = original(schema, name)
      return relation?.name === 'chat_sessions'
        ? { ...relation, columns: { ...relation.columns, organization_id: builtin('text') } }
        : relation
    }
    const sql = run(source, env).emissions.find(
      (emission) => emission.action === 'CREATE_POLICY',
    )!.sql
    expect(sql).toContain('parent.organization_id = current_setting')
    expect(sql).not.toContain('parent.organization_id::text')
  })
  it('preserves OR/either-org read semantics and does not fabricate runtime write policies', () => {
    const source =
        "SELECT ue_create_multi_party_rls_policy('per_capita_remittances', 'from_organization_id', 'to_organization_id');",
      policies = run(source).emissions.filter((emission) => emission.action === 'CREATE_POLICY')
    expect(policies).toHaveLength(2)
    expect(policies[0].sql).toContain('FOR SELECT TO union_eyes_runtime')
    expect(policies[0].sql).toContain('  OR to_organization_id::text')
    expect(policies[0].sql).not.toContain('WITH CHECK')
  })
  it('retains shared-library ANY, literal public sharing and different read/write expressions', () => {
    const call = calls.find(
        (call) =>
          fn(call.COMPARATOR.EXACT_SOURCE_SEMANTICS).name ===
          'ue_create_shared_library_child_rls_policy',
      )!,
      policies = run(call.COMPARATOR.EXACT_SOURCE_SEMANTICS).emissions.filter(
        (emission) => emission.action === 'CREATE_POLICY',
      )
    expect(policies[0].sql).toContain('ANY(parent.shared_with_org_ids)')
    expect(policies[0].sql).toContain("parent.sharing_level = 'public'")
    expect(policies[1].sql).not.toContain('ANY')
    expect(policies[1].sql).not.toContain("= 'public'")
    expect(policies[1].sql).toContain('WITH CHECK')
  })
  it('preserves mixed-global reads but never puts an IS NULL bypass into writes', () => {
    const source = "SELECT ue_create_mixed_global_tenant_rls_policy('holidays');",
      policies = run(source).emissions.filter((emission) => emission.action === 'CREATE_POLICY')
    expect(policies[0].sql).toContain('organization_id IS NULL OR')
    for (const write of policies.slice(1)) expect(write.sql).not.toContain('IS NULL')
  })
  it('quotes hostile identifiers as one physical identity without SQL injection', () => {
    const name = 'Upper"; DROP TABLE victims; --',
      col = 'Own"er',
      source = `SELECT ue_create_direct_org_rls_policy('${name}', '${col}');`,
      env = environment(source)
    env.relation = (schema, requested) =>
      requested === name && ['public', 'tenant_fixture'].includes(schema)
        ? { schema, name, columns: { [col]: builtin('uuid') } }
        : null
    const program = run(source, env)
    expect(program.guard.name).toBe(name)
    expect(program.emissions.every((emission) => emission.target.name === name)).toBe(true)
    expect(program.emissions[0].sql).toBe(
      'ALTER TABLE "Upper""; DROP TABLE victims; --" ENABLE ROW LEVEL SECURITY',
    )
    expect(program.emissions[7].sql).toContain('"Own""er"::text')
  })
  it('formats %L apostrophes/backslashes, %I quotes, %s text and %% without unsupported coercion', () => {
    expect(
      formatFakeHelperSql('%I %I %I %I', ['ordinary_id', 'public', 'select', 'coalesce']),
    ).toBe('ordinary_id public "select" "coalesce"')
    expect(formatFakeHelperSql('%I %L %s %%', ['A"B', "o'reilly", '::text'])).toBe(
      '"A""B" \'o\'\'reilly\' ::text %',
    )
    expect(formatFakeHelperSql('%L', ["a\\b'"])).toBe("E'a\\\\b'''")
    for (const template of ['%1$I', '%2I', '%', '%q'])
      expect(() => formatFakeHelperSql(template, ['x'])).toThrow('FAKE_HELPER_FORMAT_UNSUPPORTED')
    expect(() => formatFakeHelperSql('%I', [])).toThrow('FAKE_HELPER_FORMAT_ARGUMENT_MISSING')
    expect(() => formatFakeHelperSql('text', ['x'])).toThrow('FAKE_HELPER_FORMAT_ARGUMENT_EXCESS')
    expect(() => formatFakeHelperSql('%I', [true])).toThrow('FAKE_HELPER_FORMAT_TYPE_DENIED')
    expect(() => formatFakeHelperSql('%I', ['x'.repeat(64)])).toThrow(
      'FAKE_HELPER_IDENTIFIER_TRUNCATION_UNSUPPORTED',
    )
  })
  it.each(examples)(
    're-emits idempotent source DROP+CREATE, without completion flags: $name',
    ({ source }) => {
      const state = { enabled: false, forced: false, policies: new Map<string, string>() }
      const apply = (program: FakeHelperProgram) => {
        for (const emission of program.emissions) {
          if (emission.action === 'ENABLE_RLS') state.enabled = true
          else if (emission.action === 'FORCE_RLS') state.forced = true
          else {
            const tokens = sqlTokens(emission.sql),
              name = tokens[emission.action === 'CREATE_POLICY' ? 2 : 4].value
            if (emission.action === 'DROP_POLICY_IF_EXISTS') state.policies.delete(name)
            else {
              expect(state.policies.has(name)).toBe(false)
              state.policies.set(name, emission.sql)
            }
          }
        }
      }
      const first = run(source)
      apply(first)
      const before = JSON.stringify([state.enabled, state.forced, [...state.policies]])
      state.policies.set([...state.policies.keys()][0], 'independent stale policy')
      const second = run(source)
      expect(second.emissions).toEqual(first.emissions)
      apply(second)
      expect(JSON.stringify([state.enabled, state.forced, [...state.policies]])).toBe(before)
      expect(state.policies.size).toBe(
        first.emissions.filter((emission) => emission.action === 'CREATE_POLICY').length,
      )
    },
  )
  it('does not mutate environment facts or resolved stored metadata', () => {
    const row = fn(direct),
      before = structuredClone(row),
      env = environment(direct),
      physical = structuredClone(env.relation('tenant_fixture', 'claims'))
    run(direct, env, row)
    expect(row).toEqual(before)
    expect(env.relation('tenant_fixture', 'claims')).toEqual(physical)
  })
  it.each([
    ['security_definer', true],
    ['config', ['search_path=public']],
    ['argument_count', 5],
    ['argument_names', ['wrong']],
    ['language', 'sql'],
    ['strict', true],
    ['return_name', 'bool'],
    ['argument_types', [builtin('uuid')]],
  ])('denies altered function metadata %s', (key, value) => {
    const row = fn(direct)
    Object.assign(row, { [key]: value })
    expect(() => run(direct, environment(direct), row)).toThrow(
      'FAKE_HELPER_FUNCTION_METADATA_DENIED',
    )
  })
  it('denies source drift, wrong program and renamed/modified raw body', () => {
    const row = fn(direct)
    expect(() => run(`${direct} --changed`, environment(direct))).toThrow(
      'FAKE_HELPER_CALL_SOURCE_DRIFT',
    )
    row.body = row.body.replace('ENABLE', 'DISABLE')
    expect(() => run(direct, environment(direct), row)).toThrow('FAKE_HELPER_BODY_IDENTITY_DENIED')
    expect(() => run(direct, environment(direct), fn(parent))).toThrow(
      'FAKE_HELPER_CALL_IDENTITY_DENIED',
    )
    row.body = fn(direct).body + '-- body comment drift'
    expect(() => run(direct, environment(direct), row)).toThrow('FAKE_HELPER_BODY_IDENTITY_DENIED')
    row.body = fn(direct).body
    row.defaults = "'another_column'::text, false"
    expect(() => run(direct, environment(direct), row)).toThrow(
      'FAKE_HELPER_ARGUMENT_DEFAULTS_DENIED',
    )
  })
  it.each([
    ['SELECT ue_create_direct_org_rls_policy();', 'ARITY'],
    ["SELECT ue_create_direct_org_rls_policy('claims', 'id', FALSE, TRUE);", 'ARITY'],
    ['SELECT ue_create_direct_org_rls_policy(TRUE);', 'TYPE'],
    ["SELECT ue_create_direct_org_rls_policy('claims', 'id', 'false');", 'TYPE'],
  ])('denies argument %s', (source, reason) => {
    expect(() => run(source)).toThrow(`FAKE_HELPER_ARGUMENT_${reason}_DENIED`)
  })
  it.each([
    "SELECT ue_create_direct_org_rls_policy('claims'::text);",
    "SELECT ue_create_direct_org_rls_policy(p_table_name => 'claims');",
    'SELECT ue_create_direct_org_rls_policy(NULL);',
    "SELECT ue_create_direct_org_rls_policy('claims'); SELECT true;",
  ])('throws on unknown invocation grammar rather than no-op: %s', (source) => {
    expect(() => run(source)).toThrow()
  })
  it('denies unknown relation facts, missing columns and physical type drift', () => {
    const unknown = environment(direct)
    unknown.relation = () => undefined as unknown as null
    expect(() => run(direct, unknown)).toThrow('FAKE_HELPER_FACT_UNKNOWN')
    for (const type of [undefined, builtin('bytea')]) {
      const env = environment(direct)
      env.relation = (schema, name) => {
        const shape = structuredClone(columns)
        if (type) shape.organization_id = type
        else delete shape.organization_id
        return ['public', 'tenant_fixture'].includes(schema)
          ? { schema, name, columns: shape }
          : null
      }
      expect(() => run(direct, env)).toThrow(
        type ? 'FAKE_HELPER_COLUMN_TYPE_UNSUPPORTED' : 'FAKE_HELPER_COLUMN_MISSING',
      )
    }
    const env = environment(parent),
      original = env.relation
    env.relation = (schema, name) => {
      const relation = original(schema, name)
      return relation?.name === 'chat_sessions'
        ? { ...relation, columns: { ...relation.columns, id: builtin('int8') } }
        : relation
    }
    expect(() => run(parent, env)).toThrow('FAKE_HELPER_TYPE_DENIED')
  })
  it('requires real array types and observed enum labels for the literal public sharing probe', () => {
    const source = examples.find(
      (example) => example.name === 'ue_create_shared_library_rls_policy',
    )!.source
    const withSharingType = (type: FakeHelperNativeType) => {
      const env = environment(source),
        original = env.relation
      env.relation = (schema, name) => {
        const relation = original(schema, name)
        return relation
          ? { ...relation, columns: { ...relation.columns, sharing_level: type } }
          : null
      }
      return env
    }
    expect(() => run(source, withSharingType(builtin('bool')))).toThrow('FAKE_HELPER_TYPE_DENIED')
    const enumType = { schema: 'tenant_fixture', name: 'sharing_level', kind: 'e' }
    expect(() => run(source, withSharingType(enumType))).toThrow('FAKE_HELPER_TYPE_DENIED')
    expect(() => run(source, withSharingType({ ...enumType, enumLabels: ['private'] }))).toThrow(
      'FAKE_HELPER_TYPE_DENIED',
    )
    expect(
      run(source, withSharingType({ ...enumType, enumLabels: ['public', 'private'] })).emissions,
    ).toHaveLength(12)
    const env = environment(source),
      original = env.relation
    env.relation = (schema, name) => {
      const relation = original(schema, name)
      return relation
        ? { ...relation, columns: { ...relation.columns, shared_with_org_ids: builtin('text') } }
        : null
    }
    expect(() => run(source, env)).toThrow('FAKE_HELPER_TYPE_DENIED')
  })
  it('denies non-observed namespace and wrong resolved helper/native functions', () => {
    const env = environment(direct)
    env.searchPath = []
    expect(() => run(direct, env)).toThrow('FAKE_HELPER_POSITION_CONTEXT_REQUIRED')
    env.searchPath = ['pg_catalog', 'helpers', 'tenant_fixture']
    env.resolveFunction = (name) => ({ schema: 'public', name })
    expect(() => run(direct, env)).toThrow('FAKE_HELPER_FUNCTION_RESOLUTION_DENIED')
    for (const builtinName of ['format', 'to_regclass', 'current_setting', 'text', '=']) {
      const shadowed = environment(direct)
      shadowed.resolveNative = (name) => ({
        schema: name === builtinName ? 'helpers' : 'pg_catalog',
        name,
      })
      expect(() => run(direct, shadowed)).toThrow('FAKE_HELPER_NATIVE_BINDING_DENIED')
    }
  })
  it('requires role existence, observed EXECUTE and invoker ownership without owner escalation', () => {
    const row = fn(direct)
    expect(row.owner).not.toBe(actor)
    row.acl = []
    expect(() => run(direct, environment(direct), row)).toThrow('FAKE_HELPER_EXECUTE_DENIED')
    const missingRole = environment(direct)
    missingRole.roleExists = () => false
    expect(() => run(direct, missingRole)).toThrow('FAKE_HELPER_POLICY_ROLE_MISSING')
    const noAlter = environment(direct)
    noAlter.canAlterRelation = (_relation, currentActor) => currentActor === row.owner
    expect(() => run(direct, noAlter)).toThrow('FAKE_HELPER_INVOKER_OWNER_DENIED')
    const member = environment(direct),
      memberRow = fn(direct)
    member.executionRoles = [actor, 'observed_group']
    memberRow.acl[0].grantee = 'observed_group'
    expect(run(direct, member, memberRow).actor).toBe(actor)
    memberRow.acl[0].grantee = 'unobserved_group'
    expect(() => run(direct, member, memberRow)).toThrow('FAKE_HELPER_EXECUTE_DENIED')
  })
})
