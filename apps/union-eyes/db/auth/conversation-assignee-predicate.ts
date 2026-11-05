import { CONVERSATION_ASSIGNEE_ROLES } from '@/lib/authority/capacity'
import { CASE_ASSIGNEE_PREDICATE_OWNER } from './case-assignee-predicate'

export const CONVERSATION_ASSIGNEE_PREDICATE = 'public.ue_conversation_assignee_authorized'
export const CONVERSATION_ASSIGNEE_PREDICATE_OWNER = CASE_ASSIGNEE_PREDICATE_OWNER

const ROLE_LIST = CONVERSATION_ASSIGNEE_ROLES.map((role) => `'${role}'`).join(',')

// Same owner and session binding as the case-assignee predicate. The role list is the
// conversation-assignee capacities, so an organization administrator is not admitted.
export const CONVERSATION_ASSIGNEE_PREDICATE_BODY = `
  SELECT CASE WHEN target_user_id IS NOT NULL AND length(target_user_id) BETWEEN 1 AND 255
    AND user_management.auth_business_org_authorized(row_org,NULL::text[])
  THEN EXISTS (
    SELECT FROM user_management.users u
    JOIN user_management.organization_users m ON m.user_id=u.user_id
    WHERE u.user_id=target_user_id AND u.is_active AND u.lifecycle_state='active'
      AND m.organization_id=row_org AND m.is_active
      AND lower(m.role) IN (${ROLE_LIST})
  ) ELSE false END
`.trim()

/** Apply only through a reviewed, qualified companion installation transaction. */
export function compileConversationAssigneePredicateSql(): string {
  return `DO $ue_conv$ BEGIN
    IF EXISTS (SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='ue_conversation_assignee_authorized') THEN
      RAISE EXCEPTION 'Existing conversation assignee predicate requires explicit reconciliation';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${CONVERSATION_ASSIGNEE_PREDICATE_OWNER}'
      AND NOT (rolsuper OR rolbypassrls OR rolinherit OR rolcanlogin OR rolcreatedb OR rolcreaterole))
      OR has_schema_privilege('${CONVERSATION_ASSIGNEE_PREDICATE_OWNER}','public','CREATE') THEN
      RAISE EXCEPTION 'Existing bounded reader authority is required';
    END IF;
    IF to_regprocedure('user_management.auth_business_org_authorized(uuid,text[])') IS NULL THEN
      RAISE EXCEPTION 'Canonical raw-session organization authority is required';
    END IF;
  END $ue_conv$;
  GRANT CREATE ON SCHEMA public TO ${CONVERSATION_ASSIGNEE_PREDICATE_OWNER};
  CREATE FUNCTION ${CONVERSATION_ASSIGNEE_PREDICATE}(target_user_id text,row_org uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog
  AS $ue_conv$ ${CONVERSATION_ASSIGNEE_PREDICATE_BODY} $ue_conv$;
  ALTER FUNCTION ${CONVERSATION_ASSIGNEE_PREDICATE}(text,uuid) OWNER TO ${CONVERSATION_ASSIGNEE_PREDICATE_OWNER};
  REVOKE ALL ON FUNCTION ${CONVERSATION_ASSIGNEE_PREDICATE}(text,uuid) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION ${CONVERSATION_ASSIGNEE_PREDICATE}(text,uuid) TO union_eyes_runtime;
  REVOKE CREATE ON SCHEMA public FROM ${CONVERSATION_ASSIGNEE_PREDICATE_OWNER};`
}

type CatalogRow = Record<string, unknown>
const normalized = (value: unknown) => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
export function conversationAssigneePredicateViolations(rows: CatalogRow[]): string[] {
  const expectedRoles = ['union_eyes_runtime', 'union_eyes_system', CONVERSATION_ASSIGNEE_PREDICATE_OWNER]
  if (rows.length !== expectedRoles.length || new Set(rows.map((row) => row.oid)).size !== 1)
    return ['conversation-assignee predicate: missing or overloaded function']
  const violations: string[] = []
  for (const role of expectedRoles) {
    const row = rows.find((item) => item.role === role)
    if (!row || row.owner !== CONVERSATION_ASSIGNEE_PREDICATE_OWNER || row.prosecdef !== true || row.provolatile !== 's'
      || row.proleakproof !== false || row.proretset !== false || row.proisstrict !== false || row.exact_execute_acl !== true
      || row.argument_types !== '25 2950' || row.return_type !== 'boolean' || row.language !== 'sql'
      || JSON.stringify(row.proconfig) !== JSON.stringify(['search_path=pg_catalog'])
      || normalized(row.prosrc) !== normalized(CONVERSATION_ASSIGNEE_PREDICATE_BODY)
      || row.public_execute !== false || row.allowed !== (role !== 'union_eyes_system'))
      violations.push(`${role}: conversation-assignee predicate authority or body differs`)
  }
  return violations
}

export const CONVERSATION_ASSIGNEE_CATALOG_QUERY = `SELECT p.oid::text AS oid,p.prosecdef,p.provolatile,p.proconfig,p.prosrc,
  p.proleakproof,p.proretset,p.proisstrict,
  p.proargtypes::text AS argument_types,p.prorettype::regtype::text AS return_type,l.lanname AS language,
  owner.rolname AS owner,r.rolname AS role,has_function_privilege(r.oid,p.oid,'EXECUTE') AS allowed,
  has_function_privilege('public',p.oid,'EXECUTE') AS public_execute,
  NOT EXISTS (SELECT FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
    WHERE a.privilege_type='EXECUTE' AND (a.grantee NOT IN (p.proowner,
      (SELECT oid FROM pg_roles WHERE rolname='union_eyes_runtime'))
      OR (a.is_grantable AND a.grantee<>p.proowner))) AS exact_execute_acl
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles owner ON owner.oid=p.proowner
  JOIN pg_language l ON l.oid=p.prolang CROSS JOIN pg_roles r
  WHERE n.nspname='public' AND p.proname='ue_conversation_assignee_authorized'
    AND r.rolname IN ('union_eyes_runtime','union_eyes_system','${CONVERSATION_ASSIGNEE_PREDICATE_OWNER}')`
