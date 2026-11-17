import { canonicalTenantPrincipal } from '@/lib/db/canonical-transaction-scope'
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'
import { getActiveTenantDb } from '@/db/tenant-context-storage'
import { decideCase } from '@/lib/authority/store/route-adapter'
import { ApiError } from '@/lib/api/errors'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { canonicalMembershipRole } from '@/lib/auth/canonical-membership-role'
import { TENANT_LOCAL_ROLES, getRoleLevel, UserRole } from '@/lib/auth/roles'

const STAFF = new Set(TENANT_LOCAL_ROLES.filter(role => getRoleLevel(role) >= getRoleLevel(UserRole.STEWARD)))

/** Platform operations titles confer no access to tenant letters. */
export function correspondencePrincipal(organizationId: string, actorUserId?: string) {
  const principal = canonicalTenantPrincipal()
  if (!principal || principal.organizationId !== organizationId || !STAFF.has(canonicalMembershipRole(principal.role,principal.isSystemAdmin === true))
    || (actorUserId && actorUserId !== principal.userId)) throw ApiError.forbidden('A live local staff membership is required.')
  return principal
}

export async function mayReadCorrespondence(tx: RLSTx, row: { organizationId: string; grievanceId: string | null }) {
  if (!currentStateContextEnabled()) return true
  const principal = correspondencePrincipal(row.organizationId)
  if (getActiveTenantDb() !== tx) throw ApiError.forbidden('Tenant transaction required')
  if (!row.grievanceId) return true
  return (await decideCase(tx, { userId: principal.userId, organizationId: row.organizationId,
    caseId: row.grievanceId, action: 'case:read_internal' })).effect === 'allow'
}

export async function requireCorrespondenceWrite(tx: RLSTx, row: { organizationId: string; grievanceId: string | null }, actorUserId: string) {
  if (!currentStateContextEnabled()) return
  const principal = correspondencePrincipal(row.organizationId, actorUserId)
  if (getActiveTenantDb() !== tx) throw ApiError.forbidden('Tenant transaction required')
  if (row.grievanceId && (await decideCase(tx, { userId: principal.userId, organizationId: row.organizationId,
    caseId: row.grievanceId, action: 'case:draft_action' })).effect !== 'allow') throw ApiError.notFound('Correspondence')
}

/** Formal release to a recipient is distinct from drafting, approval or signing. */
export async function requireCorrespondenceDisclosure(tx: RLSTx, row: { organizationId: string; grievanceId: string | null }, actorUserId: string) {
  await requireCorrespondenceWrite(tx, row, actorUserId)
  if (!currentStateContextEnabled() || !row.grievanceId) return
  if ((await decideCase(tx, { userId: actorUserId, organizationId: row.organizationId,
    caseId: row.grievanceId, action: 'case:disclose_to_member' })).effect !== 'allow') throw ApiError.forbidden('Primary case-handler disclosure authority required.')
}
