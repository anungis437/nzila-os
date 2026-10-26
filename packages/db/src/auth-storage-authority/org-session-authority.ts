import { AUTH_EXECUTION_ROLES } from './execution-boundary'

export const AUTH_BUSINESS_ORG_PREDICATE = 'user_management.auth_business_org_authorized'
export const AUTH_BUSINESS_USER_PARENT_PREDICATE = 'user_management.auth_business_user_parent_authorized'
export const AUTH_BUSINESS_MEMBER_PARENT_PREDICATE = 'user_management.auth_business_member_parent_authorized'
export const AUTH_BUSINESS_CONTEXT_KEYS = ['app.current_user_id', 'app.current_org_id', 'app.current_session_token'] as const
/** Marks the 30-second request-scoped bridge row minted by `withResolvedOrgBinding`. */
export const AUTH_BRIDGE_PURPOSE = 'business-org-binding'

export function authBusinessContextSettings(binding: {
  userId: string; organizationId: string; sessionToken: string
}): Record<typeof AUTH_BUSINESS_CONTEXT_KEYS[number], string> {
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
      AND s.is_active AND s.expires_at>statement_timestamp()
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
    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $auth$
      SELECT row_org::text=NULLIF(current_setting('app.current_org_id',true),'')
        AND EXISTS (
          SELECT FROM user_management.user_sessions s
          JOIN user_management.users u ON u.user_id=s.user_id
          JOIN user_management.organization_users m ON m.user_id=u.user_id AND m.organization_id=row_org
          WHERE s.user_id=NULLIF(current_setting('app.current_user_id',true),'')
            AND s.session_token_hash=encode(sha256(convert_to(NULLIF(current_setting('app.current_session_token',true),''),'UTF8')),'hex')
            AND s.is_active AND s.expires_at>statement_timestamp()
            AND (s.organization_id IS NULL OR s.organization_id=row_org)
            AND (s.device_info->>'purpose' IS DISTINCT FROM '${AUTH_BRIDGE_PURPOSE}'
              OR s.device_info->>'parentSessionId' IS NULL
              OR EXISTS (SELECT FROM user_management.user_sessions p
                WHERE p.session_id::text=s.device_info->>'parentSessionId' AND p.user_id=s.user_id
                  AND p.is_active AND p.expires_at>statement_timestamp()))
            AND u.is_active AND u.lifecycle_state='active' AND m.is_active
            AND (required_roles IS NULL OR m.role=ANY(required_roles))
        ) $auth$;
    ALTER FUNCTION ${AUTH_BUSINESS_ORG_PREDICATE}(uuid,text[]) OWNER TO ${reader};
    REVOKE ALL ON FUNCTION ${AUTH_BUSINESS_ORG_PREDICATE}(uuid,text[]) FROM PUBLIC;
    GRANT USAGE ON SCHEMA user_management TO ${q(ordinary)};
    GRANT EXECUTE ON FUNCTION ${AUTH_BUSINESS_ORG_PREDICATE}(uuid,text[]) TO ${q(ordinary)};
    CREATE FUNCTION ${AUTH_BUSINESS_USER_PARENT_PREDICATE}(parent_user_id text,row_org uuid)
    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $auth$
      SELECT parent_user_id=NULLIF(current_setting('app.current_user_id',true),'')
        AND user_management.auth_business_org_authorized(row_org,NULL::text[])
      $auth$;
    ALTER FUNCTION ${AUTH_BUSINESS_USER_PARENT_PREDICATE}(text,uuid) OWNER TO ${reader};
    REVOKE ALL ON FUNCTION ${AUTH_BUSINESS_USER_PARENT_PREDICATE}(text,uuid) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION ${AUTH_BUSINESS_USER_PARENT_PREDICATE}(text,uuid) TO ${q(ordinary)};
    CREATE FUNCTION ${AUTH_BUSINESS_MEMBER_PARENT_PREDICATE}(parent_user_id text,row_org uuid)
    RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $auth$
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
