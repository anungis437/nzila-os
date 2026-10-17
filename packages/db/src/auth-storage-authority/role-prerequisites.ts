export function compileRolePrerequisiteAssertions(
  roles: readonly string[],
  memberships: Readonly<Record<string, readonly string[]>>,
): string {
  if (
    !roles.length ||
    new Set(roles).size !== roles.length ||
    roles.some((role) => !/^[a-z][a-z0-9_]{0,62}$/.test(role)) ||
    Object.entries(memberships).some(
      ([member, targets]) =>
        !roles.includes(member) ||
        new Set(targets).size !== targets.length ||
        targets.some((target) => !roles.includes(target)),
    )
  )
    throw new Error('CANONICAL_ROLE_PREREQUISITE_CONTRACT_INVALID')
  const names = roles.map((role) => `'${role}'`).join(',')
  const expected = Object.entries(memberships).flatMap(([member, targets]) =>
    targets.map((target) => `('${member}','${target}')`),
  )
  const expectedRows = expected.length
    ? `VALUES ${expected.join(',')}`
    : 'SELECT NULL::text,NULL::text WHERE false'
  return `DO $role_prerequisite$ BEGIN
    IF (SELECT count(*) FROM pg_roles WHERE rolname IN (${names}))<>${roles.length} THEN
      RAISE EXCEPTION 'CANONICAL_PREPROVISIONED_ROLE_MISSING';
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname IN (${names}) AND
      (rolsuper OR rolbypassrls OR rolcanlogin OR rolinherit OR rolcreatedb OR rolcreaterole)) THEN
      RAISE EXCEPTION 'CANONICAL_PREPROVISIONED_ROLE_UNSAFE';
    END IF;
    IF EXISTS (
      WITH expected(member,target) AS (${expectedRows}),
      actual AS (
        SELECT member.rolname AS member,target.rolname AS target,m.admin_option,m.inherit_option,m.set_option
        FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member
          JOIN pg_roles target ON target.oid=m.roleid WHERE member.rolname IN (${names})
      )
      SELECT FROM expected FULL JOIN actual USING(member,target)
        WHERE expected.member IS NULL OR actual.member IS NULL OR
          actual.admin_option OR actual.inherit_option OR NOT actual.set_option
    ) THEN
      RAISE EXCEPTION 'CANONICAL_PREPROVISIONED_MEMBERSHIP_DRIFT';
    END IF;
    IF (SELECT count(*) FROM pg_auth_members m JOIN pg_roles member ON member.oid=m.member
      WHERE member.rolname IN (${names}))<>${expected.length} THEN
      RAISE EXCEPTION 'CANONICAL_PREPROVISIONED_MEMBERSHIP_DRIFT';
    END IF;
  END $role_prerequisite$;`
}
