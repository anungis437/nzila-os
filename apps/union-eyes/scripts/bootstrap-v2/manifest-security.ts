import type pg from 'pg'
import { compileSecurity } from './security'
import type { V2Plan } from './source'
import { AUTH_FUNCTION_EXPECTATIONS } from './auth-sql'
import { inspectAuthPrivilegeExpectations } from './auth-privileges'
import { FRAMEWORK_FUNCTIONS, FRAMEWORK_ROLES } from './framework-contract'
import { inspectFrameworkPrivileges } from './framework-privileges'
import { INSTALLER_FUNCTION_OWNER_ROLES } from './execution-roles'

export interface InstallerMembership {
  role: string
  member: string
  admin_option: boolean
  inherit_option: boolean
  set_option: boolean
}

export function inspectInstallerDelegations(
  memberships: readonly InstallerMembership[],
  declaration: V2Plan['installerExecution'],
): string[] {
  if (!declaration) return memberships.length ? ['UNDECLARED_CLUSTER_ROLE_MEMBERSHIP'] : []
  if (
    declaration.prerequisiteSource !==
      'apps/union-eyes/scripts/bootstrap-v2/minimum-installer.ts' ||
    JSON.stringify(declaration.functionOwnerRoles) !==
      JSON.stringify(INSTALLER_FUNCTION_OWNER_ROLES)
  )
    return ['INSTALLER_DELEGATION_SOURCE_CONTRACT_DRIFT']
  if (
    memberships.length !== INSTALLER_FUNCTION_OWNER_ROLES.length ||
    new Set(memberships.map((entry) => entry.role)).size !==
      INSTALLER_FUNCTION_OWNER_ROLES.length ||
    memberships.some(
      (entry) =>
        entry.member !== 'ue_v2_owner' ||
        !declaration.functionOwnerRoles.includes(entry.role) ||
        entry.admin_option ||
        !entry.inherit_option ||
        !entry.set_option,
    )
  )
    return ['INSTALLER_FUNCTION_OWNER_DELEGATION_DRIFT']
  return []
}

export async function qualifyNativePrivileges(client: pg.Client, plan: V2Plan) {
  const rules = compileSecurity(plan).rules
  const mismatches: string[] = []
  const authPrivileges = plan.authExecution ? await inspectAuthPrivilegeExpectations(client) : null
  if (authPrivileges) mismatches.push(...authPrivileges.failures)
  const frameworkPrivileges = plan.frameworkExecution
    ? await inspectFrameworkPrivileges(client)
    : null
  if (frameworkPrivileges) mismatches.push(...frameworkPrivileges.failures)
  const roles = await client.query<{
    name: string
    superuser: boolean
    bypassrls: boolean
    createdb: boolean
    createrole: boolean
    login: boolean
  }>(`
    SELECT rolname AS name,rolsuper AS superuser,rolbypassrls AS bypassrls,
      rolcreatedb AS createdb,rolcreaterole AS createrole,rolcanlogin AS login
    FROM pg_roles WHERE rolname IN ('ue_v2_owner','union_eyes_runtime','union_eyes_system') ORDER BY rolname
  `)
  if (roles.rows.length !== 3) mismatches.push('REQUIRED_CLUSTER_ROLE_MISSING')
  for (const role of roles.rows)
    if (role.superuser || role.bypassrls || role.createdb || role.createrole || role.login)
      mismatches.push(`ROLE_ESCALATION:${role.name}`)
  const memberships = await client.query<InstallerMembership>(`
    SELECT parent.rolname AS role,member.rolname AS member,m.admin_option,m.inherit_option,m.set_option
    FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles member ON member.oid=m.member
    WHERE parent.rolname IN ('ue_v2_owner','union_eyes_runtime','union_eyes_system')
      OR member.rolname IN ('ue_v2_owner','union_eyes_runtime','union_eyes_system')
    ORDER BY parent.rolname,member.rolname
  `)
  mismatches.push(...inspectInstallerDelegations(memberships.rows, plan.installerExecution))
  const tables = await client.query<{
    schema: string
    table: string
    role: string
    privilege: string
    allowed: boolean
    columnAllowed: boolean
  }>(`
    SELECT n.nspname AS schema,c.relname AS table,actor.role,permission.privilege,
      has_table_privilege(actor.role,c.oid,permission.privilege) AS allowed,
      CASE WHEN permission.privilege IN ('SELECT','INSERT','UPDATE','REFERENCES')
        THEN has_any_column_privilege(actor.role,c.oid,permission.privilege) ELSE false END AS "columnAllowed"
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN (VALUES ('union_eyes_runtime'),('union_eyes_system')) actor(role)
    CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) permission(privilege)
    WHERE n.nspname IN ('public','user_management') AND c.relkind IN ('r','p','v','m')
    ORDER BY n.nspname,c.relname,actor.role,permission.privilege
  `)
  for (const entry of tables.rows) {
    const rule = entry.schema === 'public' && rules.find((rule) => rule.table === entry.table)
    const declared = rule
      ? (entry.role === 'union_eyes_runtime'
          ? rule.runtimePrivileges
          : rule.systemPrivileges
        ).includes(entry.privilege)
      : false
    // Auth adapter grants have their own producer and independent auth-native qualification.
    if (entry.schema === 'user_management') continue
    const predicateColumns =
      entry.role === 'union_eyes_system' && entry.privilege === 'SELECT'
        ? rule && rule.systemSelectColumns?.length
        : false
    if (
      entry.allowed !== Boolean(declared) ||
      (!declared && entry.columnAllowed !== Boolean(predicateColumns))
    )
      mismatches.push(
        `TABLE_GRANT_MISMATCH:${entry.schema}.${entry.table}:${entry.role}:${entry.privilege}`,
      )
  }
  const columnReads = await client.query<{
    table: string
    column: string
    role: string
    allowed: boolean
  }>(`
    SELECT c.relname AS table,a.attname AS column,actor.role,
      has_column_privilege(actor.role,c.oid,a.attnum,'SELECT') AS allowed
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    CROSS JOIN (VALUES ('union_eyes_runtime'),('union_eyes_system')) actor(role)
    WHERE c.relnamespace='public'::regnamespace AND c.relkind IN ('r','p','v','m')
      AND a.attnum>0 AND NOT a.attisdropped
    ORDER BY c.relname,a.attnum,actor.role
  `)
  for (const entry of columnReads.rows) {
    const rule = rules.find((rule) => rule.table === entry.table)
    const declared = Boolean(
      rule &&
      ((entry.role === 'union_eyes_runtime'
        ? rule.runtimePrivileges
        : rule.systemPrivileges
      ).includes('SELECT') ||
        (entry.role === 'union_eyes_system' && rule.systemSelectColumns?.includes(entry.column))),
    )
    if (entry.allowed !== declared)
      mismatches.push(`COLUMN_SELECT_GRANT_MISMATCH:${entry.table}.${entry.column}:${entry.role}`)
  }
  const functions = await client.query<{
    signature: string
    owner: string
    definer: boolean
    config: string[] | null
    extension: string | null
    language: string
    publicExecute: boolean
    runtimeExecute: boolean
    systemExecute: boolean
  }>(`
    SELECT p.oid::regprocedure::text AS signature,pg_get_userbyid(p.proowner) AS owner,
      p.prosecdef AS definer,p.proconfig AS config,l.lanname AS language,
      (SELECT e.extname FROM pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
        WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e') AS extension,
      EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
        WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') AS "publicExecute",
      has_function_privilege('union_eyes_runtime',p.oid,'EXECUTE') AS "runtimeExecute",
      has_function_privilege('union_eyes_system',p.oid,'EXECUTE') AS "systemExecute"
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
    WHERE n.nspname IN ('public','user_management') ORDER BY p.oid::regprocedure::text
  `)
  for (const entry of functions.rows) {
    if (entry.publicExecute) mismatches.push(`PUBLIC_FUNCTION_EXECUTE:${entry.signature}`)
    if (
      plan.frameworkExecution &&
      FRAMEWORK_FUNCTIONS.some((name) => entry.signature === `user_management.${name}()`) &&
      entry.owner === FRAMEWORK_ROLES.reader
    )
      continue
    if (
      plan.authExecution &&
      AUTH_FUNCTION_EXPECTATIONS.some(
        (expected) =>
          entry.signature.startsWith(`user_management.${expected.name}(`) &&
          entry.owner === expected.owner,
      )
    )
      continue
    if (
      entry.owner !== 'ue_v2_owner' &&
      !(entry.extension === 'vector' && entry.owner === 'postgres')
    )
      mismatches.push(`UNDECLARED_FUNCTION_OWNER:${entry.signature}:${entry.owner}`)
    if (entry.definer) mismatches.push(`PRIVILEGED_FUNCTION_REQUIRES_REVIEW:${entry.signature}`)
    if (entry.extension && entry.extension !== 'vector')
      mismatches.push(`UNDECLARED_EXTENSION_FUNCTION:${entry.signature}`)
    if (
      !entry.extension &&
      (entry.runtimeExecute || entry.systemExecute) &&
      !entry.config?.some((config) => config === 'search_path=pg_catalog, pg_temp')
    )
      mismatches.push(`FUNCTION_SEARCH_PATH_NOT_PINNED:${entry.signature}`)
  }
  const schemas = await client.query<{ schema: string; role: string; create: boolean }>(`
    SELECT n.nspname AS schema,actor.role,has_schema_privilege(actor.role,n.oid,'CREATE') AS create
    FROM pg_namespace n CROSS JOIN (VALUES ('union_eyes_runtime'),('union_eyes_system')) actor(role)
    WHERE n.nspname IN ('public','user_management') ORDER BY n.nspname,actor.role
  `)
  for (const entry of schemas.rows)
    if (entry.create) mismatches.push(`SCHEMA_CREATE_ESCALATION:${entry.schema}:${entry.role}`)
  const sequences = await client.query<{
    sequence: string
    role: string
    privilege: string
    allowed: boolean
  }>(`
    SELECT c.oid::regclass::text AS sequence,actor.role,permission.privilege,
      has_sequence_privilege(actor.role,c.oid,permission.privilege) AS allowed
    FROM pg_class c CROSS JOIN (VALUES ('union_eyes_runtime'),('union_eyes_system')) actor(role)
    CROSS JOIN (VALUES ('SELECT'),('UPDATE'),('USAGE')) permission(privilege)
    WHERE c.relkind='S' AND c.relnamespace IN ('public'::regnamespace,to_regnamespace('user_management'))
    ORDER BY c.oid::regclass::text,actor.role,permission.privilege
  `)
  for (const entry of sequences.rows)
    if (entry.allowed)
      mismatches.push(
        `UNDECLARED_SEQUENCE_GRANT:${entry.sequence}:${entry.role}:${entry.privilege}`,
      )
  const delegation = await client.query<{
    object: string
    grantee: string
    privilege: string
    grantable: boolean
  }>(`
    WITH acl_entries AS (
      SELECT c.oid::regclass::text AS object,c.relowner AS owner,acl.*
      FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) acl
      WHERE c.relnamespace IN ('public'::regnamespace,to_regnamespace('user_management'))
      UNION ALL
      SELECT c.oid::regclass::text||'.'||a.attname,c.relowner,acl.*
      FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
      CROSS JOIN LATERAL aclexplode(a.attacl) acl
      WHERE c.relnamespace IN ('public'::regnamespace,to_regnamespace('user_management'))
      UNION ALL
      SELECT p.oid::regprocedure::text,p.proowner,acl.*
      FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) acl
      WHERE p.pronamespace IN ('public'::regnamespace,to_regnamespace('user_management'))
    )
    SELECT object,CASE WHEN grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END AS grantee,
      privilege_type AS privilege,is_grantable AS grantable FROM acl_entries
    WHERE grantee<>owner AND (is_grantable OR (grantee=0 AND privilege_type<>'USAGE'))
    ORDER BY object,grantee,privilege_type
  `)
  for (const entry of delegation.rows)
    mismatches.push(
      `UNDECLARED_PUBLIC_OR_DELEGABLE_GRANT:${entry.object}:${entry.grantee}:${entry.privilege}`,
    )
  return {
    status: mismatches.length
      ? 'FAIL'
      : authPrivileges
        ? 'PASS_PUBLIC_AND_AUTH_NATIVE_PRIVILEGES'
        : 'PASS_PUBLIC_NATIVE_PRIVILEGES_AUTH_SEPARATE',
    authPrivileges,
    frameworkPrivileges,
    roles: roles.rows,
    memberships: memberships.rows,
    schemas: schemas.rows,
    tablePrivilegeChecks: tables.rows.length,
    tablePrivileges: tables.rows,
    functions: functions.rows,
    sequencePrivileges: sequences.rows,
    undeclaredDelegation: delegation.rows,
    scopeLimitation: authPrivileges
      ? 'Independent auth ACL contract is checked; actual auth paths, application actors and all-table RLS remain separate gates.'
      : 'Auth adapter schema grant semantics require separate auth-native qualification; application actors and all-table RLS are separate gates.',
    mismatches,
  }
}
