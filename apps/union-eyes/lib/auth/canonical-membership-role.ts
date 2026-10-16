import { AuthOrgBindingError } from '@nzila/platform-auth/org-binding'
import { getRoleLevel, UserRole } from './roles'
import { resolvePlatformOrgRole } from './platform-org-role'

export function canonicalMembershipRole(role: string, isSystemAdmin: boolean): UserRole {
  if (isSystemAdmin === true) return UserRole.APP_OWNER
  const resolved =
    resolvePlatformOrgRole(role) ?? Object.values(UserRole).find((candidate) => candidate === role)
  if (!resolved || getRoleLevel(resolved) >= getRoleLevel(UserRole.SYSTEM_ADMIN))
    throw new AuthOrgBindingError('ROLE_REQUIRED')
  return resolved
}
