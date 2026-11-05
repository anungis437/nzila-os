/**
 * Who may open the federation pages.
 *
 * The federation pages (dashboard, affiliates, remittances) are for the people who hold a federation-level or administrative role in the organization.
 * A role that cannot be read is no access: the page redirects, it does not guess.
 */
import { getUserRoleInOrganization } from '@/lib/organization-utils';

const FEDERATION_ROLES: readonly string[] = ['fed_staff', 'fed_executive', 'admin', 'system_admin'];

export async function hasFederationAccess(userId: string, organizationId: string): Promise<boolean> {
  try {
    const role = await getUserRoleInOrganization(userId, organizationId);
    return FEDERATION_ROLES.includes(role ?? '');
  } catch {
    return false;
  }
}
