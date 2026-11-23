import { UserRole } from '../auth/roles'

/** Eligibility for the staff case surface; every record/action still requires
 * live case authority. Seniority and platform titles confer no case access. */
export const CASE_HANDLER_ROLES: readonly UserRole[] = [
  UserRole.STEWARD,
  UserRole.CHIEF_STEWARD,
  UserRole.OFFICER,
  UserRole.PRESIDENT,
  UserRole.VICE_PRESIDENT,
  UserRole.SECRETARY_TREASURER,
  UserRole.HEALTH_SAFETY_REP,
  UserRole.BARGAINING_COMMITTEE,
]

export function isCaseHandlerRole(role: string): boolean {
  return (CASE_HANDLER_ROLES as readonly string[]).includes(role)
}
