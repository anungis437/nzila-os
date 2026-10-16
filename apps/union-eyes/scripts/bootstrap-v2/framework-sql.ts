import { quote, type V2Plan } from './source'
import { compileRolePrerequisiteAssertions } from '../../../../packages/db/src/auth-storage-authority/role-prerequisites'
import {
  FRAMEWORK_ADMIN_PRIVILEGES,
  FRAMEWORK_IDENTITY_PRIVILEGES,
  FRAMEWORK_IDENTITY_UPDATE_COLUMNS,
  FRAMEWORK_MEMBERSHIPS,
  FRAMEWORK_MODEL_OWNERS,
  FRAMEWORK_READER_COLUMNS,
  FRAMEWORK_ROLES,
  FRAMEWORK_WORKER_TABLES,
} from './framework-contract'

export function compileFrameworkSql(
  plan: V2Plan,
  options: { rolesPreprovisioned?: boolean } = {},
): string {
  if (!plan.authExecution) throw new Error('UE_V2_FRAMEWORK_CANONICAL_AUTH_REQUIRED')
  for (const [table, owner] of Object.entries(FRAMEWORK_MODEL_OWNERS))
    if (!plan.currentModels.models.some((model) => model.table === table && model.source === owner))
      throw new Error(`UE_V2_FRAMEWORK_CURRENT_MODEL_REQUIRED:${table}`)
  const roles = Object.values(FRAMEWORK_ROLES)
  const statements = options.rolesPreprovisioned
    ? [compileRolePrerequisiteAssertions(roles, FRAMEWORK_MEMBERSHIPS)]
    : roles.map(
        (role) => `DO $framework$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${role}') THEN
        CREATE ROLE ${quote(role)} NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
      END IF;
      IF EXISTS (SELECT FROM pg_roles WHERE rolname='${role}' AND
        (rolsuper OR rolbypassrls OR rolcanlogin OR rolinherit OR rolcreatedb OR rolcreaterole)) THEN
        RAISE EXCEPTION 'Unsafe existing framework role: ${role}';
      END IF;
    END $framework$;`,
      )
  for (const [gateway, targets] of Object.entries(
    options.rolesPreprovisioned ? {} : FRAMEWORK_MEMBERSHIPS,
  ))
    statements.push(
      `GRANT ${targets.map(quote).join(',')} TO ${quote(gateway)} WITH INHERIT FALSE, SET TRUE;`,
    )
  statements.push(
    `GRANT USAGE ON SCHEMA public TO ${roles
      .filter((role) => role !== FRAMEWORK_ROLES.reader && !role.endsWith('gateway'))
      .map(quote)
      .join(',')};`,
    `GRANT USAGE ON SCHEMA user_management TO ${quote(FRAMEWORK_ROLES.reader)},${quote(FRAMEWORK_ROLES.identity)},${quote(FRAMEWORK_ROLES.admin)};`,
    `GRANT CREATE ON SCHEMA user_management TO ${quote(FRAMEWORK_ROLES.reader)};`,
  )
  const actor = "NULLIF(current_setting('app.current_user_id',true),'')"
  const session = `EXISTS (
    SELECT FROM user_management.users u JOIN user_management.user_sessions s ON s.user_id=u.user_id
    WHERE u.user_id=${actor} AND u.is_active AND u.lifecycle_state='active'
      AND s.session_token_hash=encode(sha256(convert_to(NULLIF(current_setting('app.current_session_token',true),''),'UTF8')),'hex')
      AND s.is_active AND s.expires_at>statement_timestamp()
      AND (s.organization_id IS NULL OR s.organization_id::text=NULLIF(current_setting('app.current_org_id',true),''))
      __ADMIN__)`
  for (const [table, columns] of Object.entries(FRAMEWORK_READER_COLUMNS))
    statements.push(
      `GRANT SELECT (${columns.map(quote).join(',')}) ON user_management.${quote(table)} TO ${quote(FRAMEWORK_ROLES.reader)};`,
      `CREATE POLICY ue_framework_reader_${table} ON user_management.${quote(table)}
        FOR SELECT TO ${quote(FRAMEWORK_ROLES.reader)} USING (user_id=${actor});`,
    )
  for (const [name, predicate] of [
    ['ue_framework_actor_authorized', session.replace('__ADMIN__', '')],
    ['ue_framework_admin_authorized', session.replace('__ADMIN__', 'AND u.is_system_admin')],
  ])
    statements.push(
      `CREATE FUNCTION user_management.${name}() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
        AS $framework$ SELECT ${predicate} $framework$;`,
      `ALTER FUNCTION user_management.${name}() OWNER TO ${quote(FRAMEWORK_ROLES.reader)};`,
      `REVOKE ALL ON FUNCTION user_management.${name}() FROM PUBLIC;`,
      `GRANT EXECUTE ON FUNCTION user_management.${name}() TO ${quote(FRAMEWORK_ROLES.identity)},${quote(FRAMEWORK_ROLES.admin)};`,
    )
  statements.push(`REVOKE CREATE ON SCHEMA user_management FROM ${quote(FRAMEWORK_ROLES.reader)};`)
  const authorized = 'user_management.ue_framework_actor_authorized()'
  const administrator = 'user_management.ue_framework_admin_authorized()'
  const username = `'uev2_'||encode(sha256(convert_to(${actor},'UTF8')),'hex')`
  for (const table of Object.keys(FRAMEWORK_MODEL_OWNERS)) {
    const relation = `public.${quote(table)}`
    statements.push(
      `ALTER TABLE ${relation} ENABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE ${relation} FORCE ROW LEVEL SECURITY;`,
      `REVOKE ALL ON TABLE ${relation} FROM PUBLIC,union_eyes_runtime,union_eyes_system,${roles.map(quote).join(',')};`,
      `GRANT ${FRAMEWORK_ADMIN_PRIVILEGES.join(',')} ON TABLE ${relation} TO ${quote(FRAMEWORK_ROLES.admin)};`,
      `CREATE POLICY ue_framework_admin ON ${relation} FOR ALL TO ${quote(FRAMEWORK_ROLES.admin)}
        USING (${administrator}) WITH CHECK (${administrator}${table === 'auth_user' ? ' AND NOT is_superuser' : ''});`,
    )
    for (const privilege of FRAMEWORK_IDENTITY_PRIVILEGES[table] ?? []) {
      const own =
        table === 'auth_user'
          ? `username=${username} AND is_active`
          : ['auth_user_groups', 'auth_user_user_permissions'].includes(table)
            ? `EXISTS (SELECT FROM public.auth_user u WHERE u.id=${quote(table)}.user_id AND u.username=${username})`
            : 'true'
      statements.push(
        `GRANT ${privilege === 'UPDATE' ? `UPDATE (${FRAMEWORK_IDENTITY_UPDATE_COLUMNS.map(quote).join(',')})` : privilege} ON TABLE ${relation} TO ${quote(FRAMEWORK_ROLES.identity)};`,
        `CREATE POLICY ue_framework_identity_${privilege.toLowerCase()} ON ${relation} FOR ${privilege}
          TO ${quote(FRAMEWORK_ROLES.identity)} ${privilege === 'INSERT' ? '' : `USING (${authorized} AND (${own}))`}
          ${privilege === 'SELECT' ? '' : `WITH CHECK (${authorized} AND (${own})${table === 'auth_user' ? ` AND NOT is_superuser AND (NOT is_staff OR ${administrator})` : ''})`};`,
      )
    }
    if (FRAMEWORK_WORKER_TABLES.includes(table))
      statements.push(
        `GRANT ${FRAMEWORK_ADMIN_PRIVILEGES.join(',')} ON TABLE ${relation} TO ${quote(FRAMEWORK_ROLES.worker)};`,
        `CREATE POLICY ue_framework_worker ON ${relation} FOR ALL TO ${quote(FRAMEWORK_ROLES.worker)} USING (true) WITH CHECK (true);`,
      )
    const sequenceRoles = [
      FRAMEWORK_ROLES.admin,
      ...(table === 'auth_user' ? [FRAMEWORK_ROLES.identity] : []),
      ...(FRAMEWORK_WORKER_TABLES.includes(table) ? [FRAMEWORK_ROLES.worker] : []),
    ]
    statements.push(`DO $framework$ DECLARE sequence_name text; BEGIN
      FOR sequence_name IN SELECT pg_get_serial_sequence('${relation}',attname) FROM pg_attribute
        WHERE attrelid='${relation}'::regclass AND attnum>0 AND NOT attisdropped LOOP
        IF sequence_name IS NOT NULL THEN
          EXECUTE format('GRANT USAGE ON SEQUENCE %s TO ${sequenceRoles.map(quote).join(',')}',sequence_name);
        END IF;
      END LOOP;
    END $framework$;`)
  }
  return statements.join('\n')
}
