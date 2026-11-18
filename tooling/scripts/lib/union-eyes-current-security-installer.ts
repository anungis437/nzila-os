/**
 * Current source security convergence for the existing, data-preserving bootstrap.
 * The caller owns BEGIN/COMMIT/ROLLBACK. Released SQL is evidence only.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type pg from 'pg'
import { parseSql, type ParseNode } from '../../../apps/union-eyes/scripts/lib/sql-census/parse'
import { buildCurrentPlatformAuthSource, buildCurrentPlatformIdentitySource, hash, type V2Plan } from '../../../apps/union-eyes/scripts/bootstrap-v2/source'
import { compileSecurity } from '../../../apps/union-eyes/scripts/bootstrap-v2/security'
import { compileMinimumRoleProvisioningSql } from '../../../apps/union-eyes/scripts/bootstrap-v2/minimum-installer'
import { CANONICAL_BOOTSTRAP_ROLES, INSTALLER_FUNCTION_OWNER_ROLES } from '../../../apps/union-eyes/scripts/bootstrap-v2/execution-roles'
import { AUTH_ROLE_MEMBERSHIP_EXPECTATIONS } from '../../../apps/union-eyes/scripts/bootstrap-v2/auth-sql'
import { FRAMEWORK_MEMBERSHIPS } from '../../../apps/union-eyes/scripts/bootstrap-v2/framework-contract'
import { canonicalPostgresMajor, membershipCatalogProjectionSql, type CanonicalPostgresMajor } from '../../../packages/db/src/auth-storage-authority/membership-semantics'
import { CURRENT_CASE_GUARDS, currentSecurityProjection, loadCurrentSecurityPlan } from './union-eyes-current-security-programs'
import {
  LEGACY_SECURITY_PREIMAGE_QUERIES, planLegacyAuthPolicyReplacement,
  planLegacyJournalReplacement, readLegacySecurityReferences,
  planLegacyFrameworkFunctionReplacement, planExistingFrameworkPolicies, planLegacyFrameworkLedgerPolicy, frameworkPolicyPreimageQuery,
  planLegacyPhysicalFunctionAdoption,
  type LegacyAuthPolicy, type LegacyJournalFunction, type LegacyJournalTrigger, type ExistingFrameworkPolicy,
} from './union-eyes-current-security-preimage'
import { projectCurrentCompilerSecurity, type CurrentFunctionDescriptor } from './union-eyes-current-security-contract'
import { currentFunctionViolations, admissionQueries } from '../../../apps/union-eyes/lib/operations/catalog-admission-core.mjs'
import { canonicalCatalogContractFromOverlay, inspectCanonicalAuthCatalog } from '../../../apps/union-eyes/lib/operations/canonical-catalog-admission'
import { buildCurrentCatalogOverlay } from '../write-union-eyes-current-catalog'
import baseContract from '../../../apps/union-eyes/lib/operations/catalog-authority-contract.json'
import { inspectFrameworkPrivileges } from '../../../apps/union-eyes/scripts/bootstrap-v2/framework-privileges'
import { AUTHORITY_PHYSICAL_GUARDS } from '../../../apps/union-eyes/db/auth/authority-physical-guards'
import { inspectPhysicalGuards, planPhysicalGuards, physicalGuardViolations } from '../../../apps/union-eyes/db/auth/physical-guard-catalog'
import {
  MESSAGING_GUARD_FUNCTIONS, inspectMessagingPhysicalCatalog,
  planMessagingPhysicalGuards, messagingPhysicalGuardViolations,
} from '../../../apps/union-eyes/db/auth/messaging-physical-guards'
import { planBusinessSessionRepair, applyBusinessSessionRepair } from '../../../apps/union-eyes/db/auth/business-session-policy'
import { DEADLINE_SESSION_GUARD_QUERY } from '../../../apps/union-eyes/db/auth/business-session-event-guard'
import { verifyCurrentCatalogAuthority } from './union-eyes-catalog-authority.mjs'

type Row = Record<string, unknown>
type RoleRow = { rolname: string; rolsuper: boolean; rolbypassrls: boolean; rolcanlogin: boolean; rolinherit: boolean; rolcreatedb: boolean; rolcreaterole: boolean }
type MembershipRow = { member: string; granted: string; admin_option: boolean; inherit_option: boolean; set_option: boolean }
const managedRoles = [...CANONICAL_BOOTSTRAP_ROLES]
const applicationRoles = managedRoles.filter(role => role !== 'ue_v2_owner')
const q = (value: string) => {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(value)) throw new Error('Current security identifier is invalid')
  return '"' + value + '"'
}
const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'"
const relationParts = (table: string) => {
  const parts = table.includes('.') ? table.split('.') : ['public', table]
  if (parts.length !== 2 || !['public', 'user_management'].includes(parts[0])) throw new Error('Current source relation namespace is not admitted')
  parts.forEach(q)
  return { schema: parts[0], table: parts[1], qualified: parts.map(q).join('.') }
}
const functionQuery = admissionQueries.find(query => query.name === 'currentFunctions')!.sql
const b002 = new Set(['case_authority_scopes', 'case_respondents', 'case_scope_proposals', 'case_territories'])
const identityTarget = 'platform_identity_bindings'
const legacyAuthReference = {
  source: 'tooling/sql/union-eyes-qa-baseline.sql',
  sha256: '6c9e7ce3d5c77f11e06ab90006255f1a06fbd7db4ae2d26784bcbf12c5b2fac7',
} as const

export interface CurrentAuthColumn {
  table: string; name: string; type: string; not_null: boolean;
  default_expression: string | null; identity: string; generated: string;
}

export const CURRENT_SECURITY_QUERIES = {
  version: "SELECT current_setting('server_version_num') AS server_version_num",
  actor: `SELECT current_user::text AS current_user,session_user::text AS session_user,
    r.rolsuper FROM pg_catalog.pg_roles r WHERE r.rolname=session_user`,
  anchor: "SELECT to_regprocedure('user_management.auth_business_org_authorized(uuid,text[])')::text AS anchor",
  roles: `SELECT rolname,rolsuper,rolbypassrls,rolcanlogin,rolinherit,rolcreatedb,rolcreaterole FROM pg_catalog.pg_roles WHERE rolname IN (${managedRoles.map(literal).join(',')})`,
  relations: `SELECT n.nspname AS schema,c.relname AS table,c.relkind,pg_catalog.pg_get_userbyid(c.relowner) AS owner,
    ARRAY(SELECT a.attname::text FROM pg_catalog.pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum) AS columns,
    ARRAY(SELECT a.attname::text FROM pg_catalog.pg_attribute a WHERE a.attrelid=c.oid AND a.attnum<>0 AND NOT a.attisdropped ORDER BY a.attnum) AS acl_columns
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','user_management','audit_security') AND c.relkind IN ('r','p','v','m','f') ORDER BY n.nspname,c.relname`,
  schemas: `SELECT nspname AS name,pg_catalog.pg_get_userbyid(nspowner) AS owner FROM pg_catalog.pg_namespace WHERE nspname IN ('public','user_management','audit_security')`,
  sequences: `SELECT DISTINCT n.nspname AS schema,c.relname AS name,pg_catalog.pg_get_userbyid(c.relowner) AS owner,
    tn.nspname AS table_schema,t.relname AS table_name FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_depend d ON d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype IN ('a','i')
    JOIN pg_catalog.pg_class t ON t.oid=d.refobjid JOIN pg_catalog.pg_namespace tn ON tn.oid=t.relnamespace
    WHERE c.relkind='S' AND tn.nspname IN ('public','user_management') ORDER BY n.nspname,c.relname`,
  authColumns: `SELECT c.relname AS table,a.attname AS name,pg_catalog.format_type(a.atttypid,a.atttypmod) AS type,
    a.attnotnull AS not_null,pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS default_expression,a.attidentity AS identity,a.attgenerated AS generated
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid
    LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE n.nspname='user_management' AND c.relkind IN('r','p') AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum`,
  frameworkPolicies: `SELECT n.nspname AS schema,c.relname AS table,p.polname AS name,p.polcmd AS cmd,p.polpermissive AS permissive,
    ARRAY(SELECT COALESCE(r.rolname::text,'PUBLIC') FROM unnest(p.polroles) x(oid) LEFT JOIN pg_catalog.pg_roles r ON r.oid=x.oid ORDER BY 1) AS roles,
    pg_catalog.pg_get_expr(p.polqual,p.polrelid) AS qual,pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid) AS with_check
    FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE EXISTS(SELECT FROM pg_catalog.pg_roles r WHERE r.oid=ANY(p.polroles) AND r.rolname LIKE 'ue_framework_%') ORDER BY n.nspname,c.relname,p.polname`,
} as const

function canonicalSqlAst(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalSqlAst)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['location', 'stmt_location', 'stmt_len'].includes(key)).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => [key, canonicalSqlAst(entry)]))
  return value
}
const sameSqlAst = (left: unknown, right: unknown) => JSON.stringify(canonicalSqlAst(left)) === JSON.stringify(canonicalSqlAst(right))
interface AuthTypeNode extends Record<string, unknown> { names: unknown[]; arrayBounds?: unknown[]; typmods?: unknown[] }
function authType(node: ParseNode): AuthTypeNode {
  if (!Array.isArray(node.names) || !node.names.length || node.names.some(part => typeof part?.String?.sval !== 'string'))
    throw new Error('Auth column type must contain parsed identifier names')
  const arrayBounds: unknown = node.arrayBounds, typmods: unknown = node.typmods
  if ((arrayBounds !== undefined && !Array.isArray(arrayBounds)) || (typmods !== undefined && !Array.isArray(typmods)))
    throw new Error('Auth column type modifiers must be parsed arrays')
  return { ...node, names: node.names[0].String.sval === 'pg_catalog' ? node.names.slice(1) : node.names,
    ...(arrayBounds === undefined ? {} : { arrayBounds }), ...(typmods === undefined ? {} : { typmods }) }
}
const columnDefault = (column: ParseNode) => column.constraints?.find((entry: ParseNode) => entry.Constraint.contype === 'CONSTR_DEFAULT')?.Constraint.raw_expr ?? null

function literalDefault(expression: ParseNode | null, columnType: ParseNode) {
  const cast = expression?.TypeCast
  if (!cast?.arg?.A_Const) return expression
  const target = authType(cast.typeName), source = authType(columnType)
  // PostgreSQL deparses implicit string-to-column casts. Only a literal cast
  // to the already matched source type can be omitted; functions/operators,
  // other casts and different typmods remain exact preimage facts.
  return sameSqlAst(target.names, source.names) && sameSqlAst(target.arrayBounds ?? [], source.arrayBounds ?? [])
    && (!target.typmods?.length || sameSqlAst(target.typmods, source.typmods)) ? cast.arg : expression
}

async function authDeclarationColumns(programs: readonly string[]) {
  const columns: { table: string; node: ParseNode; fragment: string }[] = []
  for (const sql of programs) {
    const parsed = await parseSql(sql)
    if (!parsed.ok) throw new Error('Current or immutable legacy auth declaration must parse')
    for (const statement of parsed.statements) {
      const create = statement.CreateStmt
      if (create?.relation?.schemaname !== 'user_management') continue
      const elements = create.tableElts ?? []
      for (let index = 0; index < elements.length; index++) {
        const node = elements[index].ColumnDef
        if (!node) continue
        const next = elements[index + 1]
        const end = next?.ColumnDef?.location ?? next?.Constraint?.location ?? Buffer.byteLength(sql.slice(0, sql.lastIndexOf(')')), 'utf8')
        const fragment = Buffer.from(sql, 'utf8').subarray(node.location, end).toString('utf8').replace(/,\s*$/, '').trim()
        columns.push({ table: create.relation.relname, node, fragment })
      }
    }
  }
  return columns
}

/** Compare the entire current auth family and its exact retained legacy
 * fields before emitting metadata-only nullable additions from source bytes. */
export async function planCurrentAuthColumnConvergence(
  plan: V2Plan, actual: CurrentAuthColumn[], relations: Row[],
  producer: Awaited<ReturnType<typeof buildCurrentPlatformAuthSource>>, immutableLegacySql: string,
) {
  if (producer.source !== 'packages/db/src/schema/auth.ts' || plan.sourceCommitments[producer.source] !== producer.sourceDigest
    || JSON.stringify(plan.tables.filter(table => table.name.startsWith('user_management.'))) !== JSON.stringify(producer.tables)
    || JSON.stringify(plan.statements.filter(statement => statement.canonicalId === 'CURRENT_SCHEMA:user_management' || statement.canonicalId.startsWith('PLATFORM_AUTH_CURRENT:'))) !== JSON.stringify(producer.statements))
    throw new Error('Current auth declaration or SQL producer differs')
  if (hash(immutableLegacySql) !== legacyAuthReference.sha256) throw new Error('Immutable legacy auth schema reference differs')
  const source = await authDeclarationColumns(producer.statements.map(statement => statement.sql))
  const legacy = await authDeclarationColumns([immutableLegacySql])
  const names = new Set(producer.tables.map(table => table.name.slice('user_management.'.length)))
  if (relations.some(row => row.schema === 'user_management' && (!names.has(String(row.table)) || !['r', 'p'].includes(String(row.relkind))))
    || [...names].some(table => relations.filter(row => row.schema === 'user_management' && row.table === table).length !== 1))
    throw new Error('Current auth relation preimage is missing, partial or unknown')
  const knownOld = [...legacy.filter(column => names.has(column.table)),
    ...source.filter(column => !legacy.some(old => old.table === column.table))]
  if (knownOld.some(old => !actual.some(row => row.table === old.table && row.name === old.node.colname)))
    throw new Error('Legacy auth column preimage is partial')
  const additions = source.filter(column => !knownOld.some(old => old.table === column.table && old.node.colname === column.node.colname))
  const missing = additions.filter(column => !actual.some(row => row.table === column.table && row.name === column.node.colname))
  if (missing.length && missing.length !== additions.length) throw new Error('Partial current auth column addition is refused')
  const failures: string[] = []
  for (const row of actual) {
    const expected = source.find(column => column.table === row.table && column.node.colname === row.name)
      ?? knownOld.find(column => column.table === row.table && column.node.colname === row.name)
    if (!expected) { failures.push(`${row.table}.${row.name}:UNKNOWN_COLUMN`); continue }
    if (actual.filter(other => other.table === row.table && other.name === row.name).length !== 1) failures.push(`${row.table}.${row.name}:DUPLICATE_COLUMN`)
    const parsedType = await parseSql('SELECT NULL::' + row.type)
    const nativeType = parsedType.ok && parsedType.statements.length === 1 && parsedType.statements[0].SelectStmt?.targetList?.[0]?.ResTarget?.val?.TypeCast?.typeName
    if (!nativeType || !sameSqlAst(authType(expected.node.typeName), authType(nativeType))) failures.push(`${row.table}.${row.name}:TYPE`)
    const required = expected.node.constraints?.some((entry: ParseNode) => ['CONSTR_NOTNULL', 'CONSTR_PRIMARY'].includes(entry.Constraint.contype)) ?? false
    if (required !== row.not_null) failures.push(`${row.table}.${row.name}:NULLABILITY`)
    let nativeDefault = null
    if (row.default_expression !== null) {
      const parsed = await parseSql('SELECT ' + row.default_expression)
      if (!parsed.ok || parsed.statements.length !== 1) { failures.push(`${row.table}.${row.name}:DEFAULT`); continue }
      nativeDefault = parsed.statements[0].SelectStmt?.targetList?.[0]?.ResTarget?.val
    }
    if (!sameSqlAst(literalDefault(columnDefault(expected.node), expected.node.typeName), literalDefault(nativeDefault, expected.node.typeName))) failures.push(`${row.table}.${row.name}:DEFAULT`)
    if (row.identity || row.generated) failures.push(`${row.table}.${row.name}:GENERATED_OR_IDENTITY`)
  }
  if (failures.length) throw new Error('Current auth column preimage differs: ' + failures.sort().join(', '))
  const statements: string[] = []
  for (const column of missing) {
    if (column.node.constraints?.length || column.node.identity || column.node.generated || column.node.collClause)
      throw new Error(`Current auth column needs a separately approved data migration: ${column.table}.${column.node.colname}`)
    const sql = `ALTER TABLE user_management.${q(column.table)} ADD COLUMN ${column.fragment};`
    const parsed = await parseSql(sql)
    const alter = parsed.ok && parsed.statements.length === 1 && parsed.statements[0].AlterTableStmt
    const command = alter?.cmds?.[0]?.AlterTableCmd
    if (!alter || alter.relation.schemaname !== 'user_management' || alter.relation.relname !== column.table || alter.cmds.length !== 1
      || command?.subtype !== 'AT_AddColumn' || command.missing_ok || !sameSqlAst(command.def.ColumnDef, column.node))
      throw new Error('Current auth additive column slice differs from its canonical producer')
    statements.push(sql)
  }
  return { statements, addedColumns: missing.map(column => `user_management.${column.table}.${column.node.colname}`),
    retainedLegacyColumns: actual.filter(row => !source.some(column => column.table === row.table && column.node.colname === row.name)).map(row => `user_management.${row.table}.${row.name}`).sort(),
    sourceDigest: producer.sourceDigest, legacyReferenceSha256: legacyAuthReference.sha256 }
}

/** Only the absent shared identity declaration may be materialized here. SQL
 * and metadata must equal the same producer that builds the canonical plan. */
export async function planCurrentIdentityCreation(
  plan: V2Plan, actual: Row[], conflicts: Row[],
  producer: Awaited<ReturnType<typeof buildCurrentPlatformIdentitySource>>,
) {
  if (producer.source !== 'packages/db/src/schema/platform-authorization.ts' || producer.table.name !== identityTarget
    || producer.table.authority?.classification !== 'CONTAINED_NO_AUTHORITY'
    || producer.table.authority.requiredRuntimePrivileges.length || producer.table.authority.requiredSystemPrivileges.length)
    throw new Error('Exact contained current identity producer required')
  const tables = plan.tables.filter(table => table.name === identityTarget)
  const statements = plan.statements.filter(statement => statement.canonicalId.startsWith('PLATFORM_IDENTITY_CURRENT:'))
  if (tables.length !== 1 || JSON.stringify(tables[0]) !== JSON.stringify(producer.table)
    || plan.sourceCommitments[producer.source] !== producer.sourceDigest
    || JSON.stringify(statements) !== JSON.stringify(producer.statements))
    throw new Error('Current identity declaration or SQL producer differs')
  const missing = plan.tables.filter(table => {
    const target = relationParts(table.name)
    return !actual.some(row => row.schema === target.schema && row.table === target.table)
  })
  if (missing.some(table => table.name !== identityTarget)) throw new Error('Current source relation prerequisites are missing')
  // A current installation is separately validated before this legacy path.
  // A relation/type/index with this new identity is otherwise an unproven
  // partial installation, never a reason to skip CREATE or adopt its rows.
  if (missing.length !== 1 || conflicts.length || actual.some(row => row.schema === 'public' && row.table === identityTarget))
    throw new Error('Current identity target is present, partial or conflicting')
  // PostgreSQL derives these implicit PK-index and row-array type names. An
  // existing object must not make CREATE silently choose a different name.
  const objectNames = new Set([identityTarget, `${identityTarget}_pkey`])
  for (const statement of statements) {
    const parsed = await parseSql(statement.sql)
    if (!parsed.ok || parsed.statements.length !== 1) throw new Error('Current identity producer must be one parsed DDL statement')
    const node = parsed.statements[0]
    const relation = node.CreateStmt?.relation ?? node.AlterTableStmt?.relation ?? node.IndexStmt?.relation
    if (!relation || relation.relname !== identityTarget || (relation.schemaname && relation.schemaname !== 'public')
      || node.CreateStmt?.if_not_exists || node.IndexStmt?.if_not_exists
      || (!node.CreateStmt && !node.AlterTableStmt && !node.IndexStmt))
      throw new Error('Current identity producer operation or target differs')
    if (node.IndexStmt) objectNames.add(node.IndexStmt.idxname)
  }
  if (statements.length !== 4 || objectNames.size !== 4) throw new Error('Exact current identity table/FK/index program required')
  const security = compileSecurity({ ...plan, tables: [producer.table] })
  if (security.blockers.length) throw new Error('Current identity security must resolve without blockers')
  const denyStatements: string[] = []
  for (const sql of security.statements) {
    const parsed = await parseSql(sql)
    if (!parsed.ok) throw new Error('Current identity security must parse')
    const node = parsed.statements[0]
    if (node.AlterTableStmt?.relation?.relname === identityTarget
      || node.GrantStmt?.objects?.some((object: { RangeVar?: { relname?: string } }) => object.RangeVar?.relname === identityTarget))
      denyStatements.push(sql)
  }
  if (denyStatements.length !== 3) throw new Error('Exact current identity FORCE/RLS/deny source required')
  return { table: producer.table, statements: statements.map(statement => statement.sql), denyStatements, objectNames: [...objectNames].sort(), sourceDigest: producer.sourceDigest }
}

async function identityObjectConflicts(client: pg.Client, producer: Awaited<ReturnType<typeof buildCurrentPlatformIdentitySource>>) {
  const names = [producer.table.name, `${producer.table.name}_pkey`]
  for (const statement of producer.statements) {
    const parsed = await parseSql(statement.sql)
    if (!parsed.ok) throw new Error('Current identity source must parse before catalog preflight')
    for (const node of parsed.statements) if (node.IndexStmt) names.push(node.IndexStmt.idxname)
  }
  return (await client.query(`SELECT 'relation' AS kind,c.relname AS name,c.relkind::text AS relkind FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[])
    UNION ALL SELECT 'type' AS kind,t.typname AS name,t.typtype::text AS relkind FROM pg_catalog.pg_type t
    JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname=ANY($2::text[])`, [names, [producer.table.name, `_${producer.table.name}`]])).rows
}

/** CREATE only absent exact source roles; an unsafe existing role/edge is a denial. */
export async function planCanonicalRoleConvergence(roles: RoleRow[], memberships: MembershipRow[], postgresMajor: CanonicalPostgresMajor) {
  const source = compileMinimumRoleProvisioningSql({ postgresMajor })
  const parsed = await parseSql(source)
  if (!parsed.ok) throw new Error('Current role provisioning source must parse')
  const attributes = { superuser: 'rolsuper', bypassrls: 'rolbypassrls', canlogin: 'rolcanlogin', inherit: 'rolinherit', createdb: 'rolcreatedb', createrole: 'rolcreaterole' } as const
  const statements: string[] = []
  const createdRoles: string[] = []
  for (let index = 0; index < parsed.statements.length; index++) {
    const node = parsed.statements[index]
    if (!node.CreateRoleStmt) {
      if (!node.GrantRoleStmt) throw new Error('Unexpected current role provisioning operation')
      continue
    }
    const spec = node.CreateRoleStmt
    if (!managedRoles.includes(spec.role)) throw new Error('Unexpected current role provisioning identity')
    const actual = roles.filter(row => row.rolname === spec.role)
    if (actual.length > 1) throw new Error('Duplicate current role catalog fact')
    if (!actual.length) { statements.push(parsed.texts[index]); createdRoles.push(spec.role); continue }
    const options = new Map(spec.options.map((entry: { DefElem: { defname: string; arg: { Boolean: { boolval: boolean } } } }) => [entry.DefElem.defname, entry.DefElem.arg.Boolean.boolval]))
    if (Object.entries(attributes).some(([key, flag]) => !options.has(key) || actual[0][flag] !== options.get(key)))
      throw new Error(`Existing canonical role differs: ${spec.role}`)
  }
  const expected = Object.entries({ ...AUTH_ROLE_MEMBERSHIP_EXPECTATIONS, ...FRAMEWORK_MEMBERSHIPS, ue_v2_owner: INSTALLER_FUNCTION_OWNER_ROLES })
    .flatMap(([member, targets]) => targets.map(granted => ({ member, granted, admin_option: false, inherit_option: member === 'ue_v2_owner', set_option: true })))
  for (const actual of memberships) {
    const matches = expected.filter(edge => edge.member === actual.member && edge.granted === actual.granted)
    if (matches.length !== 1 || ['admin_option', 'inherit_option', 'set_option'].some(key => actual[key as keyof MembershipRow] !== matches[0][key as keyof typeof matches[0]]))
      throw new Error(`Existing canonical membership differs: ${actual.member}->${actual.granted}`)
    if (memberships.filter(edge => edge.member === actual.member && edge.granted === actual.granted).length !== 1)
      throw new Error('Duplicate canonical membership fact')
  }
  for (let index = 0; index < parsed.statements.length; index++) if (parsed.statements[index].GrantRoleStmt) statements.push(parsed.texts[index])
  return { statements, createdRoles, expectedMemberships: expected.length, sourceDigest: hash(source) }
}

/** Ownership metadata only; no relation, row, old predicate or history is rebuilt. */
export function planCanonicalOwnership(plan: Pick<V2Plan, 'tables'>, actual: Row[], sequences: Row[], trustedOwner: string) {
  q(trustedOwner)
  const statements: string[] = []
  const targets = plan.tables.map(table => relationParts(table.name))
  for (const target of targets) {
    const matches = actual.filter(row => row.schema === target.schema && row.table === target.table)
    if (matches.length !== 1 || !['r', 'p'].includes(String(matches[0].relkind)) || ![trustedOwner, 'ue_v2_owner'].includes(String(matches[0].owner)))
      throw new Error(`Source relation missing or ownership differs: ${target.qualified}`)
    if (matches[0].owner !== 'ue_v2_owner') statements.push(`ALTER TABLE ${target.qualified} OWNER TO ue_v2_owner`)
  }
  for (const sequence of sequences) {
    if (!targets.some(target => target.schema === sequence.table_schema && target.table === sequence.table_name)) continue
    if (![trustedOwner, 'ue_v2_owner'].includes(String(sequence.owner))) throw new Error('Current source sequence owner differs')
    if (sequence.owner !== 'ue_v2_owner') statements.push(`ALTER SEQUENCE ${q(String(sequence.schema))}.${q(String(sequence.name))} OWNER TO ue_v2_owner`)
  }
  return { statements, targets }
}

async function schemaOwnerSql(schemas: Row[], trustedOwner: string) {
  const auth = schemas.find(row => row.name === 'user_management'), publicSchema = schemas.find(row => row.name === 'public')
  if (!auth || !publicSchema || ![trustedOwner, 'ue_v2_owner'].includes(String(auth.owner)) ||
      ![trustedOwner, 'ue_v2_owner', 'pg_database_owner'].includes(String(publicSchema.owner))) throw new Error('Existing canonical schema owner differs')
  return [
    ...(auth.owner === 'ue_v2_owner' ? [] : ['ALTER SCHEMA user_management OWNER TO ue_v2_owner']),
    // Keep the original public-schema owner until its protected deadline guard
    // has been upgraded through the existing owner-bound production API.
    'GRANT USAGE,CREATE ON SCHEMA public TO ue_v2_owner',
  ]
}

async function compilerTexts(source: string) {
  const parsed = await parseSql(source)
  if (!parsed.ok) throw new Error('Current security source SQL must parse')
  return parsed.texts.map((sql, index) => ({ sql, node: parsed.statements[index] }))
}

/** Parser slices exclude statement delimiters. Append a delimiter outside any
 * trailing line comment while retaining every byte of each source program. */
export function joinCurrentSecurityPrograms(programs: readonly string[]) {
  return programs.map(sql => `${sql}\n;`).join('\n')
}

function sourceFunctionExecuteSql(fn: CurrentFunctionDescriptor): string[] {
  if (fn.executeAcl.some(grant => grant.grantable)) throw new Error('Current source function grant options are not admitted')
  return fn.executeAcl.length ? [`GRANT EXECUTE ON FUNCTION ${fn.signature} TO ${fn.executeAcl.map(grant => grant.role === 'PUBLIC' ? 'PUBLIC' : q(grant.role)).join(',')}`] : []
}

function frameworkFunctionDescriptor(declaration: ParseNode, functions: readonly CurrentFunctionDescriptor[]) {
  const names = declaration.funcname.map((part: ParseNode) => part.String.sval)
  const current = functions.filter(fn => fn.schema === names[0] && fn.name === names[1])
  if (names.length !== 2 || declaration.parameters?.length || current.length !== 1 || !current[0].signature.endsWith('()'))
    throw new Error('Exact source framework function ACL identity required')
  return current[0]
}

/** SQL-language body validation can call retained RLS helper functions before
 * CREATE OR REPLACE returns. Only independently verified existing replacements
 * receive their final source ACL first; no absent or unreviewed name is used. */
export async function planVerifiedFrameworkExecuteRestore(
  functions: readonly CurrentFunctionDescriptor[], replacements: readonly { originalSql: string; replacementSql: string }[],
) {
  const signatures = new Set<string>(), statements: string[] = []
  for (const replacement of replacements) {
    const parsed = await parseSql(replacement.originalSql)
    const declaration = parsed.ok && parsed.statements.length === 1 && parsed.statements[0].CreateFunctionStmt
    if (!declaration) throw new Error('Verified framework function source required for ACL restoration')
    const fn = frameworkFunctionDescriptor(declaration, functions)
    if (signatures.has(fn.signature)) throw new Error('Duplicate verified framework function ACL identity')
    signatures.add(fn.signature)
    statements.push(...sourceFunctionExecuteSql(fn))
  }
  return statements
}

/** An existing function keeps its OID and ACL across CREATE OR REPLACE. Restore
 * its exact source owner/caller EXECUTE entries before another producer or
 * CREATE POLICY can depend on it. These are final source grants, not a bypass. */
export async function planCurrentFrameworkProgram(
  source: string, functions: readonly CurrentFunctionDescriptor[],
  replacements: readonly { originalSql: string; replacementSql: string }[], omissions: readonly { originalSql: string }[],
) {
  const replace = new Map(replacements.map(entry => [entry.originalSql, entry.replacementSql]))
  const omit = new Set(omissions.map(entry => entry.originalSql))
  const statements: string[] = []
  for (const entry of await compilerTexts(source)) {
    if (omit.has(entry.sql)) continue
    statements.push(replace.get(entry.sql) ?? entry.sql)
    const declaration = entry.node.CreateFunctionStmt
    if (!declaration) continue
    statements.push(...sourceFunctionExecuteSql(frameworkFunctionDescriptor(declaration, functions)))
  }
  return statements
}

/** Failed DDL aborts PostgreSQL's transaction, so record its safe context
 * before execution. Never include the SQL body, row values or driver detail. */
export async function executeCurrentFrameworkProgram(statements: readonly string[], execute: (sql: string) => Promise<Row[]>) {
  const actor = (await execute('SELECT current_user::text AS current_role'))[0]?.current_role
  if (typeof actor !== 'string' || !/^[a-z_][a-z0-9_]{0,62}$/.test(actor)) throw new Error('Current framework executor identity is invalid')
  for (const [index, sql] of statements.entries()) {
    const parsed = await parseSql(sql)
    if (!parsed.ok || parsed.statements.length !== 1) throw new Error('Current framework statement must parse individually')
    const node = parsed.statements[0], declaration = node.CreateFunctionStmt
    const signature = declaration ? declaration.funcname.map((part: ParseNode) => part.String.sval).join('.') + '()' : undefined
    try { await execute(sql) } catch (error) {
      const message = error instanceof Error ? error.message : ''
      const code = (error as { code?: unknown })?.code
      const denied = /^permission denied for (function|table|schema) ([a-z_][a-z0-9_.]*)$/.exec(message)
      throw new Error('Current framework statement failed: ' + JSON.stringify({ index: index + 1, kind: Object.keys(node)[0], currentRole: actor,
        function: signature, sqlstate: typeof code === 'string' && /^[A-Z0-9]{5}$/.test(code) ? code : 'UNKNOWN',
        ...(denied ? { deniedKind: denied[1], deniedIdentity: denied[2] } : {}) }))
    }
  }
}

/** Names here come only from independently verified released preimages. The
 * refusal lists identities, never function bodies or credential material. */
export function assertNoPartialCurrentSecurityFunctions(
  expected: readonly { schema: string; name: string }[], actual: readonly Row[], admittedQualifiedNames: ReadonlySet<string>,
) {
  const refused = [...new Set(expected.filter(fn => !admittedQualifiedNames.has(`${fn.schema}.${fn.name}`)
    && actual.some(row => row.schema === fn.schema && row.name === fn.name)).map(fn => `${fn.schema}.${fn.name}`))].sort()
  if (refused.length) throw new Error('Mixed or partial current security installation refused: ' + refused.join(', '))
}

async function validateCurrent(client: pg.Client, root: string, plan: V2Plan, projection: Awaited<ReturnType<typeof currentSecurityProjection>>, currentContract: ReturnType<typeof canonicalCatalogContractFromOverlay>, major: CanonicalPostgresMajor) {
  const execute = async (sql: string) => (await client.query(sql)).rows
  const currentSecurity = { ...(await buildCurrentCatalogOverlay(plan)).currentSecurity }
  const failures = await inspectCanonicalAuthCatalog(execute, { postgresMajor: major, currentSecurity })
  failures.push(...(await inspectFrameworkPrivileges(client, { postgresMajor: major })).failures)
  for (const contract of CURRENT_CASE_GUARDS) failures.push(...await physicalGuardViolations(contract, execute))
  failures.push(...messagingPhysicalGuardViolations(await inspectMessagingPhysicalCatalog(execute)))
  if (failures.length) throw new Error('Current source security validation failed: ' + failures.join('; '))
  const admitted = await verifyCurrentCatalogAuthority(client, { repoRoot: root, currentContract, environment: 'bootstrap-current-security' })
  return { admitted, functionCount: projection.functions.length }
}

/** No COMMIT, rollback, historical replay, business DML, or supplied-SQL execution. */
export async function installUnionEyesCurrentSecurity(client: pg.Client, options: { repoRoot: string }) {
  await client.query('SAVEPOINT ue_current_security_transaction_required')
  await client.query('RELEASE SAVEPOINT ue_current_security_transaction_required')
  const execute = async (sql: string): Promise<Row[]> => (await client.query(sql)).rows
  const version = await execute(CURRENT_SECURITY_QUERIES.version), major = canonicalPostgresMajor(version[0]?.server_version_num)
  const plan = loadCurrentSecurityPlan(options.repoRoot), projection = await currentSecurityProjection(plan, { postgresMajor: major })
  const overlay = await buildCurrentCatalogOverlay(plan), currentContract = canonicalCatalogContractFromOverlay(baseContract, overlay)
  const sourcePlanDigest = hash(JSON.stringify(plan))
  await execute("SELECT pg_catalog.pg_advisory_xact_lock(hashtextextended('union-eyes-current-security-v1',0))")
  const actor = await execute(CURRENT_SECURITY_QUERIES.actor)
  if (actor.length !== 1 || actor[0].current_user !== actor[0].session_user || managedRoles.includes(String(actor[0].current_user))) throw new Error('Original bounded bootstrap operator required')
  const originalRole = String(actor[0].current_user)
  q(originalRole)
  const relations = await execute(CURRENT_SECURITY_QUERIES.relations)
  const sourceTargets = plan.tables.map(table => relationParts(table.name))
  const presentTargets = sourceTargets.filter(target => relations.some(row => row.schema === target.schema && row.table === target.table))
  await execute(`LOCK TABLE ${presentTargets.map(target => target.qualified).sort().join(',')} IN ACCESS EXCLUSIVE MODE`)
  const deadlineGuard = await execute(DEADLINE_SESSION_GUARD_QUERY)
  if (deadlineGuard.length !== 1) throw new Error('Existing protected deadline event guard is required')
  const anchor = await execute(CURRENT_SECURITY_QUERIES.anchor)
  if (anchor[0]?.anchor) {
    if (presentTargets.length !== sourceTargets.length) throw new Error('Current source relation prerequisites are missing')
    const verified = await validateCurrent(client, options.repoRoot, plan, projection, currentContract, major)
    return { profile: 'CURRENT_SOURCE', applied: false, sourcePlanDigest, currentContract, ...verified,
      securityPolicyVerified: true, runtimePrivilegesVerified: true, applicationReady: false }
  }
  const identityProducer = await buildCurrentPlatformIdentitySource()
  const identityCreation = await planCurrentIdentityCreation(plan, relations, await identityObjectConflicts(client, identityProducer), identityProducer)
  const authProducer = await buildCurrentPlatformAuthSource()
  const authColumns = await planCurrentAuthColumnConvergence(plan, await execute(CURRENT_SECURITY_QUERIES.authColumns) as unknown as CurrentAuthColumn[], relations,
    authProducer, readFileSync(path.join(options.repoRoot, legacyAuthReference.source), 'utf8'))
  const references = readLegacySecurityReferences(options.repoRoot)
  const legacyOwner = await execute(LEGACY_SECURITY_PREIMAGE_QUERIES.owner)
  if (legacyOwner.length !== 1 || legacyOwner[0].current_user !== originalRole || legacyOwner[0].session_user !== originalRole ||
      (legacyOwner[0].owner !== originalRole && actor[0].rolsuper !== true) || managedRoles.includes(String(legacyOwner[0].owner))) throw new Error('Trusted original relation owner cannot be established')
  const trustedOwner = String(legacyOwner[0].owner)
  const authDrops = planLegacyAuthPolicyReplacement(await execute(LEGACY_SECURITY_PREIMAGE_QUERIES.authPolicies) as unknown as LegacyAuthPolicy[])
  const journalDrops = planLegacyJournalReplacement(references['apps/union-eyes/db/migrations-platform/0049_claim_status_transitions.sql'], trustedOwner,
    await execute(LEGACY_SECURITY_PREIMAGE_QUERIES.journalFunctions) as unknown as LegacyJournalFunction[], await execute(LEGACY_SECURITY_PREIMAGE_QUERIES.journalTriggers) as unknown as LegacyJournalTrigger[])
  const functionRows = await execute(functionQuery)
  const frameworkReplacements = await planLegacyFrameworkFunctionReplacement(options.repoRoot, projection.programs.framework, functionRows)
  const authorityAdoption = await planLegacyPhysicalFunctionAdoption(options.repoRoot, AUTHORITY_PHYSICAL_GUARDS, functionRows, trustedOwner)
  const metadataPolicySql: string[] = []
  const scopePolicySql: string[] = []
  const securityFunctionSql: string[] = []
  for (const source of projection.security.statements) for (const entry of await compilerTexts(source)) {
    const create = entry.node.CreatePolicyStmt
    if (create?.table?.schemaname === 'public' && b002.has(create.table.relname)) scopePolicySql.push(entry.sql)
    if (create?.policy_name === 'ue_platform_metadata_admin') metadataPolicySql.push(entry.sql)
    if (entry.node.CreateFunctionStmt || entry.node.GrantStmt?.objtype === 'OBJECT_FUNCTION' || entry.node.AlterDefaultPrivilegesStmt) securityFunctionSql.push(entry.sql)
  }
  const frameworkPolicySource = joinCurrentSecurityPrograms([projection.programs.framework, ...metadataPolicySql])
  const frameworkRows = await execute(await frameworkPolicyPreimageQuery(frameworkPolicySource))
  const ledgerDrop = planLegacyFrameworkLedgerPolicy(options.repoRoot, frameworkRows.filter(row => row.schema === 'public' && row.table === 'django_migrations') as unknown as ExistingFrameworkPolicy[])
  const policyOmissions = await planExistingFrameworkPolicies(frameworkPolicySource,
    frameworkRows.filter(row => !(row.schema === 'public' && row.table === 'django_migrations') && row.schema !== 'user_management') as unknown as ExistingFrameworkPolicy[])
  const memberProjection = membershipCatalogProjectionSql(major)
  const members = await execute(`SELECT member.rolname AS member,target.rolname AS granted,m.admin_option,${memberProjection.inheritOption} AS inherit_option,${memberProjection.setOption} AS set_option
    FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles member ON member.oid=m.member JOIN pg_catalog.pg_roles target ON target.oid=m.roleid
    WHERE member.rolname IN (${managedRoles.map(literal).join(',')})`)
  const rolePlan = await planCanonicalRoleConvergence(await execute(CURRENT_SECURITY_QUERIES.roles) as unknown as RoleRow[], members as unknown as MembershipRow[], major)
  const ownership = planCanonicalOwnership({ tables: plan.tables.filter(table => table.name !== identityCreation.table.name) }, relations, await execute(CURRENT_SECURITY_QUERIES.sequences), trustedOwner)
  const schemaSql = await schemaOwnerSql(await execute(CURRENT_SECURITY_QUERIES.schemas), trustedOwner)
  // Reject unrecognized current-function fragments before any convergence write.
  const admittedExistingNames = new Set([...MESSAGING_GUARD_FUNCTIONS.map(fn => `public.${fn.name}`), ...authorityAdoption.adoptedNames, 'public.ue_claims_stamp_status_changed', 'public.ue_claims_record_status_transition', 'user_management.ue_framework_actor_authorized', 'user_management.ue_framework_admin_authorized'])
  assertNoPartialCurrentSecurityFunctions(projection.functions, functionRows, admittedExistingNames)
  const messagingMetadata: string[] = []
  for (const fn of MESSAGING_GUARD_FUNCTIONS) {
    const rows = functionRows.filter(row => row.schema === 'public' && row.name === fn.name)
    if (!rows.length) continue
    const current = projection.functions.filter(entry => entry.schema === 'public' && entry.name === fn.name)
    if (!currentFunctionViolations(current, rows).length) continue
    const reference = readFileSync(path.join(options.repoRoot, fn.source), 'utf8')
    if (hash(reference) !== fn.sourceSha256) throw new Error('Released messaging source reference differs')
    const legacy = (await projectCurrentCompilerSecurity([reference], trustedOwner, { immutableReferenceOnly: true })).functions.filter(entry => entry.schema === 'public' && entry.name === fn.name)
    if (legacy.length !== 1 || currentFunctionViolations(legacy, rows).length) throw new Error('Messaging preimage differs; metadata adoption refused')
    messagingMetadata.push(`ALTER FUNCTION public.${q(fn.name)}() SET search_path=pg_catalog,public`, `REVOKE ALL ON FUNCTION public.${q(fn.name)}() FROM PUBLIC,union_eyes_runtime,union_eyes_system`, `ALTER FUNCTION public.${q(fn.name)}() OWNER TO ue_v2_owner`)
  }
  for (const sql of rolePlan.statements) await execute(sql)
  // The original owner performs revocation on retained historical objects too;
  // a new canonical owner must not pretend it can revoke another owner's ACLs.
  // Every public object must already have an explicit current/retained contract.
  for (const row of relations) {
    if (row.schema === 'public' && !currentContract.payload.entries.some(entry => entry.table === row.table)) throw new Error('Unclassified existing public relation refuses convergence')
  }
  for (const sql of [...authDrops, ...journalDrops, ...ledgerDrop]) await execute(sql)
  const schemas = await execute(CURRENT_SECURITY_QUERIES.schemas)
  const recipients = ['PUBLIC', ...applicationRoles.map(q)].join(',')
  for (const schema of schemas) {
    const name = q(String(schema.name))
    await execute(`REVOKE ALL ON SCHEMA ${name} FROM ${recipients}`)
    await execute(`REVOKE ALL ON ALL TABLES IN SCHEMA ${name} FROM ${recipients}`)
    await execute(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA ${name} FROM ${recipients}`)
    await execute(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ${name} FROM ${recipients}`)
  }
  for (const row of relations) {
    // Schema facts stay positive-only; revoke explicit system-column ACLs too.
    const columns = row.acl_columns
    if (!Array.isArray(columns) || columns.some(column => typeof column !== 'string'))
      throw new Error('Current security column ACL census is missing')
    if (!columns.length) continue
    await execute(`REVOKE ${['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'].map(privilege => `${privilege} (${columns.map(q).join(',')})`).join(',')} ON TABLE ${q(String(row.schema))}.${q(String(row.table))} FROM ${recipients}`)
  }
  for (const sql of schemaSql) await execute(sql)
  for (const sql of authorityAdoption.statements) await execute(sql)
  for (const sql of messagingMetadata) await execute(sql)
  for (const sql of ownership.statements) await execute(sql)
  const asRole = async (role: string, sql: string) => {
    await execute(`SET LOCAL ROLE ${q(role)}`)
    try { return await execute(sql) } finally { await execute('SET LOCAL ROLE ue_v2_owner') }
  }
  await execute('SET LOCAL ROLE ue_v2_owner')
  await execute('SET LOCAL search_path=pg_catalog,public,pg_temp')
  for (const sql of await planVerifiedFrameworkExecuteRestore(projection.functions, frameworkReplacements)) await execute(sql)
  for (const sql of authColumns.statements) await execute(sql)
  // These canonical producers use an unqualified public table identity. Pin
  // its creation namespace, then restore the security-program search path.
  await execute('SET LOCAL search_path=public,pg_catalog,pg_temp')
  for (const sql of identityCreation.statements) await execute(sql)
  await execute('SET LOCAL search_path=pg_catalog,public,pg_temp')
  for (const sql of identityCreation.denyStatements) await execute(sql)
  await execute('GRANT USAGE ON SCHEMA public TO union_eyes_runtime,union_eyes_system')
  for (const sql of projection.publicTableGrants) await execute(sql)
  for (const sql of securityFunctionSql) await execute(sql)
  for (const sql of projection.programs.auth) await execute(sql)
  const omissions = new Set(policyOmissions.map(entry => entry.originalSql))
  await executeCurrentFrameworkProgram(await planCurrentFrameworkProgram(projection.programs.framework, projection.functions, frameworkReplacements, policyOmissions), execute)
  for (const sql of metadataPolicySql) if (!omissions.has(sql)) await execute(sql)
  for (const sql of projection.programs.companions) await execute(sql)
  for (const contract of CURRENT_CASE_GUARDS) {
    const guards = planPhysicalGuards(contract, await inspectPhysicalGuards(contract, execute))
    for (const sql of guards.statements) await execute(sql)
  }
  const messaging = planMessagingPhysicalGuards(await inspectMessagingPhysicalCatalog(execute))
  if (messaging.missingTables.length) throw new Error('Current messaging relation prerequisites are missing')
  for (const sql of messaging.statements) await execute(sql)
  // Existing dedicated-reader-owned functions survive replacement by OID.
  // Quarantine may have removed an owner's ordinary EXECUTE privilege too;
  // restore the exact source ACL, including that owner entry, rather than
  // inheriting the old object's post-replacement ACL by accident.
  for (const fn of projection.functions) {
    for (const sql of sourceFunctionExecuteSql(fn)) await execute(sql)
  }
  for (const sql of scopePolicySql) await execute(sql)
  const session = await planBusinessSessionRepair(execute)
  const sessionReceipt = await applyBusinessSessionRepair(execute, session.fingerprint, sql => asRole('uev2admin', sql))
  await asRole(originalRole, 'ALTER SCHEMA public OWNER TO ue_v2_owner')
  const verified = await validateCurrent(client, options.repoRoot, plan, projection, currentContract, major)
  await execute(`SET LOCAL ROLE ${q(originalRole)}`)
  return { profile: 'CURRENT_SOURCE', applied: true, postgresMajor: major, sourcePlanDigest, currentContract,
    roleSourceDigest: rolePlan.sourceDigest, sourceFunctionCount: projection.functions.length, session: sessionReceipt,
    identitySourceDigest: identityCreation.sourceDigest, sourceTablesCreated: [identityCreation.table.name],
    authColumnsAdded: authColumns.addedColumns, authSchemaSourceDigest: authColumns.sourceDigest,
    ...verified, securityPolicyVerified: true, runtimePrivilegesVerified: true, applicationReady: false,
    businessDmlIssued: false, historicalSqlReplayed: false }
}
