/**
 * Authority store — membership facts.
 *
 * Provider identity is NOT resolved here. The supported path is owned by the platform auth layer
 * (`resolveExternalAuthIdentity` -> `withAuthenticatedOrgBinding` / `withBearerOrgBinding` in
 * packages/platform-auth, mirrored by backend/auth_core/canonical_context.py): a verified provider
 * claim is mapped through the dedicated provider execution context to ONE internal principal, the
 * organization is selected explicitly against an active membership and a live session, and the
 * result is an authenticated binding. This kernel consumes that binding (see platform-identity.ts);
 * it never reads `platform_identity_bindings` and never binds by email, string equality or at
 * sign-in.
 *
 * What remains here is the membership FACT source: a role maps to eligibility-only capacities, and
 * every row found (including duplicates) is returned so the kernel can fail closed on ambiguity.
 */
import { capacitiesForRole } from '../capacity'
import type { Membership, MembershipStatus } from '../ontology'
import { isPrincipalId, isUuid, type SqlExecutor } from './executor'
import type { MembershipSource } from './facts'

type Row = Record<string, unknown>
function membershipStatus(row: Row): MembershipStatus {
  const lifecycle = String(row.lifecycle_state)
  if (lifecycle === 'suspended') return 'suspended'
  if (lifecycle === 'deprovisioned') return 'revoked'
  if (lifecycle !== 'active' || row.user_active !== true) return 'inactive'
  return row.member_active === true ? 'active' : 'inactive'
}

/**
 * Canonical membership source over user_management.organization_users joined to
 * user_management.users. Returns EVERY row found (including duplicates) so the
 * kernel can fail closed on them. A role maps to eligibility-only capacities.
 */
export const canonicalMembershipSource: MembershipSource = async (exec, organizationId, userIds) => {
  if (!isUuid(organizationId)) return []
  const ids = userIds.filter(isPrincipalId)
  if (ids.length === 0) return []
  const rows = (
    await exec.query<Row>(
      `SELECT m.user_id, m.organization_id::text AS organization_id, m.role, m.is_active AS member_active,
              u.is_active AS user_active, u.lifecycle_state
         FROM user_management.organization_users m
         JOIN user_management.users u ON u.user_id = m.user_id
        WHERE m.organization_id = $1::uuid AND m.user_id = ANY($2::text[])`,
      [organizationId, ids],
    )
  ).rows
  return mapMembershipRows(rows)
}

/** The single mapping from canonical membership/user rows to kernel memberships (shared by every reader path). */
export function mapMembershipRows(rows: readonly Row[]): Membership[] {
  return rows.map(
    (r): Membership => ({
      userId: String(r.user_id),
      organizationId: String(r.organization_id),
      status: membershipStatus(r),
      capacities: capacitiesForRole(r.role as string | null),
      verifiedAt: null,
    }),
  )
}

/**
 * LEGACY-LINEAGE membership source that reads through a SEPARATE, read-only identity executor connected as
 * `union_eyes_system`. Under the deployed v2 topology the legacy system role holds no grant on the identity
 * relations and `membershipSourceViaDefiner` (platform-identity.ts) is the supported path instead.
 *
 * Why it exists: under the legacy lineage the runtime role sees only ITS OWN row of
 * user_management.users / organization_users (self-select RLS), so deciding about ANOTHER principal (an
 * approver, a holder, an assignee) cannot be answered on the runtime connection and fails closed.
 *
 * The reader must be a pool-style executor (each query on its own connection): it is never part of the
 * authority transaction. It only ever runs the fixed canonical SELECT, scoped to the explicit organization.
 */
export function membershipSourceVia(reader: SqlExecutor): MembershipSource {
  return (_transaction, organizationId, userIds) => canonicalMembershipSource(reader, organizationId, userIds)
}
