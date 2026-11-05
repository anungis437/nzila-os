import { getRoleLevel, UserRole } from './roles'

/**
 * Organization-level configuration (org settings, data-sharing consent, sharing settings, billing,
 * integrations) is for organization administrators. This is the same threshold as the existing
 * PUT /api/settings/organization gate (`minRole: 'admin'`). Everyone else manages only their own
 * profile and preferences. Unknown or missing roles never qualify.
 */
export function canManageOrganizationSettings(role: string | null | undefined): boolean {
  if (!role) return false
  return getRoleLevel(role as UserRole) >= getRoleLevel(UserRole.ADMIN)
}
