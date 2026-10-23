import { getUserRoleInOrganization } from '@/lib/organization-utils'
import { caseActionAllowed, casePolicyRole } from './case-permissions'
import { creatorRetainsAccess } from './creator-access'

const PLATFORM_ADMINISTRATOR_ROLES = new Set(['app_owner', 'system_admin', 'platform_lead'])

/**
 * Whether a membership role carries supervisory case-read authority (case_read_any).
 * An ordinary steward does not: stewards reach case records only through assignment,
 * ownership or an explicit grant. Unknown roles never acquire authority.
 */
export function roleHasSupervisoryCaseRead(role: string | null | undefined): boolean {
  if (!role) return false
  const policyRole = casePolicyRole(role, PLATFORM_ADMINISTRATOR_ROLES.has(role))
  return !!policyRole && caseActionAllowed('case_read_any', policyRole)
}

/** Resolves the caller's role in the verified organization, never from client input or a global role. */
export async function hasSupervisoryCaseRead(organizationId: string, userId: string): Promise<boolean> {
  return roleHasSupervisoryCaseRead(await getUserRoleInOrganization(userId, organizationId))
}

/** Whether the caller holds a staff-level (representative) mandate in the verified organization. */
export async function isRepresentativeInOrganization(organizationId: string, userId: string): Promise<boolean> {
  const role = await getUserRoleInOrganization(userId, organizationId)
  const policyRole = role ? casePolicyRole(role, PLATFORM_ADMINISTRATOR_ROLES.has(role)) : null
  return !!policyRole && caseActionAllowed('note_add_internal', policyRole)
}

/** Creation grants a view of one's own matter, but ends for a representative once the matter is reassigned. */
export async function creatorAccessApplies(
  organizationId: string,
  userId: string,
  grievance: { createdBy: string | null; unionRepId?: string | null },
): Promise<boolean> {
  if (!grievance.createdBy || grievance.createdBy !== userId) return false
  return creatorRetainsAccess({
    createdBy: grievance.createdBy,
    userId,
    unionRepId: grievance.unionRepId,
    callerIsRepresentative: await isRepresentativeInOrganization(organizationId, userId),
  })
}
