/** Explicit projections for the two PostgreSQL majors in native acceptance. */
export type CanonicalPostgresMajor = 15 | 16

export function canonicalPostgresMajor(serverVersionNum: unknown): CanonicalPostgresMajor {
  const value =
    typeof serverVersionNum === 'number'
      ? serverVersionNum
      : typeof serverVersionNum === 'string' && /^\d+$/.test(serverVersionNum)
        ? Number(serverVersionNum)
        : NaN
  if (!Number.isSafeInteger(value)) throw new Error('CANONICAL_POSTGRES_VERSION_REQUIRED')
  const major = Math.floor(value / 10000)
  if (major !== 15 && major !== 16) throw new Error('CANONICAL_POSTGRES_VERSION_UNSUPPORTED')
  return major
}

function identifier(value: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(value)) throw new Error('CANONICAL_ROLE_IDENTIFIER_INVALID')
  return value
}

function majorVersion(major: CanonicalPostgresMajor): void {
  if (major !== 15 && major !== 16) throw new Error('CANONICAL_POSTGRES_VERSION_UNSUPPORTED')
}

/**
 * PG15 derives inheritance from the member role and permits SET on every
 * membership. PG16 stores these options on each edge. Do not use this projection
 * to accept an unrepresentable PG15 graph: the independently expected edge
 * values and role flags still have to match, including all transitive edges.
 */
export function membershipCatalogProjectionSql(
  major: CanonicalPostgresMajor = 16,
  aliases: { membershipAlias?: string; memberAlias?: string } = {},
) {
  majorVersion(major)
  const membership = identifier(aliases.membershipAlias ?? 'm')
  const member = identifier(aliases.memberAlias ?? 'member')
  return {
    adminOption: `${membership}.admin_option`,
    inheritOption: major === 15 ? `${member}.rolinherit` : `${membership}.inherit_option`,
    setOption:
      major === 15
        ? "CASE WHEN current_setting('server_version_num')::integer BETWEEN 150000 AND 159999 THEN true ELSE NULL END"
        : `${membership}.set_option`,
  }
}

/** Same canonical ADMIN=false contract; no role attributes are changed here. */
export function compileCanonicalMembershipGrant(
  member: string,
  targets: readonly string[],
  options: { inherit: boolean; set: boolean; memberRoleInherit?: boolean },
  major: CanonicalPostgresMajor = 16,
): string {
  majorVersion(major)
  identifier(member)
  if (!targets.length || new Set(targets).size !== targets.length)
    throw new Error('CANONICAL_ROLE_TARGETS_INVALID')
  targets.forEach(identifier)
  if (typeof options.inherit !== 'boolean' || typeof options.set !== 'boolean')
    throw new Error('CANONICAL_ROLE_OPTIONS_INVALID')
  if (major === 15 && (!options.set || options.memberRoleInherit !== options.inherit))
    throw new Error('CANONICAL_PG15_MEMBERSHIP_NOT_REPRESENTABLE')
  const quote = (value: string) => `"${value}"`
  const roles = targets.map(quote).join(',')
  if (major === 15) {
    // A repeated GRANT without ADMIN OPTION does not remove a former option.
    // RESTRICT is intentional: dependent grants must fail, never be cascaded.
    return `GRANT ${roles} TO ${quote(member)}; REVOKE ADMIN OPTION FOR ${roles} FROM ${quote(member)} RESTRICT;`
  }
  return `GRANT ${roles} TO ${quote(member)} WITH ADMIN FALSE, INHERIT ${options.inherit ? 'TRUE' : 'FALSE'}, SET ${options.set ? 'TRUE' : 'FALSE'};`
}
