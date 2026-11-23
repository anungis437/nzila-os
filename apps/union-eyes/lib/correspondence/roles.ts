import { getRoleLevel, TENANT_LOCAL_ROLES, UserRole } from '../auth/roles'

/** Local letter preparation includes Clerk; platform titles confer no access. */
export const CORRESPONDENCE_STAFF_ROLES = TENANT_LOCAL_ROLES.filter(
  role => getRoleLevel(role) >= getRoleLevel(UserRole.STEWARD),
)

export function isCorrespondenceStaffRole(role: string | null | undefined): boolean {
  return CORRESPONDENCE_STAFF_ROLES.some(candidate => candidate === role)
}
