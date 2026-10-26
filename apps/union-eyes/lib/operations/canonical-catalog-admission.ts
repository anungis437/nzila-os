import {
  AUTH_EXECUTION_ROLES,
  AUTH_FUNCTION_EXPECTATIONS,
  AUTH_PRIVILEGE_EXPECTATIONS,
  AUTH_PUBLIC_BINDING_EXPECTATIONS,
  AUTH_ROLE_MEMBERSHIP_EXPECTATIONS,
} from '@nzila/db/auth-storage-authority'
import baseContract from './catalog-authority-contract.json'
import { catalogContractDigest, type CatalogRow } from './catalog-admission-core.mjs'
import { CASE_ASSIGNEE_CATALOG_QUERY, CASE_ASSIGNEE_PREDICATE_OWNER, caseAssigneePredicateViolations } from '@/db/auth/case-assignee-predicate'
import { CONVERSATION_ASSIGNEE_CATALOG_QUERY, CONVERSATION_ASSIGNEE_PREDICATE_OWNER, conversationAssigneePredicateViolations } from '@/db/auth/conversation-assignee-predicate'

type Execute = (statement: string) => Promise<CatalogRow[]>
const roles = [...Object.values(AUTH_EXECUTION_ROLES), 'union_eyes_runtime', 'union_eyes_system']
const literals = roles.map(role => `'${role}'`).join(',')
const runtimeFunctions = AUTH_FUNCTION_EXPECTATIONS.filter(entry =>
  (entry.callers as readonly string[]).includes('union_eyes_runtime'),
)

/** Derive the canonical overlay from independent, compiled auth expectations.
 * The legacy public authority manifest remains exact. No observed DB ACL is
 * used to create an allowlist, and a corrupt base contract still fails closed.
 */
export function canonicalCatalogContract(base = baseContract) {
  if (catalogContractDigest(base.payload) !== base.digest) return base
  const payload = structuredClone(base.payload)
  payload.nonPublic = payload.nonPublic.map(entry => entry.schema === 'user_management'
    ? { ...entry, runtime: [], system: [] } : entry)
  payload.systemSchemaUsage = ['public']
  const binding = AUTH_PUBLIC_BINDING_EXPECTATIONS
  payload.entries.push({ table: 'platform_identity_bindings', classification: 'PLATFORM_METADATA_DEDICATED_EXECUTION_CONTEXT', runtime: [], system: [] })
  for (const [role, tables] of Object.entries(AUTH_PRIVILEGE_EXPECTATIONS)) {
    for (const [table, grants] of Object.entries(tables)) {
      for (const [privilege, columns] of Object.entries(grants)) {
        if (columns !== '*') payload.approvedColumnGrants.push({ schema: 'user_management', table, role, privilege, columns: [...columns].sort() })
      }
    }
  }
  payload.approvedColumnGrants.push(
    { schema: 'public', table: 'platform_identity_bindings', role: binding.role, privilege: 'SELECT', columns: [...binding.selectColumns].sort() },
    { schema: 'public', table: 'organization_members', role: AUTH_EXECUTION_ROLES.system, privilege: 'SELECT', columns: ['id', 'organization_id', 'status', 'user_id'] },
    { schema: 'public', table: 'organization_members', role: AUTH_EXECUTION_ROLES.system, privilege: 'UPDATE', columns: ['status', 'updated_at'] },
  )
  const canonical = { ...payload, approvedRuntimeDefiners: [
    ...runtimeFunctions.map(entry => ({ schema: 'user_management', name: entry.name, owner: entry.owner })),
    {schema:'public',name:'ue_case_assignee_authorized',owner:CASE_ASSIGNEE_PREDICATE_OWNER},
    {schema:'public',name:'ue_conversation_assignee_authorized',owner:CONVERSATION_ASSIGNEE_PREDICATE_OWNER},
  ] }
  return { payload: canonical, digest: catalogContractDigest(canonical) }
}

/** Batched PostgreSQL 15 compatible catalog reads. No credentials, mutations,
 * SET ROLE, or admission-triggered privilege repair are permitted here.
 */
export async function inspectCanonicalAuthCatalog(execute: Execute): Promise<string[]> {
  const violations: string[] = []
  const roleRows = await execute(`SELECT rolname,rolsuper,rolbypassrls,rolinherit,rolcanlogin,rolcreatedb,rolcreaterole,
    has_schema_privilege(rolname,'user_management','USAGE') AS auth_usage,
    has_schema_privilege(rolname,'user_management','CREATE') AS auth_create,
    has_schema_privilege(rolname,'public','CREATE') AS public_create
    FROM pg_roles WHERE rolname IN (${literals})`)
  for (const role of roles) {
    const actual = roleRows.find(row => row.rolname === role)
    const canonical = Object.values(AUTH_EXECUTION_ROLES).some(value => value === role)
    const gateway = role === AUTH_EXECUTION_ROLES.gateway || role === AUTH_EXECUTION_ROLES.systemGateway
    if (!actual || actual.rolsuper || actual.rolbypassrls || actual.auth_create
      || actual.auth_usage !== ((canonical && !gateway) || role === 'union_eyes_runtime')
      || (canonical && (actual.rolinherit || actual.rolcanlogin || actual.rolcreatedb || actual.rolcreaterole || actual.public_create))) {
      violations.push(`${role}: unsafe or missing canonical role/schema authority`)
    }
  }
  const memberships = await execute(`SELECT member.rolname AS member,granted.rolname AS granted,m.admin_option
    FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member JOIN pg_roles granted ON granted.oid=m.roleid
    WHERE member.rolname IN (${literals})`)
  for (const row of memberships) {
    if (!AUTH_ROLE_MEMBERSHIP_EXPECTATIONS[String(row.member)]?.includes(String(row.granted)) || row.admin_option) {
      violations.push(`${row.member}->${row.granted}: unsafe canonical membership`)
    }
  }
  for (const [member, grants] of Object.entries(AUTH_ROLE_MEMBERSHIP_EXPECTATIONS)) {
    for (const granted of grants) if (!memberships.some(row => row.member === member && row.granted === granted)) violations.push(`${member}->${granted}: missing canonical membership`)
  }
  const publicExpectations: Record<string, Record<string, Record<string, readonly string[]>>> = {
    platform_identity_bindings: { [AUTH_PUBLIC_BINDING_EXPECTATIONS.role]: { SELECT: AUTH_PUBLIC_BINDING_EXPECTATIONS.selectColumns } },
    organization_members: { [AUTH_EXECUTION_ROLES.system]: { SELECT: ['id', 'organization_id', 'status', 'user_id'], UPDATE: ['status', 'updated_at'] } },
  }
  const columns = await execute(`SELECT r.rolname AS role,n.nspname AS schema_name,c.relname AS table_name,v.privilege,
    array_agg(a.attname::text ORDER BY a.attname) AS all_columns,
    COALESCE(array_agg(a.attname::text ORDER BY a.attname) FILTER (WHERE has_column_privilege(r.oid,c.oid,a.attnum,v.privilege)),ARRAY[]::text[]) AS allowed_columns
    FROM pg_roles r CROSS JOIN pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) v(privilege)
    WHERE r.rolname IN (${literals}) AND (n.nspname='user_management' OR
      (n.nspname='public' AND c.relname IN ('platform_identity_bindings','organization_members') AND r.rolname LIKE 'nzila_auth_%'))
      AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped
    GROUP BY r.rolname,n.nspname,c.relname,v.privilege`)
  for (const row of columns) {
    const declared = row.schema_name === 'public'
      ? publicExpectations[String(row.table_name)]?.[String(row.role)]?.[String(row.privilege)]
      : AUTH_PRIVILEGE_EXPECTATIONS[String(row.role)]?.[String(row.table_name)]?.[String(row.privilege)]
    const expected = declared === '*' ? row.all_columns as string[] : [...(declared ?? [])].sort()
    const actual = row.allowed_columns as string[]
    if (JSON.stringify(actual) !== JSON.stringify(expected)) violations.push(`${row.role}:${row.table_name}:${row.privilege}: canonical column privileges differ`)
  }
  const expectedTables = new Set(Object.values(AUTH_PRIVILEGE_EXPECTATIONS).flatMap(tables => Object.keys(tables)))
  for (const table of expectedTables) if (!columns.some(row => row.schema_name === 'user_management' && row.table_name === table)) violations.push(`${table}: canonical auth relation is absent`)
  const tables = await execute(`SELECT r.rolname AS role,c.relname AS table_name,v.privilege,
    has_table_privilege(r.oid,c.oid,v.privilege) AS allowed,c.relrowsecurity,c.relforcerowsecurity,owner.rolname AS owner
    FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles owner ON owner.oid=c.relowner
    CROSS JOIN unnest(ARRAY['DELETE','TRUNCATE','TRIGGER']) v(privilege)
    WHERE r.rolname IN (${literals}) AND (n.nspname='user_management' OR
      (n.nspname='public' AND c.relname IN ('platform_identity_bindings','organization_members') AND r.rolname LIKE 'nzila_auth_%'))
      AND c.relkind IN ('r','p')`)
  for (const row of tables) {
    const expected = AUTH_PRIVILEGE_EXPECTATIONS[String(row.role)]?.[String(row.table_name)]?.[String(row.privilege)] === '*'
    if (row.allowed !== expected || !row.relrowsecurity || !row.relforcerowsecurity || roles.some(role => role === row.owner)) violations.push(`${row.role}:${row.table_name}:${row.privilege}: canonical table grant, RLS or ownership differs`)
  }
  const functions = await execute(`SELECT p.proname,p.prosecdef,p.proconfig,owner.rolname AS owner,r.rolname AS role,
    has_function_privilege(r.oid,p.oid,'EXECUTE') AS allowed,has_function_privilege('public',p.oid,'EXECUTE') AS public_execute
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles owner ON owner.oid=p.proowner CROSS JOIN pg_roles r
    WHERE n.nspname='user_management' AND r.rolname IN (${literals})`)
  for (const expected of AUTH_FUNCTION_EXPECTATIONS) {
    const actual = functions.filter(row => row.proname === expected.name)
    if (actual.length !== roles.length) violations.push(`${expected.name}: missing or overloaded canonical function`)
    for (const row of actual) {
      const allowed = row.role === expected.owner || (expected.callers as readonly string[]).includes(String(row.role))
      if (row.owner !== expected.owner || !row.prosecdef || !(row.proconfig as string[] | null)?.includes('search_path=pg_catalog') || row.allowed !== allowed || row.public_execute) {
        violations.push(`${row.role}:${expected.name}: canonical function authority differs`)
      }
    }
  }
  violations.push(...caseAssigneePredicateViolations(await execute(CASE_ASSIGNEE_CATALOG_QUERY)))
  violations.push(...conversationAssigneePredicateViolations(await execute(CONVERSATION_ASSIGNEE_CATALOG_QUERY)))
  return violations
}
