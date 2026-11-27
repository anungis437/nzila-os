/** A boolean projection for ONE actual voter on an exact live qualification.
 * No raw auth grant, new policy, role or generic foreign membership API. */
import { ROLE_CAPACITIES } from '../authority/capacity'
import { CASE_AUTHORITY_READER_ROLE } from '../../db/auth/case-authority-reader-schema'

export const EXTERNAL_AUTH_BRIDGE_SOURCE_PATH = 'apps/union-eyes/lib/external-resource-read/auth-bridge.ts'
const executives = Object.entries(ROLE_CAPACITIES).filter(([, values]) => values.includes('executive')).map(([role]) => `'${role}'`).join(',')
export const EXTERNAL_AUTHORIZER_LIVE_FUNCTION = {
  schema: 'public', name: 'ue_external_authorizer_live_v1', args: 'target_org uuid, approved_request_id uuid, authorizer_id text',
  returns: 'boolean', owner: CASE_AUTHORITY_READER_ROLE, callers: ['ue_external_read_reader'], immutable: false,
  body: `
DECLARE prior_org text:=current_setting('ue.case_domain_org',true); prior_people text:=current_setting('ue.case_domain_people',true);
  eligible boolean:=false;
BEGIN
  -- Verify original recipient authority BEFORE opening the private one-person
  -- reader scope. app actor, organization and bearer are never substituted.
  IF user_management.auth_business_org_authorized(NULLIF(current_setting('app.current_org_id',true),'')::uuid,NULL::text[]) IS NOT TRUE
    OR public.ue_external_authorizer_scope_v1(target_org,approved_request_id,authorizer_id) IS NOT TRUE THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ue.case-mail.principal:'||authorizer_id,0));
  PERFORM set_config('ue.case_domain_org',target_org::text,true);
  PERFORM set_config('ue.case_domain_people',ARRAY[authorizer_id]::text,true);
  SELECT count(*)=1 AND COALESCE(bool_and(m.is_active AND u.is_active AND u.lifecycle_state='active' AND m.role=ANY(ARRAY[${executives}])),false)
    INTO eligible FROM user_management.organization_users m JOIN user_management.users u ON u.user_id=m.user_id
    WHERE m.organization_id=target_org AND m.user_id=authorizer_id;
  PERFORM set_config('ue.case_domain_org',COALESCE(prior_org,''),true);
  PERFORM set_config('ue.case_domain_people',COALESCE(prior_people,''),true);
  RETURN eligible IS TRUE;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('ue.case_domain_org',COALESCE(prior_org,''),true);
  PERFORM set_config('ue.case_domain_people',COALESCE(prior_people,''),true);
  RAISE;
END;
`,
} as const

/** Actual restricted installer mode requires the trusted preparation to have
 * supplied schema CREATE and the existing canonical owner SET edge. The
 * original trusted finalizer removes CREATE in the same outer transaction. */
export function compileExternalAuthBridgeSql(options: { rolesPreprovisioned?: boolean } = {}): string {
  const fn = EXTERNAL_AUTHORIZER_LIVE_FUNCTION, signature = `${fn.schema}.${fn.name}(uuid,uuid,text)`
  const create = `CREATE FUNCTION ${fn.schema}.${fn.name}(${fn.args}) RETURNS ${fn.returns}
    LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $ue_external_auth$${fn.body}$ue_external_auth$;
    ALTER FUNCTION ${signature} OWNER TO ${fn.owner};`
  const acl = `REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC,union_eyes_runtime,union_eyes_system,ue_v2_owner;
    GRANT EXECUTE ON FUNCTION ${signature} TO ue_external_read_reader;`
  return `DO $ue_external_auth_admit$ BEGIN
      IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='${fn.owner}' AND NOT(rolsuper OR rolinherit OR rolcreaterole OR rolcreatedb OR rolcanlogin OR rolbypassrls))
        OR NOT EXISTS(SELECT FROM pg_roles WHERE rolname='ue_external_read_reader' AND NOT(rolsuper OR rolinherit OR rolcreaterole OR rolcreatedb OR rolcanlogin OR rolbypassrls))
        OR EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='${fn.name}')
        THEN RAISE EXCEPTION 'EXTERNAL_AUTH_BRIDGE_EXACT_SOURCE_REQUIRED' USING ERRCODE='42501'; END IF;
      ${options.rolesPreprovisioned ? `IF current_user<>'ue_v2_owner' OR NOT has_schema_privilege('${fn.owner}','public','CREATE')
        OR NOT pg_has_role(current_user,'${fn.owner}','MEMBER') THEN RAISE EXCEPTION 'EXTERNAL_AUTH_BRIDGE_PREPARATION_REQUIRED' USING ERRCODE='42501'; END IF;`
        : `IF has_schema_privilege('${fn.owner}','public','CREATE') THEN RAISE EXCEPTION 'EXTERNAL_AUTH_BRIDGE_PREEXISTING_OVERGRANT' USING ERRCODE='42501'; END IF;`}
    END $ue_external_auth_admit$;
    ${options.rolesPreprovisioned
      ? `SET LOCAL ROLE ${fn.owner};\n${create}\n${acl}\nSET LOCAL ROLE ue_v2_owner;`
      : `GRANT CREATE ON SCHEMA public TO ${fn.owner};\n${create}\n${acl}\nREVOKE CREATE ON SCHEMA public FROM ${fn.owner};`}`
}
