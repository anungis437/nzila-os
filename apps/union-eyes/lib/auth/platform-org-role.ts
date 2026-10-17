import { UserRole } from './roles'

export function resolvePlatformOrgRole(raw: string | null | undefined): UserRole | null {
  if (!raw) return null
  const key = raw.toLowerCase()
  const directMap: Record<string, UserRole> = {
    admin: UserRole.ADMIN,
    system_admin: UserRole.SYSTEM_ADMIN,
    app_owner: UserRole.APP_OWNER,
    platform_lead: UserRole.PLATFORM_LEAD,
    steward: UserRole.STEWARD,
    chief_steward: UserRole.CHIEF_STEWARD,
    member: UserRole.MEMBER,
    officer: UserRole.OFFICER,
    clerk: UserRole.CLERK,
    president: UserRole.PRESIDENT,
    vice_president: UserRole.VICE_PRESIDENT,
    secretary_treasurer: UserRole.SECRETARY_TREASURER,
    bargaining_committee: UserRole.BARGAINING_COMMITTEE,
    health_safety_rep: UserRole.HEALTH_SAFETY_REP,
  }
  if (directMap[key]) return directMap[key]
  if (key === 'executive' || key === 'ceo') return UserRole.PRESIDENT
  if (key === 'compliance_manager') return UserRole.COMPLIANCE_MANAGER
  if (key === 'auditor' || key === 'auditor_readonly') return UserRole.COMPLIANCE_MANAGER
  if (key === 'governance') return UserRole.OFFICER
  if (key === 'support_agent') return UserRole.SUPPORT_AGENT
  if (key === 'staff' || key === 'support_staff') return UserRole.SUPPORT_AGENT
  return null
}
