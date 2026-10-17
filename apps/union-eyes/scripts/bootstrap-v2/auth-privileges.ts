import type pg from 'pg'
import { AUTH_EXECUTION_ROLES, AUTH_PRIVILEGE_EXPECTATIONS, AUTH_FUNCTION_EXPECTATIONS, AUTH_PUBLIC_BINDING_EXPECTATIONS, AUTH_ROLE_MEMBERSHIP_EXPECTATIONS } from './auth-sql'

/** Live effective ACL comparison against an independently authored contract. */
export async function inspectAuthPrivilegeExpectations(client: pg.Client) {
  const failures: string[] = []
  const roles = [...Object.values(AUTH_EXECUTION_ROLES), 'union_eyes_runtime', 'union_eyes_system']
  const authRoles: readonly string[] = Object.values(AUTH_EXECUTION_ROLES)
  const roleState = (await client.query(`SELECT rolname,rolsuper,rolbypassrls,rolinherit,rolcanlogin,rolcreatedb,rolcreaterole,
    has_schema_privilege(rolname,'user_management','USAGE') AS auth_usage,
    has_schema_privilege(rolname,'user_management','CREATE') AS auth_create,
    has_schema_privilege(rolname,'public','CREATE') AS public_create
    FROM pg_roles WHERE rolname=ANY($1)`, [roles])).rows
  for (const role of roles) {
    const state = roleState.find(row => row.rolname === role)
    const gateway = role === AUTH_EXECUTION_ROLES.gateway || role === AUTH_EXECUTION_ROLES.systemGateway
    if (!state || state.rolsuper || state.rolbypassrls || state.auth_create ||
      state.auth_usage !== ((authRoles.includes(role) && !gateway) || role === 'union_eyes_runtime') ||
      (authRoles.includes(role) && (state.rolinherit || state.rolcanlogin || state.rolcreatedb || state.rolcreaterole || state.public_create)))
      failures.push(`${role}: unsafe/missing role/schema authority`)
  }
  const memberships = (await client.query(`SELECT member.rolname AS member,granted.rolname AS granted,m.admin_option,m.inherit_option,m.set_option
    FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member JOIN pg_roles granted ON granted.oid=m.roleid
    WHERE member.rolname=ANY($1)`, [roles])).rows
  for (const row of memberships) {
    if (!AUTH_ROLE_MEMBERSHIP_EXPECTATIONS[row.member]?.includes(row.granted) || row.admin_option || row.inherit_option || !row.set_option)
      failures.push(`${row.member}->${row.granted}: unexpected or unsafe membership`)
  }
  for (const [member, grantedRoles] of Object.entries(AUTH_ROLE_MEMBERSHIP_EXPECTATIONS))
    for (const granted of grantedRoles)
      if (!memberships.some(row => row.member === member && row.granted === granted)) failures.push(`${member}->${granted}: missing membership`)
  const columns = (await client.query<{ role: string; table_name: string; column_name: string; privilege: string; allowed: boolean }>(`
    SELECT r.role,c.relname AS table_name,a.attname AS column_name,v.privilege,
      has_column_privilege(r.role,c.oid,a.attname,v.privilege) AS allowed
    FROM unnest($1::text[]) r(role) CROSS JOIN pg_attribute a
    JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) v(privilege)
    WHERE n.nspname='user_management' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped`, [roles])).rows
  for (const row of columns) {
    const expected = AUTH_PRIVILEGE_EXPECTATIONS[row.role]?.[row.table_name]?.[row.privilege]
    const allowed = expected === '*' || Boolean(expected?.includes(row.column_name))
    if (row.allowed !== allowed) failures.push(`${row.role}:${row.table_name}.${row.column_name}:${row.privilege} expected=${allowed}`)
  }
  const tables = (await client.query(`
    SELECT r.role,c.relname AS table_name,v.privilege,has_table_privilege(r.role,c.oid,v.privilege) AS allowed,
      c.relrowsecurity,c.relforcerowsecurity,owner.rolname AS owner
    FROM unnest($1::text[]) r(role) CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_roles owner ON owner.oid=c.relowner CROSS JOIN unnest(ARRAY['DELETE','TRUNCATE','TRIGGER']) v(privilege)
    WHERE n.nspname='user_management' AND c.relkind='r'`, [roles])).rows
  for (const row of tables) {
    const allowed = AUTH_PRIVILEGE_EXPECTATIONS[row.role]?.[row.table_name]?.[row.privilege] === '*'
    if (row.allowed !== allowed || !row.relrowsecurity || !row.relforcerowsecurity || roles.includes(row.owner))
      failures.push(`${row.role}:${row.table_name}:${row.privilege}: unsafe grant/RLS/ownership`)
  }
  for (const expected of AUTH_FUNCTION_EXPECTATIONS) {
    const { rows } = await client.query(`SELECT p.oid::text AS oid,p.prosecdef,p.proconfig,r.rolname AS owner
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
      WHERE n.nspname='user_management' AND p.proname=$1`, [expected.name])
    if (rows.length !== 1 || rows[0].owner !== expected.owner || !rows[0].prosecdef ||
      !rows[0].proconfig?.includes('search_path=pg_catalog')) {
      failures.push(`unsafe/missing function ${expected.name}`); continue
    }
    for (const role of roles) {
      const allowed = role === expected.owner || (expected.callers as readonly string[]).includes(role)
      const result = await client.query('SELECT has_function_privilege($1,$2::oid,\'EXECUTE\') AS allowed', [role, rows[0].oid])
      if (result.rows[0].allowed !== allowed) failures.push(`${role}:${expected.name}:EXECUTE expected=${allowed}`)
    }
  }
  const binding = AUTH_PUBLIC_BINDING_EXPECTATIONS
  const publicColumns = (await client.query(`SELECT attname FROM pg_attribute WHERE attrelid=$1::regclass AND attnum>0 AND NOT attisdropped`, [binding.table])).rows
  for (const role of Object.values(AUTH_EXECUTION_ROLES)) {
    for (const { attname: column } of publicColumns) {
      for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'REFERENCES']) {
        const allowed = role === binding.role && privilege === 'SELECT' && (binding.selectColumns as readonly string[]).includes(column)
        const result = await client.query('SELECT has_column_privilege($1,$2,$3,$4) AS allowed', [role, binding.table, column, privilege])
        if (result.rows[0].allowed !== allowed) failures.push(`${role}:${binding.table}.${column}:${privilege} expected=${allowed}`)
      }
    }
  }
  return { result: failures.length ? 'FAIL' as const : 'PASS' as const, checked: columns.length + tables.length + roleState.length + memberships.length, failures }
}
