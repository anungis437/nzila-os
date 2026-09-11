import { getUserRoleInOrganization } from '@/lib/organization-utils';

// PR #752 round 8: the institutional topology/chronology/observability
// dashboards are Model A (national/cross-affiliate) surfaces — their
// underlying queries deliberately read across ALL organizations with no
// per-org filter, same shape as app/[locale]/dashboard/clc/staff/page.tsx.
// That is only safe when gated to the same clc_staff/clc_executive/
// system_admin allow-list used by the CLC dashboard (see
// lib/auth/__tests__/clc-national-role-boundary.test.ts) — requireUser()
// alone (any authenticated user, any role) is NOT sufficient.
export async function hasInstitutionalTopologyAccess(userId: string, orgId: string): Promise<boolean> {
  try {
    const userRole = await getUserRoleInOrganization(userId, orgId);
    return ['clc_staff', 'clc_executive', 'system_admin'].includes(userRole || '');
  } catch {
    return false;
  }
}
