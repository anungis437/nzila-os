import { ProvisioningError } from './governed-provisioning'
import { replayDigest } from './post-w4p-replay'
import { Cursor } from './replay-structural-effects'
import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import { createCatalogQueries } from './replay-create-inspection'
import { rlsPrimitiveQueries } from './replay-rls-primitives'
import type { CatalogReader } from './platform-baseline-promotion'
type Expression =
  | { kind: 'BOOLEAN'; value: boolean }
  | { kind: 'COLUMN'; name: string }
  | { kind: 'STRING'; value: string }
  | { kind: 'CAST_TEXT'; value: Expression }
  | { kind: 'CURRENT_SETTING'; key: string; missingOk: boolean }
  | { kind: 'EQUAL'; left: Expression; right: Expression }
  | { kind: 'IS_NOT_NULL'; value: Expression }
  | { kind: 'AND'; values: Expression[] }
function requireCondition(value: unknown, code: string): asserts value {
  if (!value) throw new ProvisioningError(code)
}
class ExpressionReader {
  index = 0
  constructor(readonly tokens: ReturnType<typeof sqlTokens>) {}
  take(value: string) {
    const token = this.tokens[this.index]
    if (
      !token ||
      token.value.toUpperCase() !== value ||
      token.kind !== (/^[A-Z_]+$/.test(value) ? 'WORD' : 'SYMBOL')
    )
      return false
    this.index++
    return true
  }
  require(value: string) {
    requireCondition(this.take(value), 'REPLAY_POLICY_EXPRESSION_UNSUPPORTED')
  }
  expression(): Expression {
    const values = [this.comparison()]
    while (this.take('AND')) values.push(this.comparison())
    const flattened = values.flatMap((value) => (value.kind === 'AND' ? value.values : [value]))
    return flattened.length === 1 ? flattened[0] : { kind: 'AND', values: flattened }
  }
  comparison(): Expression {
    const left = this.primary()
    if (this.take('=')) return { kind: 'EQUAL', left, right: this.primary() }
    if (this.take('IS')) {
      this.require('NOT')
      this.require('NULL')
      return { kind: 'IS_NOT_NULL', value: left }
    }
    return left
  }
  primary(): Expression {
    let value: Expression
    if (this.take('(')) {
      value = this.expression()
      this.require(')')
    } else {
      const token = this.tokens[this.index++]
      requireCondition(token, 'REPLAY_POLICY_EXPRESSION_UNSUPPORTED')
      if (token.kind === 'STRING') value = { kind: 'STRING', value: token.value }
      else if (token.kind === 'WORD' && ['TRUE', 'FALSE'].includes(token.value.toUpperCase()))
        value = { kind: 'BOOLEAN', value: token.value.toUpperCase() === 'TRUE' }
      else {
        requireCondition(
          token.kind === 'WORD' || token.kind === 'IDENTIFIER',
          'REPLAY_POLICY_EXPRESSION_UNSUPPORTED',
        )
        let name = token.kind === 'WORD' ? token.value.toLowerCase() : token.value
        let qualified = false
        if (this.take('.')) {
          qualified = true
          requireCondition(name === 'pg_catalog', 'REPLAY_POLICY_EXPRESSION_UNSUPPORTED')
          const member = this.tokens[this.index++]
          requireCondition(
            member && ['WORD', 'IDENTIFIER'].includes(member.kind),
            'REPLAY_POLICY_EXPRESSION_UNSUPPORTED',
          )
          name = member.kind === 'WORD' ? member.value.toLowerCase() : member.value
        }
        if (this.take('(')) {
          requireCondition(name === 'current_setting', 'REPLAY_POLICY_EXPRESSION_UNSUPPORTED')
          const key = this.primary()
          const literal = key.kind === 'CAST_TEXT' ? key.value : key
          requireCondition(literal.kind === 'STRING', 'REPLAY_POLICY_EXPRESSION_UNSUPPORTED')
          this.require(',')
          const missing = this.primary()
          requireCondition(missing.kind === 'BOOLEAN', 'REPLAY_POLICY_EXPRESSION_UNSUPPORTED')
          this.require(')')
          value = { kind: 'CURRENT_SETTING', key: literal.value, missingOk: missing.value }
        } else {
          requireCondition(!qualified, 'REPLAY_POLICY_EXPRESSION_UNSUPPORTED')
          value = { kind: 'COLUMN', name }
        }
      }
    }
    while (this.take(':')) {
      this.require(':')
      let type = this.tokens[this.index++]
      requireCondition(
        type && ['WORD', 'IDENTIFIER'].includes(type.kind),
        'REPLAY_POLICY_EXPRESSION_UNSUPPORTED',
      )
      if (type.value === 'pg_catalog' && this.take('.')) type = this.tokens[this.index++]
      requireCondition(type?.value === 'text', 'REPLAY_POLICY_EXPRESSION_UNSUPPORTED')
      value = { kind: 'CAST_TEXT', value }
    }
    return value
  }
}
export function policyExpression(expression: string): Expression {
  const reader = new ExpressionReader(sqlTokens(expression))
  const value = reader.expression()
  requireCondition(reader.index === reader.tokens.length, 'REPLAY_POLICY_EXPRESSION_UNSUPPORTED')
  return value
}
function booleanPolicyExpression(value: Expression): boolean {
  if (value.kind === 'BOOLEAN') return true
  if (value.kind === 'AND') return value.values.every(booleanPolicyExpression)
  if (value.kind === 'IS_NOT_NULL') return value.value.kind === 'COLUMN'
  if (value.kind === 'EQUAL') {
    const column = value.left.kind === 'CAST_TEXT' ? value.left.value : value.left
    return column.kind === 'COLUMN' && value.right.kind === 'CURRENT_SETTING'
  }
  return false
}
export function compileLiteralPolicy(source: string, sourceHash: string) {
  const cursor = new Cursor(source, sourceHash)
  cursor.word('CREATE')
  cursor.word('POLICY')
  const name = cursor.identifier()
  cursor.word('ON')
  const table = cursor.relation()
  cursor.word('FOR')
  const command = cursor.identifier().toUpperCase()
  requireCondition(
    ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'].includes(command),
    'REPLAY_POLICY_COMMAND_UNSUPPORTED',
  )
  cursor.word('TO')
  const roles = [cursor.identifier()]
  while (cursor.tokens[cursor.index]?.value === ',') {
    cursor.symbol(',')
    roles.push(cursor.identifier())
  }
  const expression = () => {
    cursor.symbol('(')
    const start = cursor.index
    let depth = 1
    while (cursor.index < cursor.tokens.length && depth) {
      const token = cursor.tokens[cursor.index++]
      if (token.kind === 'SYMBOL' && token.value === '(') depth++
      if (token.kind === 'SYMBOL' && token.value === ')') depth--
    }
    requireCondition(
      depth === 0 && cursor.index > start + 1,
      'REPLAY_POLICY_EXPRESSION_UNSUPPORTED',
    )
    const tokens = cursor.tokens.slice(start, cursor.index - 1),
      reader = new ExpressionReader(tokens)
    const value = reader.expression()
    requireCondition(reader.index === tokens.length, 'REPLAY_POLICY_EXPRESSION_UNSUPPORTED')
    return value
  }
  let using: Expression | null = null,
    check: Expression | null = null
  if (cursor.optionalWord('USING')) using = expression()
  if (cursor.optionalWord('WITH')) {
    cursor.word('CHECK')
    check = expression()
  }
  cursor.finish()
  requireCondition(
    (!using || booleanPolicyExpression(using)) && (!check || booleanPolicyExpression(check)),
    'REPLAY_POLICY_EXPRESSION_UNSUPPORTED',
  )
  requireCondition(
    new Set(roles).size === roles.length &&
      (using || check) &&
      !(['SELECT', 'DELETE'].includes(command) && check) &&
      !(command === 'INSERT' && using),
    'REPLAY_POLICY_CLAUSES_UNSUPPORTED',
  )
  const body = {
    schema: table.schema,
    table: table.name,
    name,
    command,
    roles: roles.sort(),
    using,
    check,
    permissive: true,
    sourceHash,
  }
  return { ...body, contractDigest: replayDigest(body) }
}
export const literalPolicyQueries = {
  uuidOutput: `SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_type t
    JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
    JOIN pg_catalog.pg_proc p ON p.oid=t.typoutput
    JOIN pg_catalog.pg_namespace pn ON pn.oid=p.pronamespace
    JOIN pg_catalog.pg_language l ON l.oid=p.prolang
    WHERE n.nspname='pg_catalog' AND t.typname='uuid' AND pn.nspname='pg_catalog'
      AND p.proname='uuid_out' AND l.lanname='internal'
      AND pg_catalog.has_function_privilege(p.oid,'EXECUTE')) AS builtin`,
  policy: `SELECT p.polname AS name,p.polname=$3 AS name_matches,p.polcmd AS command,p.polpermissive AS permissive,
    (SELECT pg_catalog.json_agg(CASE WHEN r.oid=0 THEN 'public' ELSE role.rolname END ORDER BY CASE WHEN r.oid=0 THEN 'public' ELSE role.rolname END)
      FROM pg_catalog.unnest(p.polroles) r(oid) LEFT JOIN pg_catalog.pg_roles role ON role.oid=r.oid) AS roles,
    pg_catalog.pg_get_expr(p.polqual,p.polrelid) AS using_expression,pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid) AS check_expression
    FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=$1 AND c.relname=$2 AND p.polname=$3`,
  role: 'SELECT rolname AS name FROM pg_catalog.pg_roles WHERE rolname=$1',
  setting: `SELECT n.nspname AS schema,p.proname AS name,l.lanname AS language,t.typname AS result,p.provolatile AS volatility,
    pg_catalog.has_function_privilege(p.oid,'EXECUTE') AS executable,
    EXISTS(SELECT 1 FROM pg_catalog.pg_operator op JOIN pg_catalog.pg_namespace ons ON ons.oid=op.oprnamespace
      JOIN pg_catalog.pg_proc fn ON fn.oid=op.oprcode JOIN pg_catalog.pg_namespace fns ON fns.oid=fn.pronamespace
      JOIN pg_catalog.pg_language lang ON lang.oid=fn.prolang
      WHERE op.oid=pg_catalog.to_regoperator('=(text,text)') AND ons.nspname='pg_catalog' AND fns.nspname='pg_catalog'
        AND fn.proname='texteq' AND lang.lanname='internal') AS text_operator_builtin
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang
    JOIN pg_catalog.pg_type t ON t.oid=p.prorettype WHERE p.oid=pg_catalog.to_regprocedure('current_setting(text,boolean)')`,
}
function row(value: unknown): Record<string, unknown> {
  requireCondition(
    value && typeof value === 'object' && !Array.isArray(value),
    'REPLAY_POLICY_CATALOG_ROW_INVALID',
  )
  return Object.fromEntries(Object.entries(value))
}
function columns(expression: Expression | null): string[] {
  if (!expression) return []
  if (expression.kind === 'COLUMN') return [expression.name]
  if (expression.kind === 'CAST_TEXT' || expression.kind === 'IS_NOT_NULL')
    return columns(expression.value)
  if (expression.kind === 'EQUAL')
    return [...columns(expression.left), ...columns(expression.right)]
  if (expression.kind === 'AND') return expression.values.flatMap(columns)
  return []
}
function normalize(
  expression: Expression | null,
  types: ReadonlyMap<string, string>,
): Expression | null {
  if (!expression) return null
  if (expression.kind === 'COLUMN' && types.get(expression.name) === 'varchar')
    return { kind: 'CAST_TEXT', value: expression }
  if (expression.kind === 'CAST_TEXT') {
    if (expression.value.kind === 'COLUMN')
      return types.get(expression.value.name) === 'text' ? expression.value : expression
    if (expression.value.kind === 'STRING') return expression.value
    return expression
  }
  if (expression.kind === 'EQUAL')
    return {
      ...expression,
      left: normalize(expression.left, types)!,
      right: normalize(expression.right, types)!,
    }
  if (expression.kind === 'AND')
    return { ...expression, values: expression.values.map((value) => normalize(value, types)!) }
  return expression
}
function typedPolicy(value: Expression | null, types: ReadonlyMap<string, string>): boolean {
  if (!value || value.kind === 'BOOLEAN') return true
  if (value.kind === 'AND') return value.values.every((entry) => typedPolicy(entry, types))
  if (value.kind === 'IS_NOT_NULL') return value.value.kind === 'COLUMN'
  if (value.kind !== 'EQUAL' || value.right.kind !== 'CURRENT_SETTING') return false
  if (value.left.kind === 'CAST_TEXT')
    return value.left.value.kind === 'COLUMN' && types.has(value.left.value.name)
  return (
    value.left.kind === 'COLUMN' && ['text', 'varchar'].includes(types.get(value.left.name) ?? '')
  )
}
function needsUuidOutput(value: Expression | null, types: ReadonlyMap<string, string>): boolean {
  if (!value) return false
  if (value.kind === 'AND') return value.values.some((entry) => needsUuidOutput(entry, types))
  return (
    value.kind === 'EQUAL' &&
    value.left.kind === 'CAST_TEXT' &&
    value.left.value.kind === 'COLUMN' &&
    types.get(value.left.value.name) === 'uuid'
  )
}
export async function inspectLiteralPolicy(
  reader: CatalogReader,
  spec: ReturnType<typeof compileLiteralPolicy>,
) {
  const observe = (
    definition: 'EXACT' | 'ABSENT' | 'DRIFTED' | 'PRECONDITION_MISSING',
    data: unknown,
  ) => ({
    definition,
    stateDigest: replayDigest({ contractDigest: spec.contractDigest, definition, data }),
  })
  const tables = await reader.query(rlsPrimitiveQueries.table, [spec.schema, spec.table])
  requireCondition(tables.length <= 1, 'REPLAY_POLICY_CATALOG_CARDINALITY_INVALID')
  if (!tables.length) return observe('PRECONDITION_MISSING', { table: null })
  const table = row(tables[0])
  requireCondition(
    typeof table.kind === 'string' && typeof table.standalone === 'boolean',
    'REPLAY_POLICY_CATALOG_ROW_INVALID',
  )
  if (table.kind !== 'r' || !table.standalone) return observe('DRIFTED', { table })
  for (const role of spec.roles) {
    if (role === 'public') continue
    const roles = await reader.query(literalPolicyQueries.role, [role])
    requireCondition(roles.length <= 1, 'REPLAY_POLICY_CATALOG_CARDINALITY_INVALID')
    if (!roles.length) return observe('PRECONDITION_MISSING', { role: null })
    requireCondition(row(roles[0]).name === role, 'REPLAY_POLICY_CATALOG_ROW_INVALID')
  }
  const ownedNames = new Set([...columns(spec.using), ...columns(spec.check)])
  const types = new Map<string, string>()
  if (ownedNames.size) {
    const rows = (await reader.query(createCatalogQueries.columns, [spec.schema, spec.table])).map(
      row,
    )
    for (const name of ownedNames) {
      const matches = rows.filter((entry) => entry.name === name)
      requireCondition(matches.length <= 1, 'REPLAY_POLICY_CATALOG_CARDINALITY_INVALID')
      if (!matches.length) return observe('PRECONDITION_MISSING', { column: name })
      const actual = matches[0]
      requireCondition(
        typeof actual.type_schema === 'string' && typeof actual.type_name === 'string',
        'REPLAY_POLICY_CATALOG_ROW_INVALID',
      )
      requireCondition(typeof actual.type_kind === 'string', 'REPLAY_POLICY_CATALOG_ROW_INVALID')
      if (
        actual.type_schema !== 'pg_catalog' ||
        actual.type_kind !== 'b' ||
        !['text', 'varchar', 'uuid'].includes(actual.type_name)
      )
        return observe('DRIFTED', { column: actual })
      types.set(name, actual.type_name)
    }
    if (!typedPolicy(spec.using, types) || !typedPolicy(spec.check, types))
      return observe('PRECONDITION_MISSING', { comparisonTypes: [...types] })
    if (needsUuidOutput(spec.using, types) || needsUuidOutput(spec.check, types)) {
      const uuid = await reader.query(literalPolicyQueries.uuidOutput, [])
      requireCondition(
        uuid.length === 1 && typeof row(uuid[0]).builtin === 'boolean',
        'REPLAY_POLICY_CATALOG_ROW_INVALID',
      )
      if (!row(uuid[0]).builtin) return observe('PRECONDITION_MISSING', { uuid })
    }
    const settings = await reader.query(literalPolicyQueries.setting, [])
    requireCondition(settings.length <= 1, 'REPLAY_POLICY_CATALOG_CARDINALITY_INVALID')
    if (!settings.length) return observe('PRECONDITION_MISSING', { setting: null })
    const setting = row(settings[0])
    requireCondition(
      typeof setting.schema === 'string' &&
        typeof setting.name === 'string' &&
        typeof setting.language === 'string' &&
        typeof setting.result === 'string' &&
        typeof setting.volatility === 'string' &&
        typeof setting.executable === 'boolean' &&
        typeof setting.text_operator_builtin === 'boolean',
      'REPLAY_POLICY_CATALOG_ROW_INVALID',
    )
    if (
      setting.schema !== 'pg_catalog' ||
      setting.name !== 'current_setting' ||
      setting.language !== 'internal' ||
      setting.result !== 'text' ||
      setting.volatility !== 's' ||
      !setting.executable ||
      !setting.text_operator_builtin
    )
      return observe('PRECONDITION_MISSING', { setting })
  }
  const rows = await reader.query(literalPolicyQueries.policy, [spec.schema, spec.table, spec.name])
  requireCondition(rows.length <= 1, 'REPLAY_POLICY_CATALOG_CARDINALITY_INVALID')
  if (!rows.length) return observe('ABSENT', { policy: null })
  const current = row(rows[0])
  requireCondition(
    typeof current.name === 'string' &&
      typeof current.name_matches === 'boolean' &&
      typeof current.command === 'string' &&
      typeof current.permissive === 'boolean' &&
      Array.isArray(current.roles) &&
      current.roles.every((role) => typeof role === 'string') &&
      (current.using_expression === null || typeof current.using_expression === 'string') &&
      (current.check_expression === null || typeof current.check_expression === 'string'),
    'REPLAY_POLICY_CATALOG_ROW_INVALID',
  )
  const commands: Record<string, string> = {
    SELECT: 'r',
    INSERT: 'a',
    UPDATE: 'w',
    DELETE: 'd',
    ALL: '*',
  }
  if (
    !current.name_matches ||
    current.command !== commands[spec.command] ||
    current.permissive !== spec.permissive ||
    replayDigest([...current.roles].sort()) !== replayDigest(spec.roles)
  )
    return observe('DRIFTED', { policy: current })
  const using =
    current.using_expression === null ? null : policyExpression(current.using_expression)
  const check =
    current.check_expression === null ? null : policyExpression(current.check_expression)
  const exact =
    replayDigest(normalize(using, types)) === replayDigest(normalize(spec.using, types)) &&
    replayDigest(normalize(check, types)) === replayDigest(normalize(spec.check, types))
  return observe(exact ? 'EXACT' : 'DRIFTED', { policy: current })
}
