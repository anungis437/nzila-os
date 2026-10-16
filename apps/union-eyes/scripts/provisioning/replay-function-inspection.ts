import { ProvisioningError } from './governed-provisioning'
import { replayDigest, replayHash } from './post-w4p-replay'
import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import type { CatalogReader } from './platform-baseline-promotion'
import type { StructuralObservation } from './replay-structural-effects'

type TypeIdentity = { schema: string; name: string; kind: string }
type DefaultValue = { kind: 'TEXT'; value: string } | { kind: 'BOOLEAN'; value: boolean }
type Argument = { name: string | null; type: TypeIdentity; default: DefaultValue | null }
export interface FunctionAcl {
  grantor: string
  grantee: string
  privilege: 'EXECUTE'
  grantable: boolean
}
/**
 * The declarations do not specify a creation schema, owner, or ACL. These must
 * come from the particular replay position's independently established context,
 * not a hardcoded public schema, provisioning role, or default PUBLIC grant.
 * For replacements, owner/ACL are preserved; for new objects, default privileges
 * matter. This comparator does not establish that context or execution authority.
 */
export interface FunctionPrerequisites {
  sourceHash: string
  schema: string
  owner: string
  acl: FunctionAcl[]
}
export interface FunctionEffect {
  source: string
  sourceHash: string
  action: 'CREATE_OR_REPLACE' | 'DROP_IF_EXISTS'
  schema: string | null
  name: string
  arguments: Argument[]
  returns: TypeIdentity | null
  language: 'sql' | 'plpgsql' | null
  body: string | null
  volatility: 'v' | 's'
  securityDefiner: false
  strict: false
  parallel: 'u'
  config: null
  contractDigest: string
}
export interface FunctionObservation extends StructuralObservation {
  denial: string | null
}

function requireCondition(value: unknown, code: string): asserts value {
  if (!value) throw new ProvisioningError(code)
}
const grammar = 'REPLAY_FUNCTION_GRAMMAR_UNSUPPORTED'
class Cursor {
  readonly tokens: ReturnType<typeof sqlTokens>
  index = 0
  constructor(readonly source: string) {
    this.tokens = sqlTokens(source)
  }
  optionalWord(value: string) {
    const token = this.tokens[this.index]
    if (token?.kind !== 'WORD' || token.value.toUpperCase() !== value) return false
    this.index++
    return true
  }
  word(value: string) {
    requireCondition(this.optionalWord(value), grammar)
  }
  symbol(value: string) {
    const token = this.tokens[this.index++]
    requireCondition(token?.kind === 'SYMBOL' && token.value === value, grammar)
  }
  identifier() {
    const token = this.tokens[this.index++]
    requireCondition(token?.kind === 'WORD' || token?.kind === 'IDENTIFIER', grammar)
    return token.kind === 'WORD' ? token.value.toLowerCase() : token.value
  }
  type(position: 'ARGUMENT' | 'RETURN'): TypeIdentity {
    const token = this.tokens[this.index++]
    requireCondition(token?.kind === 'WORD', grammar)
    const identities: Record<string, TypeIdentity> =
      position === 'ARGUMENT'
        ? {
            TEXT: { schema: 'pg_catalog', name: 'text', kind: 'b' },
            BOOLEAN: { schema: 'pg_catalog', name: 'bool', kind: 'b' },
          }
        : {
            VOID: { schema: 'pg_catalog', name: 'void', kind: 'p' },
            BOOLEAN: { schema: 'pg_catalog', name: 'bool', kind: 'b' },
            TRIGGER: { schema: 'pg_catalog', name: 'trigger', kind: 'p' },
          }
    const type = identities[token.value.toUpperCase()]
    requireCondition(type, grammar)
    return type
  }
  default(type: TypeIdentity): DefaultValue {
    const token = this.tokens[this.index++]
    if (type.name === 'text' && token?.kind === 'STRING')
      return { kind: 'TEXT', value: token.value }
    requireCondition(
      type.name === 'bool' &&
        token?.kind === 'WORD' &&
        ['TRUE', 'FALSE'].includes(token.value.toUpperCase()),
      grammar,
    )
    return { kind: 'BOOLEAN', value: token.value.toUpperCase() === 'TRUE' }
  }
  body() {
    // sqlTokens recursively flattens dollar bodies. Use its original offsets,
    // but extract prosrc bytes separately: comments/whitespace are significant.
    const start = this.tokens[this.index - 1].end
    const opening = /^\s*(\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$)/.exec(this.source.slice(start))
    requireCondition(opening, grammar)
    const contentStart = start + opening[0].length
    const close = this.source.indexOf(opening[1], contentStart)
    requireCondition(close >= 0, grammar)
    const end = close + opening[1].length
    while (this.tokens[this.index] && this.tokens[this.index].start < end) this.index++
    return this.source.slice(contentStart, close)
  }
  finish() {
    this.symbol(';')
    requireCondition(this.index === this.tokens.length, grammar)
  }
}

/**
 * Closed grammar: one CREATE OR REPLACE FUNCTION or DROP FUNCTION IF EXISTS
 * (implicit RESTRICT); named implicit-IN TEXT/BOOLEAN arguments with trailing
 * literal defaults; VOID/BOOLEAN/TRIGGER return; dollar AS body; LANGUAGE
 * sql/plpgsql and optional STABLE, before or after AS. All other clauses,
 * procedures, OUT/INOUT/variadic/default expressions, SET/config, SECURITY,
 * STRICT, PARALLEL, costs and CASCADE are explicitly unsupported.
 * The body is opaque exact source, not compiled/executed PL/pgSQL or SQL.
 */
export function compileFunctionEffect(source: string, sourceHash: string): FunctionEffect {
  requireCondition(
    typeof source === 'string' &&
      typeof sourceHash === 'string' &&
      /^[a-f0-9]{64}$/.test(sourceHash) &&
      replayHash(source) === sourceHash,
    'REPLAY_FUNCTION_SOURCE_HASH_DRIFT',
  )
  const cursor = new Cursor(source)
  const drop = cursor.optionalWord('DROP')
  if (drop) {
    cursor.word('FUNCTION')
    cursor.word('IF')
    cursor.word('EXISTS')
  } else {
    cursor.word('CREATE')
    cursor.word('OR')
    cursor.word('REPLACE')
    cursor.word('FUNCTION')
  }
  const first = cursor.identifier()
  let schema: string | null = null
  let name = first
  if (cursor.tokens[cursor.index]?.value === '.') {
    cursor.symbol('.')
    schema = first
    name = cursor.identifier()
  }
  cursor.symbol('(')
  const args: Argument[] = []
  let seenDefault = false
  if (cursor.tokens[cursor.index]?.value !== ')') {
    do {
      if (args.length) cursor.symbol(',')
      const argName = drop ? null : cursor.identifier()
      const type = cursor.type('ARGUMENT')
      const value = !drop && cursor.optionalWord('DEFAULT') ? cursor.default(type) : null
      requireCondition(!seenDefault || value !== null, grammar)
      seenDefault ||= value !== null
      args.push({ name: argName, type, default: value })
    } while (cursor.tokens[cursor.index]?.value === ',')
  }
  cursor.symbol(')')
  requireCondition(drop || new Set(args.map((arg) => arg.name)).size === args.length, grammar)
  let returns: TypeIdentity | null = null
  let language: FunctionEffect['language'] = null
  let body: string | null = null
  let volatility: FunctionEffect['volatility'] = 'v'
  if (!drop) {
    cursor.word('RETURNS')
    returns = cursor.type('RETURN')
    let seenStable = false
    while (cursor.tokens[cursor.index]?.value !== ';') {
      if (cursor.optionalWord('LANGUAGE')) {
        requireCondition(language === null, grammar)
        const value = cursor.identifier()
        requireCondition(value === 'sql' || value === 'plpgsql', grammar)
        language = value
      } else if (cursor.optionalWord('STABLE')) {
        requireCondition(!seenStable, grammar)
        seenStable = true
        volatility = 's'
      } else if (cursor.optionalWord('AS')) {
        requireCondition(body === null, grammar)
        body = cursor.body()
      } else throw new ProvisioningError(grammar)
    }
    requireCondition(language !== null && body !== null && body.trim().length > 0, grammar)
  }
  cursor.finish()
  const spec = {
    source,
    sourceHash,
    action: drop ? ('DROP_IF_EXISTS' as const) : ('CREATE_OR_REPLACE' as const),
    schema,
    name,
    arguments: args,
    returns,
    language,
    body,
    volatility,
    securityDefiner: false as const,
    strict: false as const,
    parallel: 'u' as const,
    config: null,
  }
  return { ...spec, contractDigest: replayDigest(spec) }
}

export const functionCatalogQueries = {
  namespace: `SELECT n.nspname AS name FROM pg_catalog.pg_namespace n WHERE n.nspname=$1`,
  owner: `SELECT r.rolname AS name FROM pg_catalog.pg_roles r WHERE r.rolname=$1`,
  type: `SELECT n.nspname AS schema,t.typname AS name,t.typtype AS kind,
    pg_catalog.pg_type_is_visible(t.oid) AS visible
    FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname=$1 AND t.typname=$2`,
  language: `SELECT l.lanname AS name,l.lanpltrusted AS trusted,
    pg_catalog.has_language_privilege($2,l.oid,'USAGE') AS owner_usage
    FROM pg_catalog.pg_language l WHERE l.lanname=$1`,
  functions: `SELECT n.nspname AS schema,p.proname AS name,p.prokind AS kind,
    COALESCE((SELECT pg_catalog.json_agg(pg_catalog.json_build_object(
      'schema',tn.nspname,'name',t.typname,'kind',t.typtype) ORDER BY a.ordinality)
      FROM pg_catalog.unnest(p.proargtypes::oid[]) WITH ORDINALITY a(type_oid,ordinality)
      JOIN pg_catalog.pg_type t ON t.oid=a.type_oid
      JOIN pg_catalog.pg_namespace tn ON tn.oid=t.typnamespace),'[]'::pg_catalog.json) AS argument_types,
    p.proargnames AS argument_names,p.proargmodes AS argument_modes,
    p.proallargtypes::text AS all_argument_types,p.pronargs AS argument_count,
    p.provariadic::text AS variadic,p.pronargdefaults AS default_count,
    pg_catalog.pg_get_expr(p.proargdefaults,0) AS defaults,
    rn.nspname AS return_schema,rt.typname AS return_name,rt.typtype AS return_kind,
    p.proretset AS returns_set,l.lanname AS language,p.prosecdef AS security_definer,
    p.provolatile AS volatility,p.proisstrict AS strict,p.proparallel AS parallel,
    p.proleakproof AS leakproof,p.proconfig AS config,p.prosrc AS body,
    p.probin AS binary,p.procost AS cost,p.prorows AS rows,
    p.prosupport::oid::text AS support,
    CASE WHEN pg_catalog.cardinality(p.protrftypes::oid[])=0
      THEN NULL ELSE p.protrftypes::text END AS transforms,
    (pg_catalog.to_jsonb(p)->>'prosqlbody') IS NULL AS sql_body_absent,
    r.rolname AS owner,
    COALESCE((SELECT pg_catalog.json_agg(pg_catalog.json_build_object(
      'grantor',grantor.rolname,'grantee',CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE grantee.rolname END,
      'privilege',a.privilege_type,'grantable',a.is_grantable)
      ORDER BY grantor.rolname,a.grantee,a.privilege_type,a.is_grantable)
      FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
      LEFT JOIN pg_catalog.pg_roles grantor ON grantor.oid=a.grantor
      LEFT JOIN pg_catalog.pg_roles grantee ON grantee.oid=a.grantee),'[]'::pg_catalog.json) AS acl,
    COALESCE((SELECT pg_catalog.json_agg(pg_catalog.json_build_object(
      'class_id',d.classid::text,'object_id',d.objid::text,'sub_id',d.objsubid,'kind',d.deptype)
      ORDER BY d.classid,d.objid,d.objsubid,d.deptype)
      FROM pg_catalog.pg_depend d WHERE d.refclassid='pg_catalog.pg_proc'::pg_catalog.regclass
      AND d.refobjid=p.oid),'[]'::pg_catalog.json) AS dependents
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    JOIN pg_catalog.pg_type rt ON rt.oid=p.prorettype
    JOIN pg_catalog.pg_namespace rn ON rn.oid=rt.typnamespace
    JOIN pg_catalog.pg_language l ON l.oid=p.prolang
    JOIN pg_catalog.pg_roles r ON r.oid=p.proowner
    WHERE n.nspname=$1 AND p.proname=$2 ORDER BY p.oid`,
}

const invalidRow = 'REPLAY_FUNCTION_CATALOG_ROW_INVALID'
function record(value: unknown): Record<string, unknown> {
  requireCondition(value && typeof value === 'object' && !Array.isArray(value), invalidRow)
  return Object.fromEntries(Object.entries(value))
}
function text(value: unknown): string {
  requireCondition(typeof value === 'string', invalidRow)
  return value
}
function boolean(value: unknown): boolean {
  requireCondition(typeof value === 'boolean', invalidRow)
  return value
}
function integer(value: unknown): number {
  requireCondition(
    typeof value === 'number' && Number.isSafeInteger(value) && value >= 0,
    invalidRow,
  )
  return value
}
function list(value: unknown): unknown[] {
  requireCondition(Array.isArray(value), invalidRow)
  return value
}
function strings(value: unknown): string[] {
  return list(value).map(text)
}
function nullableText(value: unknown): string | null {
  return value === null ? null : text(value)
}
function nullableStrings(value: unknown): string[] | null {
  return value === null ? null : strings(value)
}
function identity(value: unknown): TypeIdentity {
  const row = record(value)
  return { schema: text(row.schema), name: text(row.name), kind: text(row.kind) }
}
function acl(value: unknown): FunctionAcl[] {
  const entries = list(value).map((entry) => {
    const row = record(entry)
    requireCondition(row.privilege === 'EXECUTE', invalidRow)
    return {
      grantor: text(row.grantor),
      grantee: text(row.grantee),
      privilege: 'EXECUTE' as const,
      grantable: boolean(row.grantable),
    }
  })
  requireCondition(
    entries.every((entry) => entry.grantor.length > 0 && entry.grantee.length > 0) &&
      new Set(entries.map(replayDigest)).size === entries.length,
    invalidRow,
  )
  return entries.sort((a, b) => replayDigest(a).localeCompare(replayDigest(b)))
}
function functionRow(value: unknown) {
  const row = record(value)
  const types = list(row.argument_types).map(identity)
  const count = integer(row.argument_count)
  const defaultCount = integer(row.default_count)
  const names = nullableStrings(row.argument_names)
  const modes = nullableStrings(row.argument_modes)
  requireCondition(
    count === types.length &&
      defaultCount <= count &&
      (names === null || names.length >= count) &&
      (modes === null || modes.every((mode) => ['i', 'o', 'b', 'v', 't'].includes(mode))) &&
      ['f', 'p', 'a', 'w'].includes(text(row.kind)) &&
      ['v', 's', 'i'].includes(text(row.volatility)) &&
      ['u', 'r', 's'].includes(text(row.parallel)) &&
      /^\d+$/.test(text(row.variadic)) &&
      /^\d+$/.test(text(row.support)) &&
      typeof row.cost === 'number' &&
      Number.isFinite(row.cost) &&
      typeof row.rows === 'number' &&
      Number.isFinite(row.rows),
    invalidRow,
  )
  const defaults = nullableText(row.defaults)
  requireCondition((defaultCount === 0) === (defaults === null), invalidRow)
  const dependents = list(row.dependents).map((entry) => {
    const dependent = record(entry)
    const classId = text(dependent.class_id)
    const objectId = text(dependent.object_id)
    const kind = text(dependent.kind)
    requireCondition(
      /^\d+$/.test(classId) && /^\d+$/.test(objectId) && kind.length === 1,
      invalidRow,
    )
    return { classId, objectId, subId: integer(dependent.sub_id), kind }
  })
  return {
    schema: text(row.schema),
    name: text(row.name),
    kind: text(row.kind),
    types,
    names,
    modes,
    allTypes: nullableText(row.all_argument_types),
    count,
    variadic: text(row.variadic),
    defaultCount,
    defaults,
    returns: {
      schema: text(row.return_schema),
      name: text(row.return_name),
      kind: text(row.return_kind),
    },
    returnsSet: boolean(row.returns_set),
    language: text(row.language),
    securityDefiner: boolean(row.security_definer),
    volatility: text(row.volatility),
    strict: boolean(row.strict),
    parallel: text(row.parallel),
    leakproof: boolean(row.leakproof),
    config: nullableStrings(row.config),
    body: text(row.body),
    binary: nullableText(row.binary),
    cost: row.cost as number,
    rows: row.rows as number,
    support: text(row.support),
    transforms: nullableText(row.transforms),
    sqlBodyAbsent: boolean(row.sql_body_absent),
    owner: text(row.owner),
    acl: acl(row.acl),
    dependents,
  }
}

function catalogDefaults(expression: string | null, args: Argument[]) {
  const expected = args.filter((arg) => arg.default !== null)
  if (expression === null) return expected.length === 0 ? [] : null
  try {
    const cursor = new Cursor(expression)
    const values: DefaultValue[] = []
    for (const arg of expected) {
      if (values.length) cursor.symbol(',')
      values.push(cursor.default(arg.type))
      if (cursor.tokens[cursor.index]?.value === ':') {
        cursor.symbol(':')
        cursor.symbol(':')
        let cast = cursor.identifier()
        if (cursor.tokens[cursor.index]?.value === '.') {
          requireCondition(cast === 'pg_catalog', grammar)
          cursor.symbol('.')
          cast = cursor.identifier()
        }
        requireCondition(cast === (arg.type.name === 'bool' ? 'boolean' : 'text'), grammar)
      }
    }
    requireCondition(cursor.index === cursor.tokens.length, grammar)
    return values
  } catch {
    return null
  }
}

/**
 * A definition observation at THIS source position only. DROP is satisfied by
 * ABSENT, not by an invented replacement definition. Later recreation of its
 * identity must remain a different effect. EXACT here does not prove dynamic
 * policy effects, trigger installation, body operands, or a boundary's state.
 * Caller must supply a consistent read-only catalog snapshot and source-bound
 * resolution/owner/ACL context. No database connection is opened by this module.
 */
export async function inspectFunctionEffect(
  reader: CatalogReader,
  spec: FunctionEffect,
  prerequisites?: FunctionPrerequisites,
): Promise<FunctionObservation> {
  requireCondition(
    replayDigest(compileFunctionEffect(spec.source, spec.sourceHash)) === replayDigest(spec),
    'REPLAY_FUNCTION_IR_DRIFT',
  )
  const observations: unknown[] = []
  const observation = (
    definition: FunctionObservation['definition'],
    denial: string | null = null,
  ): FunctionObservation => ({
    definition,
    denial,
    stateDigest: replayDigest({
      spec,
      prerequisites: prerequisites ?? null,
      observations,
      definition,
      denial,
    }),
  })
  if (!prerequisites)
    return observation('PRECONDITION_MISSING', 'SOURCE_RESOLUTION_OWNER_ACL_CONTEXT_REQUIRED')
  requireCondition(
    prerequisites.sourceHash === spec.sourceHash &&
      typeof prerequisites.schema === 'string' &&
      prerequisites.schema.length > 0 &&
      typeof prerequisites.owner === 'string' &&
      prerequisites.owner.length > 0 &&
      (spec.schema === null || spec.schema === prerequisites.schema),
    'REPLAY_FUNCTION_PREREQUISITE_BINDING_INVALID',
  )
  const expectedAcl = acl(prerequisites.acl)
  const read = async (sql: string, parameters: string[]) => {
    const rows = await reader.query(sql, parameters)
    requireCondition(Array.isArray(rows), invalidRow)
    observations.push({ sql, parameters, rows })
    return rows
  }
  const single = async (sql: string, parameters: string[]) => {
    const rows = await read(sql, parameters)
    requireCondition(rows.length <= 1, 'REPLAY_FUNCTION_CATALOG_CARDINALITY_INVALID')
    return rows.length ? record(rows[0]) : null
  }
  const namespace = await single(functionCatalogQueries.namespace, [prerequisites.schema])
  if (!namespace) return observation('PRECONDITION_MISSING', 'FUNCTION_SCHEMA_MISSING')
  requireCondition(text(namespace.name) === prerequisites.schema, invalidRow)
  const owner = await single(functionCatalogQueries.owner, [prerequisites.owner])
  if (!owner) return observation('PRECONDITION_MISSING', 'FUNCTION_OWNER_MISSING')
  requireCondition(text(owner.name) === prerequisites.owner, invalidRow)
  const requiredTypes = [
    ...spec.arguments.map((arg) => arg.type),
    ...(spec.returns ? [spec.returns] : []),
  ]
  for (const type of requiredTypes.filter(
    (type, index) =>
      requiredTypes.findIndex((candidate) => replayDigest(candidate) === replayDigest(type)) ===
      index,
  )) {
    const actual = await single(functionCatalogQueries.type, [type.schema, type.name])
    if (!actual) return observation('PRECONDITION_MISSING', 'FUNCTION_TYPE_MISSING')
    const visible = boolean(actual.visible)
    if (replayDigest(identity(actual)) !== replayDigest(type)) return observation('DRIFTED')
    if (!visible)
      return observation('PRECONDITION_MISSING', 'UNQUALIFIED_TYPE_RESOLUTION_NOT_ESTABLISHED')
  }
  if (spec.language) {
    const language = await single(functionCatalogQueries.language, [
      spec.language,
      prerequisites.owner,
    ])
    if (!language) return observation('PRECONDITION_MISSING', 'FUNCTION_LANGUAGE_MISSING')
    requireCondition(text(language.name) === spec.language, invalidRow)
    if (!boolean(language.trusted) || !boolean(language.owner_usage))
      return observation('PRECONDITION_MISSING', 'FUNCTION_LANGUAGE_OWNER_USAGE_NOT_ESTABLISHED')
  }
  const rows = (
    await read(functionCatalogQueries.functions, [prerequisites.schema, spec.name])
  ).map(functionRow)
  requireCondition(
    rows.every((row) => row.schema === prerequisites.schema && row.name === spec.name) &&
      new Set(
        rows.map((row) => replayDigest(row.types.map(({ schema, name }) => ({ schema, name })))),
      ).size === rows.length,
    'REPLAY_FUNCTION_CATALOG_CARDINALITY_INVALID',
  )
  const target = rows.find(
    (row) =>
      replayDigest(row.types.map(({ schema, name }) => ({ schema, name }))) ===
      replayDigest(spec.arguments.map(({ type: { schema, name } }) => ({ schema, name }))),
  )
  if (!target) return observation('ABSENT')
  if (
    target.owner !== prerequisites.owner ||
    replayDigest(target.acl) !== replayDigest(expectedAcl)
  )
    return observation('DRIFTED')
  if (spec.action === 'DROP_IF_EXISTS') {
    if (target.kind !== 'f') return observation('DRIFTED')
    if (target.dependents.length)
      return observation(
        'PRECONDITION_MISSING',
        'DROP_RESTRICT_DEPENDENTS_REQUIRE_SEPARATE_ANALYSIS',
      )
    return observation('DRIFTED')
  }
  const exact =
    target.kind === 'f' &&
    replayDigest(target.types) === replayDigest(spec.arguments.map((arg) => arg.type)) &&
    replayDigest(target.names) ===
      replayDigest(spec.arguments.length ? spec.arguments.map((arg) => arg.name) : null) &&
    target.modes === null &&
    target.allTypes === null &&
    target.variadic === '0' &&
    target.defaultCount === spec.arguments.filter((arg) => arg.default !== null).length &&
    replayDigest(catalogDefaults(target.defaults, spec.arguments)) ===
      replayDigest(
        spec.arguments.filter((arg) => arg.default !== null).map((arg) => arg.default),
      ) &&
    replayDigest(target.returns) === replayDigest(spec.returns) &&
    !target.returnsSet &&
    target.language === spec.language &&
    target.securityDefiner === spec.securityDefiner &&
    target.volatility === spec.volatility &&
    target.strict === spec.strict &&
    target.parallel === spec.parallel &&
    !target.leakproof &&
    target.config === spec.config &&
    target.body === spec.body &&
    target.binary === null &&
    target.cost === 100 &&
    target.rows === 0 &&
    target.support === '0' &&
    target.transforms === null &&
    target.sqlBodyAbsent
  return observation(exact ? 'EXACT' : 'DRIFTED')
}
