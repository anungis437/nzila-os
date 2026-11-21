import { AUTH_EXECUTION_ROLES } from './execution-boundary'

export const AUTH_BUSINESS_ORG_PREDICATE = 'user_management.auth_business_org_authorized'
export const AUTH_BUSINESS_USER_PARENT_PREDICATE =
  'user_management.auth_business_user_parent_authorized'
export const AUTH_BUSINESS_MEMBER_PARENT_PREDICATE =
  'user_management.auth_business_member_parent_authorized'
export const AUTH_BUSINESS_CONTEXT_KEYS = [
  'app.current_user_id',
  'app.current_org_id',
  'app.current_session_token',
] as const
/** Marks the 30-second request-scoped bridge row minted by `withResolvedOrgBinding`. */
export const AUTH_BRIDGE_PURPOSE = 'business-org-binding'
/**
 * A provider sign-in has no parent session cookie. The bridge must say so.
 * A business-org bridge that omits both this class and a parent id confers nothing.
 */
export const AUTH_BRIDGE_PROVIDER_NO_PARENT = 'provider-no-parent'

export function authBusinessContextSettings(binding: {
  userId: string
  organizationId: string
  sessionToken: string
}): Record<(typeof AUTH_BUSINESS_CONTEXT_KEYS)[number], string> {
  if (!binding.userId || !binding.organizationId || !binding.sessionToken)
    throw new Error('Authenticated actor, organization and raw session authority are required')
  return {
    'app.current_user_id': binding.userId,
    'app.current_org_id': binding.organizationId,
    'app.current_session_token': binding.sessionToken,
  }
}

/**
 * Session IDs, actor IDs and stored token hashes are not bearer credentials.
 * The raw server-held cookie/bridge token is hashed inside the pinned predicate.
 */
export function compileAuthOrgBindingSql(options: { ordinaryRole?: string } = {}): string {
  const ordinary = options.ordinaryRole ?? 'union_eyes_runtime'
  if ((Object.values(AUTH_EXECUTION_ROLES) as readonly string[]).includes(ordinary))
    throw new Error('Business runtime must be separate from auth authority roles')
  const q = (identifier: string) => `"${identifier.replaceAll('"', '""')}"`
  const reader = q(AUTH_EXECUTION_ROLES.orgAuthorityReader)
  const actor = `NULLIF(current_setting('app.current_user_id',true),'')`
  const liveSession = `EXISTS (SELECT FROM user_management.user_sessions s
    WHERE s.user_id=${actor}
      AND s.session_token_hash=encode(sha256(convert_to(NULLIF(current_setting('app.current_session_token',true),''),'UTF8')),'hex')
      AND s.is_active AND isfinite(s.expires_at) AND s.expires_at>clock_timestamp()
      AND (s.organization_id IS NULL OR s.organization_id::text=NULLIF(current_setting('app.current_org_id',true),'')))`
  return `
    GRANT USAGE, CREATE ON SCHEMA user_management TO ${reader};
    GRANT SELECT (user_id,is_active,lifecycle_state) ON user_management.users TO ${reader};
    GRANT SELECT (user_id,organization_id,role,is_active) ON user_management.organization_users TO ${reader};
    GRANT SELECT (session_id,user_id,organization_id,session_token_hash,is_active,expires_at,device_info) ON user_management.user_sessions TO ${reader};
    CREATE POLICY auth_v2_org_reader_users ON user_management.users FOR SELECT TO ${reader}
      USING (user_id=${actor} OR EXISTS (
        SELECT FROM user_management.organization_users m
        WHERE m.user_id=users.user_id AND m.is_active
          AND m.organization_id::text=NULLIF(current_setting('app.current_org_id',true),'')
          AND ${liveSession}));
    CREATE POLICY auth_v2_org_reader_memberships ON user_management.organization_users FOR SELECT TO ${reader}
      USING (user_id=${actor} OR (
        organization_id::text=NULLIF(current_setting('app.current_org_id',true),'') AND ${liveSession}));
    CREATE POLICY auth_v2_org_reader_sessions ON user_management.user_sessions FOR SELECT TO ${reader}
      USING (user_id=${actor});
    CREATE FUNCTION ${AUTH_BUSINESS_ORG_PREDICATE}(row_org uuid,required_roles text[] DEFAULT NULL)
    RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $auth$
      WITH auth_clock AS MATERIALIZED (SELECT clock_timestamp() AS checked_at)
      SELECT (row_org::text=NULLIF(current_setting('app.current_org_id',true),'')
        AND EXISTS (
          SELECT FROM user_management.user_sessions s
          JOIN user_management.users u ON u.user_id=s.user_id
          JOIN user_management.organization_users m ON m.user_id=u.user_id AND m.organization_id=row_org
          WHERE s.user_id=NULLIF(current_setting('app.current_user_id',true),'')
            AND s.session_token_hash=encode(sha256(convert_to(NULLIF(current_setting('app.current_session_token',true),''),'UTF8')),'hex')
            AND s.is_active AND isfinite(s.expires_at) AND s.expires_at>auth_clock.checked_at
            AND (s.organization_id IS NULL OR s.organization_id=row_org)
            AND (s.device_info->>'purpose' IS DISTINCT FROM '${AUTH_BRIDGE_PURPOSE}'
              OR (
                NULLIF(s.device_info->>'parentSessionId','') IS NOT NULL
                AND EXISTS (SELECT FROM user_management.user_sessions p
                  WHERE p.session_id::text=s.device_info->>'parentSessionId' AND p.user_id=s.user_id
                    AND p.is_active AND isfinite(p.expires_at) AND p.expires_at>auth_clock.checked_at)
              )
              OR (
                NULLIF(s.device_info->>'parentSessionId','') IS NULL
                AND s.device_info->>'bridgeClass'='${AUTH_BRIDGE_PROVIDER_NO_PARENT}'
              ))
            AND u.is_active AND u.lifecycle_state='active' AND m.is_active
            AND (required_roles IS NULL OR m.role=ANY(required_roles))
        ) ) IS TRUE FROM auth_clock $auth$;
    ALTER FUNCTION ${AUTH_BUSINESS_ORG_PREDICATE}(uuid,text[]) OWNER TO ${reader};
    REVOKE ALL ON FUNCTION ${AUTH_BUSINESS_ORG_PREDICATE}(uuid,text[]) FROM PUBLIC;
    GRANT USAGE ON SCHEMA user_management TO ${q(ordinary)};
    GRANT EXECUTE ON FUNCTION ${AUTH_BUSINESS_ORG_PREDICATE}(uuid,text[]) TO ${q(ordinary)};
    CREATE FUNCTION ${AUTH_BUSINESS_USER_PARENT_PREDICATE}(parent_user_id text,row_org uuid)
    RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $auth$
      SELECT (parent_user_id=NULLIF(current_setting('app.current_user_id',true),'')
        AND user_management.auth_business_org_authorized(row_org,NULL::text[])) IS TRUE
      $auth$;
    ALTER FUNCTION ${AUTH_BUSINESS_USER_PARENT_PREDICATE}(text,uuid) OWNER TO ${reader};
    REVOKE ALL ON FUNCTION ${AUTH_BUSINESS_USER_PARENT_PREDICATE}(text,uuid) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION ${AUTH_BUSINESS_USER_PARENT_PREDICATE}(text,uuid) TO ${q(ordinary)};
    CREATE FUNCTION ${AUTH_BUSINESS_MEMBER_PARENT_PREDICATE}(parent_user_id text,row_org uuid)
    RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $auth$
      SELECT CASE WHEN user_management.auth_business_org_authorized(row_org,NULL::text[]) THEN
        EXISTS (SELECT FROM user_management.users u
          JOIN user_management.organization_users m ON m.user_id=u.user_id
          WHERE u.user_id=parent_user_id AND u.is_active AND u.lifecycle_state='active'
            AND m.organization_id=row_org AND m.is_active)
        ELSE false END
      $auth$;
    ALTER FUNCTION ${AUTH_BUSINESS_MEMBER_PARENT_PREDICATE}(text,uuid) OWNER TO ${reader};
    REVOKE ALL ON FUNCTION ${AUTH_BUSINESS_MEMBER_PARENT_PREDICATE}(text,uuid) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION ${AUTH_BUSINESS_MEMBER_PARENT_PREDICATE}(text,uuid) TO ${q(ordinary)};
    REVOKE CREATE ON SCHEMA user_management FROM ${reader};
  `
}

/** Current-source definition admission, in addition to the existing role/column census. */
export function buildAuthBusinessFunctionCatalogQuery(
  additionalCallers: Readonly<Record<string, readonly string[]>> = {},
): string {
  const clauses = Object.entries(additionalCallers).map(([name, callers]) => {
    if (!['auth_business_org_authorized', 'auth_business_user_parent_authorized', 'auth_business_member_parent_authorized'].includes(name)
      || !callers.length || new Set(callers).size !== callers.length
      || callers.some(role => !/^[a-z_][a-z0-9_]{0,62}$/.test(role)))
      throw new Error('AUTH_BUSINESS_PREDICATE_SOURCE_CALLERS_REQUIRED')
    return `(p.proname='${name}' AND EXISTS(SELECT FROM pg_roles expected_caller
      WHERE expected_caller.oid=a.grantee AND expected_caller.rolname IN(${callers.map(role => `'${role}'`).join(',')})))`
  })
  const ordinary = `a.grantee NOT IN(p.proowner,
      (SELECT oid FROM pg_roles WHERE rolname='union_eyes_runtime'))`
  const unexpected = clauses.length ? `(${ordinary} AND NOT (${clauses.join(' OR ')}))` : ordinary
  return `SELECT p.proname AS name,p.prosrc,p.provolatile,p.prosecdef,
  p.proargtypes::text AS argument_types,p.prorettype::regtype::text AS returns,l.lanname AS language,
  owner.rolname AS owner,p.proconfig,p.proleakproof,p.proretset,p.proisstrict,
  has_function_privilege('public',p.oid,'EXECUTE') AS public_execute,
  NOT EXISTS(SELECT FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
    WHERE a.privilege_type='EXECUTE' AND (${unexpected} OR (a.is_grantable AND a.grantee<>p.proowner))) AS exact_acl
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
  JOIN pg_roles owner ON owner.oid=p.proowner WHERE n.nspname='user_management'
  AND p.proname IN('auth_business_org_authorized','auth_business_user_parent_authorized','auth_business_member_parent_authorized')`
}

export const AUTH_BUSINESS_FUNCTION_CATALOG_QUERY = buildAuthBusinessFunctionCatalogQuery()

export function authBusinessFunctionViolations(rows: readonly Record<string, unknown>[]): string[] {
  const source = compileAuthOrgBindingSql()
  const definitions = [
    ...source.matchAll(
      /CREATE FUNCTION user_management\.(auth_business_[a-z_]+)\([^]*?AS \$auth\$([^]*?)\$auth\$;/g,
    ),
  ]
  if (definitions.length !== 3)
    throw new Error('Canonical business predicate source contract could not be recovered')
  const failures: string[] = []
  for (const definition of definitions) {
    const name = definition[1]!,
      body = definition[2]!
    const found = rows.filter((row) => row.name === name),
      row = found[0]
    const args = name === 'auth_business_org_authorized' ? '2950 1009' : '25 2950'
    if (
      found.length !== 1 ||
      !row ||
      row.prosrc !== body ||
      row.provolatile !== 'v' ||
      row.prosecdef !== true ||
      row.argument_types !== args ||
      row.returns !== 'boolean' ||
      row.language !== 'sql' ||
      row.owner !== AUTH_EXECUTION_ROLES.orgAuthorityReader ||
      JSON.stringify(row.proconfig) !== JSON.stringify(['search_path=pg_catalog']) ||
      row.proleakproof !== false ||
      row.proretset !== false ||
      row.proisstrict !== false ||
      row.public_execute !== false ||
      row.exact_acl !== true
    )
      failures.push(`Current business predicate definition or authority differs: ${name}`)
  }
  return failures
}
