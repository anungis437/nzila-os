import pg from 'pg'
import { AUTH_EXECUTION_ROLES, AUTH_ROLE_MEMBERSHIP_EXPECTATIONS } from './auth-sql'
import { CANONICAL_BOOTSTRAP_ROLES, INSTALLER_FUNCTION_OWNER_ROLES } from './execution-roles'
import { FRAMEWORK_MEMBERSHIPS, FRAMEWORK_ROLES } from './framework-contract'
import { quote } from './source'
import { compileRolePrerequisiteAssertions } from '../../../../packages/db/src/auth-storage-authority/role-prerequisites'

export { INSTALLER_FUNCTION_OWNER_ROLES } from './execution-roles'

export const VECTOR_FUNCTION_ACL_SQL = `DO $ue_v2$ DECLARE entry record; BEGIN
      FOR entry IN SELECT p.oid::regprocedure::text AS signature FROM pg_proc p
        JOIN pg_depend d ON d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e'
        JOIN pg_extension e ON e.oid=d.refobjid WHERE e.extname='vector' AND p.prokind IN ('f','a')
      LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',entry.signature);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO union_eyes_runtime,union_eyes_system',entry.signature);
      END LOOP; END $ue_v2$`

export function compileMinimumRoleProvisioningSql(): string {
  const dedicated: readonly string[] = [
    ...Object.values(AUTH_EXECUTION_ROLES),
    ...Object.values(FRAMEWORK_ROLES),
  ]
  return [
    ...CANONICAL_BOOTSTRAP_ROLES.map(
      (role) =>
        `CREATE ROLE ${quote(role)} NOLOGIN ${dedicated.includes(role) ? 'NOINHERIT' : 'INHERIT'} NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;`,
    ),
    ...Object.entries({
      ...AUTH_ROLE_MEMBERSHIP_EXPECTATIONS,
      ...FRAMEWORK_MEMBERSHIPS,
    }).map(
      ([member, targets]) =>
        `GRANT ${targets.map(quote).join(',')} TO ${quote(member)} WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;`,
    ),
    `GRANT ${INSTALLER_FUNCTION_OWNER_ROLES.map(quote).join(',')} TO ue_v2_owner WITH ADMIN FALSE, INHERIT TRUE, SET TRUE;`,
  ].join('\n')
}

export async function assertMinimumInstaller(client: pg.Client): Promise<void> {
  await client.query(
    compileRolePrerequisiteAssertions(
      Object.values(AUTH_EXECUTION_ROLES),
      AUTH_ROLE_MEMBERSHIP_EXPECTATIONS,
    ),
  )
  await client.query(
    compileRolePrerequisiteAssertions(Object.values(FRAMEWORK_ROLES), FRAMEWORK_MEMBERSHIPS),
  )
  await client.query(`DO $minimum_installer$ BEGIN
    IF current_user NOT IN (session_user,'ue_v2_owner') OR session_user<>'ue_v2_fixture_installer' OR NOT EXISTS (
      SELECT FROM pg_roles WHERE rolname=session_user AND rolcanlogin AND NOT
        (rolsuper OR rolbypassrls OR rolinherit OR rolcreatedb OR rolcreaterole)
    ) THEN RAISE EXCEPTION 'UE_V2_GENUINE_RESTRICTED_INSTALLER_LOGIN_REQUIRED'; END IF;
    IF (SELECT count(*) FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member
      WHERE r.rolname=session_user)<>1 OR NOT EXISTS (
      SELECT FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member
        JOIN pg_roles target ON target.oid=m.roleid
      WHERE member.rolname=session_user AND target.rolname='ue_v2_owner'
        AND NOT m.admin_option AND NOT m.inherit_option AND m.set_option
    ) THEN RAISE EXCEPTION 'UE_V2_INSTALLER_LOGIN_MEMBERSHIP_DRIFT'; END IF;
    IF (SELECT count(*) FROM pg_roles WHERE rolname IN
      ('ue_v2_owner','union_eyes_runtime','union_eyes_system') AND NOT
      (rolsuper OR rolbypassrls OR rolcanlogin OR rolcreatedb OR rolcreaterole))<>3 OR
      NOT EXISTS (SELECT FROM pg_database WHERE datname=current_database()
        AND datdba=(SELECT oid FROM pg_roles WHERE rolname='ue_v2_owner')) THEN
      RAISE EXCEPTION 'UE_V2_INSTALLER_OWNER_PREREQUISITE_DRIFT';
    END IF;
    IF (SELECT count(*) FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member
      WHERE member.rolname='ue_v2_owner')<>${INSTALLER_FUNCTION_OWNER_ROLES.length} OR
      (SELECT count(DISTINCT m.roleid) FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member
        WHERE member.rolname='ue_v2_owner')<>${INSTALLER_FUNCTION_OWNER_ROLES.length} OR EXISTS (
      SELECT FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member
        JOIN pg_roles target ON target.oid=m.roleid
      WHERE member.rolname='ue_v2_owner' AND (target.rolname NOT IN
        (${INSTALLER_FUNCTION_OWNER_ROLES.map((role) => `'${role}'`).join(',')})
        OR m.admin_option OR NOT m.inherit_option OR NOT m.set_option)
    ) THEN RAISE EXCEPTION 'UE_V2_INSTALLER_FUNCTION_OWNER_DELEGATION_DRIFT'; END IF;
    IF EXISTS (SELECT FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member
      WHERE member.rolname IN ('union_eyes_runtime','union_eyes_system')) THEN
      RAISE EXCEPTION 'UE_V2_INSTALLER_APPLICATION_MEMBERSHIP_DRIFT';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
      JOIN pg_roles owner ON owner.oid=e.extowner
      WHERE e.extname='vector' AND e.extversion='0.8.1' AND n.nspname='public'
        AND owner.rolname='postgres') THEN
      RAISE EXCEPTION 'UE_V2_OPERATOR_PREPROVISIONED_VECTOR_REQUIRED';
    END IF;
  END $minimum_installer$`)
}

export async function inspectVectorObjectIds(client: pg.Client): Promise<Set<string>> {
  const result = await client.query<{ kind: string; id: string }>(`
    WITH owned AS (
      SELECT d.classid,d.objid FROM pg_depend d JOIN pg_extension e ON e.oid=d.refobjid
      WHERE d.refclassid='pg_extension'::regclass AND d.deptype='e' AND e.extname='vector'
    )
    SELECT 'function' AS kind,p.oid::regprocedure::text AS id FROM pg_proc p
      JOIN owned o ON o.classid='pg_proc'::regclass AND o.objid=p.oid WHERE p.prokind IN ('f','p')
    UNION ALL SELECT 'aggregate',p.oid::regprocedure::text FROM pg_proc p
      JOIN owned o ON o.classid='pg_proc'::regclass AND o.objid=p.oid WHERE p.prokind='a'
    UNION ALL SELECT 'operator',n.nspname||'.'||p.oprname||'('||
      CASE WHEN p.oprleft=0 THEN 'NONE' ELSE format_type(p.oprleft,NULL) END||','||
      format_type(p.oprright,NULL)||')' FROM pg_operator p JOIN pg_namespace n ON n.oid=p.oprnamespace
      JOIN owned o ON o.classid='pg_operator'::regclass AND o.objid=p.oid
    UNION ALL SELECT 'type',n.nspname||'.'||t.typname FROM pg_type t
      JOIN pg_namespace n ON n.oid=t.typnamespace WHERE EXISTS (
        SELECT FROM owned o WHERE o.classid='pg_type'::regclass AND (o.objid=t.oid OR o.objid=t.typelem)
      )
    UNION ALL SELECT 'operator_class',n.nspname||'.'||c.opcname||' USING '||a.amname
      FROM pg_opclass c JOIN pg_namespace n ON n.oid=c.opcnamespace JOIN pg_am a ON a.oid=c.opcmethod
      JOIN owned o ON o.classid='pg_opclass'::regclass AND o.objid=c.oid
    UNION ALL SELECT 'operator_family',n.nspname||'.'||f.opfname||' USING '||a.amname
      FROM pg_opfamily f JOIN pg_namespace n ON n.oid=f.opfnamespace JOIN pg_am a ON a.oid=f.opfmethod
      JOIN owned o ON o.classid='pg_opfamily'::regclass AND o.objid=f.oid
    UNION ALL SELECT 'cast',format_type(c.castsource,NULL)||' AS '||format_type(c.casttarget,NULL)
      FROM pg_cast c JOIN owned o ON o.classid='pg_cast'::regclass AND o.objid=c.oid
    UNION ALL SELECT 'access_method',a.amname FROM pg_am a
      JOIN owned o ON o.classid='pg_am'::regclass AND o.objid=a.oid
  `)
  return new Set(result.rows.map((row) => `${row.kind}:${row.id}`))
}
