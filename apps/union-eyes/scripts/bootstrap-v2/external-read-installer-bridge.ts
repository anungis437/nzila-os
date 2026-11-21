/** Fixed trusted phases for the genuine restricted local installer. No request
 * supplies SQL, a role, an owner, or arguments to either privileged function. */
import { createHash } from 'node:crypto'
import { compileAuthBootstrapSql } from './auth-sql'
import { compileCaseDomainSupportSql } from '../../db/auth/case-primary-domain-guards'
import { compileAuthorityMembershipReaderSql } from '../../lib/authority/store/platform-identity'
import { compileExternalAuthBridgeSql, EXTERNAL_AUTHORIZER_LIVE_FUNCTION } from '../../lib/external-resource-read/auth-bridge'
import {
  EXTERNAL_READ_FUNCTIONS, EXTERNAL_READ_OWNER, EXTERNAL_READ_PREREQUISITE_FUNCTIONS,
  EXTERNAL_READ_STORAGE_TABLES, compileExternalReadRolePreparationSql,
  compileExternalReadRoleFinalizationSql, compileExternalReadSql,
} from '../../lib/external-resource-read/source'
import { projectCurrentCompilerSecurity, type CurrentFunctionDescriptor } from '../../../../tooling/scripts/lib/union-eyes-current-security-contract'
import { currentFunctionViolations } from '../../lib/operations/catalog-admission-core.mjs'

export const EXTERNAL_INSTALLER_BRIDGE_SCHEMA = 'ue_v2_external_installer'
export const EXTERNAL_INSTALLER_LOGIN = 'ue_v2_fixture_installer'
const trustedOwner = 'postgres'
const prepareName = 'prepare_external_read'
const finalizeName = 'finalize_external_read'
const namespace = EXTERNAL_INSTALLER_BRIDGE_SCHEMA
const signature = (name: string) => `${namespace}.${name}()`
const literal = (value: string) => `'${value.replaceAll("'", "''")}'`
const array = (values: readonly string[] | null) => values === null ? 'NULL::text[]'
  : `ARRAY[${values.map(literal).join(',')}]::text[]`
const digest = (value: string) => createHash('sha256').update(value).digest('hex')

/** Compare actual catalog facts to compiled source, never to a live-derived
 * desired definition. Built-in SHA-256 avoids an extension prerequisite. */
function functionMatches(fn: CurrentFunctionDescriptor): string {
  const acl = fn.executeAcl.map(grant => `${grant.role}:${grant.grantable}`).sort()
  return `EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=to_regprocedure(${literal(fn.signature)})
      AND n.nspname=${literal(fn.schema)} AND p.proname=${literal(fn.name)} AND p.prokind='f'
      AND pg_get_userbyid(p.proowner)=${literal(fn.owner)} AND l.lanname=${literal(fn.language)}
      AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=${literal(fn.bodyDigest)}
      AND p.provolatile=${literal(fn.volatility)} AND p.prosecdef=${fn.definer}
      AND p.proisstrict=${fn.strict} AND p.proleakproof=${fn.leakproof}
      AND format_type(p.prorettype,NULL)=${literal(fn.returns)} AND p.proretset=${fn.returnsSet}
      AND p.proargnames IS NOT DISTINCT FROM ${array(fn.argumentNames)}
      AND p.proargmodes::text[] IS NOT DISTINCT FROM ${array(fn.argumentModes)}
      AND ARRAY(SELECT format_type(t,NULL) FROM unnest(COALESCE(p.proallargtypes,p.proargtypes::oid[])) t)=${array(fn.allArgumentTypes)}
      AND p.pronargdefaults=${fn.defaultCount}
      AND pg_get_expr(p.proargdefaults,0) IS NOT DISTINCT FROM ${fn.defaults === null ? 'NULL::text' : literal(fn.defaults)}
      AND p.proconfig IS NOT DISTINCT FROM ${array(fn.config)}
      AND ARRAY(SELECT COALESCE(r.rolname,'PUBLIC')||':'||a.is_grantable::text
        FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee
        WHERE a.privilege_type='EXECUTE' ORDER BY COALESCE(r.rolname,'PUBLIC')||':'||a.is_grantable::text)=${array(acl)})`
}

const installerAdmission = `IF session_user<>${literal(EXTERNAL_INSTALLER_LOGIN)} OR NOT EXISTS(
  SELECT FROM pg_roles WHERE rolname=session_user AND rolcanlogin AND NOT
    (rolsuper OR rolinherit OR rolcreaterole OR rolcreatedb OR rolbypassrls))
  OR (SELECT count(*) FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=session_user)<>1
  OR NOT EXISTS(SELECT FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member
    JOIN pg_roles target ON target.oid=m.roleid WHERE member.rolname=session_user AND target.rolname='ue_v2_owner'
      AND NOT m.admin_option AND NOT COALESCE((to_jsonb(m)->>'inherit_option')::boolean,member.rolinherit)
      AND COALESCE((to_jsonb(m)->>'set_option')::boolean,true))
  THEN RAISE EXCEPTION 'EXTERNAL_INSTALLER_LOGIN_REQUIRED' USING ERRCODE='42501'; END IF;`

export async function compileExternalReadInstallerBridge(databaseName: string) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(databaseName)) throw new Error('External installer database binding is invalid')
  const preparation = compileExternalReadRolePreparationSql({ rolesPreprovisioned: true })
  const installation = compileExternalReadSql({ rolesPreprovisioned: true })
  const authBridge = compileExternalAuthBridgeSql({ rolesPreprovisioned: true })
  const finalization = compileExternalReadRoleFinalizationSql()
  const approvedPrerequisites = ['public.ue_case_domain_authorized(uuid,uuid,text)',
    'user_management.auth_business_org_authorized(uuid,text[])', 'user_management.ue_authority_membership_rows(uuid,text[])']
  if (JSON.stringify([...EXTERNAL_READ_PREREQUISITE_FUNCTIONS].sort()) !== JSON.stringify(approvedPrerequisites.sort()))
    throw new Error('External installer prerequisite source differs')
  const foundation = [compileAuthBootstrapSql({ rolesPreprovisioned: true }), compileAuthorityMembershipReaderSql(), compileCaseDomainSupportSql()]
  const before = await projectCurrentCompilerSecurity(foundation)
  const after = await projectCurrentCompilerSecurity([...foundation, preparation, installation, authBridge, finalization])
  const prerequisiteNames = new Set(EXTERNAL_READ_PREREQUISITE_FUNCTIONS.map(value => value.split('(')[0]))
  const beforePredicates = before.functions.filter(fn => prerequisiteNames.has(`${fn.schema}.${fn.name}`))
  const expectedNames = new Set(EXTERNAL_READ_FUNCTIONS.map(fn => `public.${fn.name}`))
  const authName = `${EXTERNAL_AUTHORIZER_LIVE_FUNCTION.schema}.${EXTERNAL_AUTHORIZER_LIVE_FUNCTION.name}`
  const externalPublicNames = [...EXTERNAL_READ_FUNCTIONS.map(fn => fn.name), EXTERNAL_AUTHORIZER_LIVE_FUNCTION.name]
  const finalFunctions = after.functions.filter(fn => prerequisiteNames.has(`${fn.schema}.${fn.name}`) || expectedNames.has(`${fn.schema}.${fn.name}`) || `${fn.schema}.${fn.name}` === authName)
  if (beforePredicates.length !== 3 || finalFunctions.length !== expectedNames.size + 4)
    throw new Error('External installer source function census differs')
  const sourceDigest = digest(JSON.stringify({ databaseName, preparation, installation, authBridge, finalization, beforePredicates, finalFunctions }))
  const context = `${installerAdmission}
    IF current_database()<>${literal(databaseName)} OR current_user<>${literal(trustedOwner)}
      OR NOT EXISTS(SELECT FROM pg_database WHERE datname=current_database()
        AND datdba=(SELECT oid FROM pg_roles WHERE rolname='ue_v2_owner'))
      OR NOT EXISTS(SELECT FROM pg_roles WHERE rolname='ue_v2_owner' AND rolinherit
        AND NOT(rolsuper OR rolbypassrls OR rolcanlogin OR rolcreaterole OR rolcreatedb))
      THEN RAISE EXCEPTION 'EXTERNAL_INSTALLER_SOURCE_CONTEXT_REQUIRED' USING ERRCODE='42501'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('ue.external-installer:'||current_database(),0));`
  const prepareBody = `BEGIN
    ${context}
    IF EXISTS(SELECT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname IN(${externalPublicNames.map(literal).join(',')}))
      OR NOT (${beforePredicates.map(functionMatches).join(' AND ')})
      OR EXISTS(SELECT FROM unnest(${array(EXTERNAL_READ_STORAGE_TABLES)}) expected(name)
        LEFT JOIN pg_namespace n ON n.nspname='public' LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=expected.name
        WHERE c.oid IS NULL OR c.relkind<>'r' OR NOT c.relrowsecurity OR NOT c.relforcerowsecurity
          OR pg_get_userbyid(c.relowner)<>'ue_v2_owner')
      THEN RAISE EXCEPTION 'EXTERNAL_INSTALLER_PREIMAGE_REQUIRED' USING ERRCODE='42501'; END IF;
    ${preparation}
  END`
  const finalizeBody = `BEGIN
    ${context}
    IF NOT (${finalFunctions.map(functionMatches).join(' AND ')})
      OR (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='public' AND (p.proname IN(${EXTERNAL_READ_FUNCTIONS.map(fn => literal(fn.name)).join(',')})
          OR p.proowner=(SELECT oid FROM pg_roles WHERE rolname=${literal(EXTERNAL_READ_OWNER)})))<>${expectedNames.size}
      OR (SELECT count(*) FROM pg_auth_members m JOIN pg_roles r ON r.oid IN(m.roleid,m.member)
        WHERE r.rolname=${literal(EXTERNAL_READ_OWNER)})<>1
      OR NOT EXISTS(SELECT FROM pg_auth_members m JOIN pg_roles granted ON granted.oid=m.roleid
        JOIN pg_roles member ON member.oid=m.member WHERE granted.rolname=${literal(EXTERNAL_READ_OWNER)}
          AND member.rolname='ue_v2_owner' AND NOT m.admin_option AND COALESCE((to_jsonb(m)->>'set_option')::boolean,true)
          AND NOT COALESCE((to_jsonb(m)->>'inherit_option')::boolean,false))
      THEN RAISE EXCEPTION 'EXTERNAL_INSTALLER_FINAL_SOURCE_REQUIRED' USING ERRCODE='42501'; END IF;
    ${finalization}
    REVOKE ALL ON FUNCTION ${signature(finalizeName)} FROM PUBLIC,${EXTERNAL_INSTALLER_LOGIN};
    DROP FUNCTION ${signature(prepareName)};
    ALTER FUNCTION ${signature(finalizeName)} OWNER TO ue_v2_owner;
    ALTER SCHEMA ${namespace} OWNER TO ue_v2_owner;
  END`
  if ([prepareBody, finalizeBody].some(body => body.includes('$ue_external_bridge$')))
    throw new Error('External installer source delimiter collision')
  const provisionSql = `DO $ue_external_bridge_provision$ BEGIN
    IF current_user<>session_user OR current_user<>${literal(trustedOwner)}
      OR NOT EXISTS(SELECT FROM pg_roles WHERE rolname=session_user AND rolsuper)
      OR current_database()<>${literal(databaseName)} OR to_regnamespace(${literal(namespace)}) IS NOT NULL
      OR NOT EXISTS(SELECT FROM pg_database WHERE datname=current_database()
        AND datdba=(SELECT oid FROM pg_roles WHERE rolname='ue_v2_owner'))
      OR NOT EXISTS(SELECT FROM pg_roles WHERE rolname=${literal(EXTERNAL_READ_OWNER)}
        AND NOT(rolsuper OR rolinherit OR rolcreaterole OR rolcreatedb OR rolcanlogin OR rolbypassrls))
      OR EXISTS(SELECT FROM pg_auth_members m JOIN pg_roles r ON r.oid IN(m.roleid,m.member) WHERE r.rolname=${literal(EXTERNAL_READ_OWNER)})
      OR EXISTS(SELECT FROM pg_namespace n WHERE n.nspname IN('public','user_management')
        AND has_schema_privilege(${literal(EXTERNAL_READ_OWNER)},n.oid,'CREATE'))
      THEN RAISE EXCEPTION 'EXTERNAL_INSTALLER_TRUSTED_PROVISION_REQUIRED' USING ERRCODE='42501'; END IF;
    END $ue_external_bridge_provision$;
    CREATE SCHEMA ${namespace} AUTHORIZATION ${trustedOwner};
    GRANT USAGE ON SCHEMA ${namespace} TO ${EXTERNAL_INSTALLER_LOGIN};
    CREATE FUNCTION ${signature(prepareName)} RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER
      SET search_path=pg_catalog AS $ue_external_bridge$${prepareBody}$ue_external_bridge$;
    CREATE FUNCTION ${signature(finalizeName)} RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER
      SET search_path=pg_catalog AS $ue_external_bridge$${finalizeBody}$ue_external_bridge$;
    REVOKE ALL ON FUNCTION ${signature(prepareName)},${signature(finalizeName)} FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION ${signature(prepareName)},${signature(finalizeName)} TO ${EXTERNAL_INSTALLER_LOGIN};`
  const helpers = (await projectCurrentCompilerSecurity([provisionSql], trustedOwner)).functions
  if (helpers.length !== 2) throw new Error('External installer trusted helper source differs')
  return { databaseName, sourceDigest, provisionSql, helpers, sourceFunctions: finalFunctions,
    prepareSql: `SELECT ${signature(prepareName)};`, finalizeSql: `SELECT ${signature(finalizeName)};`,
    cleanupSql: `DROP FUNCTION ${signature(finalizeName)}; DROP SCHEMA ${namespace};` }
}

export const EXTERNAL_INSTALLER_BRIDGE_QUERY = `SELECT n.nspname AS schema,p.proname AS name,
  n.nspname||'.'||p.proname||'()' AS signature,pg_get_userbyid(p.proowner) AS owner,p.prosrc AS body,
  l.lanname AS language,p.provolatile AS volatility,p.prosecdef AS definer,p.proisstrict AS strict,p.proleakproof AS leakproof,
  format_type(p.prorettype,NULL) AS returns,p.proretset AS "returnsSet",p.proargnames AS "argumentNames",p.proargmodes::text[] AS "argumentModes",
  ARRAY(SELECT format_type(t,NULL) FROM unnest(COALESCE(p.proallargtypes,p.proargtypes::oid[])) t) AS "allArgumentTypes",
  p.pronargdefaults AS "defaultCount",pg_get_expr(p.proargdefaults,0) AS defaults,p.proconfig AS config,
  (SELECT jsonb_agg(jsonb_build_object('role',COALESCE(r.rolname,'PUBLIC'),'grantable',a.is_grantable))
    FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee
    WHERE a.privilege_type='EXECUTE') AS "executeAcl"
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang
  WHERE n.nspname='${namespace}' ORDER BY p.proname,p.oid`

export async function assertExternalReadInstallerBridge(
  program: Awaited<ReturnType<typeof compileExternalReadInstallerBridge>>,
  execute: (sql: string) => Promise<Record<string, unknown>[]>,
) {
  const actual = await execute(EXTERNAL_INSTALLER_BRIDGE_QUERY)
  const failures = currentFunctionViolations(program.helpers, actual)
  const schemas = await execute(`SELECT pg_get_userbyid(n.nspowner) AS owner,
    (SELECT count(*)::integer FROM pg_class c WHERE c.relnamespace=n.oid) AS relations,
    (SELECT count(*)::integer FROM pg_type t WHERE t.typnamespace=n.oid) AS types,
    ARRAY(SELECT COALESCE(r.rolname,'PUBLIC')||':'||a.privilege_type||':'||a.is_grantable::text
      FROM aclexplode(COALESCE(n.nspacl,acldefault('n',n.nspowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee
      WHERE a.grantee<>n.nspowner ORDER BY 1) AS grants
    FROM pg_namespace n WHERE n.nspname=${literal(namespace)}`)
  if (schemas.length !== 1 || schemas[0].owner !== trustedOwner || schemas[0].relations !== 0 || schemas[0].types !== 0
    || JSON.stringify(schemas[0].grants) !== JSON.stringify([`${EXTERNAL_INSTALLER_LOGIN}:USAGE:false`]))
    failures.push('Trusted installer helper namespace differs')
  if (actual.length !== 2 || failures.length) throw new Error('External installer trusted helper catalog differs: ' + failures.join('; '))
}
