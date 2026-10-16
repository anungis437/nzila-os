import type pg from 'pg'
import { AUTH_EXECUTION_ROLES } from './auth-sql'
import {
  FRAMEWORK_ADMIN_PRIVILEGES,
  FRAMEWORK_FUNCTIONS,
  FRAMEWORK_IDENTITY_PRIVILEGES,
  FRAMEWORK_IDENTITY_UPDATE_COLUMNS,
  FRAMEWORK_MEMBERSHIPS,
  FRAMEWORK_MODEL_OWNERS,
  FRAMEWORK_READER_COLUMNS,
  FRAMEWORK_ROLES,
  FRAMEWORK_WORKER_TABLES,
  DEDICATED_ADMIN_MODEL_OWNERS,
  PLATFORM_METADATA_MODEL_OWNERS,
} from './framework-contract'

function expectedColumns(
  role: string,
  schema: string,
  table: string,
  privilege: string,
): '*' | readonly string[] | null {
  if (schema === 'user_management') {
    if (role !== FRAMEWORK_ROLES.reader || privilege !== 'SELECT') return null
    if (table === 'users') return FRAMEWORK_READER_COLUMNS.users
    if (table === 'user_sessions') return FRAMEWORK_READER_COLUMNS.user_sessions
    return null
  }
  if (!DEDICATED_ADMIN_MODEL_OWNERS[table]) return null
  if (role === FRAMEWORK_ROLES.admin)
    return (FRAMEWORK_ADMIN_PRIVILEGES as readonly string[]).includes(privilege) ? '*' : null
  if (role === FRAMEWORK_ROLES.worker && FRAMEWORK_WORKER_TABLES.includes(table))
    return (FRAMEWORK_ADMIN_PRIVILEGES as readonly string[]).includes(privilege) ? '*' : null
  if (
    role === FRAMEWORK_ROLES.identity &&
    FRAMEWORK_IDENTITY_PRIVILEGES[table]?.includes(privilege)
  )
    return privilege === 'UPDATE' ? FRAMEWORK_IDENTITY_UPDATE_COLUMNS : '*'
  return null
}

export async function inspectFrameworkPrivileges(client: pg.Client) {
  const failures: string[] = []
  const roles: string[] = Object.values(FRAMEWORK_ROLES)
  const flags = (
    await client.query<{
      rolname: string
      rolsuper: boolean
      rolbypassrls: boolean
      rolcanlogin: boolean
      rolinherit: boolean
      rolcreatedb: boolean
      rolcreaterole: boolean
      publicCreate: boolean
      authCreate: boolean
      publicUsage: boolean
      authUsage: boolean
    }>(
      `SELECT rolname,rolsuper,rolbypassrls,rolcanlogin,rolinherit,rolcreatedb,rolcreaterole,
        has_schema_privilege(rolname,'public','CREATE') AS "publicCreate",
        has_schema_privilege(rolname,'user_management','CREATE') AS "authCreate",
        has_schema_privilege(rolname,'public','USAGE') AS "publicUsage",
        has_schema_privilege(rolname,'user_management','USAGE') AS "authUsage"
       FROM pg_roles WHERE rolname=ANY($1)`,
      [roles],
    )
  ).rows
  for (const role of roles) {
    const flag = flags.find((entry) => entry.rolname === role)
    if (
      !flag ||
      flag.rolsuper ||
      flag.rolbypassrls ||
      flag.rolcanlogin ||
      flag.rolinherit ||
      flag.rolcreatedb ||
      flag.rolcreaterole ||
      flag.publicCreate ||
      flag.authCreate ||
      flag.publicUsage !==
        [FRAMEWORK_ROLES.identity, FRAMEWORK_ROLES.admin, FRAMEWORK_ROLES.worker].some(
          (expected) => expected === role,
        ) ||
      flag.authUsage !==
        [FRAMEWORK_ROLES.identity, FRAMEWORK_ROLES.admin, FRAMEWORK_ROLES.reader].some(
          (expected) => expected === role,
        )
    )
      failures.push(`FRAMEWORK_ROLE_UNSAFE:${role}`)
  }
  const memberships = (
    await client.query<{
      member: string
      target: string
      admin_option: boolean
      inherit_option: boolean
      set_option: boolean
    }>(
      `SELECT member.rolname AS member,target.rolname AS target,m.admin_option,m.inherit_option,m.set_option
       FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member JOIN pg_roles target ON target.oid=m.roleid
       WHERE member.rolname=ANY($1)`,
      [[...roles, 'union_eyes_runtime', 'union_eyes_system']],
    )
  ).rows
  for (const membership of memberships)
    if (
      !FRAMEWORK_MEMBERSHIPS[membership.member]?.includes(membership.target) ||
      membership.admin_option ||
      membership.inherit_option ||
      !membership.set_option
    )
      failures.push(`FRAMEWORK_MEMBERSHIP_UNSAFE:${membership.member}:${membership.target}`)
  for (const [member, targets] of Object.entries(FRAMEWORK_MEMBERSHIPS))
    for (const target of targets)
      if (!memberships.some((entry) => entry.member === member && entry.target === target))
        failures.push(`FRAMEWORK_MEMBERSHIP_MISSING:${member}:${target}`)
  const tables = (
    await client.query<{
      role: string
      schema: string
      table: string
      privilege: string
      allowed: boolean
      columnAllowed: boolean
      owner: string
      rls: boolean
      force: boolean
    }>(
      `SELECT actor.role,n.nspname AS schema,c.relname AS table,permission.privilege,
        has_table_privilege(actor.role,c.oid,permission.privilege) AS allowed,
        CASE WHEN permission.privilege IN ('SELECT','INSERT','UPDATE','REFERENCES')
          THEN has_any_column_privilege(actor.role,c.oid,permission.privilege) ELSE false END AS "columnAllowed",
        pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity AS rls,c.relforcerowsecurity AS force
       FROM unnest($1::text[]) actor(role) CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) permission(privilege)
       WHERE n.nspname IN ('public','user_management') AND c.relkind IN ('r','p','v','m')`,
      [roles],
    )
  ).rows
  for (const row of tables) {
    const expected = expectedColumns(row.role, row.schema, row.table, row.privilege)
    if (
      row.allowed !== (expected === '*') ||
      row.columnAllowed !==
        Boolean(expected && ['SELECT', 'INSERT', 'UPDATE', 'REFERENCES'].includes(row.privilege)) ||
      roles.includes(row.owner) ||
      (DEDICATED_ADMIN_MODEL_OWNERS[row.table] && (!row.rls || !row.force))
    )
      failures.push(
        `FRAMEWORK_TABLE_AUTHORITY:${row.role}:${row.schema}.${row.table}:${row.privilege}`,
      )
  }
  const columnGrants = (
    await client.query<{
      role: string
      schema: string
      table: string
      column: string
      privilege: string
      allowed: boolean
    }>(
      `SELECT actor.role,n.nspname AS schema,c.relname AS table,a.attname AS column,permission.privilege,
        has_column_privilege(actor.role,c.oid,a.attname,permission.privilege) AS allowed
       FROM unnest($1::text[]) actor(role) CROSS JOIN pg_attribute a
       JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
       CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','REFERENCES']) permission(privilege)
       WHERE a.attnum>0 AND NOT a.attisdropped AND
         ((n.nspname='public' AND c.relname='auth_user') OR
          (n.nspname='user_management' AND c.relname IN ('users','user_sessions')))`,
      [roles],
    )
  ).rows
  for (const row of columnGrants) {
    const expected = expectedColumns(row.role, row.schema, row.table, row.privilege)
    if (row.allowed !== (expected === '*' || Boolean(expected?.includes(row.column))))
      failures.push(
        `FRAMEWORK_COLUMN_AUTHORITY:${row.role}:${row.table}.${row.column}:${row.privilege}`,
      )
  }
  const peers = ['union_eyes_runtime', 'union_eyes_system', ...Object.values(AUTH_EXECUTION_ROLES)]
  const peerGrants = (
    await client.query<{ role: string; table: string; allowed: boolean }>(
      `SELECT actor.role,c.relname AS table,
        has_table_privilege(actor.role,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        OR has_any_column_privilege(actor.role,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') AS allowed
       FROM unnest($1::text[]) actor(role) CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname='public' AND c.relname=ANY($2)`,
      [peers, Object.keys(DEDICATED_ADMIN_MODEL_OWNERS)],
    )
  ).rows
  for (const row of peerGrants)
    if (row.allowed) failures.push(`FRAMEWORK_PEER_OVERGRANT:${row.role}:${row.table}`)
  const sequences = (
    await client.query<{
      role: string
      sequence: string
      table: string | null
      privilege: string
      allowed: boolean
      owner: string
    }>(
      `SELECT actor.role,n.nspname||'.'||s.relname AS sequence,t.relname AS table,
        permission.privilege,has_sequence_privilege(actor.role,s.oid,permission.privilege) AS allowed,
        pg_get_userbyid(s.relowner) AS owner
       FROM unnest($1::text[]) actor(role) CROSS JOIN pg_class s JOIN pg_namespace n ON n.oid=s.relnamespace
       LEFT JOIN pg_depend d ON d.classid='pg_class'::regclass AND d.objid=s.oid
         AND d.refclassid='pg_class'::regclass AND d.deptype IN ('a','i')
       LEFT JOIN pg_class t ON t.oid=d.refobjid
       CROSS JOIN unnest(ARRAY['USAGE','SELECT','UPDATE']) permission(privilege)
       WHERE s.relkind='S' AND n.nspname IN ('public','user_management')`,
      [[...roles, ...peers]],
    )
  ).rows
  for (const row of sequences) {
    const frameworkTable = row.table !== null && Boolean(FRAMEWORK_MODEL_OWNERS[row.table])
    if (!roles.includes(row.role) && !frameworkTable) continue
    const expected =
      frameworkTable &&
      row.privilege === 'USAGE' &&
      (row.role === FRAMEWORK_ROLES.admin ||
        (row.role === FRAMEWORK_ROLES.identity && row.table === 'auth_user') ||
        (row.role === FRAMEWORK_ROLES.worker && FRAMEWORK_WORKER_TABLES.includes(row.table!)))
    if (row.allowed !== expected || roles.includes(row.owner))
      failures.push(`FRAMEWORK_SEQUENCE_AUTHORITY:${row.role}:${row.sequence}:${row.privilege}`)
  }
  const policies = (
    await client.query<{
      schema: string
      table: string
      name: string
      command: string
      permissive: boolean
      roles: string[]
      using: string | null
      check: string | null
    }>(
      `SELECT n.nspname AS schema,c.relname AS table,p.polname AS name,p.polcmd AS command,
        p.polpermissive AS permissive,
        ARRAY(SELECT coalesce(r.rolname::text,'PUBLIC') FROM unnest(p.polroles) actor(oid)
          LEFT JOIN pg_roles r ON r.oid=actor.oid ORDER BY r.rolname) AS roles,
        pg_get_expr(p.polqual,p.polrelid) AS using,pg_get_expr(p.polwithcheck,p.polrelid) AS check
       FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE (n.nspname='public' AND c.relname=ANY($1)) OR
         EXISTS (SELECT FROM unnest(p.polroles) actor(oid) JOIN pg_roles r ON r.oid=actor.oid
           WHERE r.rolname=ANY($2))`,
      [Object.keys(DEDICATED_ADMIN_MODEL_OWNERS), roles],
    )
  ).rows
  const expectedPolicies: {
    schema: string
    table: string
    name: string
    role: string
    command: string
  }[] = []
  for (const table of Object.keys(DEDICATED_ADMIN_MODEL_OWNERS)) {
    expectedPolicies.push({
      schema: 'public',
      table,
      name: PLATFORM_METADATA_MODEL_OWNERS[table]
        ? 'ue_platform_metadata_admin'
        : 'ue_framework_admin',
      role: FRAMEWORK_ROLES.admin,
      command: '*',
    })
    for (const privilege of FRAMEWORK_IDENTITY_PRIVILEGES[table] ?? [])
      expectedPolicies.push({
        schema: 'public',
        table,
        name: `ue_framework_identity_${privilege.toLowerCase()}`,
        role: FRAMEWORK_ROLES.identity,
        command: { SELECT: 'r', INSERT: 'a', UPDATE: 'w' }[privilege]!,
      })
    if (FRAMEWORK_WORKER_TABLES.includes(table))
      expectedPolicies.push({
        schema: 'public',
        table,
        name: 'ue_framework_worker',
        role: FRAMEWORK_ROLES.worker,
        command: '*',
      })
  }
  for (const table of Object.keys(FRAMEWORK_READER_COLUMNS))
    expectedPolicies.push({
      schema: 'user_management',
      table,
      name: `ue_framework_reader_${table}`,
      role: FRAMEWORK_ROLES.reader,
      command: 'r',
    })
  for (const expected of expectedPolicies) {
    const policy = policies.find(
      (entry) =>
        entry.schema === expected.schema &&
        entry.table === expected.table &&
        entry.name === expected.name,
    )
    const expressions = [policy?.using, policy?.check].filter(
      (expression): expression is string => expression !== null && expression !== undefined,
    )
    let correctPredicate = false
    if (expected.role === FRAMEWORK_ROLES.worker)
      correctPredicate = policy?.using === 'true' && policy?.check === 'true'
    else if (expected.role === FRAMEWORK_ROLES.reader)
      correctPredicate = Boolean(
        policy?.using?.includes('user_id') &&
        policy.using.includes('app.current_user_id') &&
        !policy.check,
      )
    else {
      const helper =
        expected.role === FRAMEWORK_ROLES.admin
          ? 'ue_framework_admin_authorized()'
          : 'ue_framework_actor_authorized()'
      correctPredicate =
        expressions.length > 0 && expressions.every((expression) => expression.includes(helper))
      if (expected.table === 'auth_user' && expected.command !== 'r')
        correctPredicate &&= Boolean(policy?.check?.includes('NOT is_superuser'))
      if (
        expected.role === FRAMEWORK_ROLES.identity &&
        ['auth_user', 'auth_user_groups', 'auth_user_user_permissions'].includes(expected.table)
      )
        correctPredicate &&= expressions.every(
          (expression) =>
            expression.includes('username') &&
            expression.includes('sha256') &&
            expression.includes('app.current_user_id'),
        )
    }
    if (
      !policy ||
      !policy.permissive ||
      policy.command !== expected.command ||
      policy.roles.length !== 1 ||
      policy.roles[0] !== expected.role ||
      !correctPredicate ||
      ((expected.command === '*' || expected.command === 'w') &&
        (!policy.using || !policy.check)) ||
      (expected.command === 'a' && (policy.using !== null || !policy.check))
    )
      failures.push(`FRAMEWORK_POLICY_UNSAFE:${expected.schema}.${expected.table}:${expected.name}`)
  }
  for (const policy of policies)
    if (
      !expectedPolicies.some(
        (expected) =>
          expected.schema === policy.schema &&
          expected.table === policy.table &&
          expected.name === policy.name,
      )
    )
      failures.push(`FRAMEWORK_POLICY_UNEXPECTED:${policy.schema}.${policy.table}:${policy.name}`)
  for (const name of FRAMEWORK_FUNCTIONS) {
    const functions = (
      await client.query<{
        oid: string
        owner: string
        definer: boolean
        config: string[] | null
        publicExecute: boolean
      }>(
        `SELECT p.oid::text AS oid,pg_get_userbyid(p.proowner) AS owner,p.prosecdef AS definer,p.proconfig AS config,
          EXISTS (SELECT FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
            WHERE acl.grantee=0 AND acl.privilege_type='EXECUTE') AS "publicExecute"
         FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='user_management' AND p.proname=$1`,
        [name],
      )
    ).rows
    const fn = functions[0]
    if (
      functions.length !== 1 ||
      fn.owner !== FRAMEWORK_ROLES.reader ||
      !fn.definer ||
      !fn.config?.includes('search_path=pg_catalog') ||
      fn.publicExecute
    )
      failures.push(`FRAMEWORK_FUNCTION_UNSAFE:${name}`)
    if (fn)
      for (const role of [...roles, ...peers]) {
        const expected = [
          FRAMEWORK_ROLES.reader,
          FRAMEWORK_ROLES.identity,
          FRAMEWORK_ROLES.admin,
        ].some((allowed) => allowed === role)
        const actual = await client.query<{ allowed: boolean }>(
          "SELECT has_function_privilege($1,$2::oid,'EXECUTE') AS allowed",
          [role, fn.oid],
        )
        if (actual.rows[0].allowed !== expected)
          failures.push(`FRAMEWORK_FUNCTION_CALLER:${role}:${name}`)
      }
    const callableFunctions = (
      await client.query<{
        role: string
        schema: string
        name: string
        signature: string
        allowed: boolean
      }>(
        `SELECT actor.role,n.nspname AS schema,p.proname AS name,p.oid::regprocedure::text AS signature,
            has_function_privilege(actor.role,p.oid,'EXECUTE') AS allowed
           FROM unnest($1::text[]) actor(role) CROSS JOIN pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname IN ('public','user_management')`,
        [roles],
      )
    ).rows
    for (const fn of callableFunctions) {
      const expected =
        fn.schema === 'user_management' &&
        FRAMEWORK_FUNCTIONS.some((name) => name === fn.name) &&
        [FRAMEWORK_ROLES.reader, FRAMEWORK_ROLES.identity, FRAMEWORK_ROLES.admin].some(
          (role) => role === fn.role,
        )
      if (fn.allowed !== expected)
        failures.push(`FRAMEWORK_UNDECLARED_FUNCTION_AUTHORITY:${fn.role}:${fn.signature}`)
    }
  }
  return { result: failures.length ? ('FAIL' as const) : ('PASS' as const), failures }
}
