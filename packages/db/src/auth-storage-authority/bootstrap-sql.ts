import { authStorageAuthorityEntries } from './entries'
import { AUTH_EXECUTION_ROLES as roles, AUTH_TENANT_ASSIGNABLE_ROLES } from './execution-boundary'
import { compileAuthOrgBindingSql } from './org-session-authority'
import { compileRolePrerequisiteAssertions } from './role-prerequisites'
import { AUTH_ROLE_MEMBERSHIP_EXPECTATIONS } from './privilege-expectations'

const q = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`
const setting = (name: string) => `NULLIF(current_setting('nzila.auth_${name}',true),'')`
const own = `user_id = ${setting('user_id')}`
const token = `token_hash = ${setting('token_hash')}`
const selector = (kind: string) => `${setting('selector')} = '${kind}'`

/**
 * Apply after canonical auth tables exist, as installation owner. Deliberately
 * rejects existing policies rather than silently OR-ing permissive authorities.
 * No passwords, LOGIN credentials, production application or deployment.
 */
export function compileAuthBootstrapSql(options: {
  ordinaryRole?: string
  legacySystemRole?: string
  rolesPreprovisioned?: boolean
} = {}): string {
  const ordinary = options.ordinaryRole ?? 'union_eyes_runtime'
  const legacySystem = options.legacySystemRole ?? 'union_eyes_system'
  if (Object.values(roles).some(role => role === ordinary || role === legacySystem))
    throw new Error('Auth roles must be separate from application roles')
  const statements: string[] = []
  if (options.rolesPreprovisioned)
    statements.push(compileRolePrerequisiteAssertions(
      Object.values(roles), AUTH_ROLE_MEMBERSHIP_EXPECTATIONS,
    ))
  for (const role of options.rolesPreprovisioned ? [] : Object.values(roles)) {
    statements.push(`DO $auth$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${role}') THEN
        CREATE ROLE ${q(role)} NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
      END IF;
      IF EXISTS (SELECT FROM pg_roles WHERE rolname='${role}' AND
        (rolsuper OR rolbypassrls OR rolcanlogin OR rolinherit OR rolcreatedb OR rolcreaterole)) THEN
        RAISE EXCEPTION 'Unsafe existing auth role: ${role}';
      END IF;
    END $auth$;`)
  }
  if (!options.rolesPreprovisioned)
    statements.push(`GRANT ${[roles.lookup, roles.identity, roles.issuance, roles.redemption, roles.tenantAdmin, roles.provider, roles.audit].map(q).join(', ')} TO ${q(roles.gateway)};`,
    `GRANT ${[roles.system, roles.lifecycle, roles.cleanup, roles.mfaAdmin].map(q).join(', ')} TO ${q(roles.systemGateway)};`)
  for (const appRole of [ordinary, legacySystem]) {
    const literal = appRole.replaceAll("'", "''")
    statements.push(`DO $auth$ BEGIN
      IF EXISTS (SELECT FROM pg_roles WHERE rolname='${literal}') THEN
        IF EXISTS (SELECT FROM pg_roles WHERE rolname='${literal}' AND (rolsuper OR rolbypassrls)) THEN
          RAISE EXCEPTION 'Application role must not bypass auth RLS';
        END IF;
        IF ${Object.values(roles).map(role => `pg_has_role('${literal}','${role}','MEMBER')`).join(' OR ')} THEN
          RAISE EXCEPTION 'Application role must not inherit auth roles';
        END IF;
        REVOKE ALL ON SCHEMA user_management FROM ${q(appRole)};
      END IF;
    END $auth$;`)
  }
  // Table-level REVOKE does not remove previously granted column privileges.
  const revokeRoles = [...Object.values(roles), ordinary, legacySystem, 'PUBLIC']
    .map(role => `'${role.replaceAll("'", "''")}'`).join(',')
  statements.push(`REVOKE ALL ON SCHEMA user_management FROM PUBLIC;`,
    `GRANT USAGE ON SCHEMA user_management TO ${Object.values(roles).filter(role => role !== roles.gateway && role !== roles.systemGateway).map(q).join(', ')};`)
  for (const entry of authStorageAuthorityEntries) {
    const table = entry.table.split('.')[1]!
    const relation = `user_management.${q(table)}`
    statements.push(`DO $auth$ BEGIN
      IF EXISTS (SELECT FROM pg_policies WHERE schemaname='user_management' AND tablename='${table}') THEN
        RAISE EXCEPTION 'Existing auth policies require explicit reconciliation: ${table}';
      END IF;
      IF EXISTS (SELECT FROM pg_class WHERE oid='${relation}'::regclass AND
        relowner IN (SELECT oid FROM pg_roles WHERE rolname IN
          (${Object.values(roles).map(role => `'${role}'`).join(',')}))) THEN
        RAISE EXCEPTION 'Auth executor must not own tables';
      END IF;
    END $auth$;`)
    statements.push(`REVOKE ALL ON TABLE ${relation} FROM PUBLIC, ${Object.values(roles).map(q).join(', ')};`)
    for (const appRole of [ordinary, legacySystem]) {
      statements.push(`DO $auth$ BEGIN
        IF EXISTS (SELECT FROM pg_roles WHERE rolname='${appRole.replaceAll("'", "''")}') THEN
          REVOKE ALL ON TABLE ${relation} FROM ${q(appRole)};
        END IF;
      END $auth$;`)
    }
    statements.push(`ALTER TABLE ${relation} ENABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE ${relation} FORCE ROW LEVEL SECURITY;`)
    statements.push(`DO $auth$ DECLARE cols text; principal text; target text; BEGIN
      SELECT string_agg(quote_ident(attname),',') INTO cols FROM pg_attribute
        WHERE attrelid='${relation}'::regclass AND attnum>0 AND NOT attisdropped;
      FOREACH principal IN ARRAY ARRAY[${revokeRoles}] LOOP
        IF principal='PUBLIC' OR EXISTS (SELECT FROM pg_roles WHERE rolname=principal) THEN
          target := CASE WHEN principal='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(principal) END;
          EXECUTE format('REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON %s FROM %s',
            cols,cols,cols,cols,'${relation}',target);
        END IF;
      END LOOP;
    END $auth$;`)
  }
  const grant = (table: string, role: string, privilege: string) =>
    statements.push(`GRANT ${privilege} ON user_management.${q(table)} TO ${q(role)};`)
  const policy = (table: string, role: string, operation: string, predicate: string) => {
    const check = operation === 'INSERT' ? `WITH CHECK (${predicate})`
      : operation === 'UPDATE' ? `USING (${predicate}) WITH CHECK (${predicate})`
        : `USING (${predicate})`
    statements.push(`CREATE POLICY ${q(`auth_v2_${role}_${operation.toLowerCase()}`)}
      ON user_management.${q(table)} FOR ${operation} TO ${q(role)} ${check};`)
  }
  grant('users', roles.lookup, 'SELECT, UPDATE (failed_login_attempts, account_locked_until)')
  grant('auth_audit_log', roles.audit, 'INSERT')
  policy('auth_audit_log', roles.audit, 'INSERT', `user_id IS NULL AND ${setting('provider')}='cora-acceptance'
    AND metadata->>'provider'='cora-acceptance' AND metadata->>'applicationId'='cora'
    AND ((event_type='acceptance_auth.allow' AND metadata->>'decision'='ALLOW')
      OR (event_type='acceptance_auth.deny' AND metadata->>'decision'='DENY'))`)
  policy('users', roles.lookup, 'SELECT', `${selector('email')} AND lower(email)=${setting('email')}`)
  policy('users', roles.lookup, 'UPDATE', `${selector('email')} AND lower(email)=${setting('email')}`)
  grant('users', roles.identity, `SELECT, UPDATE (password_hash, password_changed_at,
    failed_login_attempts, account_locked_until, last_login_at, last_login_ip, two_factor_enabled)`)
  policy('users', roles.identity, 'SELECT', own)
  policy('users', roles.identity, 'UPDATE', own)
  grant('organization_users', roles.identity, 'SELECT')
  policy('organization_users', roles.identity, 'SELECT', own)
  grant('org_auth_policies', roles.identity, 'SELECT')
  policy('org_auth_policies', roles.identity, 'SELECT', `EXISTS (
    SELECT FROM user_management.organization_users m WHERE m.organization_id=org_auth_policies.organization_id
      AND m.user_id=${setting('user_id')} AND m.is_active=true)`)
  grant('user_sessions', roles.lookup, 'SELECT, UPDATE (last_used_at)')
  const sessionLookup = `${selector('session')} AND session_token_hash=${setting('token_hash')}`
  policy('user_sessions', roles.lookup, 'SELECT', sessionLookup)
  policy('user_sessions', roles.lookup, 'UPDATE', sessionLookup)
  grant('user_sessions', roles.identity, 'SELECT, INSERT, UPDATE (is_active, last_used_at)')
  for (const op of ['SELECT', 'UPDATE']) policy('user_sessions', roles.identity, op, own)
  policy('user_sessions', roles.identity, 'INSERT', `${own} AND EXISTS (
    SELECT FROM user_management.users u WHERE u.user_id=user_sessions.user_id
      AND u.is_active=true AND u.lifecycle_state='active') AND
    (organization_id IS NULL OR EXISTS (
      SELECT FROM user_management.organization_users m
        WHERE m.user_id=user_sessions.user_id AND m.organization_id=user_sessions.organization_id AND m.is_active=true))`)
  for (const [table, kind] of [
    ['password_reset_tokens', 'reset'], ['magic_links', 'magic-link'],
    ['invites', 'invite'], ['mfa_challenges', 'mfa'],
  ]) {
    grant(table!, roles.lookup, 'SELECT')
    policy(table!, roles.lookup, 'SELECT', `${selector(kind!)} AND ${token}`)
  }
  // Password-validated login reads enrollment and mints a challenge before a
  // session exists. This is not equivalent to MFA-completed authentication.
  grant('mfa_totp', roles.identity, 'SELECT')
  policy('mfa_totp', roles.identity, 'SELECT', own)
  grant('mfa_challenges', roles.identity, 'SELECT, INSERT')
  policy('mfa_challenges', roles.identity, 'SELECT', own)
  policy('mfa_challenges', roles.identity, 'INSERT', own)
  grant('auth_audit_log', roles.lookup, 'INSERT')
  policy('auth_audit_log', roles.lookup, 'INSERT', `user_id IS NULL OR EXISTS (
    SELECT FROM user_management.users u WHERE u.user_id=auth_audit_log.user_id)`)
  grant('auth_audit_log', roles.identity, 'SELECT, INSERT')
  policy('auth_audit_log', roles.identity, 'SELECT', own)
  policy('auth_audit_log', roles.identity, 'INSERT', own)
  // The scorer counts failures against ANY account at one IP. Own-user RLS
  // would silently weaken that signal. Expose the aggregate, never its rows.
  statements.push(`GRANT USAGE, CREATE ON SCHEMA user_management TO ${q(roles.riskReader)};`)
  grant('auth_audit_log', roles.riskReader, 'SELECT')
  policy('auth_audit_log', roles.riskReader, 'SELECT', 'true')
  statements.push(`CREATE FUNCTION user_management.auth_failed_login_count(ip text, since_at timestamptz)
    RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
    AS $auth$ SELECT count(*)::integer FROM user_management.auth_audit_log
      WHERE event_type='login_failed' AND ip_address=ip AND created_at>since_at $auth$;`,
    `ALTER FUNCTION user_management.auth_failed_login_count(text,timestamptz) OWNER TO ${q(roles.riskReader)};`,
    `REVOKE CREATE ON SCHEMA user_management FROM ${q(roles.riskReader)};`,
    `REVOKE ALL ON FUNCTION user_management.auth_failed_login_count(text,timestamptz) FROM PUBLIC;`,
    `GRANT EXECUTE ON FUNCTION user_management.auth_failed_login_count(text,timestamptz) TO ${q(roles.identity)};`)
  // Registry grants justify UPDATE only, never full DML or lifecycle/users access.
  for (const [table, operation, columns] of [
    ['user_sessions', 'revoke-sessions', 'is_active'],
    ['organization_users', 'membership-state', 'is_active, updated_at'],
  ]) {
    grant(table!, roles.system, `SELECT (user_id, ${table === 'user_sessions' ? 'session_id, is_active' : 'organization_id, organization_user_id, is_active'}), UPDATE (${columns})`)
    const predicate = `${own} AND ${setting('actor_id')} IS NOT NULL AND
      ${setting('reason')} IS NOT NULL AND ${setting('operation')}='${operation}'${table === 'organization_users'
        ? ` AND organization_id::text=${setting('org_id')}` : ''}`
    policy(table!, roles.system, 'SELECT', predicate)
    policy(table!, roles.system, 'UPDATE', predicate)
  }

  const issuance = `${setting('operation')}`
  const matchingEmail = `lower(email)=${setting('email')}`
  const emailUser = `user_id IN (SELECT u.user_id FROM user_management.users u WHERE lower(u.email)=${setting('email')})`
  grant('users', roles.issuance, 'SELECT, INSERT (user_id,email,password_hash,first_name,last_name,display_name,email_verified,is_active)')
  policy('users', roles.issuance, 'SELECT', matchingEmail)
  policy('users', roles.issuance, 'INSERT', `${matchingEmail} AND ${issuance}='signup' AND
    NOT is_system_admin AND is_active AND lifecycle_state='active' AND account_source='local' AND NOT email_verified`)
  grant('password_reset_tokens', roles.issuance, 'SELECT, INSERT (user_id,token_hash,expires_at), UPDATE (used_at)')
  for (const op of ['SELECT', 'INSERT', 'UPDATE'])
    policy('password_reset_tokens', roles.issuance, op, `${issuance}='reset-issue' AND ${emailUser}`)
  grant('magic_links', roles.issuance, 'SELECT, INSERT (email,user_id,organization_id,purpose,token_hash,expires_at,requested_ip,requested_user_agent)')
  policy('magic_links', roles.issuance, 'SELECT', `${issuance}='magic-issue' AND ${matchingEmail}`)
  policy('magic_links', roles.issuance, 'INSERT', `${issuance}='magic-issue' AND ${matchingEmail}
    AND purpose='login' AND (user_id IS NULL OR ${emailUser})
    AND (organization_id IS NULL OR organization_id::text=${setting('org_id')})`)
  grant('org_auth_policies', roles.issuance, 'SELECT')
  policy('org_auth_policies', roles.issuance, 'SELECT', `organization_id::text=${setting('org_id')}`)
  grant('auth_audit_log', roles.issuance, 'INSERT')
  policy('auth_audit_log', roles.issuance, 'INSERT', `user_id IS NULL OR ${emailUser}`)
  grant('user_sessions', roles.issuance, 'SELECT, INSERT')
  const newlyProvisioned = `${issuance}='signup' AND EXISTS (SELECT FROM user_management.users u
    WHERE u.user_id=user_sessions.user_id AND lower(u.email)=${setting('email')}
      AND u.xmin::text::bigint=txid_current() AND u.is_active AND u.lifecycle_state='active')`
  policy('user_sessions', roles.issuance, 'SELECT', newlyProvisioned)
  policy('user_sessions', roles.issuance, 'INSERT', `${newlyProvisioned} AND organization_id IS NULL`)

  // A bearer is authority only over the live row selected by its hash. Lock
  // that row before side effects; consumption is the final transactional write.
  const live = (kind: string, table: string, sentinel: string) => `${selector(kind)} AND
    ${table}.token_hash=${setting('token_hash')} AND ${table}.expires_at>now() AND ${table}.${sentinel} IS NULL`
  const resetLive = live('reset', 'r', 'used_at')
  const magicLive = `${live('magic-link', 'm', 'used_at')} AND m.purpose='login' AND m.attempts<5`
  const inviteLive = `${live('invite', 'i', 'accepted_at')} AND i.revoked_at IS NULL`
  const mfaLive = `${live('mfa', 'c', 'consumed_at')} AND c.attempts<5`
  const bearerEmail = `email IN (
    SELECT m.email FROM user_management.magic_links m WHERE ${magicLive}
    UNION ALL SELECT i.email FROM user_management.invites i WHERE ${inviteLive})`
  const bearerUser = `user_id IN (
    SELECT r.user_id FROM user_management.password_reset_tokens r WHERE ${resetLive}
    UNION ALL SELECT c.user_id FROM user_management.mfa_challenges c WHERE ${mfaLive}
    UNION ALL SELECT u.user_id FROM user_management.users u WHERE ${bearerEmail.replace('email IN', 'u.email IN')})`
  const bearerUserOnUsers = `(${bearerEmail} OR user_id IN (
    SELECT r.user_id FROM user_management.password_reset_tokens r WHERE ${resetLive}
    UNION ALL SELECT c.user_id FROM user_management.mfa_challenges c WHERE ${mfaLive}))`
  for (const [table, kind, columns] of [
    ['password_reset_tokens', 'reset', 'used_at'],
    ['magic_links', 'magic-link', 'used_at, consumed_ip'],
    ['invites', 'invite', 'accepted_at, accepted_user_id'],
    ['mfa_challenges', 'mfa', 'consumed_at, ip_address, user_agent, attempts'],
  ]) {
    grant(table!, roles.redemption, `SELECT, UPDATE (${columns})`)
    for (const op of ['SELECT', 'UPDATE'])
      policy(table!, roles.redemption, op, `${selector(kind!)} AND ${token}`)
  }
  grant('users', roles.redemption, `SELECT, INSERT (user_id,email,password_hash,first_name,last_name,display_name,email_verified,is_active),
    UPDATE (password_hash,password_changed_at,failed_login_attempts,account_locked_until)`)
  policy('users', roles.redemption, 'SELECT', bearerUserOnUsers)
  policy('users', roles.redemption, 'INSERT', `${bearerEmail} AND password_hash IS NULL
    AND email_verified AND is_active AND NOT is_system_admin AND lifecycle_state='active' AND account_source='local'`)
  policy('users', roles.redemption, 'UPDATE', `${selector('reset')} AND ${bearerUserOnUsers}`)
  grant('organization_users', roles.redemption, `SELECT, INSERT (organization_id,user_id,role,invited_by,invited_at,joined_at),
    UPDATE (role,invited_by,invited_at,joined_at,updated_at)`)
  policy('organization_users', roles.redemption, 'SELECT', bearerUser)
  grant('org_auth_policies', roles.redemption, 'SELECT')
  policy('org_auth_policies', roles.redemption, 'SELECT', `EXISTS (
    SELECT FROM user_management.organization_users m WHERE m.organization_id=org_auth_policies.organization_id AND m.is_active)`)
  const inviteMembership = `${bearerUser} AND EXISTS (SELECT FROM user_management.invites i WHERE ${inviteLive}
    AND i.organization_id=organization_users.organization_id AND i.role=organization_users.role
    AND i.invited_by=organization_users.invited_by AND i.role IN (${AUTH_TENANT_ASSIGNABLE_ROLES.map(role => `'${role}'`).join(',')}))`
  policy('organization_users', roles.redemption, 'INSERT', inviteMembership)
  statements.push(`CREATE POLICY auth_v2_redemption_membership_update ON user_management.organization_users FOR UPDATE TO ${q(roles.redemption)}
    USING (${bearerUser} AND EXISTS (SELECT FROM user_management.invites i WHERE ${inviteLive} AND i.organization_id=organization_users.organization_id))
    WITH CHECK (${inviteMembership});`)
  grant('user_sessions', roles.redemption, 'SELECT, INSERT, UPDATE (is_active)')
  policy('user_sessions', roles.redemption, 'SELECT', bearerUser)
  policy('user_sessions', roles.redemption, 'INSERT', `${bearerUser} AND NOT ${selector('reset')}
    AND EXISTS (SELECT FROM user_management.users u WHERE u.user_id=user_sessions.user_id AND u.is_active AND u.lifecycle_state='active')
    AND (organization_id IS NULL OR EXISTS (SELECT FROM user_management.organization_users m
      WHERE m.user_id=user_sessions.user_id AND m.organization_id=user_sessions.organization_id AND m.is_active))`)
  statements.push(`CREATE POLICY auth_v2_redemption_session_revoke ON user_management.user_sessions FOR UPDATE TO ${q(roles.redemption)}
    USING (${selector('reset')} AND ${bearerUser}) WITH CHECK (${selector('reset')} AND ${bearerUser} AND NOT is_active);`)
  grant('mfa_totp', roles.redemption, 'SELECT, UPDATE (recovery_codes_hashed,last_used_at,updated_at)')
  for (const op of ['SELECT', 'UPDATE']) policy('mfa_totp', roles.redemption, op, `${selector('mfa')} AND ${bearerUser}`)
  grant('mfa_challenges', roles.redemption, 'INSERT')
  policy('mfa_challenges', roles.redemption, 'INSERT', `(${selector('magic-link')} OR ${selector('invite')}) AND ${bearerUser}`)
  grant('auth_audit_log', roles.redemption, 'INSERT')
  policy('auth_audit_log', roles.redemption, 'INSERT', `user_id IS NULL OR ${bearerUser}`)
  grant('mfa_totp', roles.identity, 'INSERT, UPDATE (secret_encrypted,recovery_codes_hashed,enabled_at,disabled_at,last_used_at,updated_at)')
  for (const op of ['INSERT', 'UPDATE']) policy('mfa_totp', roles.identity, op, own)

  // The membership SELECT used to establish tenant authority is self-only;
  // invite/policy writes must match that active admin's organization.
  grant('organization_users', roles.tenantAdmin, 'SELECT')
  policy('organization_users', roles.tenantAdmin, 'SELECT', own)
  const adminOrg = `organization_id::text=${setting('org_id')} AND EXISTS (
    SELECT FROM user_management.organization_users a WHERE a.user_id=${setting('user_id')}
      AND a.organization_id::text=${setting('org_id')} AND a.is_active AND a.role='admin')`
  grant('invites', roles.tenantAdmin, 'SELECT, INSERT (email,organization_id,role,token_hash,invited_by,expires_at), UPDATE (revoked_at)')
  policy('invites', roles.tenantAdmin, 'SELECT', adminOrg)
  policy('invites', roles.tenantAdmin, 'UPDATE', adminOrg)
  policy('invites', roles.tenantAdmin, 'INSERT', `${adminOrg} AND invited_by=${setting('user_id')}
    AND role IN (${AUTH_TENANT_ASSIGNABLE_ROLES.map(role => `'${role}'`).join(',')})`)
  grant('org_auth_policies', roles.tenantAdmin, `SELECT, INSERT (organization_id,allow_local_auth,allow_magic_link,allow_sso,require_sso,require_invite,password_reset_allowed,allowed_email_domains,mfa_required_for_roles,updated_by),
    UPDATE (allow_local_auth,allow_magic_link,allow_sso,require_sso,require_invite,password_reset_allowed,allowed_email_domains,mfa_required_for_roles,updated_by,updated_at)`)
  for (const op of ['SELECT', 'INSERT', 'UPDATE']) policy('org_auth_policies', roles.tenantAdmin, op, adminOrg)
  grant('auth_audit_log', roles.tenantAdmin, 'INSERT')
  policy('auth_audit_log', roles.tenantAdmin, 'INSERT', own)

  // Cross-account request counting never exposes audit/token rows. The caller
  // holds a transaction advisory lock on the matching scope before count+write.
  grant('magic_links', roles.riskReader, 'SELECT')
  policy('magic_links', roles.riskReader, 'SELECT', 'true')
  statements.push(`GRANT CREATE ON SCHEMA user_management TO ${q(roles.riskReader)};
    CREATE FUNCTION user_management.auth_request_count(kind text, scope text) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $auth$
      SELECT CASE WHEN kind='magic-issue' THEN
        (SELECT count(*)::int FROM user_management.magic_links WHERE email=scope AND created_at>now()-interval '15 minutes')
      ELSE (SELECT count(*)::int FROM user_management.auth_audit_log
        WHERE event_type=CASE WHEN kind='reset-issue' THEN 'password_reset_request' ELSE 'signup' END
          AND ip_address=scope AND created_at>now()-interval '15 minutes') END
      WHERE kind=NULLIF(current_setting('nzila.auth_operation',true),'')
        AND scope=CASE WHEN kind='magic-issue' THEN current_setting('nzila.auth_email',true) ELSE current_setting('nzila.auth_ip',true) END
    $auth$;
    ALTER FUNCTION user_management.auth_request_count(text,text) OWNER TO ${q(roles.riskReader)};
    REVOKE CREATE ON SCHEMA user_management FROM ${q(roles.riskReader)};
    REVOKE ALL ON FUNCTION user_management.auth_request_count(text,text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION user_management.auth_request_count(text,text) TO ${q(roles.issuance)};`)

  grant('users', roles.lifecycle, `SELECT (user_id,lifecycle_state,is_active,is_system_admin),
    UPDATE (lifecycle_state,lifecycle_reason,lifecycle_changed_at,lifecycle_changed_by,is_active,updated_at)`)
  policy('users', roles.lifecycle, 'SELECT', `user_id=${setting('user_id')} OR user_id=${setting('actor_id')}`)
  // Self-reference needs a narrowly owned predicate, not recursive user RLS.
  statements.push(`GRANT CREATE ON SCHEMA user_management TO ${q(roles.providerReader)};`)
  grant('users', roles.providerReader, 'SELECT (user_id,is_system_admin,is_active,lifecycle_state)')
  policy('users', roles.providerReader, 'SELECT', `user_id=${setting('actor_id')}`)
  statements.push(`CREATE FUNCTION user_management.auth_lifecycle_actor() RETURNS boolean LANGUAGE sql STABLE
    SECURITY DEFINER SET search_path=pg_catalog AS $auth$ SELECT EXISTS (
      SELECT FROM user_management.users WHERE user_id=NULLIF(current_setting('nzila.auth_actor_id',true),'')
        AND is_system_admin AND is_active AND lifecycle_state='active') $auth$;
    ALTER FUNCTION user_management.auth_lifecycle_actor() OWNER TO ${q(roles.providerReader)};
    REVOKE ALL ON FUNCTION user_management.auth_lifecycle_actor() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION user_management.auth_lifecycle_actor() TO ${q(roles.lifecycle)}, ${q(roles.mfaAdmin)};`)
  statements.push(`CREATE POLICY auth_v2_lifecycle_update ON user_management.users FOR UPDATE TO ${q(roles.lifecycle)}
    USING (${own} AND user_management.auth_lifecycle_actor() AND
      (${setting('operation')}='deprovision' OR lifecycle_state<>'deprovisioned'))
    WITH CHECK (${own} AND lifecycle_changed_by=${setting('actor_id')} AND
      lifecycle_state=CASE ${setting('operation')} WHEN 'suspend' THEN 'suspended' WHEN 'reactivate' THEN 'active' ELSE 'deprovisioned' END
      AND is_active=(${setting('operation')}='reactivate'));`)
  grant('user_sessions', roles.lifecycle, 'SELECT (session_id,user_id,is_active), UPDATE (is_active)')
  policy('user_sessions', roles.lifecycle, 'SELECT', own)
  statements.push(`CREATE POLICY auth_v2_lifecycle_revoke ON user_management.user_sessions FOR UPDATE TO ${q(roles.lifecycle)}
    USING (${own} AND ${setting('operation')}='deprovision' AND user_management.auth_lifecycle_actor())
    WITH CHECK (${own} AND NOT is_active AND user_management.auth_lifecycle_actor());`)
  grant('auth_audit_log', roles.lifecycle, 'INSERT')
  policy('auth_audit_log', roles.lifecycle, 'INSERT', `${own} AND user_management.auth_lifecycle_actor()`)
  grant('user_sessions', roles.cleanup, 'SELECT (session_id,is_active,expires_at), DELETE')
  const expired = `NOT is_active AND expires_at<now()-interval '7 days'`
  for (const op of ['SELECT', 'DELETE']) policy('user_sessions', roles.cleanup, op, expired)
  grant('mfa_totp', roles.mfaAdmin, 'SELECT, UPDATE (disabled_at,updated_at)')
  for (const op of ['SELECT', 'UPDATE']) policy('mfa_totp', roles.mfaAdmin, op, `${own} AND user_management.auth_lifecycle_actor()`)
  grant('users', roles.mfaAdmin, 'SELECT (user_id,two_factor_enabled), UPDATE (two_factor_enabled)')
  policy('users', roles.mfaAdmin, 'SELECT', own)
  statements.push(`CREATE POLICY auth_v2_mfa_admin_disable ON user_management.users FOR UPDATE TO ${q(roles.mfaAdmin)}
    USING (${own} AND user_management.auth_lifecycle_actor()) WITH CHECK (${own} AND NOT two_factor_enabled);`)
  grant('auth_audit_log', roles.mfaAdmin, 'INSERT')
  policy('auth_audit_log', roles.mfaAdmin, 'INSERT', `${own} AND user_management.auth_lifecycle_actor()`)

  // Provider validation precedes this resolver. Never bind by email or mint a
  // binding at sign-in: only a pre-provisioned verified platform binding maps.
  statements.push(`GRANT USAGE ON SCHEMA public TO ${q(roles.providerReader)};
    GRANT SELECT (id,provider,provider_subject,platform_user_id,state,verified_at) ON public.platform_identity_bindings TO ${q(roles.providerReader)};
    CREATE POLICY auth_v2_provider_mapping ON public.platform_identity_bindings FOR SELECT TO ${q(roles.providerReader)}
      USING (provider=${setting('provider')} AND provider_subject=${setting('provider_subject')} AND state='active' AND verified_at IS NOT NULL);
    CREATE FUNCTION user_management.auth_provider_user() RETURNS text LANGUAGE sql STABLE
    SECURITY DEFINER SET search_path=pg_catalog AS $auth$
      SELECT platform_user_id::text FROM public.platform_identity_bindings
        WHERE provider=NULLIF(current_setting('nzila.auth_provider',true),'')
          AND provider_subject=NULLIF(current_setting('nzila.auth_provider_subject',true),'')
          AND state='active' AND verified_at IS NOT NULL $auth$;
    ALTER FUNCTION user_management.auth_provider_user() OWNER TO ${q(roles.providerReader)};
    CREATE FUNCTION user_management.auth_provider_binding() RETURNS jsonb LANGUAGE sql STABLE
    SECURITY DEFINER SET search_path=pg_catalog AS $auth$
      SELECT jsonb_build_object('id',id,'provider',provider,'providerSubject',provider_subject,
        'platformUserId',platform_user_id,'state',state,'verifiedAt',verified_at)
      FROM public.platform_identity_bindings WHERE provider=NULLIF(current_setting('nzila.auth_provider',true),'')
        AND provider_subject=NULLIF(current_setting('nzila.auth_provider_subject',true),'')
        AND state='active' AND verified_at IS NOT NULL $auth$;
    ALTER FUNCTION user_management.auth_provider_binding() OWNER TO ${q(roles.providerReader)};
    REVOKE CREATE ON SCHEMA user_management FROM ${q(roles.providerReader)};
    REVOKE ALL ON FUNCTION user_management.auth_provider_user() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION user_management.auth_provider_user() TO ${q(roles.provider)};`)
  statements.push(`REVOKE ALL ON FUNCTION user_management.auth_provider_binding() FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION user_management.auth_provider_binding() TO ${q(roles.provider)};`)
  grant('users', roles.provider, 'SELECT')
  policy('users', roles.provider, 'SELECT', `user_id=user_management.auth_provider_user() AND is_active AND lifecycle_state='active'`)
  statements.push(compileAuthOrgBindingSql({ ordinaryRole: ordinary }))
  return statements.join('\n')
}
