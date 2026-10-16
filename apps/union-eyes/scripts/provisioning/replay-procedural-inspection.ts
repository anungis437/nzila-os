import { readFileSync } from 'node:fs'
import { sqlTokens } from '../../../../scripts/ue/close-w4t-named-types'
import { ProvisioningError } from './governed-provisioning'
import { replayDigest, replayHash } from './post-w4p-replay'
import { catalogQueries, type CatalogReader } from './platform-baseline-promotion'
import { compileEnumWrapper } from './replay-enum-inspection'
import {
  compileColumnDefinition,
  createCatalogQueries,
  normalizeCreateDefault,
} from './replay-create-inspection'
import {
  compileForeignKey,
  compileSimpleIndex,
  inspectForeignKey,
  inspectSimpleIndex,
} from './replay-structural-effects'
import { helperCatalogQueries } from './replay-policy-helper-inspection'
import { literalPolicyQueries } from './replay-literal-policy'
import {
  compileFunctionEffect,
  inspectFunctionEffect,
  type FunctionPrerequisites,
} from './replay-function-inspection'

/**
 * Position-local, read-only COMPONENTS, not an installed execution registry.
 * EXACT is neither a receipt nor original-whole-unit eligibility. In particular,
 * later migrations must not be compared at an earlier verification position.
 * Frozen denominator: 75 catalog/data comparators. Default exceptions require
 * an independent pre-block reader, not inferred execution-success flags.
 */
export interface ProceduralSource {
  effectId: string
  boundaryId: string
  boundaryHash: string
  ordinal: number
  sourcePath: string
  source: string
  sourceHash: string
}
export type ProceduralState =
  | 'EXACT'
  | 'UNSATISFIED'
  | 'PARTIAL'
  | 'DRIFTED'
  | 'MISSING_PREREQUISITE'
export interface ProceduralObservation {
  state: ProceduralState
  branch: string
  stateDigest: string
  limitation: string | null
  wholeUnitEligibility: 'NOT_ESTABLISHED'
}
export interface ProceduralContext {
  effectId: string
  sourceHash: string
  boundaryHash: string
  ordinal: number
  window: 'IMMEDIATE_PRE_SUCCESSOR'
  snapshotDigest: string
  actor: string
  database: string
  searchPath: string[]
  /** Independently resolved unqualified names at this exact position. No public fallback. */
  relations: Record<string, string>
  creationSchema?: string
  catalogVisibility: { snapshotDigest: string; schemas: string[]; allSchemas?: true }
  /** Full-row visibility evidence, not the count itself or a completion flag. */
  dataVisibility?: Record<string, { snapshotDigest: string; basis: string }>
  databaseGrantor?: string
  triggerFunction?: FunctionPrerequisites
  /** Independently resolved name allocated for the source's unnamed inline FK. */
  memberDocumentsForeignKeyName?: string
}
/** Same effect/actor/resolution context, captured immediately BEFORE the DO.
 * The caller binds this independent read-only snapshot to the supplied digest.
 */
export interface ProceduralPredecessor {
  reader: CatalogReader
  snapshotDigest: string
  dataVisibility?: Record<string, { snapshotDigest: string; basis: string }>
}
type DefaultAssignment = {
  column: string
  value: 'UUID_GENERATOR' | 'FULL_MEMBER'
  catches: ('undefined_column' | 'undefined_function' | 'datatype_mismatch')[]
}
type Guard = {
  kind: 'GUARD'
  tables: string[]
  parents: string[]
  columns: [string, string][]
  policies: string[]
  mode: 'COMMAND_AND_ROLE' | 'ROLE_ONLY' | 'PROHIBITION' | 'REQUIRED_RELATIONS'
}
type RetrofitColumn = {
  column: ReturnType<typeof compileColumnDefinition>
  foreignKeys: ReturnType<typeof compileForeignKey>[]
  indexes: ReturnType<typeof compileSimpleIndex>[]
}
type Policy = {
  name: string
  table: string
  command: string
  role: string
  using: string | null
  check: string | null
}
type Geometry =
  | { kind: 'ENUM'; enum: ReturnType<typeof compileEnumWrapper>; qualified: boolean }
  | Guard
  | { kind: 'RETROFIT'; table: string; columns: RetrofitColumn[] }
  | {
      kind: 'BACKFILL'
      table: 'member_documents'
      column: ReturnType<typeof compileColumnDefinition>
      indexes: ReturnType<typeof compileSimpleIndex>[]
    }
  | { kind: 'POLICIES'; table: string; rls: boolean; policies: Policy[] }
  | { kind: 'CONNECT'; roles: string[] }
  | { kind: 'TRIGGER'; table: string; name: string; functionName: string }
  | {
      kind: 'DEFAULTS'
      table: 'organization_members' | 'claim_updates'
      guard: 'PUBLIC_VISIBLE_ID_NULL_DEFAULT' | null
      assignments: DefaultAssignment[]
      updateNullCategory: boolean
    }
export interface ProceduralContract {
  binding: ProceduralSource
  geometry: Geometry
  contractDigest: string
  transaction: 'WHOLE_DO_ATOMIC_WITH_SOURCE_EXCEPTION_SUBTRANSACTIONS'
}
function ensure(value: unknown, code = 'PROCEDURAL_CATALOG_INVALID'): asserts value {
  if (!value) throw new ProvisioningError(code)
}
function object(value: unknown): Record<string, unknown> {
  ensure(value !== null && typeof value === 'object' && !Array.isArray(value))
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  ensure(typeof value === 'string')
  return value
}
function strings(value: unknown): string[] {
  ensure(Array.isArray(value) && value.every((v) => typeof v === 'string'))
  return value as string[]
}
function bool(value: unknown): boolean {
  ensure(typeof value === 'boolean')
  return value
}
function count(value: unknown): bigint {
  ensure(typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value))
  return BigInt(value)
}
const ledgerPin = '41ff4487e83c831dd94c6dbc50a2fe48de3f26af6b3c31453a188e975e423787'
let sources: ProceduralSource[] | undefined
export function frozenProceduralSources(): ProceduralSource[] {
  if (!sources) {
    const bytes = readFileSync(
      new URL(
        '../../../../docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json',
        import.meta.url,
      ),
      'utf8',
    )
    ensure(replayHash(bytes) === ledgerPin, 'PROCEDURAL_LEDGER_HASH_DRIFT')
    const ledger = object(JSON.parse(bytes))
    ensure(Array.isArray(ledger.BOUNDARIES))
    sources = ledger.BOUNDARIES.flatMap((entry: unknown) => {
      const boundary = object(entry)
      ensure(Array.isArray(boundary.EFFECTS))
      return boundary.EFFECTS.flatMap((value: unknown) => {
        const effect = object(value)
        if (effect.EFFECT_CLASS !== 'DO_OR_PROCEDURAL_BLOCK') return []
        const source = text(object(effect.COMPARATOR).EXACT_SOURCE_SEMANTICS)
        const sourceHash = text(effect.EXACT_EFFECT_SHA256)
        ensure(replayHash(source) === sourceHash, 'PROCEDURAL_SOURCE_HASH_DRIFT')
        ensure(Number.isInteger(effect.SOURCE_ORDINAL))
        return [
          {
            effectId: text(effect.EFFECT_ID),
            boundaryId: text(boundary.BOUNDARY_ID),
            boundaryHash: text(boundary.SOURCE_SHA256),
            ordinal: effect.SOURCE_ORDINAL as number,
            sourcePath: text(boundary.SOURCE_PATH),
            source,
            sourceHash,
          },
        ]
      })
    })
    ensure(sources.length === 75, 'PROCEDURAL_DENOMINATOR_DRIFT')
  }
  return structuredClone(sources)
}
// Dollar bodies are flattened by the existing lexer. Comments are not parsed as SQL.
function code(source: string): string {
  return sqlTokens(source)
    .map((t) =>
      t.kind === 'STRING'
        ? `'${t.value.replaceAll("'", "''")}'`
        : t.kind === 'IDENTIFIER'
          ? `"${t.value.replaceAll('"', '""')}"`
          : t.value,
    )
    .join(' ')
}
function literals(value: string): string[] {
  return sqlTokens(value)
    .filter((t) => t.kind === 'STRING')
    .map((t) => t.value)
}
function array(code: string, name: string): string[] {
  const match = new RegExp(
    `${name}\\s+TEXT\\s*\\[\\s*\\]\\s*(?::=|: =)\\s*ARRAY\\s*\\[([\\s\\S]*?)\\]`,
    'i',
  ).exec(code)
  return match ? literals(match[1]) : []
}
function balanced(value: string, start: number): { body: string; end: number } {
  const tokens = sqlTokens(value.slice(start))
  ensure(tokens[0]?.value === '(', 'PROCEDURAL_GRAMMAR_UNSUPPORTED')
  let depth = 0
  for (const token of tokens) {
    if (token.kind === 'SYMBOL' && token.value === '(') depth++
    if (token.kind === 'SYMBOL' && token.value === ')' && --depth === 0)
      return { body: value.slice(start + 1, start + token.start), end: start + token.end }
  }
  throw new ProvisioningError('PROCEDURAL_GRAMMAR_UNSUPPORTED')
}
function policyClauses(value: string): Pick<Policy, 'using' | 'check'> {
  const result: Pick<Policy, 'using' | 'check'> = { using: null, check: null }
  for (const [keyword, key] of [
    ['USING', 'using'],
    ['WITH CHECK', 'check'],
  ] as const) {
    const match = new RegExp(`\\b${keyword}\\s*\\(`, 'i').exec(value)
    if (match) result[key] = balanced(value, match.index + match[0].lastIndexOf('(')).body
  }
  return result
}
export function compileProceduralEffect(source: string, sourceHash: string): ProceduralContract {
  ensure(replayHash(source) === sourceHash, 'PROCEDURAL_SOURCE_HASH_DRIFT')
  const binding = frozenProceduralSources().find(
    (s) => s.sourceHash === sourceHash && s.source === source,
  )
  ensure(binding, 'PROCEDURAL_UNFROZEN_SOURCE')
  const sql = code(source)
  let geometry: Geometry
  if (/^DO BEGIN CREATE TYPE /i.test(sql)) {
    geometry = {
      kind: 'ENUM',
      enum: compileEnumWrapper(source, sourceHash),
      qualified: /^DO BEGIN CREATE TYPE [^ ]+ \./i.test(sql),
    }
  } else if (
    sql.includes("'GRANT CONNECT ON DATABASE %I TO union_eyes_runtime, union_eyes_system'")
  ) {
    geometry = { kind: 'CONNECT', roles: ['union_eyes_runtime', 'union_eyes_system'] }
  } else if (/CREATE TRIGGER /i.test(sql)) {
    const match =
      /CREATE TRIGGER (\w+) BEFORE INSERT OR UPDATE ON (\w+) FOR EACH ROW EXECUTE FUNCTION (\w+) \(/i.exec(
        sql,
      )
    ensure(match, 'PROCEDURAL_GRAMMAR_UNSUPPORTED')
    geometry = { kind: 'TRIGGER', name: match[1], table: match[2], functionName: match[3] }
  } else if (/CREATE POLICY /i.test(sql)) {
    const matches = [
      ...sql.matchAll(
        /CREATE POLICY (\w+) ON (\w+) FOR (ALL|SELECT|INSERT|UPDATE|DELETE) TO (\w+) ([\s\S]*?);/gi,
      ),
    ]
    ensure(matches.length > 0, 'PROCEDURAL_GRAMMAR_UNSUPPORTED')
    const policies = matches.map(
      (m): Policy => ({
        name: m[1],
        table: m[2],
        command: { ALL: '*', SELECT: 'r', INSERT: 'a', UPDATE: 'w', DELETE: 'd' }[
          m[3].toUpperCase()
        ]!,
        role: m[4],
        ...policyClauses(m[5]),
      }),
    )
    ensure(policies.every((p) => p.table === policies[0].table))
    geometry = {
      kind: 'POLICIES',
      table: policies[0].table,
      rls: /ENABLE ROW LEVEL SECURITY/i.test(sql),
      policies,
    }
  } else if (/UPDATE member_documents /i.test(sql)) {
    geometry = {
      kind: 'BACKFILL',
      table: 'member_documents',
      column: compileColumnDefinition({
        name: 'organization_id',
        definition: 'organization_id uuid',
      }),
      indexes: [...sql.matchAll(/CREATE INDEX IF NOT EXISTS [^;]+;/gi)].map((m) =>
        compileSimpleIndex(m[0], replayHash(m[0])),
      ),
    }
    ensure(geometry.indexes.length === 2, 'PROCEDURAL_GRAMMAR_UNSUPPORTED')
  } else if (/ADD COLUMN /i.test(sql) && !/UPDATE member_documents /i.test(sql)) {
    const match = /to_regclass \( 'public\.(\w+)' \)/i.exec(sql)
    ensure(match, 'PROCEDURAL_GRAMMAR_UNSUPPORTED')
    const table = match[1]
    const fks = [...sql.matchAll(/ALTER TABLE \w+ ADD CONSTRAINT [^;]+;/gi)].map((m) =>
      compileForeignKey(m[0], replayHash(m[0])),
    )
    const indexes = [...sql.matchAll(/CREATE INDEX [^;]+;/gi)].map((m) =>
      compileSimpleIndex(m[0], replayHash(m[0])),
    )
    const columns = [...sql.matchAll(/ALTER TABLE \w+ ADD COLUMN (\w+) ([^;]+);/gi)].map(
      (m): RetrofitColumn => {
        const definition = `${m[1]} ${m[2]}`
          .replace(/\[\s+\]/g, '[]')
          .replace(/\(\s*([\d\s]+)\)/g, (_, digits: string) => `(${digits.replace(/\s+/g, '')})`)
        const column =
          m[2].replace(/\s+/g, '') === 'uuid[]'
            ? {
                ...compileColumnDefinition({ name: m[1], definition: `${m[1]} uuid` }),
                type: { schema: 'pg_catalog', name: '_uuid', display: 'uuid[]', enum: null },
              }
            : compileColumnDefinition({ name: m[1], definition })
        return {
          column,
          foreignKeys: fks.filter((fk) => fk.columns.includes(m[1])),
          indexes: indexes.filter((idx) => idx.columns.includes(m[1])),
        }
      },
    )
    ensure(columns.length > 0 && columns.every((c) => !c.column.primary))
    geometry = { kind: 'RETROFIT', table, columns }
  } else if (/FROM pg_policies|FOREACH t IN ARRAY target_tables/i.test(sql)) {
    const prohibition = /qual ILIKE/i.test(sql)
    const tables = array(sql, 'target_tables')
    if (!tables.length) {
      const match = /tablename\s*(?:=\s*ANY\s*\(\s*ARRAY\s*\[|IN\s*\()([\s\S]*?)(?:\]|\))/i.exec(
        sql,
      )
      ensure(match, 'PROCEDURAL_GRAMMAR_UNSUPPORTED')
      tables.push(...literals(match[1]))
    }
    const policyNames = /policyname IN \(([\s\S]*?)\)/i.exec(sql)
    const columns: [string, string][] = [
      ...sql.matchAll(/table_name = '(\w+)' AND column_name = '(\w+)'/gi),
    ].map((m) => [m[1], m[2]])
    const present = /present_cols TEXT \[ \] \[ \] : = ARRAY \[([\s\S]*?)\] ;/i.exec(sql)
    if (present)
      for (const m of present[1].matchAll(/ARRAY \[ '(\w+)' , '(\w+)' \]/g))
        columns.push([m[1], m[2]])
    geometry = {
      kind: 'GUARD',
      tables,
      parents: array(sql, 'parent_tables'),
      columns,
      policies: policyNames ? literals(policyNames[1]) : [],
      mode: prohibition
        ? 'PROHIBITION'
        : /r \. cmd <\s*>/i.test(sql)
          ? 'COMMAND_AND_ROLE'
          : /r \. roles <\s*>/i.test(sql)
            ? 'ROLE_ONLY'
            : 'REQUIRED_RELATIONS',
    }
  } else if (/ALTER COLUMN .* SET DEFAULT/i.test(sql)) {
    const assignments = [
      ...sql.matchAll(
        /ALTER TABLE (organization_members|claim_updates) ALTER COLUMN (\w+) SET DEFAULT (gen_random_uuid \( \)|'full_member') ;/gi,
      ),
    ]
    ensure(assignments.length > 0, 'PROCEDURAL_GRAMMAR_UNSUPPORTED')
    const table = assignments[0][1] as 'organization_members' | 'claim_updates'
    const guard = /column_default IS NULL/i.test(sql) ? 'PUBLIC_VISIBLE_ID_NULL_DEFAULT' : null
    geometry = {
      kind: 'DEFAULTS',
      table,
      guard,
      assignments: assignments.map((m): DefaultAssignment => {
        ensure(m[1] === table, 'PROCEDURAL_GRAMMAR_UNSUPPORTED')
        const clause = guard
          ? sql.slice(sql.indexOf('EXCEPTION'))
          : sql.slice(m.index! + m[0].length).split(/\bEND\b/i)[0]
        const catches = [
          ...clause.matchAll(/\b(undefined_column|undefined_function|datatype_mismatch)\b/g),
        ].map((match) => match[1] as DefaultAssignment['catches'][number])
        ensure(catches.length > 0, 'PROCEDURAL_GRAMMAR_UNSUPPORTED')
        return {
          column: m[2],
          value: m[3].startsWith("'") ? 'FULL_MEMBER' : 'UUID_GENERATOR',
          catches,
        }
      }),
      updateNullCategory:
        /UPDATE organization_members SET member_category = 'full_member' WHERE member_category IS NULL/i.test(
          sql,
        ),
    }
  } else throw new ProvisioningError('PROCEDURAL_GRAMMAR_UNSUPPORTED')
  const body = {
    binding,
    geometry,
    transaction: 'WHOLE_DO_ATOMIC_WITH_SOURCE_EXCEPTION_SUBTRANSACTIONS' as const,
  }
  return { ...body, contractDigest: replayDigest(body) }
}
export const proceduralQueries = {
  defaultColumn: `SELECT a.attname AS name,a.atttypid::text AS type_oid,a.atttypmod::int AS typmod,t.typname AS type_name,n.nspname AS type_schema,t.typtype AS type_kind,t.typcategory AS category,t.typbasetype::text AS base_oid,pg_catalog.format_type(t.oid,a.atttypmod) AS postgres_type,
    a.attnotnull AS not_null,a.attidentity AS identity,a.attgenerated AS generated,
    pn.nspname AS input_schema,p.proname AS input_name,l.lanname AS input_language,p.prosrc AS input_source,
    COALESCE((SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) FROM pg_catalog.pg_enum e WHERE e.enumtypid=t.oid),ARRAY[]::text[]) AS labels,
    pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS default_expression,
    COALESCE((SELECT array_agg(m[1] ORDER BY m[1]) FROM pg_catalog.regexp_matches(d.adbin::text,':funcid ([0-9]+)','g') m),ARRAY[]::text[]) AS default_functions,
    COALESCE((SELECT array_agg(dep.refobjid::text ORDER BY dep.refobjid) FROM pg_catalog.pg_depend dep WHERE dep.classid='pg_catalog.pg_attrdef'::regclass AND dep.objid=d.oid AND dep.refclassid='pg_catalog.pg_proc'::regclass),ARRAY[]::text[]) AS function_dependencies,
    COALESCE((SELECT array_agg(dep.refobjid::text ORDER BY dep.refobjid) FROM pg_catalog.pg_depend dep WHERE dep.classid='pg_catalog.pg_attrdef'::regclass AND dep.objid=d.oid AND dep.refclassid='pg_catalog.pg_type'::regclass),ARRAY[]::text[]) AS type_dependencies
    FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_class c ON c.oid=a.attrelid JOIN pg_catalog.pg_namespace cn ON cn.oid=c.relnamespace JOIN pg_catalog.pg_type t ON t.oid=a.atttypid JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace JOIN pg_catalog.pg_proc p ON p.oid=t.typinput JOIN pg_catalog.pg_namespace pn ON pn.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE cn.nspname=$1 AND c.relname=$2 AND a.attname=$3 AND a.attnum>0 AND NOT a.attisdropped`,
  defaultGenerator: `SELECT p.oid::text AS oid,n.nspname AS schema,p.proname AS name,l.lanname AS language,p.prosrc AS source,p.probin AS binary,p.pronargs::int AS arguments,p.prokind AS kind,p.provolatile AS volatility,p.proretset AS set_returning,p.prosecdef AS security_definer,p.proconfig AS configuration,t.typname AS result,tn.nspname AS result_schema,pg_catalog.has_function_privilege(p.oid,'EXECUTE') AS executable,
    (SELECT e.extname FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_extension e ON e.oid=d.refobjid WHERE d.classid='pg_catalog.pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e') AS extension
    FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang JOIN pg_catalog.pg_type t ON t.oid=p.prorettype JOIN pg_catalog.pg_namespace tn ON tn.oid=t.typnamespace WHERE p.oid=pg_catalog.to_regprocedure('gen_random_uuid()')`,
  defaultGeneratorCandidates: `SELECT p.oid::text AS oid,n.nspname AS schema,p.pronargs::int AS arguments,p.pronargdefaults::int AS defaults,p.provariadic::text AS variadic FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE p.proname='gen_random_uuid' AND n.nspname=ANY(pg_catalog.current_schemas(true)) AND n.nspname NOT LIKE 'pg_temp_%' AND (p.pronargs-p.pronargdefaults-CASE WHEN p.provariadic<>0 THEN 1 ELSE 0 END)<=0 ORDER BY p.oid`,
  uuidAssignmentCast: `SELECT c.castcontext AS context,c.castmethod AS method,c.castfunc::text AS function_oid FROM pg_catalog.pg_cast c WHERE c.castsource='pg_catalog.uuid'::regtype AND c.casttarget=$1::oid`,
  nativeTypmod: `SELECT p.oid::text AS oid,p.proname AS name,p.prosrc AS source,l.lanname AS language FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE n.nspname='pg_catalog' AND p.proname=$1 AND p.pronargs=3 AND p.proargtypes[0]=$2::oid AND p.proargtypes[1]='pg_catalog.int4'::regtype AND p.proargtypes[2]='pg_catalog.bool'::regtype`,
  defaultPrivileges: `SELECT pg_catalog.pg_has_role(c.relowner,'USAGE') AS can_alter,CASE WHEN a.attnum IS NULL THEN false ELSE pg_catalog.has_column_privilege(c.oid,a.attnum,'SELECT') END AS can_select,CASE WHEN a.attnum IS NULL THEN false ELSE pg_catalog.has_column_privilege(c.oid,a.attnum,'UPDATE') END AS can_update,
    COALESCE((SELECT array_agg(pg_catalog.pg_get_constraintdef(k.oid) ORDER BY k.oid) FROM pg_catalog.pg_constraint k WHERE k.conrelid=c.oid AND k.contype IN ('c','f','x')),ARRAY[]::text[]) AS constraints,
    COALESCE((SELECT array_agg(pg_catalog.pg_get_triggerdef(t.oid) ORDER BY t.oid) FROM pg_catalog.pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal AND t.tgenabled<>'D'),ARRAY[]::text[]) AS triggers,
    COALESCE((SELECT array_agg(pg_catalog.pg_get_ruledef(r.oid) ORDER BY r.oid) FROM pg_catalog.pg_rewrite r WHERE r.ev_class=c.oid AND r.rulename<>'_RETURN'),ARRAY[]::text[]) AS rules
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attname=$3 AND a.attnum>0 AND NOT a.attisdropped WHERE n.nspname=$1 AND c.relname=$2`,
  identity:
    'SELECT current_user::text AS actor,current_database()::text AS database,pg_catalog.current_schemas(true)::text[] AS search_path',
  policies:
    "SELECT schemaname,tablename,policyname,cmd,roles,qual,(qual ILIKE '%IS NULL%' AND qual ILIKE '%current_org_id%') AS source_prohibited FROM pg_catalog.pg_policies ORDER BY schemaname,tablename,policyname",
  visibleColumn: `SELECT column_name AS name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3`,
  databaseAcl: `SELECT d.datname AS database,grantor.rolname AS grantor,CASE WHEN acl.grantee=0 THEN 'public' ELSE grantee.rolname END AS grantee,acl.privilege_type AS privilege,acl.is_grantable AS grantable FROM pg_catalog.pg_database d CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(d.datacl,pg_catalog.acldefault('d',d.datdba))) acl LEFT JOIN pg_catalog.pg_roles grantor ON grantor.oid=acl.grantor LEFT JOIN pg_catalog.pg_roles grantee ON grantee.oid=acl.grantee WHERE d.datname=$1`,
  trigger: `SELECT t.tgname AS name,t.tgtype::int AS type,t.tgenabled AS enabled,t.tgisinternal AS internal,t.tgnargs::int AS arguments,t.tgargs::text AS argument_bytes,t.tgconstraint::text AS constraint_oid,t.tgdeferrable AS deferrable,t.tginitdeferred AS deferred,pg_catalog.pg_get_expr(t.tgqual,t.tgrelid) AS qualification,t.tgoldtable AS old_table,t.tgnewtable AS new_table,n.nspname AS function_schema,p.proname AS function_name FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace cn ON cn.oid=c.relnamespace JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE cn.nspname=$1 AND c.relname=$2 AND t.tgname=$3`,
}
export function categoryAggregateQuery(schema: string): string {
  return `SELECT member_category::text AS value,count(*)::text AS total FROM "${schema.replaceAll('"', '""')}"."organization_members" GROUP BY member_category ORDER BY member_category NULLS FIRST`
}
export function tableCountQuery(schema: string, table: string): string {
  const quote = (v: string) => `"${v.replaceAll('"', '""')}"`
  return `SELECT count(*)::text AS total FROM ${quote(schema)}.${quote(table)}`
}
export function memberDocumentsAggregateQuery(schema: string, membershipSchema: string): string {
  const quote = (v: string) => `"${v.replaceAll('"', '""')}"`
  const documents = `${quote(schema)}."member_documents"`
  const members = `${quote(membershipSchema)}."organization_members"`
  // The source counts ambiguous groups by md.id, not by user or membership rows.
  return `SELECT (SELECT pg_catalog.count(*)::text FROM ${documents} WHERE organization_id IS NULL) AS null_rows,
    pg_catalog.count(*) FILTER (WHERE distinct_org_count=0)::text AS zero_match_groups,
    pg_catalog.count(*) FILTER (WHERE distinct_org_count>1)::text AS multi_match_groups
    FROM (SELECT md.id,pg_catalog.count(DISTINCT om.organization_id) AS distinct_org_count
      FROM ${documents} md LEFT JOIN ${members} om ON om.user_id=md.user_id
      WHERE md.organization_id IS NULL GROUP BY md.id) match_counts`
}
async function one(
  reader: CatalogReader,
  query: string,
  params: string[],
): Promise<Record<string, unknown> | null> {
  const rows = await reader.query(query, params)
  ensure(Array.isArray(rows) && rows.length <= 1)
  return rows.length ? object(rows[0]) : null
}
async function relation(reader: CatalogReader, schema: string, name: string) {
  const row = await one(reader, helperCatalogQueries.relation, [schema, name])
  if (!row) return null
  ensure(text(row.schema) === schema && text(row.name) === name && /^\d+$/.test(text(row.oid)))
  text(row.kind)
  bool(row.enabled)
  bool(row.forced)
  bool(row.visible)
  ensure(Number.isInteger(row.inheritance))
  return row
}
function same(left: unknown, right: unknown) {
  return replayDigest(left) === replayDigest(right)
}
/**
 * Closed, conjunction-only policy normal form. Removing grouping is safe ONLY
 * within these frozen positive equality/EXISTS/inner-JOIN/boolean expressions.
 * Reject OR/NOT, arithmetic, extra clauses and non-text casts rather than weaken
 * precedence or cast semantics. Literal text casts from pg_get_expr are ignored.
 */
export function proceduralPolicyNormalForm(expression: string): string[] {
  const tokens = sqlTokens(expression)
  let depth = 0
  for (const token of tokens) {
    if (token.kind === 'SYMBOL' && token.value === '(') depth++
    if (token.kind === 'SYMBOL' && token.value === ')') {
      depth--
      ensure(depth >= 0, 'PROCEDURAL_POLICY_EXPRESSION_UNSUPPORTED')
    }
  }
  ensure(depth === 0 && tokens.length > 0, 'PROCEDURAL_POLICY_EXPRESSION_UNSUPPORTED')
  ensure(
    !tokens.some(
      (t) =>
        t.kind === 'WORD' &&
        ['OR', 'NOT', 'UNION', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'LIMIT'].includes(
          t.value.toUpperCase(),
        ),
    ),
    'PROCEDURAL_POLICY_EXPRESSION_UNSUPPORTED',
  )
  const values: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.kind === 'SYMBOL' && ['(', ')'].includes(t.value)) continue
    if (t.value === ':' && tokens[i + 1]?.value === ':') {
      ensure(
        tokens[i + 2]?.value.toLowerCase() === 'text',
        'PROCEDURAL_POLICY_EXPRESSION_UNSUPPORTED',
      )
      // UUID-column casts must remain; only literal casts are redundant here.
      if (tokens[i - 1]?.kind !== 'STRING') values.push('::text')
      i += 2
      continue
    }
    values.push(
      t.kind === 'WORD'
        ? t.value.toLowerCase()
        : t.kind === 'STRING'
          ? `STRING:${t.value}`
          : t.value,
    )
  }
  return values
}
function combine(states: ProceduralState[]): ProceduralState {
  if (states.includes('MISSING_PREREQUISITE')) return 'MISSING_PREREQUISITE'
  if (states.includes('DRIFTED')) return 'DRIFTED'
  if (states.every((s) => s === 'EXACT')) return 'EXACT'
  if (states.every((s) => s === 'UNSATISFIED')) return 'UNSATISFIED'
  return 'PARTIAL'
}
async function defaultColumn(reader: CatalogReader, schema: string, table: string, name: string) {
  const row = await one(reader, proceduralQueries.defaultColumn, [schema, table, name])
  if (!row) return null
  ensure(text(row.name) === name)
  for (const key of ['type_oid', 'base_oid']) count(row[key])
  for (const key of [
    'type_name',
    'type_schema',
    'type_kind',
    'category',
    'postgres_type',
    'identity',
    'generated',
    'input_schema',
    'input_name',
    'input_language',
    'input_source',
  ])
    text(row[key])
  ensure(Number.isInteger(row.typmod) && (row.typmod as number) >= -1)
  bool(row.not_null)
  for (const key of ['labels', 'default_functions', 'function_dependencies', 'type_dependencies']) {
    const values = strings(row[key])
    ensure(new Set(values).size === values.length || key === 'default_functions')
    if (key !== 'labels') for (const value of values) count(value)
  }
  ensure(row.default_expression === null || typeof row.default_expression === 'string')
  if (row.default_expression === null)
    ensure(
      ['default_functions', 'function_dependencies', 'type_dependencies'].every(
        (k) => strings(row[k]).length === 0,
      ),
    )
  return row
}
function columnShape(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).filter(
      ([key]) =>
        ![
          'default_expression',
          'default_functions',
          'function_dependencies',
          'type_dependencies',
        ].includes(key),
    ),
  )
}
function nativeColumn(row: Record<string, unknown>) {
  if (row.base_oid !== '0' || row.identity !== '' || row.generated !== '') return false
  if (row.input_schema !== 'pg_catalog' || row.input_language !== 'internal') return false
  if (row.type_kind === 'e')
    return row.input_name === 'enum_in' && row.input_source === 'enum_in' && row.category === 'E'
  const input = row.type_name === 'uuid' ? 'uuid_in' : `${row.type_name}in`
  return (
    row.type_kind === 'b' &&
    row.type_schema === 'pg_catalog' &&
    row.input_name === input &&
    row.input_source === input
  )
}
async function generator(reader: CatalogReader) {
  const row = await one(reader, proceduralQueries.defaultGenerator, [])
  if (!row) return null
  count(row.oid)
  for (const key of [
    'schema',
    'name',
    'language',
    'source',
    'result',
    'result_schema',
    'kind',
    'volatility',
  ])
    text(row[key])
  ensure(Number.isInteger(row.arguments))
  for (const key of ['executable', 'security_definer', 'set_returning']) bool(row[key])
  ensure(row.configuration === null || Array.isArray(row.configuration))
  if (row.configuration !== null) strings(row.configuration)
  ensure(row.binary === null || typeof row.binary === 'string')
  ensure(row.extension === null || typeof row.extension === 'string')
  return row
}
function nativeGenerator(row: Record<string, unknown>) {
  const builtin =
    row.schema === 'pg_catalog' &&
    row.language === 'internal' &&
    row.source === 'gen_random_uuid' &&
    row.binary === null &&
    row.extension === null
  const extension =
    row.language === 'c' &&
    row.source === 'pg_random_uuid' &&
    row.binary === '$libdir/pgcrypto' &&
    row.extension === 'pgcrypto'
  return (
    (builtin || extension) &&
    row.name === 'gen_random_uuid' &&
    row.arguments === 0 &&
    row.kind === 'f' &&
    row.volatility === 'v' &&
    row.set_returning === false &&
    row.security_definer === false &&
    row.configuration === null &&
    row.result_schema === 'pg_catalog' &&
    row.result === 'uuid'
  )
}
export async function inspectProceduralEffect(
  reader: CatalogReader,
  contract: ProceduralContract,
  context?: ProceduralContext,
  predecessor?: ProceduralPredecessor,
): Promise<ProceduralObservation> {
  ensure(
    same(compileProceduralEffect(contract.binding.source, contract.binding.sourceHash), contract),
    'PROCEDURAL_CONTRACT_DRIFT',
  )
  const facts: unknown[] = []
  const result = (
    state: ProceduralState,
    branch: string,
    limitation: string | null = null,
  ): ProceduralObservation => ({
    state,
    branch,
    stateDigest: replayDigest({ contract: contract.contractDigest, context, facts, state, branch }),
    limitation,
    wholeUnitEligibility: 'NOT_ESTABLISHED',
  })
  const g = contract.geometry
  const b = contract.binding
  if (
    !context ||
    context.effectId !== b.effectId ||
    context.sourceHash !== b.sourceHash ||
    context.boundaryHash !== b.boundaryHash ||
    context.ordinal !== b.ordinal ||
    context.window !== 'IMMEDIATE_PRE_SUCCESSOR' ||
    !/^[a-f0-9]{64}$/.test(context.snapshotDigest) ||
    !context.actor ||
    !context.database ||
    !context.searchPath.length ||
    context.catalogVisibility.snapshotDigest !== context.snapshotDigest
  )
    return result('MISSING_PREREQUISITE', 'POSITION_CONTEXT_MISSING')
  const identity = await one(reader, proceduralQueries.identity, [])
  facts.push(identity)
  if (
    !identity ||
    text(identity.actor) !== context.actor ||
    text(identity.database) !== context.database ||
    !same(strings(identity.search_path), context.searchPath)
  )
    return result('MISSING_PREREQUISITE', 'POSITION_IDENTITY_MISMATCH')
  const covered = (schema: string) =>
    context.catalogVisibility.allSchemas === true ||
    context.catalogVisibility.schemas.includes(schema)
  const resolved = (name: string, expected?: string) => {
    const schema = context.relations[name]
    return schema && covered(schema) && (!expected || schema === expected) ? schema : null
  }
  const target = async (name: string, expected?: string) => {
    const schema = resolved(name, expected)
    if (!schema) return undefined
    const row = await relation(reader, schema, name)
    facts.push({ schema, name, row })
    if (row && !row.visible) return undefined
    return row
  }
  if (g.kind === 'DEFAULTS') {
    if (
      !predecessor ||
      !/^[a-f0-9]{64}$/.test(predecessor.snapshotDigest) ||
      predecessor.snapshotDigest === context.snapshotDigest
    )
      return result('MISSING_PREREQUISITE', 'DEFAULT_PRE_BLOCK_SNAPSHOT_MISSING')
    const priorIdentity = await one(predecessor.reader, proceduralQueries.identity, [])
    facts.push({ predecessor: predecessor.snapshotDigest, priorIdentity })
    if (!priorIdentity || !same(priorIdentity, identity))
      return result('MISSING_PREREQUISITE', 'DEFAULT_PRE_BLOCK_IDENTITY_MISMATCH')
    const before = predecessor.reader
    if (g.guard) {
      if (!covered('public'))
        return result('MISSING_PREREQUISITE', 'DEFAULT_GUARD_VISIBILITY_MISSING')
      const visible = await one(before, proceduralQueries.visibleColumn, ['public', g.table, 'id'])
      if (visible) ensure(text(visible.name) === 'id')
      const prior = await defaultColumn(before, 'public', g.table, 'id')
      const current = await defaultColumn(reader, 'public', g.table, 'id')
      facts.push({ guard: { visible, prior, current } })
      if (visible) ensure(prior !== null)
      if (!visible || prior!.default_expression !== null)
        return result(
          same(prior, current) ? 'EXACT' : 'DRIFTED',
          'PUBLIC_VISIBLE_ID_NULL_DEFAULT_GUARD_SKIPS',
        )
    }
    const schema = resolved(g.table)
    if (!schema) return result('MISSING_PREREQUISITE', 'DEFAULT_TARGET_RESOLUTION_MISSING')
    const priorRelation = await relation(before, schema, g.table)
    const currentRelation = await target(g.table)
    facts.push({ priorRelation })
    if (!priorRelation || !currentRelation || !priorRelation.visible)
      return result('MISSING_PREREQUISITE', 'UNCAUGHT_UNDEFINED_TABLE_OR_INVISIBLE_TARGET')
    if (
      !same(priorRelation, currentRelation) ||
      currentRelation.kind !== 'r' ||
      currentRelation.inheritance !== 0
    )
      return result('DRIFTED', 'DEFAULT_RELATION_DRIFT')
    const states: ProceduralState[] = []
    const branches: string[] = []
    for (const assignment of g.assignments) {
      const prior = await defaultColumn(before, schema, g.table, assignment.column)
      const current = await defaultColumn(reader, schema, g.table, assignment.column)
      facts.push({ assignment, prior, current })
      const privileges = await one(before, proceduralQueries.defaultPrivileges, [
        schema,
        g.table,
        assignment.column,
      ])
      facts.push(privileges)
      if (!privileges) return result('MISSING_PREREQUISITE', 'DEFAULT_PRIVILEGE_CATALOG_ABSENT')
      for (const key of ['can_alter', 'can_select', 'can_update']) bool(privileges[key])
      for (const key of ['constraints', 'triggers', 'rules']) strings(privileges[key])
      if (!privileges.can_alter) {
        states.push('MISSING_PREREQUISITE')
        branches.push(`${assignment.column}:UNCAUGHT_INSUFFICIENT_PRIVILEGE`)
        continue
      }
      if (!prior) {
        states.push(
          assignment.catches.includes('undefined_column')
            ? current
              ? 'DRIFTED'
              : 'EXACT'
            : 'MISSING_PREREQUISITE',
        )
        branches.push(`${assignment.column}:undefined_column:SUBTRANSACTION_ROLLBACK`)
        if (g.updateNullCategory)
          branches.push(
            'member_category:UPDATE_NULLS:undefined_column:INDEPENDENT_SUBTRANSACTION_ROLLBACK',
          )
        continue
      }
      if (!current || !same(columnShape(prior), columnShape(current))) {
        states.push('DRIFTED')
        branches.push(`${assignment.column}:COLUMN_TYPE_OR_SHAPE_DRIFT`)
        continue
      }
      if (!nativeColumn(prior)) {
        states.push('MISSING_PREREQUISITE')
        branches.push(`${assignment.column}:NATIVE_INPUT_TYPE_REQUIRED`)
        continue
      }
      let random: Record<string, unknown> | null = null
      let error: DefaultAssignment['catches'][number] | null = null
      if (assignment.value === 'UUID_GENERATOR') {
        if (!context.searchPath.every(covered))
          return result(
            'MISSING_PREREQUISITE',
            'GENERATOR_SEARCH_PATH_INVENTORY_VISIBILITY_MISSING',
          )
        random = await generator(before)
        const currentRandom = await generator(reader)
        const readCandidates = async (r: CatalogReader) => {
          const rows = (await r.query(proceduralQueries.defaultGeneratorCandidates, [])).map(object)
          const oids = new Set<string>()
          for (const row of rows) {
            const oid = text(row.oid)
            count(oid)
            text(row.schema)
            count(row.variadic)
            ensure(!oids.has(oid))
            oids.add(oid)
            ensure(
              Number.isInteger(row.arguments) &&
                Number.isInteger(row.defaults) &&
                (row.arguments as number) >= 0 &&
                (row.defaults as number) >= 0 &&
                (row.defaults as number) <= (row.arguments as number) &&
                (row.arguments as number) -
                  (row.defaults as number) -
                  (row.variadic === '0' ? 0 : 1) <=
                  0,
            )
          }
          return rows
        }
        const candidates = await readCandidates(before),
          currentCandidates = await readCandidates(reader)
        const cast = await one(before, proceduralQueries.uuidAssignmentCast, [text(prior.type_oid)])
        const currentCast = await one(reader, proceduralQueries.uuidAssignmentCast, [
          text(prior.type_oid),
        ])
        for (const row of [cast, currentCast])
          if (row) {
            ensure(['i', 'a', 'e'].includes(text(row.context)))
            ensure(['f', 'b', 'i'].includes(text(row.method)))
            count(row.function_oid)
          }
        facts.push({ random, currentRandom, candidates, currentCandidates, cast, currentCast })
        if (
          !same(random, currentRandom) ||
          !same(candidates, currentCandidates) ||
          !same(cast, currentCast)
        ) {
          states.push('DRIFTED')
          branches.push(`${assignment.column}:GENERATOR_OR_CAST_DRIFT`)
          continue
        }
        if (
          random &&
          cast &&
          ['i', 'a'].includes(text(cast.context)) &&
          prior.type_schema === 'pg_catalog' &&
          ['text', 'varchar', 'bpchar'].includes(text(prior.type_name)) &&
          !(cast.method === 'i' && cast.function_oid === '0')
        ) {
          states.push('DRIFTED')
          branches.push(`${assignment.column}:CUSTOM_STRING_ASSIGNMENT_CAST`)
          continue
        }
        if (!random && candidates.length) {
          states.push('DRIFTED')
          branches.push(
            `${assignment.column}:DEFAULTED_OR_VARIADIC_OVERLOAD_NOT_UNDEFINED_FUNCTION`,
          )
          continue
        }
        if (random)
          ensure(
            candidates.some(
              (c) =>
                c.oid === random!.oid &&
                c.schema === random!.schema &&
                c.arguments === 0 &&
                c.defaults === 0 &&
                c.variadic === '0',
            ),
          )
        if (!random) error = 'undefined_function'
        else if (!covered(text(random.schema))) {
          states.push('MISSING_PREREQUISITE')
          branches.push(`${assignment.column}:GENERATOR_SCHEMA_VISIBILITY_MISSING`)
          continue
        } else if (!nativeGenerator(random)) {
          states.push('DRIFTED')
          branches.push(`${assignment.column}:NON_NATIVE_GENERATOR`)
          continue
        } else if (!random.executable) {
          states.push('MISSING_PREREQUISITE')
          branches.push(`${assignment.column}:UNCAUGHT_EXECUTE_DENIED`)
          continue
        } else if (
          !(prior.type_schema === 'pg_catalog' && prior.type_name === 'uuid') &&
          !(
            prior.type_schema === 'pg_catalog' &&
            ['text', 'varchar', 'bpchar'].includes(text(prior.type_name))
          )
        ) {
          if (!cast || cast.context === 'e') error = 'datatype_mismatch'
          else {
            states.push('DRIFTED')
            branches.push(`${assignment.column}:NON_SOURCE_NATIVE_ASSIGNMENT_CAST`)
            continue
          }
        }
      } else if (
        !(
          prior.type_schema === 'pg_catalog' &&
          ['text', 'varchar', 'bpchar'].includes(text(prior.type_name))
        ) &&
        !(prior.type_kind === 'e' && strings(prior.labels).includes('full_member'))
      ) {
        states.push('DRIFTED')
        branches.push(`${assignment.column}:UNCAUGHT_INVALID_LITERAL_INPUT`)
        continue
      }
      if (error) {
        states.push(
          assignment.catches.includes(error)
            ? same(prior, current)
              ? 'EXACT'
              : 'DRIFTED'
            : 'MISSING_PREREQUISITE',
        )
        branches.push(`${assignment.column}:${error}:SUBTRANSACTION_ROLLBACK`)
        continue
      }
      const width = prior.typmod as number
      const length = assignment.value === 'UUID_GENERATOR' ? 36 : 11
      if (
        ['varchar', 'bpchar'].includes(text(prior.type_name)) &&
        width !== -1 &&
        width - 4 < length
      ) {
        states.push('DRIFTED')
        branches.push(`${assignment.column}:UNCAUGHT_STRING_DATA_RIGHT_TRUNCATION`)
        continue
      }
      let normalized = normalizeCreateDefault(
        current.default_expression as string | null,
        text(prior.postgres_type),
        random ? [text(random.schema)] : [],
        text(prior.type_schema),
      )
      // pg_get_expr groups CoerceViaIO casts. Accept only the resolved native call
      // followed by the exact target cast, never arbitrary surrounding SQL.
      if (random && normalized.kind === 'UNSUPPORTED') {
        const expression = text(current.default_expression)
        const compact = sqlTokens(expression)
          .map((t) => t.value)
          .join('')
          .replaceAll('"', '')
        const functionName = `${text(random.schema)}.gen_random_uuid`
        const ungrouped = compact.replaceAll('(', '').replaceAll(')', '')
        const targetType = text(prior.postgres_type)
          .replace(/\s+/g, '')
          .replaceAll('(', '')
          .replaceAll(')', '')
        let depth = 0
        for (const token of sqlTokens(expression)) {
          if (token.value === '(') depth++
          if (token.value === ')') depth--
          ensure(depth >= 0)
        }
        ensure(depth === 0)
        if (
          compact.includes('gen_random_uuid()') &&
          [`gen_random_uuid::${targetType}`, `${functionName}::${targetType}`].includes(ungrouped)
        )
          normalized = { kind: 'FUNCTION', name: 'canonical.gen_random_uuid' }
      }
      const expected =
        assignment.value === 'UUID_GENERATOR'
          ? { kind: 'FUNCTION', name: 'canonical.gen_random_uuid' }
          : { kind: 'STRING', value: 'full_member' }
      const expectedFunctions = random ? [text(random.oid)] : []
      if (random && ['varchar', 'bpchar'].includes(text(prior.type_name)) && width !== -1) {
        const modifier = await one(before, proceduralQueries.nativeTypmod, [
          text(prior.type_name),
          text(prior.type_oid),
        ])
        const currentModifier = await one(reader, proceduralQueries.nativeTypmod, [
          text(prior.type_name),
          text(prior.type_oid),
        ])
        facts.push({ modifier, currentModifier })
        for (const m of [modifier, currentModifier])
          if (m) {
            count(m.oid)
            text(m.name)
            text(m.source)
            text(m.language)
          }
        if (
          !modifier ||
          !same(modifier, currentModifier) ||
          modifier.name !== prior.type_name ||
          modifier.source !== prior.type_name ||
          modifier.language !== 'internal'
        ) {
          states.push('DRIFTED')
          branches.push(`${assignment.column}:TYPEMOD_FUNCTION_DRIFT`)
          continue
        }
        expectedFunctions.push(text(modifier.oid))
        expectedFunctions.sort()
      }
      const expectedDependencies = random?.extension === 'pgcrypto' ? [text(random.oid)] : []
      const expectedTypes = prior.type_kind === 'e' ? [text(prior.type_oid)] : []
      const exact =
        same(normalized, expected) &&
        same(current.default_functions, expectedFunctions) &&
        same(current.function_dependencies, expectedDependencies) &&
        same(current.type_dependencies, expectedTypes)
      states.push(exact ? 'EXACT' : same(prior, current) ? 'UNSATISFIED' : 'DRIFTED')
      branches.push(`${assignment.column}:SET_DEFAULT`)
      if (g.updateNullCategory) {
        const visibility = context.dataVisibility?.[`${schema}.${g.table}`]
        const priorVisibility = predecessor.dataVisibility?.[`${schema}.${g.table}`]
        if (
          !visibility ||
          visibility.snapshotDigest !== context.snapshotDigest ||
          !visibility.basis ||
          !priorVisibility ||
          priorVisibility.snapshotDigest !== predecessor.snapshotDigest ||
          !priorVisibility.basis ||
          !privileges.can_select ||
          !privileges.can_update
        )
          return result(
            'MISSING_PREREQUISITE',
            'CATEGORY_UPDATE_FULL_ROW_VISIBILITY_OR_PRIVILEGE_MISSING',
          )
        const readCounts = async (r: CatalogReader) => {
          const rows = (await r.query(categoryAggregateQuery(schema), [])).map(object)
          const map = new Map<string | null, bigint>()
          for (const row of rows) {
            ensure(row.value === null || typeof row.value === 'string')
            const value = row.value as string | null
            ensure(!map.has(value) && count(row.total) > 0n)
            map.set(value, count(row.total))
          }
          facts.push(rows)
          return map
        }
        const priorCounts = await readCounts(before),
          currentCounts = await readCounts(reader)
        const nulls = priorCounts.get(null) ?? 0n
        if (
          strings(privileges.triggers).length ||
          strings(privileges.rules).length ||
          (nulls > 0n && strings(privileges.constraints).length > 0)
        )
          return result(
            'MISSING_PREREQUISITE',
            'CATEGORY_UPDATE_EXTERNAL_CONSTRAINT_OR_TRIGGER_SEMANTICS_REQUIRED',
          )
        const expectedCounts = new Map(priorCounts)
        expectedCounts.delete(null)
        if (nulls) expectedCounts.set('full_member', (priorCounts.get('full_member') ?? 0n) + nulls)
        const sorted = (map: Map<string | null, bigint>) =>
          [...map]
            .map(([value, total]) => [value, total.toString()])
            .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
        states.push(
          same(sorted(expectedCounts), sorted(currentCounts))
            ? 'EXACT'
            : same(sorted(priorCounts), sorted(currentCounts))
              ? 'UNSATISFIED'
              : 'DRIFTED',
        )
        branches.push('member_category:UPDATE_NULLS:INDEPENDENT_SUBTRANSACTION')
      }
    }
    return result(combine(states), branches.join('|'))
  }
  if (g.kind === 'ENUM') {
    const schema = g.qualified ? g.enum.schema : context.creationSchema
    if (!schema || !covered(schema))
      return result('MISSING_PREREQUISITE', 'ENUM_CREATION_SCHEMA_MISSING')
    const ns = await one(reader, createCatalogQueries.namespace, [schema])
    if (!ns) return result('MISSING_PREREQUISITE', 'ENUM_NAMESPACE_ABSENT')
    ensure(text(ns.name) === schema)
    const row = await one(reader, catalogQueries.type, [schema, g.enum.name])
    facts.push(row)
    if (!row) return result('UNSATISFIED', 'ENUM_ABSENT')
    const members = strings(row.members)
    return result(
      text(row.kind) === 'e' && same(members, g.enum.members) ? 'EXACT' : 'DRIFTED',
      'DUPLICATE_OBJECT_DOES_NOT_CERTIFY_DEFINITION',
    )
  }
  if (g.kind === 'GUARD') {
    if (
      !covered('public') ||
      (g.mode === 'PROHIBITION' && context.catalogVisibility.allSchemas !== true)
    )
      return result('MISSING_PREREQUISITE', 'POLICY_INVENTORY_VISIBILITY_MISSING')
    for (const table of [...new Set([...g.tables, ...g.parents, ...g.columns.map(([t]) => t)])]) {
      // These source probes are explicitly public-qualified, unlike DDL targets.
      const row = await relation(reader, 'public', table)
      facts.push({ table, row })
      if (!row && g.mode === 'REQUIRED_RELATIONS')
        return result('MISSING_PREREQUISITE', 'REQUIRED_RELATION_ABSENT')
      if (row)
        for (const [t, c] of g.columns.filter(([t]) => t === table)) {
          const column = await one(reader, proceduralQueries.visibleColumn, ['public', t, c])
          facts.push(column)
          if (!column)
            return result('MISSING_PREREQUISITE', 'REQUIRED_VISIBLE_AUTHORITY_COLUMN_ABSENT')
          ensure(text(column.name) === c)
        }
    }
    if (g.mode === 'REQUIRED_RELATIONS') return result('EXACT', 'ALL_REQUIRED_RELATIONS_PRESENT')
    const rows = (await reader.query(proceduralQueries.policies, [])).map(object)
    const keys = new Set<string>()
    for (const row of rows) {
      const schema = text(row.schemaname),
        table = text(row.tablename),
        name = text(row.policyname)
      const key = `${schema}.${table}.${name}`
      ensure(!keys.has(key))
      keys.add(key)
      text(row.cmd)
      strings(row.roles)
      ensure(row.qual === null || typeof row.qual === 'string')
      if (!g.tables.includes(table) || (g.mode !== 'PROHIBITION' && schema !== 'public')) continue
      facts.push(row)
      if (g.mode === 'PROHIBITION') {
        // Catalog-evaluated ILIKE preserves wildcard '_' and database collation.
        // It is a predicate fact, not a reader's inspection-completion flag.
        ensure(row.source_prohibited === null || typeof row.source_prohibited === 'boolean')
        ensure((row.qual === null) === (row.source_prohibited === null))
        if (row.source_prohibited === true)
          return result('DRIFTED', 'SOURCE_PROHIBITION_WOULD_RAISE')
      } else if (g.policies.includes(name)) {
        const role = name === 'ue_system_full_access' ? 'union_eyes_system' : 'union_eyes_runtime'
        const command =
          /^ue_org_isolation_(select|insert|update|delete)$/.exec(name)?.[1].toUpperCase() ?? 'ALL'
        if (!same(row.roles, [role]) || (g.mode === 'COMMAND_AND_ROLE' && row.cmd !== command))
          return result('DRIFTED', 'SOURCE_CONFLICT_GUARD_WOULD_RAISE')
      }
    }
    return result('EXACT', 'SOURCE_GUARD_PASSES_NOT_A_POLICY_INSTALLATION_PROOF')
  }
  if (g.kind === 'CONNECT') {
    if (!context.databaseGrantor) return result('MISSING_PREREQUISITE', 'DATABASE_GRANTOR_MISSING')
    for (const role of g.roles) {
      const row = await one(reader, literalPolicyQueries.role, [role])
      if (!row) return result('MISSING_PREREQUISITE', 'GRANTEE_ROLE_ABSENT')
      ensure(text(row.name) === role)
    }
    const rows = (await reader.query(proceduralQueries.databaseAcl, [context.database])).map(object)
    const states = g.roles.map((role): ProceduralState => {
      for (const row of rows) {
        ensure(text(row.database) === context.database)
        text(row.grantor)
        text(row.grantee)
        text(row.privilege)
        bool(row.grantable)
      }
      const grants = rows.filter(
        (r) =>
          r.grantor === context.databaseGrantor && r.grantee === role && r.privilege === 'CONNECT',
      )
      ensure(grants.length <= 1)
      return !grants.length ? 'UNSATISFIED' : grants[0].grantable ? 'DRIFTED' : 'EXACT'
    })
    facts.push(rows)
    return result(combine(states), 'EXPLICIT_CONNECT_GRANT_NOT_EFFECTIVE_PRIVILEGE')
  }
  const row = await target(g.table, g.kind === 'TRIGGER' ? undefined : 'public')
  if (row === undefined)
    return result('MISSING_PREREQUISITE', 'UNQUALIFIED_TARGET_RESOLUTION_MISSING')
  if (!row) return result('EXACT', 'SOURCE_ABSENCE_GUARD_SKIPS')
  if (row.kind !== 'r' || row.inheritance !== 0)
    return result('DRIFTED', 'TARGET_KIND_OR_INHERITANCE_UNSUPPORTED')
  const schema = context.relations[g.table]
  if (g.kind === 'BACKFILL') {
    for (const parent of ['organizations', 'organization_members']) {
      const parentRow = await target(parent, 'public')
      if (!parentRow)
        return result('MISSING_PREREQUISITE', 'BACKFILL_PARENT_RESOLUTION_OR_RELATION_ABSENT')
      if (parentRow.kind !== 'r' || parentRow.inheritance !== 0)
        return result('DRIFTED', 'BACKFILL_PARENT_KIND_DRIFT')
    }
    for (const [table, names] of [
      ['member_documents', ['id', 'user_id']],
      ['organizations', ['id']],
      ['organization_members', ['user_id', 'organization_id']],
    ] as const) {
      for (const name of names) {
        const column = await one(reader, proceduralQueries.visibleColumn, [
          context.relations[table],
          table,
          name,
        ])
        facts.push(column)
        if (!column) return result('MISSING_PREREQUISITE', 'BACKFILL_OPERAND_COLUMN_ABSENT')
        ensure(text(column.name) === name)
      }
    }
    for (const table of ['member_documents', 'organization_members']) {
      const evidence = context.dataVisibility?.[`${context.relations[table]}.${table}`]
      if (!evidence || evidence.snapshotDigest !== context.snapshotDigest || !evidence.basis)
        return result('MISSING_PREREQUISITE', 'FULL_ROW_VISIBILITY_MISSING')
    }
    const columns = (await reader.query(createCatalogQueries.columns, [schema, g.table])).map(
      object,
    )
    ensure(new Set(columns.map((c) => text(c.name))).size === columns.length)
    facts.push(columns)
    const column = columns.find((c) => c.name === g.column.name)
    if (!column) return result('UNSATISFIED', 'BACKFILL_TENANT_COLUMN_ABSENT')
    text(column.postgres_type)
    text(column.type_schema)
    text(column.type_name)
    text(column.type_kind)
    bool(column.not_null)
    text(column.identity)
    text(column.generated)
    bool(column.collation_default)
    ensure(column.default_expression === null || typeof column.default_expression === 'string')
    ensure(column.acl === null || typeof column.acl === 'string')
    const states: ProceduralState[] = [
      column.type_schema === 'pg_catalog' &&
      column.type_name === 'uuid' &&
      column.type_kind === 'b' &&
      column.postgres_type === 'uuid' &&
      !column.not_null &&
      column.identity === '' &&
      column.generated === '' &&
      column.collation_default &&
      column.default_expression === null &&
      column.acl === null
        ? 'EXACT'
        : 'DRIFTED',
    ]
    const name = context.memberDocumentsForeignKeyName
    if (!name || !/^[a-z_][a-z0-9_]*$/.test(name))
      return result('MISSING_PREREQUISITE', 'INLINE_FK_NAME_RESOLUTION_MISSING')
    const fkSql = `ALTER TABLE member_documents ADD CONSTRAINT ${name} FOREIGN KEY (organization_id) REFERENCES organizations(id);`
    const foreignKey = await inspectForeignKey(reader, compileForeignKey(fkSql, replayHash(fkSql)))
    facts.push(foreignKey)
    states.push(
      foreignKey.definition === 'EXACT'
        ? 'EXACT'
        : foreignKey.definition === 'ABSENT'
          ? 'UNSATISFIED'
          : 'DRIFTED',
    )
    for (const index of g.indexes) {
      const observed = await inspectSimpleIndex(reader, index)
      facts.push(observed)
      states.push(
        observed.definition === 'EXACT'
          ? 'EXACT'
          : observed.definition === 'ABSENT'
            ? 'UNSATISFIED'
            : 'DRIFTED',
      )
    }
    const aggregate = await one(
      reader,
      memberDocumentsAggregateQuery(schema, context.relations.organization_members),
      [],
    )
    facts.push(aggregate)
    if (!aggregate) return result('MISSING_PREREQUISITE', 'VISIBLE_BACKFILL_AGGREGATE_MISSING')
    const nullRows = count(aggregate.null_rows),
      zeroGroups = count(aggregate.zero_match_groups),
      multipleGroups = count(aggregate.multi_match_groups)
    ensure(zeroGroups + multipleGroups <= nullRows, 'PROCEDURAL_BACKFILL_AGGREGATE_INCONSISTENT')
    if (zeroGroups || multipleGroups)
      return result(
        'MISSING_PREREQUISITE',
        'BACKFILL_SOURCE_INVARIANT_WOULD_RAISE_AND_ROLL_BACK_WHOLE_DO',
      )
    states.push(nullRows === 0n ? 'EXACT' : 'UNSATISFIED')
    return result(combine(states), 'BACKFILL_UNAMBIGUOUS_NULL_GROUPS_UPDATE_AND_OWNED_METADATA')
  }
  if (g.kind === 'RETROFIT') {
    const actual = (await reader.query(createCatalogQueries.columns, [schema, g.table])).map(object)
    ensure(new Set(actual.map((c) => text(c.name))).size === actual.length)
    const states: ProceduralState[] = []
    for (const spec of g.columns) {
      const c = actual.find((c) => c.name === spec.column.name)
      if (!c) {
        const visibility = context.dataVisibility?.[`${schema}.${g.table}`]
        if (
          !visibility ||
          visibility.snapshotDigest !== context.snapshotDigest ||
          !visibility.basis
        )
          return result('MISSING_PREREQUISITE', 'FULL_ROW_VISIBILITY_MISSING')
        const aggregate = await one(reader, tableCountQuery(schema, g.table), [])
        if (!aggregate) return result('MISSING_PREREQUISITE', 'VISIBLE_AGGREGATE_MISSING')
        facts.push(aggregate)
        if (count(aggregate.total) > 0n)
          return result('MISSING_PREREQUISITE', 'NONEMPTY_WITHOUT_DETERMINISTIC_AUTHORITY_SOURCE')
        states.push('UNSATISFIED')
        continue
      }
      text(c.postgres_type)
      text(c.type_schema)
      text(c.type_name)
      text(c.type_kind)
      bool(c.not_null)
      text(c.identity)
      text(c.generated)
      bool(c.collation_default)
      ensure(c.default_expression === null || typeof c.default_expression === 'string')
      ensure(c.acl === null || typeof c.acl === 'string')
      const expected = spec.column
      states.push(
        c.type_schema === expected.type.schema &&
          c.type_name === expected.type.name &&
          c.type_kind === 'b' &&
          text(c.postgres_type).replace(/\s*([(),])\s*/g, '$1') === expected.type.display &&
          c.not_null === expected.notNull &&
          c.identity === '' &&
          c.generated === '' &&
          c.collation_default === true &&
          c.acl === null &&
          same(
            normalizeCreateDefault(c.default_expression as string | null, text(c.postgres_type)),
            expected.normalizedDefault,
          )
          ? 'EXACT'
          : 'DRIFTED',
      )
      for (const fk of spec.foreignKeys) {
        if (!resolved(fk.parent, 'public'))
          return result('MISSING_PREREQUISITE', 'FK_PARENT_RESOLUTION_MISSING')
        const value = await inspectForeignKey(reader, fk)
        facts.push(value)
        states.push(
          value.definition === 'EXACT'
            ? 'EXACT'
            : value.definition === 'ABSENT'
              ? 'UNSATISFIED'
              : 'DRIFTED',
        )
      }
      for (const index of spec.indexes) {
        const value = await inspectSimpleIndex(reader, index)
        facts.push(value)
        states.push(
          value.definition === 'EXACT'
            ? 'EXACT'
            : value.definition === 'ABSENT'
              ? 'UNSATISFIED'
              : 'DRIFTED',
        )
      }
    }
    facts.push(actual)
    return result(combine(states), 'GUARDED_COLUMNS_EXACT_OWNED_METADATA_NOT_REAPPLY_REPAIR')
  }
  if (g.kind === 'POLICIES') {
    for (const role of new Set(g.policies.map((p) => p.role))) {
      const roleRow = await one(reader, literalPolicyQueries.role, [role])
      if (!roleRow) return result('MISSING_PREREQUISITE', 'POLICY_ROLE_ABSENT')
      ensure(text(roleRow.name) === role)
    }
    // Freeze resolution of every unqualified parent and check physical key columns.
    const expressions = g.policies
      .flatMap((p) => [p.using, p.check])
      .filter((v): v is string => v !== null)
    const refs = [
      ...new Set(
        expressions.flatMap((e) => [...e.matchAll(/\b(?:FROM|JOIN)\s+(\w+)/gi)].map((m) => m[1])),
      ),
    ]
    for (const parent of refs) {
      const parentRow = await target(parent, 'public')
      if (!parentRow)
        return result('MISSING_PREREQUISITE', 'POLICY_PARENT_RESOLUTION_OR_RELATION_ABSENT')
      if (parentRow.kind !== 'r' || parentRow.inheritance !== 0)
        return result('DRIFTED', 'POLICY_PARENT_KIND_DRIFT')
    }
    const aliases: Record<string, string> = { [g.table]: g.table }
    for (const e of expressions)
      for (const m of e.matchAll(/\b(?:FROM|JOIN)\s+(\w+)\s+(\w+)/gi)) aliases[m[2]] = m[1]
    for (const e of expressions) {
      const tokens = sqlTokens(e)
      for (let i = 0; i < tokens.length - 2; i++) {
        if (
          !['WORD', 'IDENTIFIER'].includes(tokens[i].kind) ||
          tokens[i + 1].value !== '.' ||
          !['WORD', 'IDENTIFIER'].includes(tokens[i + 2].kind)
        )
          continue
        const alias = tokens[i].value,
          name = tokens[i + 2].value
        const table = aliases[alias]
        if (!table) return result('MISSING_PREREQUISITE', 'POLICY_COLUMN_RESOLUTION_UNKNOWN')
        const column = await one(reader, proceduralQueries.visibleColumn, [
          context.relations[table],
          table,
          name,
        ])
        if (!column) return result('MISSING_PREREQUISITE', 'POLICY_COLUMN_ABSENT')
        ensure(text(column.name) === name)
      }
    }
    const setting = expressions.some((e) => /current_setting\s*\(/i.test(e))
      ? await one(reader, literalPolicyQueries.setting, [])
      : null
    if (
      expressions.some((e) => /current_setting\s*\(/i.test(e)) &&
      (!setting ||
        text(setting.schema) !== 'pg_catalog' ||
        text(setting.name) !== 'current_setting' ||
        text(setting.language) !== 'internal' ||
        text(setting.result) !== 'text' ||
        text(setting.volatility) !== 's' ||
        !bool(setting.executable) ||
        !bool(setting.text_operator_builtin))
    )
      return result('MISSING_PREREQUISITE', 'BUILTIN_SETTING_OR_TEXT_OPERATOR_MISSING')
    const states: ProceduralState[] = g.rls
      ? [row.enabled && row.forced ? 'EXACT' : 'UNSATISFIED']
      : []
    for (const p of g.policies) {
      const actual = await one(reader, literalPolicyQueries.policy, [schema, g.table, p.name])
      facts.push(actual)
      if (!actual) {
        states.push('UNSATISFIED')
        continue
      }
      text(actual.name)
      bool(actual.name_matches)
      text(actual.command)
      bool(actual.permissive)
      strings(actual.roles)
      const equalExpr = (value: unknown, expected: string | null) => {
        ensure(value === null || typeof value === 'string')
        if (value === null || expected === null) return value === expected
        return same(
          proceduralPolicyNormalForm(value as string),
          proceduralPolicyNormalForm(expected),
        )
      }
      states.push(
        actual.name === p.name &&
          actual.name_matches &&
          actual.command === p.command &&
          actual.permissive &&
          same(actual.roles, [p.role]) &&
          equalExpr(actual.using_expression, p.using) &&
          equalExpr(actual.check_expression, p.check)
          ? 'EXACT'
          : 'DRIFTED',
      )
    }
    return result(combine(states), 'EXACT_POLICY_GEOMETRY_AND_ROLE_BINDINGS')
  }
  const prerequisites = context.triggerFunction
  if (!prerequisites || !covered(prerequisites.schema))
    return result('MISSING_PREREQUISITE', 'TRIGGER_FUNCTION_CONTEXT_MISSING')
  const ledger = object(
    JSON.parse(
      readFileSync(
        new URL(
          '../../../../docs/union-eyes/reality-remediation/UE_W5_ORIGINAL_BOUNDARY_EFFECT_LEDGER.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ),
  )
  const boundaries = ledger.BOUNDARIES as Record<string, unknown>[]
  const effects = boundaries.find((v) => v.BOUNDARY_ID === b.boundaryId)?.EFFECTS as
    | Record<string, unknown>[]
    | undefined
  const functionEffect = effects?.find(
    (v) =>
      typeof object(v.COMPARATOR).EXACT_SOURCE_SEMANTICS === 'string' &&
      new RegExp(`CREATE OR REPLACE FUNCTION ${g.functionName}\\s*\\(`).test(
        text(object(v.COMPARATOR).EXACT_SOURCE_SEMANTICS),
      ),
  )
  ensure(functionEffect, 'PROCEDURAL_TRIGGER_FUNCTION_SOURCE_MISSING')
  const functionSource = text(object(functionEffect.COMPARATOR).EXACT_SOURCE_SEMANTICS)
  const fn = compileFunctionEffect(functionSource, text(functionEffect.EXACT_EFFECT_SHA256))
  if (prerequisites.sourceHash !== fn.sourceHash)
    return result('MISSING_PREREQUISITE', 'TRIGGER_FUNCTION_HASH_MISMATCH')
  const observed = await inspectFunctionEffect(reader, fn, prerequisites)
  facts.push(observed)
  if (observed.definition !== 'EXACT')
    return result(
      observed.definition === 'DRIFTED' ? 'DRIFTED' : 'MISSING_PREREQUISITE',
      'TRIGGER_FUNCTION_NOT_EXACT',
    )
  const trigger = await one(reader, proceduralQueries.trigger, [schema, g.table, g.name])
  facts.push(trigger)
  if (!trigger) return result('UNSATISFIED', 'TRIGGER_ABSENT')
  text(trigger.name)
  text(trigger.enabled)
  bool(trigger.internal)
  text(trigger.argument_bytes)
  text(trigger.constraint_oid)
  bool(trigger.deferrable)
  bool(trigger.deferred)
  text(trigger.function_schema)
  text(trigger.function_name)
  ensure(Number.isInteger(trigger.type) && Number.isInteger(trigger.arguments))
  ensure(trigger.qualification === null || typeof trigger.qualification === 'string')
  ensure(trigger.old_table === null || typeof trigger.old_table === 'string')
  ensure(trigger.new_table === null || typeof trigger.new_table === 'string')
  return result(
    trigger.name === g.name &&
      trigger.type === 23 &&
      trigger.enabled === 'O' &&
      !trigger.internal &&
      trigger.arguments === 0 &&
      trigger.argument_bytes === '\\x' &&
      trigger.constraint_oid === '0' &&
      !trigger.deferrable &&
      !trigger.deferred &&
      trigger.qualification === null &&
      trigger.old_table === null &&
      trigger.new_table === null &&
      trigger.function_schema === prerequisites.schema &&
      trigger.function_name === g.functionName
      ? 'EXACT'
      : 'DRIFTED',
    'EXACT_TRIGGER_AND_FUNCTION_BINDING',
  )
}
