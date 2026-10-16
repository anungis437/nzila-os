import { readFileSync } from 'node:fs'
import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import { ProvisioningError } from './governed-provisioning'
import { replayDigest, replayHash } from './post-w4p-replay'
import {
  compileFunctionEffect,
  inspectFunctionEffect,
  type FunctionEffect,
  type FunctionPrerequisites,
} from './replay-function-inspection'
import { literalPolicyQueries } from './replay-literal-policy'
import type { CatalogReader } from './platform-baseline-promotion'

/**
 * Offline, position-local components only. Neither compilation nor EXACT proves
 * execution, supersession, a replay boundary, or runtime authority. The caller
 * must establish the position/snapshot and function owner/ACL context separately.
 */
export type HelperExpression =
  | { kind: 'column'; relation: string | null; name: string }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'cast'; type: 'text' | 'uuid'; value: HelperExpression }
  | { kind: 'setting'; key: string; missingOk: true }
  | { kind: 'equal'; left: HelperExpression; right: HelperExpression }
  | { kind: 'and' | 'or'; values: HelperExpression[] }
  | { kind: 'null' | 'any'; value: HelperExpression }
  | { kind: 'exists'; table: string; schema: string | null; alias: string; where: HelperExpression }

export interface FrozenHelperSource {
  effectId: string
  boundaryId: string
  ordinal: number
  source: string
  sourceHash: string
}
export interface HelperPolicy {
  name: string
  command: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL'
  role: string
  permissive: true
  using: HelperExpression | null
  check: HelperExpression | null
}
export interface HelperEffect {
  call: FrozenHelperSource
  function: FunctionEffect
  arguments: (string | boolean)[]
  table: string
  policies: HelperPolicy[]
  contractDigest: string
}
export interface HelperPositionContext {
  effectId: string
  sourceHash: string
  functionHash: string
  /** Independently established replay-position path, not the helper's public existence probe. */
  searchPath: string[]
  executionRole: string
  targetSchema: string
  parentSchemas: Record<string, string>
  function: FunctionPrerequisites
}
const pins = [
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
]
function ensure(value: unknown, code = 'HELPER_GRAMMAR_UNSUPPORTED'): asserts value {
  if (!value) throw new ProvisioningError(code)
}
function object(value: unknown): Record<string, unknown> {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value), 'HELPER_ROW_INVALID')
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  ensure(typeof value === 'string', 'HELPER_ROW_INVALID')
  return value
}
function strings(value: unknown): string[] {
  ensure(Array.isArray(value) && value.every((v) => typeof v === 'string'), 'HELPER_ROW_INVALID')
  return value as string[]
}
function bool(value: unknown): boolean {
  ensure(typeof value === 'boolean', 'HELPER_ROW_INVALID')
  return value
}

/** The ledger has 320 helper calls, plus 14 simple literal CREATE POLICY effects. */
let frozenCache: { calls: FrozenHelperSource[]; functions: FrozenHelperSource[] } | undefined
export function frozenHelperSources(): {
  calls: FrozenHelperSource[]
  functions: FrozenHelperSource[]
} {
  if (frozenCache) return structuredClone(frozenCache)
  const bytes = readFileSync(
    new URL(
      '../../../../docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json',
      import.meta.url,
    ),
    'utf8',
  )
  ensure(
    replayHash(bytes) === '41ff4487e83c831dd94c6dbc50a2fe48de3f26af6b3c31453a188e975e423787',
    'HELPER_LEDGER_HASH_DRIFT',
  )
  const ledger = object(JSON.parse(bytes))
  ensure(Array.isArray(ledger.BOUNDARIES), 'HELPER_LEDGER_INVALID')
  const calls: FrozenHelperSource[] = [],
    functions: FrozenHelperSource[] = []
  for (const boundary of ledger.BOUNDARIES) {
    const b = object(boundary)
    ensure(Array.isArray(b.EFFECTS), 'HELPER_LEDGER_INVALID')
    for (const value of b.EFFECTS) {
      const e = object(value),
        comparator = object(e.COMPARATOR)
      const source = comparator.EXACT_SOURCE_SEMANTICS
      if (typeof source !== 'string') continue
      if (e.EFFECT_CLASS !== 'POLICY_OR_RLS' && e.EFFECT_CLASS !== 'FUNCTION_OR_PROCEDURE') continue
      const tokens = sqlTokens(source)
      const call =
        e.EFFECT_CLASS === 'POLICY_OR_RLS' &&
        tokens[0]?.value.toUpperCase() === 'SELECT' &&
        tokens[1]?.value.startsWith('ue_create_')
      const declaration =
        e.EFFECT_CLASS === 'FUNCTION_OR_PROCEDURE' && pins.includes(text(e.EXACT_EFFECT_SHA256))
      if (!call && !declaration) continue
      ensure(Number.isSafeInteger(e.SOURCE_ORDINAL), 'HELPER_LEDGER_INVALID')
      const entry = {
        effectId: text(e.EFFECT_ID),
        boundaryId: text(e.BOUNDARY_ID),
        ordinal: e.SOURCE_ORDINAL as number,
        source,
        sourceHash: text(e.EXACT_EFFECT_SHA256),
      }
      ensure(replayHash(source) === entry.sourceHash, 'HELPER_SOURCE_HASH_DRIFT')
      ;(call ? calls : functions).push(entry)
    }
  }
  ensure(calls.length === 320 && functions.length === 10, 'HELPER_LEDGER_DENOMINATOR_DRIFT')
  frozenCache = { calls, functions }
  return structuredClone(frozenCache)
}

class Parser {
  tokens: ReturnType<typeof sqlTokens>
  index = 0
  constructor(source: string) {
    this.tokens = sqlTokens(source)
  }
  take(value: string) {
    const t = this.tokens[this.index]
    if (!t || !['WORD', 'SYMBOL'].includes(t.kind) || t.value.toUpperCase() !== value.toUpperCase())
      return false
    this.index++
    return true
  }
  need(value: string) {
    ensure(this.take(value))
  }
  id() {
    const t = this.tokens[this.index++]
    ensure(t && ['WORD', 'IDENTIFIER'].includes(t.kind))
    return t.kind === 'WORD' ? t.value.toLowerCase() : t.value
  }
  literal(): string | boolean {
    const t = this.tokens[this.index++]
    ensure(t)
    if (t.kind === 'STRING') return t.value
    ensure(t.kind === 'WORD' && ['TRUE', 'FALSE'].includes(t.value.toUpperCase()))
    return t.value.toUpperCase() === 'TRUE'
  }
  expression(): HelperExpression {
    return this.junction('or')
  }
  junction(kind: 'or' | 'and'): HelperExpression {
    const values = [kind === 'or' ? this.junction('and') : this.comparison()]
    while (this.take(kind)) values.push(kind === 'or' ? this.junction('and') : this.comparison())
    const flat = values.flatMap((v) => (v.kind === kind ? v.values : [v]))
    return flat.length === 1 ? flat[0] : { kind, values: flat }
  }
  comparison(): HelperExpression {
    const left = this.primary()
    if (this.take('=')) return { kind: 'equal', left, right: this.primary() }
    if (this.take('IS')) {
      this.need('NULL')
      return { kind: 'null', value: left }
    }
    return left
  }
  primary(): HelperExpression {
    let value: HelperExpression
    if (this.take('(')) {
      value = this.expression()
      this.need(')')
    } else if (this.take('EXISTS')) {
      this.need('(')
      this.need('SELECT')
      this.need('1')
      this.need('FROM')
      let table = this.id(),
        schema: string | null = null
      if (this.take('.')) {
        schema = table
        table = this.id()
      }
      this.take('AS')
      const alias = this.id()
      this.need('WHERE')
      value = { kind: 'exists', table, schema, alias, where: this.expression() }
      this.need(')')
    } else if (this.take('ANY')) {
      this.need('(')
      value = { kind: 'any', value: this.expression() }
      this.need(')')
    } else {
      const t = this.tokens[this.index]
      ensure(t)
      if (t.kind === 'STRING') {
        this.index++
        value = { kind: 'string', value: t.value }
      } else if (this.take('TRUE')) value = { kind: 'boolean', value: true }
      else if (this.take('FALSE')) value = { kind: 'boolean', value: false }
      else {
        let name = this.id(),
          relation: string | null = null
        if (this.take('.')) {
          relation = name
          name = this.id()
        }
        if (this.take('(')) {
          ensure(name === 'current_setting' && (relation === null || relation === 'pg_catalog'))
          const key = this.primary()
          const literal = key.kind === 'cast' && key.type === 'text' ? key.value : key
          ensure(literal.kind === 'string')
          this.need(',')
          this.need('TRUE')
          this.need(')')
          value = { kind: 'setting', key: literal.value, missingOk: true }
        } else value = { kind: 'column', relation, name }
      }
    }
    while (this.take(':')) {
      this.need(':')
      let type = this.id()
      if (this.take('.')) {
        ensure(type === 'pg_catalog')
        type = this.id()
      }
      ensure(type === 'text' || type === 'uuid')
      value = { kind: 'cast', type, value }
    }
    return value
  }
}
export function helperExpression(source: string): HelperExpression {
  const p = new Parser(source),
    result = p.expression()
  ensure(p.index === p.tokens.length)
  return result
}
function quote(value: string) {
  ensure(
    value.length > 0 && Buffer.byteLength(value) <= 63 && !value.includes('\0'),
    'HELPER_IDENTIFIER_INVALID',
  )
  return `"${value.replaceAll('"', '""')}"`
}
function policy(sql: string): HelperPolicy {
  const p = new Parser(sql)
  p.need('CREATE')
  p.need('POLICY')
  const name = p.id()
  p.need('ON')
  p.id()
  p.need('FOR')
  const command = p.id().toUpperCase()
  ensure(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'].includes(command))
  p.need('TO')
  const role = p.id()
  let using: HelperExpression | null = null,
    check: HelperExpression | null = null
  if (p.take('USING')) {
    p.need('(')
    using = p.expression()
    p.need(')')
  }
  if (p.take('WITH')) {
    p.need('CHECK')
    p.need('(')
    check = p.expression()
    p.need(')')
  }
  ensure(p.index === p.tokens.length && (using || check))
  return { name, command: command as HelperPolicy['command'], role, permissive: true, using, check }
}

/**
 * Closed partial evaluator of the ten hash-pinned bodies: literal format strings,
 * concatenation, parameter references, and the exact v_cast declaration. No SQL
 * or PL/pgSQL is executed. Templates are extracted from bodies, not helper names.
 */
export function compilePolicyHelper(
  call: FrozenHelperSource,
  functionSource: FrozenHelperSource,
): HelperEffect {
  const frozen = frozenHelperSources()
  ensure(
    frozen.calls.some((v) => replayDigest(v) === replayDigest(call)),
    'HELPER_CALL_NOT_FROZEN',
  )
  ensure(
    frozen.functions.some((v) => replayDigest(v) === replayDigest(functionSource)),
    'HELPER_BODY_NOT_FROZEN',
  )
  const fn = compileFunctionEffect(functionSource.source, functionSource.sourceHash)
  const p = new Parser(call.source)
  p.need('SELECT')
  ensure(p.id() === fn.name, 'HELPER_FUNCTION_MISMATCH')
  p.need('(')
  const args: (string | boolean)[] = []
  do {
    if (args.length) p.need(',')
    args.push(p.literal())
  } while (p.tokens[p.index]?.value === ',')
  p.need(')')
  p.need(';')
  ensure(p.index === p.tokens.length)
  ensure(args.length <= fn.arguments.length)
  const bindings = new Map<string, string | boolean>()
  fn.arguments.forEach((arg, i) => {
    const value = args[i] ?? arg.default?.value
    ensure(
      value !== undefined && typeof value === (arg.type.name === 'bool' ? 'boolean' : 'string'),
    )
    if (typeof value === 'string') quote(value)
    args[i] = value
    bindings.set(arg.name!, value)
  })
  const body = fn.body!
  const cast = /v_cast TEXT := CASE WHEN (\w+) THEN '' ELSE '::text' END;/.exec(body)
  if (cast) bindings.set('v_cast', bindings.get(cast[1]) ? '' : '::text')
  const statements: string[] = []
  const bodyTokens = sqlTokens(body)
  for (let i = 0; i < bodyTokens.length; i++) {
    if (bodyTokens[i].kind !== 'WORD' || bodyTokens[i].value.toUpperCase() !== 'EXECUTE') continue
    ensure(bodyTokens[++i]?.value === 'format' && bodyTokens[++i]?.value === '(')
    let format = ''
    do {
      const t = bodyTokens[++i]
      ensure(t?.kind === 'STRING')
      format += t.value
      if (bodyTokens[i + 1]?.value !== '|') break
      ensure(bodyTokens[++i]?.value === '|' && bodyTokens[++i]?.value === '|')
    } while (true)
    const values: (string | boolean)[] = []
    while (bodyTokens[i + 1]?.value === ',') {
      i += 2
      const v = bindings.get(bodyTokens[i]?.value)
      ensure(v !== undefined)
      values.push(v)
    }
    ensure(bodyTokens[++i]?.value === ')' && bodyTokens[++i]?.value === ';')
    let used = 0
    const sql = format.replace(/%([Is])/g, (_, mode: string) => {
      const v = values[used++]
      ensure(typeof v === 'string')
      return mode === 'I' ? quote(v) : v
    })
    ensure(used === values.length && !sql.includes('%'))
    statements.push(sql)
  }
  const table = args[0] as string
  ensure(
    statements[0] === `ALTER TABLE ${quote(table)} ENABLE ROW LEVEL SECURITY` &&
      statements[1] === `ALTER TABLE ${quote(table)} FORCE ROW LEVEL SECURITY`,
    'HELPER_RLS_BODY_INVALID',
  )
  const policies = statements.filter((s) => s.startsWith('CREATE POLICY ')).map(policy)
  const drops = statements.filter((s) => s.startsWith('DROP POLICY IF EXISTS '))
  ensure(
    policies.length > 0 &&
      drops.length === policies.length &&
      policies.every((v) => drops.includes(`DROP POLICY IF EXISTS ${v.name} ON ${quote(table)}`)) &&
      statements.length === 2 + policies.length * 2,
    'HELPER_DDL_BODY_INVALID',
  )
  const data = { call, function: fn, arguments: args, table, policies }
  return { ...data, contractDigest: replayDigest(data) }
}

export const helperCatalogQueries = {
  context: `SELECT current_user::text AS role,pg_catalog.current_schemas(true)::text[] AS search_path`,
  relation: `SELECT c.oid::text AS oid,n.nspname AS schema,c.relname AS name,c.relkind AS kind,
    c.relrowsecurity AS enabled,c.relforcerowsecurity AS forced,
    pg_catalog.pg_table_is_visible(c.oid) AS visible,
    (SELECT count(*)::int FROM pg_catalog.pg_inherits WHERE inhrelid=c.oid OR inhparent=c.oid) AS inheritance
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=$1 AND c.relname=$2`,
  column: `SELECT a.attname AS name,n.nspname AS schema,t.typname AS type,t.typtype AS kind,
    t.oid::text AS oid,t.typelem::text AS element,a.attrelid::text AS relation,
    ip.prosrc AS input_body,op.prosrc AS output_body,
    t.typinput::pg_catalog.oid::text AS input_oid,t.typoutput::pg_catalog.oid::text AS output_oid,
    a.attnum::int AS number,a.attcollation::text AS collation
    FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_type t ON t.oid=a.atttypid
    JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
    JOIN pg_catalog.pg_proc ip ON ip.oid=t.typinput JOIN pg_catalog.pg_proc op ON op.oid=t.typoutput
    WHERE a.attrelid=$1::pg_catalog.oid AND a.attname=$2 AND a.attnum>0 AND NOT a.attisdropped`,
  functionResolution: `SELECT p.oid::text AS oid,n.nspname AS schema,p.proname AS name,
    pg_catalog.pg_function_is_visible(p.oid) AS visible,p.proargtypes::text AS argument_oids
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE p.proname=$1 ORDER BY p.oid`,
  builtin: `SELECT p.oid::text AS oid,n.nspname AS schema,p.proname AS name,p.prosrc AS body,
    l.lanname AS language,p.prokind AS kind,p.prosecdef AS definer,p.proconfig AS config,
    p.proargtypes::text AS argument_oids,p.provariadic::text AS variadic,
    pg_catalog.format_type(p.prorettype,NULL) AS result,pg_catalog.pg_function_is_visible(p.oid) AS visible
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    JOIN pg_catalog.pg_language l ON l.oid=p.prolang
    WHERE p.oid=pg_catalog.to_regprocedure('pg_catalog.' || $1)::pg_catalog.oid`,
  overloads: `SELECT p.oid::text AS oid,n.nspname AS schema,p.proname AS name,
    p.proargtypes::text AS argument_oids,p.provariadic::text AS variadic
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE p.proname=$1 AND pg_catalog.pg_function_is_visible(p.oid) ORDER BY p.oid`,
  operator: `SELECT o.oid::text AS oid,n.nspname AS schema,o.oprname AS name,
    o.oprleft::text AS left_type,o.oprright::text AS right_type,o.oprresult::text AS result,
    p.prosrc AS body,l.lanname AS language,pg_catalog.pg_operator_is_visible(o.oid) AS visible,
    p.oid::text AS function_oid,pn.nspname AS function_schema,p.proargtypes::text AS argument_oids,
    p.prorettype::text AS function_result,p.prokind::text AS function_kind,
    p.prosecdef AS definer,p.proconfig AS config
    FROM pg_catalog.pg_operator o JOIN pg_catalog.pg_namespace n ON n.oid=o.oprnamespace
    JOIN pg_catalog.pg_proc p ON p.oid=o.oprcode JOIN pg_catalog.pg_language l ON l.oid=p.prolang
    JOIN pg_catalog.pg_namespace pn ON pn.oid=p.pronamespace
    WHERE o.oprname='=' AND o.oprleft=$1::pg_catalog.oid AND o.oprright=$1::pg_catalog.oid`,
  cast: `SELECT c.castmethod AS method,c.castcontext AS context,c.castfunc::text AS function
    FROM pg_catalog.pg_cast c WHERE c.castsource=$1::pg_catalog.oid AND c.casttarget=$2::pg_catalog.oid`,
  dependencies: `SELECT d.refclassid::pg_catalog.regclass::text AS catalog,d.refobjid::text AS oid,
    d.refobjsubid::int AS subid,d.deptype AS kind
    FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_policy p ON p.oid=d.objid
    WHERE d.classid='pg_catalog.pg_policy'::pg_catalog.regclass AND p.polrelid=$1::pg_catalog.oid
      AND p.polname=$2 ORDER BY d.refclassid,d.refobjid,d.refobjsubid,d.deptype`,
}
type Column = { relation: string; name: string; type: string; oid: string; number: number }
type Resolution = { schema: string; oid: string }
class Denial extends Error {
  constructor(
    readonly definition: 'ABSENT' | 'DRIFTED' | 'PRECONDITION_MISSING',
    message: string,
  ) {
    super(message)
  }
}
function deny(definition: Denial['definition'], message: string): never {
  throw new Denial(definition, message)
}
function visit(value: HelperExpression | null, action: (e: HelperExpression) => void) {
  if (!value) return
  action(value)
  if (value.kind === 'and' || value.kind === 'or') value.values.forEach((v) => visit(v, action))
  else if (value.kind === 'equal') {
    visit(value.left, action)
    visit(value.right, action)
  } else if (value.kind === 'exists') visit(value.where, action)
  else if (value.kind === 'cast' || value.kind === 'any' || value.kind === 'null')
    visit(value.value, action)
}

export async function inspectPolicyHelper(
  reader: CatalogReader,
  spec: HelperEffect,
  context?: HelperPositionContext,
) {
  const evidence: unknown[] = []
  const observation = (definition: 'EXACT' | Denial['definition'], denial: string | null) => ({
    definition,
    denial,
    stateDigest: replayDigest({
      contractDigest: spec.contractDigest,
      context: context ?? null,
      evidence,
      definition,
      denial,
    }),
  })
  try {
    const frozen = frozenHelperSources()
    const source = frozen.functions.find((v) => v.sourceHash === spec.function.sourceHash)
    ensure(
      source && replayDigest(compilePolicyHelper(spec.call, source)) === replayDigest(spec),
      'HELPER_IR_DRIFT',
    )
    if (!context) return observation('PRECONDITION_MISSING', 'POSITION_RESOLUTION_CONTEXT_REQUIRED')
    ensure(
      context.effectId === spec.call.effectId &&
        context.sourceHash === spec.call.sourceHash &&
        context.functionHash === spec.function.sourceHash &&
        context.function.sourceHash === spec.function.sourceHash &&
        strings(context.searchPath).length > 0 &&
        new Set(context.searchPath).size === context.searchPath.length &&
        typeof context.executionRole === 'string' &&
        context.executionRole.length > 0 &&
        typeof context.targetSchema === 'string' &&
        context.targetSchema.length > 0,
      'HELPER_CONTEXT_BINDING_INVALID',
    )
    object(context.parentSchemas)
    const read = async (sql: string, params: string[]) => {
      const rows = await reader.query(sql, params)
      ensure(Array.isArray(rows), 'HELPER_ROW_INVALID')
      evidence.push({ sql, params, rows })
      return rows
    }
    const one = async (sql: string, params: string[], absent = 'CATALOG_PREREQUISITE_MISSING') => {
      const rows = await read(sql, params)
      ensure(rows.length <= 1, 'HELPER_CARDINALITY_INVALID')
      if (!rows.length) deny('PRECONDITION_MISSING', absent)
      return object(rows[0])
    }
    const current = await one(helperCatalogQueries.context, [])
    if (
      text(current.role) !== context.executionRole ||
      replayDigest(strings(current.search_path)) !== replayDigest(context.searchPath)
    )
      deny('PRECONDITION_MISSING', 'POSITION_SEARCH_PATH_OR_ROLE_NOT_ESTABLISHED')
    const functionObservation = await inspectFunctionEffect(
      {
        query: (sql, params) => read(sql, params),
      },
      spec.function,
      context.function,
    )
    evidence.push(functionObservation)
    if (functionObservation.definition !== 'EXACT')
      deny('PRECONDITION_MISSING', 'SOURCE_FUNCTION_DEFINITION_NOT_EXACT')
    const resolutionRows = (
      await read(helperCatalogQueries.functionResolution, [spec.function.name])
    ).map(object)
    for (const row of resolutionRows) {
      ensure(/^\d+$/.test(text(row.oid)), 'HELPER_ROW_INVALID')
      text(row.schema)
      text(row.name)
      bool(row.visible)
      text(row.argument_oids)
    }
    // Unknown-string overloads/defaults can change SELECT resolution. Reject
    // every additional overload, rather than guessing PostgreSQL's winner.
    if (
      resolutionRows.length !== 1 ||
      resolutionRows[0].schema !== context.function.schema ||
      resolutionRows[0].name !== spec.function.name ||
      !resolutionRows[0].visible
    )
      deny('PRECONDITION_MISSING', 'SOURCE_FUNCTION_RESOLUTION_AMBIGUOUS')
    if (
      resolutionRows[0].argument_oids !==
      spec.function.arguments.map((a) => (a.type.name === 'text' ? '25' : '16')).join(' ')
    )
      deny('PRECONDITION_MISSING', 'SOURCE_FUNCTION_SIGNATURE_DRIFT')
    const resolutions = new Map<string, Resolution>()
    const relation = async (name: string, schema: string, target: boolean) => {
      if (!context.searchPath.includes(schema))
        deny('PRECONDITION_MISSING', 'RELATION_SCHEMA_OUTSIDE_POSITION_PATH')
      const row = await one(helperCatalogQueries.relation, [schema, name], 'OWNED_RELATION_MISSING')
      const oid = text(row.oid)
      ensure(
        /^\d+$/.test(oid) &&
          text(row.schema) === schema &&
          text(row.name) === name &&
          Number.isSafeInteger(row.inheritance),
        'HELPER_ROW_INVALID',
      )
      const enabled = bool(row.enabled),
        forced = bool(row.forced),
        visible = bool(row.visible)
      if (text(row.kind) !== 'r' || row.inheritance !== 0) deny('DRIFTED', 'RELATION_SHAPE_DRIFT')
      if (!visible) deny('PRECONDITION_MISSING', 'UNQUALIFIED_RELATION_RESOLUTION_NOT_ESTABLISHED')
      if (target && (!enabled || !forced)) deny('DRIFTED', 'RLS_ENABLE_FORCE_DRIFT')
      resolutions.set(name, { schema, oid })
    }
    await relation(spec.table, context.targetSchema, true)
    // The guard checks public, but the DDL resolves through search_path. Both
    // facts are required; they need not denote the same object.
    if (context.targetSchema !== 'public') {
      const probe = await one(
        helperCatalogQueries.relation,
        ['public', spec.table],
        'PUBLIC_EXISTENCE_GUARD_MISSING',
      )
      ensure(
        text(probe.name) === spec.table && text(probe.schema) === 'public',
        'HELPER_ROW_INVALID',
      )
      text(probe.oid)
    }
    const parentNames = new Set<string>()
    spec.policies.forEach((p) =>
      [p.using, p.check].forEach((e) =>
        visit(e, (v) => {
          if (v.kind === 'exists') parentNames.add(v.table)
        }),
      ),
    )
    ensure(
      Object.keys(context.parentSchemas).sort().join() === [...parentNames].sort().join(),
      'HELPER_CONTEXT_BINDING_INVALID',
    )
    for (const name of parentNames) await relation(name, text(context.parentSchemas[name]), false)
    const columns = new Map<string, Column>()
    const typeIo = new Map<string, { input: string; output: string }>()
    const aliases = new Map<string, string>([[spec.table, spec.table]])
    spec.policies.forEach((p) =>
      [p.using, p.check].forEach((e) =>
        visit(e, (v) => {
          if (v.kind === 'exists') aliases.set(v.alias, v.table)
        }),
      ),
    )
    const key = (v: Extract<HelperExpression, { kind: 'column' }>) => {
      const relationName = v.relation === null ? spec.table : aliases.get(v.relation)
      ensure(relationName, 'HELPER_EXPRESSION_SCOPE_INVALID')
      return `${relationName}.${v.name}`
    }
    const wanted = new Map<string, Extract<HelperExpression, { kind: 'column' }>>()
    spec.policies.forEach((p) =>
      [p.using, p.check].forEach((e) =>
        visit(e, (v) => {
          if (v.kind === 'column') wanted.set(key(v), v)
        }),
      ),
    )
    const types: Record<string, { oid: string; input: string; output: string }> = {
      text: { oid: '25', input: 'textin', output: 'textout' },
      varchar: { oid: '1043', input: 'varcharin', output: 'varcharout' },
      uuid: { oid: '2950', input: 'uuid_in', output: 'uuid_out' },
      int4: { oid: '23', input: 'int4in', output: 'int4out' },
      int8: { oid: '20', input: 'int8in', output: 'int8out' },
      _uuid: { oid: '2951', input: 'array_in', output: 'array_out' },
    }
    for (const [columnKey, v] of wanted) {
      const name = v.relation === null ? spec.table : aliases.get(v.relation)!
      const row = await one(
        helperCatalogQueries.column,
        [resolutions.get(name)!.oid, v.name],
        'OWNED_COLUMN_MISSING',
      )
      const type = text(row.type)
      ensure(
        text(row.name) === v.name &&
          text(row.relation) === resolutions.get(name)!.oid &&
          Number.isSafeInteger(row.number) &&
          (row.number as number) > 0,
        'HELPER_ROW_INVALID',
      )
      text(row.element)
      text(row.collation)
      const inputOid = text(row.input_oid),
        outputOid = text(row.output_oid)
      ensure(/^\d+$/.test(inputOid) && /^\d+$/.test(outputOid), 'HELPER_ROW_INVALID')
      if (
        text(row.schema) !== 'pg_catalog' ||
        text(row.kind) !== 'b' ||
        !types[type] ||
        text(row.oid) !== types[type].oid ||
        (type === '_uuid' && row.element !== '2950') ||
        text(row.input_body) !== types[type]?.input ||
        text(row.output_body) !== types[type]?.output ||
        row.collation !== (type === 'text' || type === 'varchar' ? '100' : '0')
      )
        deny('DRIFTED', 'OWNED_COLUMN_TYPE_DRIFT')
      columns.set(columnKey, {
        relation: name,
        name: v.name,
        type,
        oid: types[type].oid,
        number: row.number as number,
      })
      if (
        typeIo.has(type) &&
        replayDigest(typeIo.get(type)) !== replayDigest({ input: inputOid, output: outputOid })
      )
        deny('DRIFTED', 'TYPE_IO_IDENTITY_DRIFT')
      typeIo.set(type, { input: inputOid, output: outputOid })
    }
    const builtinOids = new Set<string>()
    const builtinNames = new Map<string, string>()
    const builtin = async (signature: string, body: string, result: string) => {
      const row = await one(helperCatalogQueries.builtin, [signature], 'BODY_BUILTIN_MISSING')
      ensure(/^\d+$/.test(text(row.oid)), 'HELPER_ROW_INVALID')
      const name = signature.split('(')[0]
      const argOids: Record<string, string> = {
        text: '25',
        boolean: '16',
        any: '2276',
        cstring: '2275',
        oid: '26',
        integer: '23',
        uuid: '2950',
        int4: '23',
        int8: '20',
        varchar: '1043',
        anyarray: '2277',
      }
      const expectedArguments = signature
        .slice(name.length + 1, -1)
        .split(',')
        .map((v) => argOids[v.replaceAll('"', '')])
        .join(' ')
      if (
        Number(row.oid) >= 16384 ||
        text(row.schema) !== 'pg_catalog' ||
        text(row.body) !== body ||
        text(row.language) !== 'internal' ||
        text(row.kind) !== 'f' ||
        text(row.name) !== name ||
        text(row.argument_oids) !== expectedArguments ||
        text(row.variadic) !== (name === 'format' ? '2276' : '0') ||
        bool(row.definer) ||
        row.config !== null ||
        text(row.result) !== result ||
        !bool(row.visible)
      )
        deny('PRECONDITION_MISSING', 'BODY_BUILTIN_RESOLUTION_DRIFT')
      builtinOids.add(row.oid as string)
      builtinNames.set(name, row.oid as string)
    }
    await builtin('current_setting(text,boolean)', 'show_config_by_name_missing_ok', 'text')
    await builtin('format(text,"any")', 'text_format', 'text')
    await builtin('to_regclass(text)', 'to_regclass', 'regclass')
    const allowedOverloads: Record<string, string[]> = {
      current_setting: ['25|0', '25 16|0'],
      format: ['25|0', '25 2276|2276'],
      to_regclass: ['25|0'],
    }
    for (const [name, allowed] of Object.entries(allowedOverloads)) {
      const rows = (await read(helperCatalogQueries.overloads, [name])).map(object)
      ensure(
        new Set(rows.map((r) => text(r.oid))).size === rows.length,
        'HELPER_CARDINALITY_INVALID',
      )
      if (!rows.length) deny('PRECONDITION_MISSING', 'BODY_FUNCTION_OVERLOADS_MISSING')
      for (const row of rows) {
        ensure(/^\d+$/.test(text(row.oid)), 'HELPER_ROW_INVALID')
        if (
          text(row.name) !== name ||
          text(row.schema) !== 'pg_catalog' ||
          Number(row.oid) >= 16384 ||
          !allowed.includes(`${text(row.argument_oids)}|${text(row.variadic)}`)
        )
          deny('PRECONDITION_MISSING', 'BODY_FUNCTION_OVERLOAD_RESOLUTION_AMBIGUOUS')
      }
      if (!rows.some((r) => r.oid === builtinNames.get(name)))
        deny('PRECONDITION_MISSING', 'BODY_FUNCTION_OVERLOAD_IDENTITY_DRIFT')
    }
    for (const type of new Set([...columns.values()].map((v) => v.type).concat(['text', 'uuid']))) {
      const t = types[type]
      await builtin(
        `${t.input}(cstring${type === 'varchar' || type === '_uuid' ? ',oid,integer' : ''})`,
        t.input,
        type === '_uuid'
          ? 'anyarray'
          : type === 'int4'
            ? 'integer'
            : type === 'int8'
              ? 'bigint'
              : type === 'varchar'
                ? 'character varying'
                : type,
      )
      await builtin(`${t.output}(${type === '_uuid' ? 'anyarray' : type})`, t.output, 'cstring')
      const io = typeIo.get(type)
      if (
        io &&
        (io.input !== builtinNames.get(t.input) || io.output !== builtinNames.get(t.output))
      )
        deny('DRIFTED', 'COLUMN_TYPE_IO_BINDING_DRIFT')
    }
    for (const type of new Set(
      [...columns.values()]
        .map((v) => v.type)
        .filter((v) => v !== 'text' && v !== '_uuid')
        .concat(['uuid']),
    )) {
      for (const [from, to] of [
        [types[type].oid, '25'],
        ['25', types[type].oid],
      ]) {
        const casts = (await read(helperCatalogQueries.cast, [from, to])).map(object)
        ensure(casts.length <= 1, 'HELPER_CARDINALITY_INVALID')
        if (type === 'varchar') {
          if (
            casts.length !== 1 ||
            text(casts[0].method) !== 'b' ||
            text(casts[0].context) !== 'i' ||
            text(casts[0].function) !== '0'
          )
            deny('PRECONDITION_MISSING', 'TEXT_BINARY_CAST_DRIFT')
        } else if (casts.length !== 0) deny('PRECONDITION_MISSING', 'TEXT_IO_CAST_OVERRIDDEN')
      }
    }
    const equalityBodies: Record<string, string> = {
      '25': 'texteq',
      '2950': 'uuid_eq',
      '23': 'int4eq',
      '20': 'int8eq',
    }
    const operatorTypes = new Set<string>()
    const operatorOids = new Set<string>()
    const infer = (v: HelperExpression): string => {
      if (v.kind === 'column')
        return columns.get(key(v))!.type === 'varchar' ? 'text' : columns.get(key(v))!.type
      if (v.kind === 'cast') {
        const type = infer(v.value)
        if (v.type === 'uuid' && type !== 'text') deny('DRIFTED', 'UUID_CAST_TYPE_DRIFT')
        if (v.type === 'text' && !['text', 'uuid', 'int4', 'int8'].includes(type))
          deny('DRIFTED', 'TEXT_CAST_TYPE_DRIFT')
        return v.type
      }
      if (v.kind === 'string' || v.kind === 'setting') return 'text'
      if (v.kind === 'any') {
        if (infer(v.value) !== '_uuid') deny('DRIFTED', 'ANY_ARRAY_TYPE_DRIFT')
        return 'uuid'
      }
      if (v.kind === 'equal') {
        if (
          v.left.kind === 'column' &&
          v.right.kind === 'column' &&
          columns.get(key(v.left))!.oid !== columns.get(key(v.right))!.oid
        )
          deny('DRIFTED', 'PARENT_ID_FK_TYPE_MISMATCH')
        const left = infer(v.left),
          right = infer(v.right)
        if (left !== right || !types[left]) deny('DRIFTED', 'EQUALITY_TYPE_DRIFT')
        operatorTypes.add(types[left].oid)
        return 'bool'
      }
      if (v.kind === 'and' || v.kind === 'or') {
        if (v.values.some((e) => infer(e) !== 'bool')) deny('DRIFTED', 'BOOLEAN_TYPE_DRIFT')
      } else if (v.kind === 'exists') {
        if (infer(v.where) !== 'bool') deny('DRIFTED', 'PARENT_PREDICATE_TYPE_DRIFT')
      } else if (v.kind === 'null') infer(v.value)
      return 'bool'
    }
    for (const p of spec.policies) {
      if ((p.using && infer(p.using) !== 'bool') || (p.check && infer(p.check) !== 'bool'))
        deny('DRIFTED', 'POLICY_PREDICATE_TYPE_DRIFT')
    }
    for (const oid of operatorTypes) {
      const rows = (await read(helperCatalogQueries.operator, [oid])).map(object)
      ensure(rows.length <= 1, 'HELPER_CARDINALITY_INVALID')
      if (!rows.length) deny('PRECONDITION_MISSING', 'EQUALITY_OPERATOR_MISSING')
      const row = rows[0]
      ensure(/^\d+$/.test(text(row.oid)), 'HELPER_ROW_INVALID')
      ensure(/^\d+$/.test(text(row.function_oid)), 'HELPER_ROW_INVALID')
      if (
        text(row.schema) !== 'pg_catalog' ||
        text(row.name) !== '=' ||
        text(row.left_type) !== oid ||
        text(row.right_type) !== oid ||
        text(row.result) !== '16' ||
        text(row.language) !== 'internal' ||
        text(row.body) !== equalityBodies[oid] ||
        Number(row.function_oid) >= 16384 ||
        text(row.function_schema) !== 'pg_catalog' ||
        text(row.argument_oids) !== `${oid} ${oid}` ||
        text(row.function_result) !== '16' ||
        text(row.function_kind) !== 'f' ||
        bool(row.definer) ||
        row.config !== null ||
        Number(row.oid) >= 16384 ||
        !bool(row.visible)
      )
        deny('PRECONDITION_MISSING', 'EQUALITY_OPERATOR_RESOLUTION_DRIFT')
      operatorOids.add(row.oid as string)
    }
    const normalize = (v: HelperExpression): HelperExpression => {
      if (v.kind === 'cast') {
        const child = normalize(v.value)
        if (
          v.type === 'text' &&
          (child.kind === 'string' ||
            (child.kind === 'column' &&
              ['text', 'varchar'].includes(columns.get(key(child))!.type)))
        )
          return child
        return { ...v, value: child }
      }
      if (v.kind === 'column') {
        key(v)
        return {
          ...v,
          relation: v.relation === null || v.relation === spec.table ? spec.table : v.relation,
        }
      }
      if (v.kind === 'exists') {
        const schema = resolutions.get(v.table)?.schema
        ensure(schema && (v.schema === null || v.schema === schema), 'HELPER_PARENT_SCHEMA_DRIFT')
        return { ...v, schema, where: normalize(v.where) }
      }
      if (v.kind === 'equal') return { ...v, left: normalize(v.left), right: normalize(v.right) }
      if (v.kind === 'and' || v.kind === 'or') return { ...v, values: v.values.map(normalize) }
      if (v.kind === 'null' || v.kind === 'any') return { ...v, value: normalize(v.value) }
      return v
    }
    for (const p of spec.policies) {
      const role = await one(literalPolicyQueries.role, [p.role], 'POLICY_ROLE_MISSING')
      ensure(text(role.name) === p.role, 'HELPER_ROW_INVALID')
      const rows = await read(literalPolicyQueries.policy, [
        context.targetSchema,
        spec.table,
        p.name,
      ])
      ensure(rows.length <= 1, 'HELPER_CARDINALITY_INVALID')
      if (!rows.length) deny('ABSENT', 'OWNED_POLICY_ABSENT')
      const row = object(rows[0]),
        roles = strings(row.roles)
      const nullable = (v: unknown) => (v === null ? null : helperExpression(text(v)))
      const using = nullable(row.using_expression),
        check = nullable(row.check_expression)
      if (
        text(row.name) !== p.name ||
        !bool(row.name_matches) ||
        !bool(row.permissive) ||
        text(row.command) !==
          { SELECT: 'r', INSERT: 'a', UPDATE: 'w', DELETE: 'd', ALL: '*' }[p.command] ||
        replayDigest(roles) !== replayDigest([p.role]) ||
        replayDigest(using && normalize(using)) !== replayDigest(p.using && normalize(p.using)) ||
        replayDigest(check && normalize(check)) !== replayDigest(p.check && normalize(p.check))
      )
        deny('DRIFTED', 'OWNED_POLICY_DEFINITION_DRIFT')
      const deps = (
        await read(helperCatalogQueries.dependencies, [resolutions.get(spec.table)!.oid, p.name])
      ).map(object)
      ensure(new Set(deps.map(replayDigest)).size === deps.length, 'HELPER_CARDINALITY_INVALID')
      for (const dep of deps) {
        const catalog = text(dep.catalog).replace('pg_catalog.', '')
        ensure(
          /^\d+$/.test(text(dep.oid)) &&
            Number.isSafeInteger(dep.subid) &&
            (dep.subid as number) >= 0,
          'HELPER_ROW_INVALID',
        )
        const kind = text(dep.kind)
        if (!['n', 'a'].includes(kind)) deny('DRIFTED', 'POLICY_DEPENDENCY_KIND_DRIFT')
        if (catalog === 'pg_class') {
          if (
            ![...resolutions.values()].some((r) => r.oid === dep.oid) ||
            (dep.subid !== 0 &&
              ![...columns.values()].some(
                (c) => resolutions.get(c.relation)!.oid === dep.oid && c.number === dep.subid,
              ))
          )
            deny('DRIFTED', 'POLICY_RELATION_DEPENDENCY_DRIFT')
        } else if (
          !(
            (catalog === 'pg_type' &&
              ['16', ...Object.values(types).map((t) => t.oid)].includes(dep.oid as string)) ||
            (catalog === 'pg_proc' && builtinOids.has(dep.oid as string)) ||
            (catalog === 'pg_operator' && operatorOids.has(dep.oid as string)) ||
            (catalog === 'pg_collation' && ['0', '100'].includes(dep.oid as string))
          ) ||
          dep.subid !== 0
        )
          deny('DRIFTED', 'POLICY_NONBUILTIN_DEPENDENCY_DRIFT')
      }
      if (
        !deps.some(
          (d) =>
            text(d.catalog).replace('pg_catalog.', '') === 'pg_class' &&
            d.oid === resolutions.get(spec.table)!.oid &&
            d.subid === 0,
        )
      )
        deny('PRECONDITION_MISSING', 'POLICY_TARGET_DEPENDENCY_MISSING')
      for (const e of [p.using, p.check])
        visit(e, (v) => {
          if (v.kind !== 'column') return
          const c = columns.get(key(v))!
          if (
            !deps.some(
              (d) =>
                text(d.catalog).replace('pg_catalog.', '') === 'pg_class' &&
                d.oid === resolutions.get(c.relation)!.oid &&
                d.subid === c.number,
            )
          )
            deny('PRECONDITION_MISSING', 'POLICY_COLUMN_DEPENDENCY_MISSING')
        })
    }
    return observation('EXACT', null)
  } catch (error) {
    if (error instanceof Denial) return observation(error.definition, error.message)
    if (error instanceof ProvisioningError) return observation('DRIFTED', error.message)
    return observation('PRECONDITION_MISSING', 'CATALOG_READING_FAILED_OR_UNSUPPORTED')
  }
}
