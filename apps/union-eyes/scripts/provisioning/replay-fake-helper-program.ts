import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import type { FakeFunctionRow } from './replay-fake-functions'

export interface FakeHelperNativeType {
  schema: string
  name: string
  kind: string
  /** Needed only for an enum compared to a source literal, not for a text cast. */
  enumLabels?: readonly string[]
}
export interface FakeHelperRelation {
  schema: string
  name: string
  columns: Readonly<Record<string, FakeHelperNativeType>>
}
export interface FakeHelperIdentity {
  schema: string
  name: string
}
/**
 * All facts are observed at the call position. null means known absence;
 * undefined (or an invalid fact) is an error, not an absence.
 * The adapter must resolve functions including actual ACL-visible overloads,
 * effective role memberships and implicit pg_catalog positioning.
 */
export interface FakeHelperEnvironment {
  sourceHash: string
  actor: string
  executionRoles: readonly string[]
  searchPath: readonly string[]
  creationSchema: string
  relation(schema: string, name: string): FakeHelperRelation | null
  resolveFunction(
    name: string,
    argumentTypes: readonly FakeHelperNativeType[],
    searchPath: readonly string[],
  ): FakeHelperIdentity | null
  resolveNative(
    name: string,
    kind: 'function' | 'type' | 'operator',
    searchPath: readonly string[],
  ): FakeHelperIdentity | null
  roleExists(role: string): boolean
  canAlterRelation(relation: FakeHelperIdentity, actor: string): boolean
}
export interface FakeHelperEmission {
  /** Genuine dynamic text; intentionally still unqualified, as in prosrc. */
  sql: string
  actor: string
  target: FakeHelperIdentity
  references: FakeHelperIdentity[]
  action: 'ENABLE_RLS' | 'FORCE_RLS' | 'DROP_POLICY_IF_EXISTS' | 'CREATE_POLICY'
}
export interface FakeHelperProgram {
  sourceHash: string
  declarationHash: string
  bodyHash: string
  function: FakeHelperIdentity
  actor: string
  searchPath: string[]
  creationSchema: string
  arguments: (string | boolean)[]
  guard: { schema: 'public'; name: string; exists: boolean }
  emissions: FakeHelperEmission[]
}

const hash = (source: string) => createHash('sha256').update(source).digest('hex')
function requireFact(value: unknown, code = 'FAKE_HELPER_GRAMMAR_UNSUPPORTED'): asserts value {
  if (!value) throw new Error(code)
}
function record(value: unknown): Record<string, unknown> {
  requireFact(value !== null && typeof value === 'object' && !Array.isArray(value))
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  requireFact(typeof value === 'string')
  return value
}
type NativeValue = string | boolean
class Reader {
  readonly tokens: ReturnType<typeof sqlTokens>
  at = 0
  constructor(source: string) {
    this.tokens = sqlTokens(source)
  }
  take(value: string) {
    const token = this.tokens[this.at]
    if (
      !token ||
      !['WORD', 'SYMBOL'].includes(token.kind) ||
      token.value.toUpperCase() !== value.toUpperCase()
    )
      return false
    this.at++
    return true
  }
  need(value: string) {
    requireFact(this.take(value))
  }
  id() {
    const token = this.tokens[this.at++]
    requireFact(token && ['WORD', 'IDENTIFIER'].includes(token.kind))
    return token.kind === 'WORD' ? token.value.toLowerCase() : token.value
  }
  literal(): NativeValue {
    const token = this.tokens[this.at++]
    requireFact(token)
    if (token.kind === 'STRING') return token.value
    requireFact(token.kind === 'WORD' && /^(TRUE|FALSE)$/i.test(token.value))
    return token.value.toUpperCase() === 'TRUE'
  }
  end() {
    requireFact(this.at === this.tokens.length)
  }
}

// Commitments bind exact original declarations, not compiler-generated policies.
const declarationPins = new Set([
  '26e5da2582e5551b783139655ab3661dd50f2aee5a9c4e3e1e1fcaa32cb0aafc',
  '313db29acf9a0e7607b21dbfadf89db809d6de96dd6f22fc163e462ef71a947a',
  '2e2de4e7146ad38106ef53c0d9d4f8bf2ec6f592d03090e8d7709cbc7d9df79c',
  '1f39fcc40dd5623751f10fd3f6e3582d3974127785d089c0091bda1a84a22d63',
  'be2477088d8e3646bff52109dd9429ea9a0c9aa756856f6ec92ebd7ec74d7380',
  '4bdce242354041811bce7373bb8ecb4faa9934d5775019d3486dccfc98e46322',
  '5c98ad7a42a5b12dd927efbd9b039ec91f87a236de371cd25cef175efdcf6073',
  '25c59a9fc641970fbeb8b068f668cd74dda360c9ab56e09e7225b19a5ca2a70d',
  '4c2d9b9d3fab023a374e9b1678638b80f65bd5df4d21adf0e27d78a28d4a9940',
  'da3089587f744df71c9f740364c9e46cf490b53e2b8c6b1f15ad0c5ef4f3c74d',
])
interface Declaration {
  name: string
  hash: string
  body: string
  names: string[]
  types: FakeHelperNativeType[]
  defaults: NativeValue[]
}
let declarations: Declaration[] | undefined
function frozenDeclarations(): Declaration[] {
  if (declarations) return declarations
  const bytes = readFileSync(
    new URL(
      '../../../../docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json',
      import.meta.url,
    ),
    'utf8',
  )
  requireFact(
    hash(bytes) === '41ff4487e83c831dd94c6dbc50a2fe48de3f26af6b3c31453a188e975e423787',
    'FAKE_HELPER_LEDGER_DRIFT',
  )
  const ledger = record(JSON.parse(bytes))
  requireFact(Array.isArray(ledger.BOUNDARIES))
  const result: Declaration[] = []
  for (const boundary of ledger.BOUNDARIES) {
    const effects = record(boundary).EFFECTS
    requireFact(Array.isArray(effects))
    for (const entry of effects) {
      const effect = record(entry)
      if (!declarationPins.has(text(effect.EXACT_EFFECT_SHA256))) continue
      const source = text(record(effect.COMPARATOR).EXACT_SOURCE_SEMANTICS)
      requireFact(hash(source) === effect.EXACT_EFFECT_SHA256, 'FAKE_HELPER_SOURCE_DRIFT')
      const start = source.indexOf('$$'),
        end = source.indexOf('$$', start + 2)
      requireFact(start >= 0 && end > start)
      const r = new Reader(source.slice(0, start))
      r.need('CREATE')
      r.need('OR')
      r.need('REPLACE')
      r.need('FUNCTION')
      const name = r.id()
      r.need('(')
      const names: string[] = [],
        types: FakeHelperNativeType[] = [],
        defaults: NativeValue[] = []
      do {
        if (names.length) r.need(',')
        names.push(r.id())
        const type = r.id()
        requireFact(type === 'text' || type === 'boolean')
        types.push({ schema: 'pg_catalog', name: type === 'boolean' ? 'bool' : 'text', kind: 'b' })
        if (r.take('DEFAULT')) defaults.push(r.literal())
        else requireFact(defaults.length === 0)
      } while (r.tokens[r.at]?.value === ',')
      r.need(')')
      r.need('RETURNS')
      r.need('VOID')
      r.need('AS')
      r.end()
      const suffix = new Reader(source.slice(end + 2))
      suffix.need('LANGUAGE')
      suffix.need('plpgsql')
      suffix.need(';')
      suffix.end()
      result.push({
        name,
        hash: hash(source),
        body: source.slice(start + 2, end),
        names,
        types,
        defaults,
      })
    }
  }
  requireFact(result.length === 10 && new Set(result.map((d) => d.name)).size === 10)
  declarations = result
  return result
}

const sameType = (a: FakeHelperNativeType, b: FakeHelperNativeType) =>
  a.schema === b.schema && a.name === b.name && a.kind === b.kind
const nativeType = (name: string): FakeHelperNativeType => ({
  schema: 'pg_catalog',
  name,
  kind: 'b',
})
function native(env: FakeHelperEnvironment, name: string, kind: 'function' | 'type' | 'operator') {
  const resolved = env.resolveNative(name, kind, env.searchPath)
  requireFact(
    resolved?.schema === 'pg_catalog' && resolved.name === name,
    'FAKE_HELPER_NATIVE_BINDING_DENIED',
  )
}
function identifier(value: string) {
  requireFact(value.length > 0 && !value.includes('\0'), 'FAKE_HELPER_IDENTIFIER_INVALID')
  requireFact(
    Buffer.byteLength(value, 'utf8') <= 63,
    'FAKE_HELPER_IDENTIFIER_TRUNCATION_UNSUPPORTED',
  )
  return value
}
// Non-unreserved PostgreSQL keywords used by quote_identifier. Unreserved
// keywords (for example policy, public, text) must NOT be needlessly quoted.
const quotedKeywords = new Set(
  `all analyse analyze and any array as asc asymmetric authorization between
  bigint binary bit boolean both case cast char character check coalesce collate
  collation column concurrently constraint create cross current_catalog
  current_date current_role current_schema current_time current_timestamp
  current_user dec decimal default deferrable desc distinct do else end except
  exists extract false fetch float for foreign freeze from full grant greatest
  group grouping having ilike in initially inner inout int integer intersect
  interval into is isnull join json_array json_arrayagg json_exists json_object
  json_objectagg json_query json_scalar json_serialize json_table json_value
  lateral leading least left like limit localtime localtimestamp national natural
  nchar none normalize not notnull null nullif numeric offset on only or order
  out outer overlaps overlay placing position precision primary real references
  returning right row select session_user setof similar smallint some substring
  symmetric table tablesample then time timestamp to trailing treat trim true
  union unique user using values varchar variadic verbose when where window with
  xmlattributes xmlconcat xmlelement xmlexists xmlforest xmlnamespaces xmlparse
  xmlpi xmlroot xmlserialize xmltable`
    .split(/\s+/)
    .filter(Boolean),
)
/**
 * The frozen programs use only %I, %s, %L and %%. Positional/width directives,
 * null arguments, identifier truncation and non-text coercion are unsupported.
 */
export function formatFakeHelperSql(template: string, values: readonly NativeValue[]): string {
  let at = 0
  const sql = template.replace(/%([\s\S]?)/g, (_match, specifier: string) => {
    if (specifier === '%') return '%'
    requireFact(['I', 'L', 's'].includes(specifier), 'FAKE_HELPER_FORMAT_UNSUPPORTED')
    requireFact(at < values.length, 'FAKE_HELPER_FORMAT_ARGUMENT_MISSING')
    const value = values[at++]
    requireFact(
      typeof value === 'string' && !value.includes('\0'),
      'FAKE_HELPER_FORMAT_TYPE_DENIED',
    )
    if (specifier === 'I') {
      identifier(value)
      return /^[a-z_][a-z0-9_$]*$/.test(value) && !quotedKeywords.has(value)
        ? value
        : `"${value.replaceAll('"', '""')}"`
    }
    if (specifier === 'L') {
      const quoted = value.replaceAll("'", "''")
      return value.includes('\\') ? `E'${quoted.replaceAll('\\', '\\\\')}'` : `'${quoted}'`
    }
    return value
  })
  requireFact(at === values.length, 'FAKE_HELPER_FORMAT_ARGUMENT_EXCESS')
  return sql
}
function valueExpression(r: Reader, variables: ReadonlyMap<string, NativeValue>): NativeValue {
  let result: NativeValue
  if (r.tokens[r.at]?.kind === 'STRING') result = r.literal()
  else {
    const name = r.id()
    requireFact(variables.has(name), 'FAKE_HELPER_VARIABLE_UNKNOWN')
    result = variables.get(name)!
  }
  while (r.take('|')) {
    r.need('|')
    const right = valueExpression(r, variables)
    requireFact(typeof result === 'string' && typeof right === 'string')
    result += right
  }
  return result
}
function formatExpression(r: Reader, variables: ReadonlyMap<string, NativeValue>): string {
  r.need('format')
  r.need('(')
  const template = valueExpression(r, variables),
    args: NativeValue[] = []
  requireFact(typeof template === 'string')
  while (r.take(',')) args.push(valueExpression(r, variables))
  r.need(')')
  return formatFakeHelperSql(template, args)
}
function physical(
  env: FakeHelperEnvironment,
  schema: string,
  name: string,
): FakeHelperRelation | null {
  const relation = env.relation(schema, name)
  requireFact(
    relation === null || (relation && typeof relation === 'object'),
    'FAKE_HELPER_FACT_UNKNOWN',
  )
  if (relation) {
    requireFact(
      relation.schema === schema && relation.name === name && relation.columns,
      'FAKE_HELPER_RELATION_FACT_INVALID',
    )
  }
  return relation
}
function resolveRelation(env: FakeHelperEnvironment, name: string): FakeHelperRelation {
  identifier(name)
  for (const schema of env.searchPath) {
    const relation = physical(env, schema, name)
    if (relation) return relation
  }
  throw new Error('FAKE_HELPER_RELATION_UNRESOLVED')
}
function column(relation: FakeHelperRelation, name: string): FakeHelperNativeType {
  requireFact(Object.hasOwn(relation.columns, name), 'FAKE_HELPER_COLUMN_MISSING')
  const type = relation.columns[name]
  requireFact(
    type &&
      ((type.schema === 'pg_catalog' &&
        type.kind === 'b' &&
        ['text', 'uuid', '_uuid', 'int4', 'int8', 'bool', 'varchar'].includes(type.name)) ||
        (type.kind === 'e' && type.schema.length > 0 && type.name.length > 0)),
    'FAKE_HELPER_COLUMN_TYPE_UNSUPPORTED',
  )
  return type
}
type ExpressionType = FakeHelperNativeType | 'unknown-string'
/**
 * Type-check the emitted closed policy expression grammar against physical
 * columns, resolving every FROM through the same effective invocation path.
 * This does not evaluate RLS against data, roles, session settings or rows.
 */
class PolicyExpressionReader {
  constructor(
    readonly r: Reader,
    readonly env: FakeHelperEnvironment,
    readonly target: FakeHelperRelation,
    readonly aliases: ReadonlyMap<string, FakeHelperRelation>,
    readonly references: FakeHelperIdentity[],
  ) {}
  boolean(type: ExpressionType) {
    requireFact(
      type !== 'unknown-string' && sameType(type, nativeType('bool')),
      'FAKE_HELPER_TYPE_DENIED',
    )
  }
  expression(): ExpressionType {
    let result = this.comparison()
    while (this.r.take('AND') || this.r.take('OR')) {
      this.boolean(result)
      this.boolean(this.comparison())
      result = nativeType('bool')
    }
    return result
  }
  comparison(): ExpressionType {
    const left = this.primary()
    if (this.r.take('=')) {
      const right = this.primary()
      native(this.env, '=', 'operator')
      const acceptsPublicLiteral = (type: ExpressionType) =>
        type === 'unknown-string' ||
        (type.schema === 'pg_catalog' && ['text', 'varchar'].includes(type.name)) ||
        (type.kind === 'e' && type.enumLabels?.includes('public') === true)
      requireFact(
        left === 'unknown-string'
          ? acceptsPublicLiteral(right)
          : right === 'unknown-string'
            ? acceptsPublicLiteral(left)
            : sameType(left, right) ||
              (left.schema === 'pg_catalog' &&
                right.schema === 'pg_catalog' &&
                ['text', 'varchar'].includes(left.name) &&
                ['text', 'varchar'].includes(right.name)),
        'FAKE_HELPER_TYPE_DENIED',
      )
      return nativeType('bool')
    }
    if (this.r.take('IS')) {
      this.r.need('NULL')
      return nativeType('bool')
    }
    return left
  }
  primary(): ExpressionType {
    const r = this.r
    let type: ExpressionType
    if (r.take('(')) {
      type = this.expression()
      r.need(')')
    } else if (r.take('EXISTS')) {
      r.need('(')
      r.need('SELECT')
      r.need('1')
      r.need('FROM')
      const relation = resolveRelation(this.env, r.id())
      this.references.push({ schema: relation.schema, name: relation.name })
      const alias = r.id(),
        aliases = new Map(this.aliases)
      requireFact(!aliases.has(alias), 'FAKE_HELPER_ALIAS_UNSUPPORTED')
      aliases.set(alias, relation)
      r.need('WHERE')
      const nested = new PolicyExpressionReader(r, this.env, this.target, aliases, this.references)
      nested.boolean(nested.expression())
      r.need(')')
      type = nativeType('bool')
    } else if (r.take('ANY')) {
      r.need('(')
      const array = this.primary()
      requireFact(
        array !== 'unknown-string' && sameType(array, nativeType('_uuid')),
        'FAKE_HELPER_TYPE_DENIED',
      )
      r.need(')')
      type = nativeType('uuid')
    } else if (r.take('current_setting')) {
      native(this.env, 'current_setting', 'function')
      r.need('(')
      const key = r.literal()
      requireFact(key === 'app.current_org_id' || key === 'app.current_user_id')
      r.need(',')
      requireFact(r.literal() === true)
      r.need(')')
      type = nativeType('text')
    } else if (r.tokens[r.at]?.kind === 'STRING') {
      requireFact(r.literal() === 'public')
      type = 'unknown-string'
    } else if (r.take('TRUE') || r.take('FALSE')) {
      type = nativeType('bool')
    } else {
      let name = r.id(),
        relation = this.target
      if (r.take('.')) {
        requireFact(this.aliases.has(name), 'FAKE_HELPER_COLUMN_QUALIFIER_UNKNOWN')
        relation = this.aliases.get(name)!
        name = r.id()
      }
      type = column(relation, name)
    }
    if (r.take(':')) {
      r.need(':')
      const cast = r.id()
      requireFact(cast === 'text' || cast === 'uuid')
      native(this.env, cast, 'type')
      requireFact(
        cast === 'text' ||
          type === 'unknown-string' ||
          (type.schema === 'pg_catalog' && ['text', 'varchar', 'uuid'].includes(type.name)),
        'FAKE_HELPER_TYPE_DENIED',
      )
      type = nativeType(cast)
    }
    return type
  }
}
function emission(sql: string, env: FakeHelperEnvironment): FakeHelperEmission {
  const r = new Reader(sql)
  let action: FakeHelperEmission['action'], target: FakeHelperRelation
  const references: FakeHelperIdentity[] = []
  if (r.take('ALTER')) {
    r.need('TABLE')
    target = resolveRelation(env, r.id())
    if (r.take('ENABLE')) action = 'ENABLE_RLS'
    else {
      r.need('FORCE')
      action = 'FORCE_RLS'
    }
    r.need('ROW')
    r.need('LEVEL')
    r.need('SECURITY')
  } else if (r.take('DROP')) {
    r.need('POLICY')
    r.need('IF')
    r.need('EXISTS')
    r.id()
    r.need('ON')
    target = resolveRelation(env, r.id())
    action = 'DROP_POLICY_IF_EXISTS'
  } else {
    r.need('CREATE')
    r.need('POLICY')
    r.id()
    r.need('ON')
    target = resolveRelation(env, r.id())
    r.need('FOR')
    requireFact(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'].some((value) => r.take(value)))
    r.need('TO')
    requireFact(env.roleExists(r.id()) === true, 'FAKE_HELPER_POLICY_ROLE_MISSING')
    const expression = new PolicyExpressionReader(
      r,
      env,
      target,
      new Map([[target.name, target]]),
      references,
    )
    let clauses = 0
    if (r.take('USING')) {
      r.need('(')
      expression.boolean(expression.expression())
      r.need(')')
      clauses++
    }
    if (r.take('WITH')) {
      r.need('CHECK')
      r.need('(')
      expression.boolean(expression.expression())
      r.need(')')
      clauses++
    }
    requireFact(clauses > 0)
    action = 'CREATE_POLICY'
  }
  r.end()
  requireFact(env.canAlterRelation(target, env.actor) === true, 'FAKE_HELPER_INVOKER_OWNER_DENIED')
  return {
    sql,
    actor: env.actor,
    target: { schema: target.schema, name: target.name },
    references,
    action,
  }
}

/**
 * Execute only the ten committed frozen source programs, directly from the
 * resolved stored prosrc. No helper compiler, expected policy rows, completion
 * flags, SQL engine or mutation occurs here. The consumer applies emissions in
 * order, with its own transactional semantics; this result alone is not a
 * proof of execution, boundary recovery or the full 107-boundary programme.
 */
export function interpretFakeHelperCall(
  source: string,
  resolvedFunction: FakeFunctionRow,
  environment: FakeHelperEnvironment,
): FakeHelperProgram {
  const env = environment,
    row = resolvedFunction
  requireFact(hash(source) === env.sourceHash, 'FAKE_HELPER_CALL_SOURCE_DRIFT')
  requireFact(
    typeof env.actor === 'string' &&
      env.actor.length > 0 &&
      Array.isArray(env.executionRoles) &&
      env.executionRoles.includes(env.actor) &&
      Array.isArray(env.searchPath) &&
      env.searchPath.length > 0 &&
      new Set(env.searchPath).size === env.searchPath.length &&
      env.searchPath.every((schema) => typeof schema === 'string' && schema.length > 0) &&
      typeof env.creationSchema === 'string' &&
      env.searchPath.includes(env.creationSchema),
    'FAKE_HELPER_POSITION_CONTEXT_REQUIRED',
  )
  const declaration = frozenDeclarations().find((d) => d.name === row.name && d.body === row.body)
  requireFact(declaration, 'FAKE_HELPER_BODY_IDENTITY_DENIED')
  requireFact(
    row.kind === 'f' &&
      row.language === 'plpgsql' &&
      row.security_definer === false &&
      row.config === null &&
      row.return_schema === 'pg_catalog' &&
      row.return_name === 'void' &&
      row.return_kind === 'p' &&
      row.returns_set === false &&
      row.strict === false &&
      row.volatility === 'v' &&
      row.parallel === 'u' &&
      row.leakproof === false &&
      row.variadic === '0' &&
      row.argument_modes === null &&
      row.all_argument_types === null &&
      row.sql_body_absent === true &&
      row.binary === null &&
      row.argument_count === declaration.types.length &&
      row.argument_types.length === declaration.types.length &&
      row.argument_types.every((type, index) => sameType(type, declaration.types[index])) &&
      JSON.stringify(row.argument_names) === JSON.stringify(declaration.names) &&
      row.default_count === declaration.defaults.length,
    'FAKE_HELPER_FUNCTION_METADATA_DENIED',
  )
  const expectedDefaults = declaration.defaults
    .map((value) =>
      typeof value === 'string' ? `'${value.replaceAll("'", "''")}'::text` : String(value),
    )
    .join(', ')
  requireFact(row.defaults === (expectedDefaults || null), 'FAKE_HELPER_ARGUMENT_DEFAULTS_DENIED')
  requireFact(
    row.acl.some(
      (acl) =>
        acl.privilege === 'EXECUTE' &&
        (acl.grantee === 'PUBLIC' || env.executionRoles.includes(acl.grantee)),
    ),
    'FAKE_HELPER_EXECUTE_DENIED',
  )
  const call = new Reader(source)
  call.need('SELECT')
  const name = call.id()
  requireFact(name === row.name, 'FAKE_HELPER_CALL_IDENTITY_DENIED')
  call.need('(')
  const args: NativeValue[] = []
  if (!call.take(')')) {
    do {
      if (args.length) call.need(',')
      args.push(call.literal())
    } while (call.tokens[call.at]?.value === ',')
    call.need(')')
  }
  call.need(';')
  call.end()
  requireFact(
    args.length >= declaration.types.length - declaration.defaults.length &&
      args.length <= declaration.types.length,
    'FAKE_HELPER_ARGUMENT_ARITY_DENIED',
  )
  while (args.length < declaration.types.length)
    args.push(
      declaration.defaults[args.length - declaration.types.length + declaration.defaults.length],
    )
  requireFact(
    args.every((value, index) =>
      declaration.types[index].name === 'text'
        ? typeof value === 'string'
        : typeof value === 'boolean',
    ),
    'FAKE_HELPER_ARGUMENT_TYPE_DENIED',
  )
  const resolved = env.resolveFunction(name, declaration.types, env.searchPath)
  requireFact(
    resolved?.schema === row.schema && resolved.name === row.name,
    'FAKE_HELPER_FUNCTION_RESOLUTION_DENIED',
  )
  native(env, 'format', 'function')
  native(env, 'to_regclass', 'function')
  const variables = new Map(declaration.names.map((name, index) => [name, args[index]]))
  const program = new Reader(row.body)
  if (program.take('DECLARE')) {
    const variable = program.id()
    requireFact(!variables.has(variable))
    program.need('TEXT')
    program.need(':')
    program.need('=')
    program.need('CASE')
    program.need('WHEN')
    const condition = variables.get(program.id())
    requireFact(typeof condition === 'boolean')
    program.need('THEN')
    const yes = program.literal()
    program.need('ELSE')
    const no = program.literal()
    requireFact(typeof yes === 'string' && typeof no === 'string')
    program.need('END')
    program.need(';')
    variables.set(variable, condition ? yes : no)
  }
  program.need('BEGIN')
  program.need('IF')
  program.need('to_regclass')
  program.need('(')
  // The source probes public explicitly; never reuse it as an execution path.
  program.need('format')
  program.need('(')
  requireFact(program.literal() === 'public.%I')
  program.need(',')
  const guardedName = variables.get(program.id())
  requireFact(typeof guardedName === 'string')
  identifier(guardedName)
  program.need(')')
  program.need(')')
  program.need('IS')
  program.need('NULL')
  program.need('THEN')
  program.need('RAISE')
  program.need('NOTICE')
  requireFact(typeof program.literal() === 'string')
  program.need(',')
  requireFact(variables.has(program.id()))
  program.need(';')
  program.need('RETURN')
  program.need(';')
  program.need('END')
  program.need('IF')
  program.need(';')
  const exists = physical(env, 'public', guardedName) !== null,
    emissions: FakeHelperEmission[] = []
  const result: FakeHelperProgram = {
    sourceHash: env.sourceHash,
    declarationHash: declaration.hash,
    bodyHash: hash(row.body),
    function: { schema: row.schema, name: row.name },
    actor: env.actor,
    searchPath: [...env.searchPath],
    creationSchema: env.creationSchema,
    arguments: args,
    guard: { schema: 'public', name: guardedName, exists },
    emissions,
  }
  // A committed body has been established before reaching the source RETURN.
  // Do not evaluate even a format argument in the unreachable dynamic DDL.
  if (!exists) return result
  while (program.take('EXECUTE')) {
    const sql = formatExpression(program, variables)
    program.need(';')
    emissions.push(emission(sql, env))
  }
  program.need('END')
  program.need(';')
  program.end()
  return result
}
