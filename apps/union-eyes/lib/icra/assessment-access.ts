/**
 * Who may act on an ICRA assessment.
 *
 * An unclaimed assessment is pseudonymous: its bearer capability (the cookie or fragment token issued at start) is the whole credential,
 * as before. A claimed assessment belongs to an organization, and from the moment of the claim the capability is NOT accepted for it,
 * even if a hash were still stored: the holder of an old link is not the owner. Access then needs an authenticated account that is
 *   - the account that claimed it, still an active member of the claiming organization, or
 *   - an administrator of the claiming organization.
 * A plain member of that organization who did not claim it is refused, a member of another organization is refused, and an
 * organization the account merely has selected is irrelevant: the membership that counts is the claiming organization's.
 *
 * Every route that used checkCapability goes through this one gate so the rule cannot drift between them. It fails closed: a claimed
 * row without a claiming organization is refused to everyone.
 */
import { checkCapability, extractCapabilityToken, type CapabilityDenialReason } from './assessment-capability'

export interface AssessmentAccessRow {
  capabilityTokenHash: string | null
  capabilityTokenExpiresAt: Date | null
  claimedAt: Date | null
  claimedOrgId: string | null
  claimedByUserId: string | null
}

export type AssessmentAccess =
  | { ok: true; via: 'capability' }
  | { ok: true; via: 'owner'; userId: string; organizationId: string }
  | { ok: false; reason: CapabilityDenialReason }

export interface AccessDeps {
  currentUserId(): Promise<string | null>
  hasRole(organizationId: string, role: 'member' | 'admin', userId: string): Promise<boolean>
}

const defaultDeps: AccessDeps = {
  async currentUserId() {
    const { auth } = await import('@nzila/platform-auth/entra/server')
    return (await auth()).userId ?? null
  },
  async hasRole(organizationId, role, userId) {
    const { hasRoleInOrganization } = await import('@/lib/api-auth-guard')
    return hasRoleInOrganization(organizationId, role, userId)
  },
}

export const isAssessmentClaimed = (row: Pick<AssessmentAccessRow, 'claimedAt' | 'claimedOrgId' | 'claimedByUserId'>): boolean =>
  Boolean(row.claimedAt || row.claimedOrgId || row.claimedByUserId)

export async function authorizeAssessmentAccess(
  request: Request,
  assessmentId: string,
  row: AssessmentAccessRow | undefined,
  deps: AccessDeps = defaultDeps,
): Promise<AssessmentAccess> {
  return authorizeAssessmentToken(extractCapabilityToken(request, assessmentId), row, deps)
}

/** Same rule for server actions and pages that resolve the capability themselves (cookie) rather than from a Request. */
export async function authorizeAssessmentToken(
  presentedCapability: string | null,
  row: AssessmentAccessRow | undefined,
  deps: AccessDeps = defaultDeps,
): Promise<AssessmentAccess> {
  if (!row) return { ok: false, reason: 'not_found' }

  if (!isAssessmentClaimed(row)) {
    const check = checkCapability(presentedCapability, row)
    return check.ok ? { ok: true, via: 'capability' } : { ok: false, reason: check.reason }
  }

  const userId = await deps.currentUserId()
  if (!userId) return { ok: false, reason: 'authentication_required' }
  if (!row.claimedOrgId) return { ok: false, reason: 'not_owner' }

  const claimedBySelf = row.claimedByUserId === userId
  const allowed = claimedBySelf
    ? await deps.hasRole(row.claimedOrgId, 'member', userId)
    : await deps.hasRole(row.claimedOrgId, 'admin', userId)
  return allowed ? { ok: true, via: 'owner', userId, organizationId: row.claimedOrgId } : { ok: false, reason: 'not_owner' }
}