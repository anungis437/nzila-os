import { describe, expect, it } from 'vitest'
import { read } from '../../../../scripts/ue/w4-physical-producers'
import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import {
  replayObject,
  replayRecords,
  replayText,
  replayHash,
  replayDigest,
} from './post-w4p-replay'
import {
  compileLiteralPolicy,
  inspectLiteralPolicy,
  literalPolicyQueries,
  policyExpression,
} from './replay-literal-policy'
import { createCatalogQueries } from './replay-create-inspection'
import { rlsPrimitiveQueries } from './replay-rls-primitives'
const ledger = replayObject(
  JSON.parse(
    read('docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json'),
  ),
)
const effects = replayRecords(ledger.BOUNDARIES)
  .flatMap((boundary) => replayRecords(boundary.EFFECTS))
  .filter(
    (effect) =>
      effect.EFFECT_CLASS === 'POLICY_OR_RLS' &&
      sqlTokens(
        replayText(replayObject(effect.COMPARATOR).EXACT_SOURCE_SEMANTICS),
      )[0].value.toUpperCase() === 'CREATE',
  )
type Expression = ReturnType<typeof policyExpression>
function render(value: Expression | null): string | null {
  if (!value) return null
  if (value.kind === 'BOOLEAN') return value.value ? 'true' : 'false'
  if (value.kind === 'STRING') return "'" + value.value.replaceAll("'", "''") + "'"
  if (value.kind === 'COLUMN') return `"${value.name}"`
  if (value.kind === 'CAST_TEXT') return `(${render(value.value)})::text`
  if (value.kind === 'CURRENT_SETTING')
    return `current_setting('${value.key}'::text,${value.missingOk ? 'true' : 'false'})`
  if (value.kind === 'IS_NOT_NULL') return `(${render(value.value)} IS NOT NULL)`
  if (value.kind === 'EQUAL') return `(${render(value.left)} = ${render(value.right)})`
  return `(${value.values.map(render).join(' AND ')})`
}
function ownedColumns(value: Expression | null): string[] {
  if (!value) return []
  if (value.kind === 'COLUMN') return [value.name]
  if (value.kind === 'CAST_TEXT' || value.kind === 'IS_NOT_NULL') return ownedColumns(value.value)
  if (value.kind === 'EQUAL') return [...ownedColumns(value.left), ...ownedColumns(value.right)]
  if (value.kind === 'AND') return value.values.flatMap(ownedColumns)
  return []
}
function harness(spec: ReturnType<typeof compileLiteralPolicy>) {
  const command: Record<string, string> = {
    SELECT: 'r',
    INSERT: 'a',
    UPDATE: 'w',
    DELETE: 'd',
    ALL: '*',
  }
  const current: Record<string, unknown> = {
    name: spec.name,
    name_matches: true,
    command: command[spec.command],
    roles: spec.roles,
    permissive: true,
    using_expression: render(spec.using),
    check_expression: render(spec.check),
  }
  const types: Record<string, unknown>[] = Array.from(
    new Set([...ownedColumns(spec.using), ...ownedColumns(spec.check)]),
  ).map((name) => ({
    name,
    type_schema: 'pg_catalog',
    type_kind: 'b',
    type_name: spec.schema === 'user_management' ? 'varchar' : 'uuid',
  }))
  const setting: Record<string, unknown> = {
    schema: 'pg_catalog',
    name: 'current_setting',
    language: 'internal',
    result: 'text',
    volatility: 's',
    executable: true,
    text_operator_builtin: true,
  }
  const policies = [current],
    tables = [{ kind: 'r', standalone: true }],
    roles = [{ name: spec.roles[0] }]
  return {
    current,
    types,
    setting,
    policies,
    tables,
    roles,
    async query(sql: string, parameters: string[]) {
      if (sql === rlsPrimitiveQueries.table) {
        expect(parameters).toEqual([spec.schema, spec.table])
        return tables
      }
      if (sql === literalPolicyQueries.role) return roles
      if (sql === createCatalogQueries.columns) return types
      if (sql === literalPolicyQueries.setting) return [setting]
      if (sql === literalPolicyQueries.uuidOutput) return [{ builtin: true }]
      expect(sql).toBe(literalPolicyQueries.policy)
      expect(parameters).toEqual([spec.schema, spec.table, spec.name])
      return policies
    },
  }
}
describe('fourteen source-bound literal policy components;not whole-boundary qualification', () => {
  it('accounts exactly14literalCREATEPOLICYeffects', () => {
    expect(effects).toHaveLength(14)
  })
  it('denies bare UUID-to-text equality rather than treating syntax similarity as executable', async () => {
    const source =
      "CREATE POLICY p ON public.t FOR SELECT TO union_eyes_runtime USING (user_id = current_setting('app.current_user_id',true));"
    const spec = compileLiteralPolicy(source, replayHash(source))
    expect((await inspectLiteralPolicy(harness(spec), spec)).definition).toBe(
      'PRECONDITION_MISSING',
    )
    const text = harness(spec)
    text.types[0].type_name = 'text'
    expect((await inspectLiteralPolicy(text, spec)).definition).toBe('EXACT')
  })
  it('rejects an invented pg_catalog column qualifier', () => {
    expect(() =>
      policyExpression("pg_catalog.user_id = current_setting('app.current_user_id',true)"),
    ).toThrow('REPLAY_POLICY_EXPRESSION_UNSUPPORTED')
  })
  for (const effect of effects) {
    const source = replayText(replayObject(effect.COMPARATOR).EXACT_SOURCE_SEMANTICS)
    const spec = compileLiteralPolicy(source, replayHash(source))
    it(`full literal policy:${effect.EFFECT_ID}`, async () => {
      expect((await inspectLiteralPolicy(harness(spec), spec)).definition).toBe('EXACT')
      const absent = harness(spec)
      absent.policies.length = 0
      expect((await inspectLiteralPolicy(absent, spec)).definition).toBe('ABSENT')
      for (const change of [
        { name_matches: false },
        { command: 'unapproved' },
        { roles: ['public'] },
        { permissive: false },
        { using_expression: 'false' },
        { check_expression: 'false' },
      ]) {
        const fake = harness(spec)
        Object.assign(fake.current, change)
        expect((await inspectLiteralPolicy(fake, spec)).definition).toBe('DRIFTED')
      }
      const noTable = harness(spec)
      noTable.tables.length = 0
      expect((await inspectLiteralPolicy(noTable, spec)).definition).toBe('PRECONDITION_MISSING')
      const noRole = harness(spec)
      noRole.roles.length = 0
      expect((await inspectLiteralPolicy(noRole, spec)).definition).toBe('PRECONDITION_MISSING')
      if (harness(spec).types.length) {
        for (const change of [
          { schema: 'public' },
          { name: 'unapproved' },
          { language: 'sql' },
          { result: 'uuid' },
          { volatility: 'v' },
          { executable: false },
          { text_operator_builtin: false },
        ]) {
          const fake = harness(spec)
          Object.assign(fake.setting, change)
          expect((await inspectLiteralPolicy(fake, spec)).definition).toBe('PRECONDITION_MISSING')
        }
        const noColumn = harness(spec)
        noColumn.types.length = 0
        expect((await inspectLiteralPolicy(noColumn, spec)).definition).toBe('PRECONDITION_MISSING')
        const wrongType = harness(spec)
        wrongType.types[0].type_schema = 'public'
        expect((await inspectLiteralPolicy(wrongType, spec)).definition).toBe('DRIFTED')
      }
    })
  }
  it('normalizes PostgreSQL parenthesization,literal text casts and implicit varchar-to-text comparison only', async () => {
    const source =
      "CREATE POLICY p ON user_management.users FOR SELECT TO union_eyes_runtime USING (user_id = current_setting('app.current_user_id',true));"
    const spec = compileLiteralPolicy(source, replayHash(source)),
      fake = harness(spec)
    fake.current.using_expression =
      "((user_id)::text = pg_catalog.current_setting('app.current_user_id'::text,true))"
    expect((await inspectLiteralPolicy(fake, spec)).definition).toBe('EXACT')
    fake.current.using_expression =
      "((user_id)::text = pg_catalog.current_setting('app.different_key'::text,true))"
    expect((await inspectLiteralPolicy(fake, spec)).definition).toBe('DRIFTED')
    expect(replayDigest(policyExpression('(true)'))).toBe(replayDigest(policyExpression('true')))
    expect(() => policyExpression("public.current_setting('app.current_user_id',true)")).toThrow(
      'REPLAY_POLICY_EXPRESSION_UNSUPPORTED',
    )
    expect(() =>
      policyExpression("user_id = current_setting('app.current_user_id',true) OR true"),
    ).toThrow('REPLAY_POLICY_EXPRESSION_UNSUPPORTED')
  })
  it('rejects extra source statements,hash changes and malformed metadata completion objects', async () => {
    const source = replayText(replayObject(effects[0].COMPARATOR).EXACT_SOURCE_SEMANTICS)
    expect(() => compileLiteralPolicy(source + ' ', replayHash(source))).toThrow(
      'REPLAY_STRUCTURAL_SOURCE_HASH_DRIFT',
    )
    expect(() =>
      compileLiteralPolicy(source + ' SELECT 1;', replayHash(source + ' SELECT 1;')),
    ).toThrow('REPLAY_STRUCTURAL_GRAMMAR_UNSUPPORTED')
    const spec = compileLiteralPolicy(source, replayHash(source)),
      fake = harness(spec)
    delete fake.current.command
    await expect(inspectLiteralPolicy(fake, spec)).rejects.toThrow(
      'REPLAY_POLICY_CATALOG_ROW_INVALID',
    )
  })
})
