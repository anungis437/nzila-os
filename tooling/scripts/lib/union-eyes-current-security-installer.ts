/**
 * Current source security convergence for the existing, data-preserving bootstrap.
 * The caller owns BEGIN/COMMIT/ROLLBACK. Released SQL is evidence only.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type pg from 'pg'
import { parseSql, type ParseNode } from '../../../apps/union-eyes/scripts/lib/sql-census/parse'
import { buildCurrentPlatformAuthSource, buildCurrentPlatformIdentitySource, buildCurrentExternalReadSource, hash, type V2Plan } from '../../../apps/union-eyes/scripts/bootstrap-v2/source'
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
  LEGACY_REWARDS_SIGNATURE_POLICY_QUERY, planLegacyRewardsSignaturePolicyRetirement,
  planLegacyActivationConstraintTransition,
  type LegacyAuthPolicy, type LegacyJournalFunction, type LegacyJournalTrigger, type ExistingFrameworkPolicy, type LegacyActivationConstraint,
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
import { EXTERNAL_READ_OWNER, EXTERNAL_READ_STORAGE_TABLES } from '../../../apps/union-eyes/lib/external-resource-read/source'
import { CONTAINED_PARENT_POLICY_QUERY, planContainedParentPolicyInstall } from '../../../apps/union-eyes/scripts/bootstrap-v2/contained-parent-policies'
import { CURRENT_PUBLIC_TABLE_CREATION_SQL, verifyCurrentUuidDefaultBindings, type CurrentUuidDefaultRow } from '../../../apps/union-eyes/scripts/bootstrap-v2/uuid-default-bindings'

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
  relations: `SELECT n.nspname AS schema,c.relname AS table,c.relkind,pg_catalog.pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity,
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

/** Only the two exact current declarations may be absent. Existing or partial
 * storage has no admitted legacy preimage and is never adopted by name. */
export async function planCurrentExternalReadCreation(
  plan: V2Plan, actual: Row[], conflicts: Row[],
  producer: Awaited<ReturnType<typeof buildCurrentExternalReadSource>>,
) {
  const source = await buildCurrentExternalReadSource()
  const names = new Set<string>(EXTERNAL_READ_STORAGE_TABLES)
  if (JSON.stringify(producer) !== JSON.stringify(source)
    || plan.sourceCommitments[source.source] !== source.sourceDigest
    || JSON.stringify(plan.statements.filter(statement => statement.canonicalId.startsWith('EXTERNAL_READ_CURRENT:'))) !== JSON.stringify(source.statements)
    || JSON.stringify(plan.tables.filter(table => names.has(table.name))) !== JSON.stringify(source.tables))
    throw new Error('Current external storage declaration or SQL producer differs')
  const missing = plan.tables.filter(table => {
    const target = relationParts(table.name)
    return !actual.some(row => row.schema === target.schema && row.table === target.table)
  })
  if (missing.some(table => !names.has(table.name) && table.name !== identityTarget))
    throw new Error('Current source relation prerequisites are missing')
  if (conflicts.length || missing.filter(table => names.has(table.name)).length !== 2
    || actual.some(row => row.schema === 'public' && names.has(String(row.table))))
    throw new Error('Current external storage is present, partial or conflicting')
  const objectNames = new Set(source.tables.flatMap(table => [table.name, `${table.name}_pkey`]))
  for (const statement of source.statements) {
    const parsed = await parseSql(statement.sql)
    if (!parsed.ok || parsed.statements.length !== 1) throw new Error('Current external storage must be one parsed DDL statement')
    const node = parsed.statements[0]
    const relation = node.CreateStmt?.relation ?? node.AlterTableStmt?.relation ?? node.IndexStmt?.relation
    if (!relation || !names.has(relation.relname) || (relation.schemaname && relation.schemaname !== 'public')
      || node.CreateStmt?.if_not_exists || node.IndexStmt?.if_not_exists
      || (!node.CreateStmt && !node.AlterTableStmt && !node.IndexStmt))
      throw new Error('Current external storage operation or target differs')
    if (node.IndexStmt) objectNames.add(node.IndexStmt.idxname)
  }
  const security = compileSecurity({ ...plan, tables: source.tables })
  if (security.blockers.length) throw new Error('Current external storage denial must resolve')
  const denyStatements: string[] = []
  for (const sql of security.statements) {
    const parsed = await parseSql(sql)
    if (!parsed.ok) throw new Error('Current external storage security must parse')
    const node = parsed.statements[0]
    if (names.has(node.AlterTableStmt?.relation?.relname)
      || node.GrantStmt?.objects?.some((object: { RangeVar?: { relname?: string } }) => names.has(object.RangeVar?.relname ?? '')))
      denyStatements.push(sql)
  }
  if (denyStatements.length !== 6) throw new Error('Exact external storage FORCE/RLS/denial source required')
  return { tables: source.tables, statements: source.statements.map(statement => statement.sql), denyStatements,
    objectNames: [...objectNames].sort(), sourceDigest: source.sourceDigest }
}

async function externalReadObjectConflicts(client: pg.Client, producer: Awaited<ReturnType<typeof buildCurrentExternalReadSource>>) {
  const names = producer.tables.flatMap(table => [table.name, `${table.name}_pkey`])
  for (const statement of producer.statements) {
    const parsed = await parseSql(statement.sql)
    if (!parsed.ok) throw new Error('Current external storage source must parse before catalog preflight')
    for (const node of parsed.statements) if (node.IndexStmt) names.push(node.IndexStmt.idxname)
  }
  return (await client.query(`SELECT 'relation' AS kind,c.relname AS name,c.relkind::text AS relkind
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=ANY($1::text[])
    UNION ALL SELECT 'type' AS kind,t.typname AS name,t.typtype::text AS relkind
    FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='public' AND (t.typname=ANY($1::text[]) OR t.typname=ANY($2::text[]))`,
  [names, producer.tables.map(table => `_${table.name}`)])).rows
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

async function compilerTexts(source: string): Promise<{ sql: string; node: ParseNode }[]> {
  const parsed = await parseSql(source)
  if (!parsed.ok) throw new Error('Current security source SQL must parse')
  return parsed.texts.map((sql, index) => ({ sql, node: parsed.statements[index] }))
}

/** Apply only actual source ENABLE/FORCE metadata. Historical resource
 * predicates stay intact; full source policy compilation is not replayed
 * (planDeclaredAdmissionPolicies installs the declared policies only where a
 * granted command would otherwise have no admitting policy). */
export async function planCurrentRlsFlagConvergence(plan: V2Plan, relations: readonly Row[], options: { identityWillBeCreated?: boolean; externalReadWillBeCreated?: boolean } = {}) {
  const source = compileSecurity(plan)
  if (source.blockers.length) throw new Error('Current source RLS flag authority is unresolved')
  const targets = plan.tables.map(table => relationParts(table.name))
  const expected = new Map<string, Map<string, string>>()
  for (const program of source.statements) for (const entry of await compilerTexts(program)) {
    const alter = entry.node.AlterTableStmt
    if (!alter) continue
    const flags = alter.cmds?.map((command: ParseNode) => command.AlterTableCmd?.subtype) ?? []
    if (!flags.some((flag: string) => ['AT_EnableRowSecurity', 'AT_ForceRowSecurity', 'AT_DisableRowSecurity', 'AT_NoForceRowSecurity'].includes(flag))) continue
    const table = targets.find(target => target.schema === alter.relation?.schemaname && target.table === alter.relation?.relname)
    if (!table || flags.length !== 1 || !['AT_EnableRowSecurity', 'AT_ForceRowSecurity'].includes(flags[0]) || alter.missing_ok)
      throw new Error('Current source RLS flag atom is not admitted')
    const key = table.schema + '.' + table.table, current = expected.get(key) ?? new Map<string, string>()
    if (current.has(flags[0])) throw new Error('Duplicate current source RLS flag producer')
    current.set(flags[0], entry.sql); expected.set(key, current)
  }
  if (expected.size !== targets.length || [...expected.values()].some(flags => flags.size !== 2))
    throw new Error('Every canonical source table requires exact ENABLE and FORCE producers')
  const statements: string[] = []
  for (const target of targets) {
    const rows = relations.filter(row => row.schema === target.schema && row.table === target.table)
    if (!rows.length && options.identityWillBeCreated && target.schema === 'public' && target.table === identityTarget) continue
    if (!rows.length && options.externalReadWillBeCreated && target.schema === 'public'
      && EXTERNAL_READ_STORAGE_TABLES.some(name => name === target.table)) continue
    const row = rows[0]
    if (rows.length !== 1 || !['r', 'p'].includes(String(row.relkind)) || typeof row.relrowsecurity !== 'boolean' || typeof row.relforcerowsecurity !== 'boolean')
      throw new Error('Exact current source RLS relation metadata required: ' + target.schema + '.' + target.table)
    const flags = expected.get(target.schema + '.' + target.table)!
    if (!row.relrowsecurity) statements.push(flags.get('AT_EnableRowSecurity')!)
    if (!row.relforcerowsecurity) statements.push(flags.get('AT_ForceRowSecurity')!)
  }
  return { statements, inspectedRelations: expected.size }
}

async function verifyCurrentRlsFlags(plan: V2Plan, execute: (sql: string) => Promise<Row[]>) {
  const current = await planCurrentRlsFlagConvergence(plan, await execute(CURRENT_SECURITY_QUERIES.relations))
  if (current.statements.length) throw new Error('Current source RLS flags remain missing; read-only verification refused')
  return current.inspectedRelations
}

/** Every (application role, public relation, command) the role holds a grant for under row security, with no permissive policy that
 * admits it. Under RLS a grant without an admitting policy reads nothing and writes nothing: the declared authority is silently void. */
export const UNADMITTED_GRANT_QUERY = `SELECT r.rolname AS role,c.relname AS table,v.cmd
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  CROSS JOIN (VALUES ('union_eyes_runtime'),('union_eyes_system')) AS r(rolname)
  CROSS JOIN (VALUES ('r','SELECT'),('a','INSERT'),('w','UPDATE'),('d','DELETE')) AS v(cmd,privilege)
  WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relrowsecurity
    AND CASE WHEN v.privilege='DELETE' THEN pg_catalog.has_table_privilege(r.rolname,c.oid,'DELETE')
      ELSE pg_catalog.has_any_column_privilege(r.rolname,c.oid,v.privilege) END
    AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid=c.oid AND p.polpermissive AND p.polcmd IN (v.cmd,'*')
      AND (0=ANY(p.polroles) OR (SELECT o.oid FROM pg_catalog.pg_roles o WHERE o.rolname=r.rolname)=ANY(p.polroles)))
  ORDER BY 1,2,3`

export interface DeclaredPolicy { table: string; name: string; role: string; cmd: string; sql: string }
const POLICY_COMMAND: Record<string, string> = { select: 'r', insert: 'a', update: 'w', delete: 'd', all: '*' }

/** The permissive public-schema policies the current source compiler declares for the application roles, with their exact SQL text. */
export async function declaredApplicationPolicies(statements: readonly string[]): Promise<DeclaredPolicy[]> {
  const declared: DeclaredPolicy[] = []
  for (const source of statements) for (const entry of await compilerTexts(source)) {
    const create = entry.node.CreatePolicyStmt
    if (!create || create.table?.schemaname !== 'public' || create.permissive !== true) continue // the parser omits a false flag: RESTRICTIVE has none
    const roles = (create.roles ?? []).map((role: ParseNode) => role.RoleSpec?.rolename)
    if (roles.length !== 1 || !['union_eyes_runtime', 'union_eyes_system'].includes(roles[0])) continue
    const cmd = POLICY_COMMAND[String(create.cmd_name)]
    if (!cmd) throw new Error('Current source policy command is not admitted')
    declared.push({ table: String(create.table.relname), name: String(create.policy_name), role: roles[0], cmd, sql: entry.sql })
  }
  return declared
}

/**
 * The historical lineage keeps its own resource predicates, so the source policy program is not replayed wholesale. But a relation the
 * convergence grants a role under forced row security, with no historical policy admitting that command (GLOBAL_REFERENCE_DATA tables that
 * had no row security before), would be void. For exactly those (role, relation, command) gaps, install the source-declared policies, as
 * scripts/bootstrap-v2/security.ts compiles them, and nothing else. A gap the source declares no policy for refuses convergence.
 */
export function planDeclaredAdmissionPolicies(declared: readonly DeclaredPolicy[], gaps: readonly Row[], existing: readonly Row[]) {
  const statements: string[] = []
  const installed: string[] = []
  for (const gap of gaps) {
    const matches = declared.filter(policy => policy.table === gap.table && policy.role === gap.role && (policy.cmd === gap.cmd || policy.cmd === '*'))
    if (!matches.length) throw new Error(`Granted relation has no declared admitting policy: ${String(gap.role)} ${String(gap.table)} ${String(gap.cmd)}`)
    for (const policy of matches) {
      if (existing.some(row => row.table === policy.table && row.name === policy.name))
        throw new Error(`Declared policy name is already taken by a non-admitting policy: ${policy.table}.${policy.name}`)
      if (!statements.includes(policy.sql)) { statements.push(policy.sql); installed.push(`${policy.table}.${policy.name}`) }
    }
  }
  return { statements, installed }
}

export function assertEveryGrantAdmitted(gaps: readonly Row[]) {
  if (gaps.length) throw new Error('Granted relations without an admitting policy remain: ' +
    gaps.map(gap => `${String(gap.role)}:${String(gap.table)}:${String(gap.cmd)}`).join(', '))
}

/**
 * Retained security-invoker helpers that a retained physical guard calls in the writer's own role. The blanket function REVOKE in
 * the convergence removes every application EXECUTE; each helper here gets back exactly its declared callers and no other role.
 * - ue_is_workbook_system_principal (cache 0013): the workbooks trigger ue_workbook_credential_authority calls it on every
 *   INSERT/UPDATE, and the canonical catalog grants union_eyes_system SELECT/INSERT/UPDATE on workbooks. Without EXECUTE every
 *   system workbook write is refused with "permission denied for function"; the runtime role stays refused.
 * A helper that is absent (the canonical V2 source plan has neither the helper nor its trigger) is granted nothing.
 */
export const RETAINED_FUNCTION_EXECUTE: readonly { name: string; callers: readonly string[] }[] = [
  { name: 'ue_is_workbook_system_principal', callers: ['union_eyes_system'] },
]
export const RETAINED_FUNCTION_ACL_QUERY = `SELECT p.proname AS name,pg_catalog.pg_get_function_identity_arguments(p.oid) AS args,p.prosecdef AS definer,
  r.rolname AS role,pg_catalog.has_function_privilege(r.rolname,p.oid,'EXECUTE') AS allowed,pg_catalog.has_function_privilege('public',p.oid,'EXECUTE') AS public_execute
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  CROSS JOIN (VALUES ('union_eyes_runtime'),('union_eyes_system')) r(rolname)
  WHERE n.nspname='public' AND p.proname IN (${RETAINED_FUNCTION_EXECUTE.map(fn => `'${fn.name}'`).join(',')}) ORDER BY 1,4`

export function planRetainedFunctionExecute(rows: readonly Row[]): string[] {
  const statements: string[] = []
  for (const fn of RETAINED_FUNCTION_EXECUTE) {
    const present = rows.filter(row => row.name === fn.name)
    if (!present.length) continue
    if (present.some(row => row.args !== '' || row.definer !== false))
      throw new Error(`Retained helper ${fn.name} must be one argument-less security-invoker function`)
    if (fn.callers.length) statements.push(`GRANT EXECUTE ON FUNCTION public.${q(fn.name)}() TO ${fn.callers.map(q).join(',')}`)
  }
  return statements
}

export function retainedFunctionExecuteViolations(rows: readonly Row[]): string[] {
  const violations: string[] = []
  for (const row of rows) {
    const fn = RETAINED_FUNCTION_EXECUTE.find(entry => entry.name === row.name)
    if (!fn) continue
    if (row.public_execute !== false) violations.push(`PUBLIC:${fn.name}: retained helper is executable by PUBLIC`)
    if (row.allowed !== fn.callers.includes(String(row.role))) violations.push(`${String(row.role)}:${fn.name}: retained helper EXECUTE differs from its declared callers`)
  }
  return violations
}

function assertRetainedFunctionExecute(rows: readonly Row[]) {
  const violations = retainedFunctionExecuteViolations(rows)
  if (violations.length) throw new Error('Retained helper execute authority differs: ' + violations.join(', '))
}

export interface RetainedPublicSchemaAuthority {
  owner: string; effective_owner: string; can_set_owner: boolean;
}
export interface CurrentPublicSchemaExecution {
  owner: string; statements: readonly string[]; usageRoles: readonly string[];
}
type CurrentPublicSchemaPrivileges = Pick<CurrentPublicSchemaExecution, 'statements' | 'usageRoles'>

function publicSchemaGrant(node: ParseNode) {
  const grant = node.GrantStmt
  if (grant?.objtype !== 'OBJECT_SCHEMA' || !grant.objects?.some((item: ParseNode) => item.String?.sval === 'public')) return null
  if (grant.objects.length !== 1 || grant.objects[0].String?.sval !== 'public' || grant.grant_option || grant.grantor
    || (grant.targtype && grant.targtype !== 'ACL_TARGET_OBJECT') || (grant.behavior && grant.behavior !== 'DROP_RESTRICT'))
    throw new Error('Current public schema privilege atom is not admitted')
  const roles: string[] = (grant.grantees ?? []).map((item: ParseNode) => {
    const role = item.RoleSpec
    if (role?.roletype === 'ROLESPEC_PUBLIC') return 'PUBLIC'
    if (role?.roletype !== 'ROLESPEC_CSTRING' || !managedRoles.includes(role.rolename)) throw new Error('Current public schema privilege target is not admitted')
    return role.rolename
  })
  if (!roles.length || new Set(roles).size !== roles.length || (grant.is_grant && roles.includes('PUBLIC')))
    throw new Error('Current public schema privilege target is not admitted')
  const privileges: string[] = grant.privileges?.map((item: ParseNode) => {
    const privilege = item.AccessPriv
    const name = String(privilege?.priv_name).toUpperCase()
    if (!['USAGE', 'CREATE'].includes(name) || privilege.cols?.length) throw new Error('Current public schema privilege is not admitted')
    return name
  }) ?? []
  if (!privileges.length && (grant.is_grant || roles.length !== 1 || roles[0] !== 'PUBLIC'))
    throw new Error('Current public schema ALL privilege is not admitted')
  return { roles, privileges: privileges.length ? privileges : ['USAGE', 'CREATE'], isGrant: grant.is_grant === true }
}

/** The old public owner remains authoritative until its protected deadline
 * guard is repaired. Delegate only exact current source schema atoms through
 * that verified owner; never give the installer a new GRANT OPTION. */
export async function planRetainedPublicSchemaExecution(
  programs: readonly string[], authority: RetainedPublicSchemaAuthority, trustedOwner: string,
): Promise<CurrentPublicSchemaExecution> {
  if (!authority || ![trustedOwner, 'ue_v2_owner', 'pg_database_owner'].includes(authority.owner)
    || ![trustedOwner, 'ue_v2_owner'].includes(authority.effective_owner)
    || (authority.owner !== 'pg_database_owner' && authority.owner !== authority.effective_owner)
    || authority.can_set_owner !== true)
    throw new Error('Retained public schema owner and SET authority are required')
  q(authority.effective_owner)
  return { owner: authority.effective_owner, ...await projectCurrentPublicSchemaPrivileges(programs) }
}

async function projectCurrentPublicSchemaPrivileges(programs: readonly string[]): Promise<CurrentPublicSchemaPrivileges> {
  const statements: string[] = [], privileges = new Map<string, Set<string>>()
  for (const program of programs) for (const entry of await compilerTexts(program)) {
    const atom = publicSchemaGrant(entry.node)
    if (!atom) continue
    statements.push(entry.sql)
    for (const role of atom.roles) {
      const current = privileges.get(role) ?? new Set<string>()
      for (const privilege of atom.privileges) {
        if (atom.isGrant) current.add(privilege)
        else current.delete(privilege)
      }
      privileges.set(role, current)
    }
  }
  if (!statements.length || [...privileges].some(([role, current]) => role !== 'ue_v2_owner' && current.has('CREATE')))
    throw new Error('Current source must revoke every transient public schema CREATE grant')
  return { statements: [...new Set(statements)],
    usageRoles: [...privileges].filter(([role, current]) => current.has('USAGE') && role !== 'ue_v2_owner').map(([role]) => role).sort() }
}

/** A savepoint restores role state even when PostgreSQL aborts a statement.
 * The error still propagates to the caller's complete transaction rollback. */
export async function executeRetainedPublicSchemaProgram(
  source: string, plan: CurrentPublicSchemaExecution, execute: (sql: string) => Promise<Row[]>,
): Promise<Row[]> {
  const entries = await compilerTexts(source)
  if (!entries.some(entry => publicSchemaGrant(entry.node))) return execute(source)
  for (const entry of entries) if (publicSchemaGrant(entry.node) && !plan.statements.includes(entry.sql))
    throw new Error('Public schema privilege has no exact current source producer')
  let rows: Row[] = []
  for (const entry of entries) {
    if (!publicSchemaGrant(entry.node)) { rows = await execute(entry.sql); continue }
    await execute('SAVEPOINT ue_current_public_schema_atom')
    try {
      await execute(`SET LOCAL ROLE ${q(plan.owner)}`)
      rows = await execute(entry.sql)
    } catch (error) {
      await execute('ROLLBACK TO SAVEPOINT ue_current_public_schema_atom')
      throw error
    } finally {
      await execute('SET LOCAL ROLE ue_v2_owner')
      await execute('RELEASE SAVEPOINT ue_current_public_schema_atom')
    }
  }
  return rows
}

async function currentPublicSchemaAuthority(execute: (sql: string) => Promise<Row[]>, major: CanonicalPostgresMajor) {
  const rows = await execute(`WITH retained AS (
    SELECT n.nspowner,pg_catalog.pg_get_userbyid(n.nspowner) AS owner,
      CASE WHEN pg_catalog.pg_get_userbyid(n.nspowner)='pg_database_owner' THEN d.datdba ELSE n.nspowner END AS effective_oid
    FROM pg_catalog.pg_namespace n CROSS JOIN pg_catalog.pg_database d WHERE n.nspname='public' AND d.datname=current_database())
    SELECT owner,pg_catalog.pg_get_userbyid(effective_oid) AS effective_owner,
      pg_catalog.pg_has_role(session_user,effective_oid,'${major === 16 ? 'SET' : 'MEMBER'}') AS can_set_owner FROM retained`)
  if (rows.length !== 1) throw new Error('Exactly one retained public schema owner is required')
  return rows[0] as unknown as RetainedPublicSchemaAuthority
}

export function assertFinalPublicSchemaPrivileges(plan: CurrentPublicSchemaPrivileges, rows: readonly Row[]) {
  if (rows.length !== 1 || rows[0].owner !== 'ue_v2_owner' || !Array.isArray(rows[0].create_roles)
    || rows[0].create_roles.length || !Array.isArray(rows[0].grantable_roles) || rows[0].grantable_roles.length || !Array.isArray(rows[0].usage_roles)
    || JSON.stringify([...rows[0].usage_roles].sort()) !== JSON.stringify([...plan.usageRoles].sort()))
    throw new Error('Final public schema privileges differ from current source')
}

async function verifyFinalPublicSchemaPrivileges(plan: CurrentPublicSchemaPrivileges, execute: (sql: string) => Promise<Row[]>) {
  assertFinalPublicSchemaPrivileges(plan, await execute(`SELECT pg_catalog.pg_get_userbyid(n.nspowner) AS owner,
    ARRAY(SELECT r.rolname::text FROM pg_catalog.pg_roles r WHERE r.rolname IN (${applicationRoles.map(literal).join(',')})
      AND pg_catalog.has_schema_privilege(r.oid,n.oid,'CREATE')
      UNION SELECT COALESCE(r.rolname::text,'PUBLIC') FROM pg_catalog.aclexplode(COALESCE(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) a
        LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='CREATE' AND a.grantee<>n.nspowner) AS create_roles,
    ARRAY(SELECT COALESCE(r.rolname::text,'PUBLIC') FROM pg_catalog.aclexplode(COALESCE(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) a
      LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee WHERE a.is_grantable AND a.grantee<>n.nspowner) AS grantable_roles,
    ARRAY(SELECT COALESCE(r.rolname::text,'PUBLIC') FROM pg_catalog.aclexplode(COALESCE(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) a
      LEFT JOIN pg_catalog.pg_roles r ON r.oid=a.grantee WHERE a.privilege_type='USAGE' AND a.grantee<>n.nspowner
      AND (a.grantee=0 OR r.rolname IN (${applicationRoles.map(literal).join(',')})) ORDER BY 1) AS usage_roles
    FROM pg_catalog.pg_namespace n WHERE n.nspname='public'`))
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
async function executeCurrentSourceProgram(label: string, statements: readonly string[], execute: (sql: string) => Promise<Row[]>) {
  const actor = (await execute('SELECT current_user::text AS current_role'))[0]?.current_role
  if (typeof actor !== 'string' || !/^[a-z_][a-z0-9_]{0,62}$/.test(actor)) throw new Error('Current framework executor identity is invalid')
  for (const [index, sql] of statements.entries()) {
    const parsed = await parseSql(sql)
    if (!parsed.ok || parsed.statements.length !== 1) throw new Error('Current framework statement must parse individually')
    const node = parsed.statements[0], declaration = node.CreateFunctionStmt
    const signature = declaration ? declaration.funcname.map((part: ParseNode) => part.String.sval).join('.') + (declaration.parameters?.length ? '' : '()') : undefined
    try { await execute(sql) } catch (error) {
      const message = error instanceof Error ? error.message : ''
      const code = (error as { code?: unknown })?.code
      const denied = /^permission denied for (function|table|schema) ([a-z_][a-z0-9_.]*)$/.exec(message)
      throw new Error(`Current ${label} statement failed: ` + JSON.stringify({ index: index + 1, kind: Object.keys(node)[0], currentRole: actor,
        function: signature, sqlstate: typeof code === 'string' && /^[A-Z0-9]{5}$/.test(code) ? code : 'UNKNOWN',
        ...(denied ? { deniedKind: denied[1], deniedIdentity: denied[2] } : {}) }))
    }
  }
}

export async function executeCurrentFrameworkProgram(statements: readonly string[], execute: (sql: string) => Promise<Row[]>) {
  return executeCurrentSourceProgram('framework', statements, execute)
}

export async function executeCurrentCompanionPrograms(programs: readonly string[], execute: (sql: string) => Promise<Row[]>) {
  for (const [index, source] of programs.entries())
    await executeCurrentSourceProgram(`companion ${index + 1}`, (await compilerTexts(source)).map(entry => entry.sql), execute)
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
  await verifyCurrentUuidDefaultBindings(plan, async (sql, parameters) =>
    (await client.query<CurrentUuidDefaultRow>(sql, parameters)).rows)
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
  const schemaPrograms = [...projection.security.statements, ...projection.programs.auth, projection.programs.framework,
    ...projection.programs.companions, ...projection.programs.guardFunctions, ...projection.programs.messaging,
    projection.programs.externalRead.prepare, projection.programs.externalRead.install, projection.programs.externalRead.authBridge, projection.programs.externalRead.finalize]
  const publicSchemaPrivileges = await projectCurrentPublicSchemaPrivileges(schemaPrograms)
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
    await verifyCurrentRlsFlags(plan, execute)
    await verifyFinalPublicSchemaPrivileges(publicSchemaPrivileges, execute)
    assertEveryGrantAdmitted(await execute(UNADMITTED_GRANT_QUERY))
    assertRetainedFunctionExecute(await execute(RETAINED_FUNCTION_ACL_QUERY))
    const verified = await validateCurrent(client, options.repoRoot, plan, projection, currentContract, major)
    return { profile: 'CURRENT_SOURCE', applied: false, sourcePlanDigest, currentContract, ...verified,
      securityPolicyVerified: true, runtimePrivilegesVerified: true, applicationReady: false }
  }
  const externalProducer = await buildCurrentExternalReadSource()
  const externalCreation = await planCurrentExternalReadCreation(plan, relations, await externalReadObjectConflicts(client, externalProducer), externalProducer)
  const identityProducer = await buildCurrentPlatformIdentitySource()
  const identityScope = { ...plan, tables: plan.tables.filter(table => !EXTERNAL_READ_STORAGE_TABLES.some(name => name === table.name)) }
  const identityCreation = await planCurrentIdentityCreation(identityScope, relations, await identityObjectConflicts(client, identityProducer), identityProducer)
  const rlsFlags = await planCurrentRlsFlagConvergence(plan, relations, { identityWillBeCreated: identityCreation.statements.length > 0,
    externalReadWillBeCreated: externalCreation.statements.length > 0 })
  const authProducer = await buildCurrentPlatformAuthSource()
  const authColumns = await planCurrentAuthColumnConvergence(plan, await execute(CURRENT_SECURITY_QUERIES.authColumns) as unknown as CurrentAuthColumn[], relations,
    authProducer, readFileSync(path.join(options.repoRoot, legacyAuthReference.source), 'utf8'))
  const references = readLegacySecurityReferences(options.repoRoot)
  const legacyOwner = await execute(LEGACY_SECURITY_PREIMAGE_QUERIES.owner)
  if (legacyOwner.length !== 1 || legacyOwner[0].current_user !== originalRole || legacyOwner[0].session_user !== originalRole ||
      (legacyOwner[0].owner !== originalRole && actor[0].rolsuper !== true) || managedRoles.includes(String(legacyOwner[0].owner))) throw new Error('Trusted original relation owner cannot be established')
  const trustedOwner = String(legacyOwner[0].owner)
  const containedParent = planContainedParentPolicyInstall(projection.requiredContainedParentPolicies,
    await execute(CONTAINED_PARENT_POLICY_QUERY), { expectedOwner: trustedOwner, requireForcedRls: false })
  const signaturePolicyDrops = await planLegacyRewardsSignaturePolicyRetirement(options.repoRoot,
    await execute(LEGACY_REWARDS_SIGNATURE_POLICY_QUERY) as unknown as ExistingFrameworkPolicy[])
  const schemaExecution = await planRetainedPublicSchemaExecution(schemaPrograms, await currentPublicSchemaAuthority(execute, major), trustedOwner)
  const activationTransition = await planLegacyActivationConstraintTransition(options.repoRoot,
    await execute(LEGACY_SECURITY_PREIMAGE_QUERIES.activationConstraint) as unknown as LegacyActivationConstraint[])
  const authDrops = planLegacyAuthPolicyReplacement(await execute(LEGACY_SECURITY_PREIMAGE_QUERIES.authPolicies) as unknown as LegacyAuthPolicy[])
  const journalDrops = planLegacyJournalReplacement(references['apps/union-eyes/db/migrations-platform/0049_claim_status_transitions.sql'], trustedOwner,
    await execute(LEGACY_SECURITY_PREIMAGE_QUERIES.journalFunctions) as unknown as LegacyJournalFunction[], await execute(LEGACY_SECURITY_PREIMAGE_QUERIES.journalTriggers) as unknown as LegacyJournalTrigger[])
  const functionRows = await execute(functionQuery)
  const frameworkReplacements = await planLegacyFrameworkFunctionReplacement(options.repoRoot, projection.programs.framework, functionRows)
  const authorityAdoption = await planLegacyPhysicalFunctionAdoption(options.repoRoot, AUTHORITY_PHYSICAL_GUARDS, functionRows, trustedOwner)
  const metadataPolicySql: string[] = []
  const scopePolicySql: string[] = []
  const securityFunctionSql: string[] = []
  const publicSchemaSql: string[] = []
  for (const source of projection.security.statements) for (const entry of await compilerTexts(source)) {
    const create = entry.node.CreatePolicyStmt
    if (create?.table?.schemaname === 'public' && b002.has(create.table.relname)) scopePolicySql.push(entry.sql)
    if (create?.policy_name === 'ue_platform_metadata_admin') metadataPolicySql.push(entry.sql)
    if (entry.node.CreateFunctionStmt || entry.node.GrantStmt?.objtype === 'OBJECT_FUNCTION' || entry.node.AlterDefaultPrivilegesStmt) securityFunctionSql.push(entry.sql)
    if (publicSchemaGrant(entry.node)) publicSchemaSql.push(entry.sql)
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
  const ownership = planCanonicalOwnership({ tables: plan.tables.filter(table => table.name !== identityCreation.table.name
    && !EXTERNAL_READ_STORAGE_TABLES.some(name => name === table.name)) }, relations, await execute(CURRENT_SECURITY_QUERIES.sequences), trustedOwner)
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
  for (const sql of [...authDrops, ...journalDrops, ...ledgerDrop, ...signaturePolicyDrops]) await execute(sql)
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
  const executeSource = (sql: string) => executeRetainedPublicSchemaProgram(sql, schemaExecution, execute)
  for (const sql of await planVerifiedFrameworkExecuteRestore(projection.functions, frameworkReplacements)) await execute(sql)
  for (const sql of authColumns.statements) await execute(sql)
  // Public remains the table creation namespace; implicit pg_catalog wins
  // function lookup over a retained public alias. Restore security path below.
  await execute(CURRENT_PUBLIC_TABLE_CREATION_SQL)
  for (const sql of identityCreation.statements) await execute(sql)
  for (const sql of externalCreation.statements) await execute(sql)
  await execute('SET LOCAL search_path=pg_catalog,public,pg_temp')
  for (const sql of identityCreation.denyStatements) await execute(sql)
  for (const sql of externalCreation.denyStatements) await execute(sql)
  for (const sql of rlsFlags.statements) await execute(sql)
  for (const sql of publicSchemaSql) await executeSource(sql)
  for (const sql of projection.publicTableGrants) await execute(sql)
  for (const sql of securityFunctionSql) await execute(sql)
  for (const sql of projection.programs.auth) await executeSource(sql)
  const omissions = new Set(policyOmissions.map(entry => entry.originalSql))
  await executeCurrentFrameworkProgram(await planCurrentFrameworkProgram(projection.programs.framework, projection.functions, frameworkReplacements, policyOmissions), executeSource)
  for (const sql of metadataPolicySql) if (!omissions.has(sql)) await execute(sql)
  await executeCurrentCompanionPrograms(projection.programs.companions, executeSource)
  await asRole(originalRole, projection.programs.externalRead.prepare)
  await executeCurrentSourceProgram('external read', (await compilerTexts(projection.programs.externalRead.install)).map(entry => entry.sql), executeSource)
  await executeCurrentSourceProgram('external auth bridge', (await compilerTexts(projection.programs.externalRead.authBridge)).map(entry => entry.sql), executeSource)
  for (const sql of activationTransition.statements) await execute(sql)
  for (const contract of CURRENT_CASE_GUARDS) {
    const guards = planPhysicalGuards(contract, await inspectPhysicalGuards(contract, execute))
    for (const sql of guards.statements) await executeSource(sql)
  }
  const messaging = planMessagingPhysicalGuards(await inspectMessagingPhysicalCatalog(execute))
  if (messaging.missingTables.length) throw new Error('Current messaging relation prerequisites are missing')
  for (const sql of messaging.statements) await executeSource(sql)
  // Existing dedicated-reader-owned functions survive replacement by OID.
  // Quarantine may have removed an owner's ordinary EXECUTE privilege too;
  // restore the exact source ACL, including that owner entry, rather than
  // inheriting the old object's post-replacement ACL by accident.
  for (const fn of projection.functions) {
    for (const sql of sourceFunctionExecuteSql(fn)) {
      if (fn.owner === EXTERNAL_READ_OWNER) await asRole(EXTERNAL_READ_OWNER, sql)
      else await execute(sql)
    }
  }
  await asRole(originalRole, projection.programs.externalRead.finalize)
  // The retained helper keeps its historical owner (the bootstrap operator); only that owner can restore its declared callers.
  const retainedFunctionGrants = planRetainedFunctionExecute(await execute(RETAINED_FUNCTION_ACL_QUERY))
  for (const sql of retainedFunctionGrants) await asRole(originalRole, sql)
  assertRetainedFunctionExecute(await execute(RETAINED_FUNCTION_ACL_QUERY))
  for (const sql of scopePolicySql) await execute(sql)
  for (const sql of containedParent.statements) await execute(sql)
  const admission = planDeclaredAdmissionPolicies(await declaredApplicationPolicies(projection.security.statements),
    await execute(UNADMITTED_GRANT_QUERY),
    await execute("SELECT c.relname AS table,p.polname AS name FROM pg_catalog.pg_policy p JOIN pg_catalog.pg_class c ON c.oid=p.polrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'"))
  for (const sql of admission.statements) await execute(sql)
  assertEveryGrantAdmitted(await execute(UNADMITTED_GRANT_QUERY))
  const session = await planBusinessSessionRepair(execute)
  const sessionReceipt = await applyBusinessSessionRepair(execute, session.fingerprint, sql => asRole('uev2admin', sql))
  await asRole(schemaExecution.owner, 'ALTER SCHEMA public OWNER TO ue_v2_owner')
  await verifyFinalPublicSchemaPrivileges(publicSchemaPrivileges, execute)
  const rlsRelationsVerified = await verifyCurrentRlsFlags(plan, execute)
  const verified = await validateCurrent(client, options.repoRoot, plan, projection, currentContract, major)
  await execute(`SET LOCAL ROLE ${q(originalRole)}`)
  return { profile: 'CURRENT_SOURCE', applied: true, postgresMajor: major, sourcePlanDigest, currentContract,
    roleSourceDigest: rolePlan.sourceDigest, sourceFunctionCount: projection.functions.length, session: sessionReceipt,
    identitySourceDigest: identityCreation.sourceDigest,
    externalReadSourceDigest: externalCreation.sourceDigest,
    sourceTablesCreated: [identityCreation.table.name, ...externalCreation.tables.map(table => table.name)],
    containedParentPoliciesAdded: containedParent.targets, declaredAdmissionPoliciesAdded: admission.installed, retainedFunctionGrants,
    authColumnsAdded: authColumns.addedColumns, authSchemaSourceDigest: authColumns.sourceDigest,
    activationConstraintReplaced: activationTransition.statements.length > 0, activationReferenceSha256: activationTransition.referenceSha256,
    rlsFlagStatementsApplied: rlsFlags.statements.length, rlsRelationsVerified,
    ...verified, securityPolicyVerified: true, runtimePrivilegesVerified: true, applicationReady: false,
    businessDmlIssued: false, historicalSqlReplayed: false }
}
