/**
 * The signed-in person and the organization a tenant page or server action reads for.
 *
 * Every tenant statement a page issues runs inside withRLSContext({ organizationId }): outside it the database handle is the pooled
 * connection with no organization, and row-level security shows every tenant table as empty. This is the one place a page learns
 * which organization that is. The identity is requireUser(); an organization that is not a uuid (a platform administrator who belongs
 * to no organization is reported as "platform") names no tenant, so there is nothing to read and the caller is sent back to the dashboard.
 */
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/api-auth-guard';
import { isUuid } from './uuid';

export { isUuid };

export interface OrganizationScope {
  userId: string;
  organizationId: string;
}

export async function requireOrganizationScope(): Promise<OrganizationScope> {
  const user = await requireUser();
  if (!isUuid(user.organizationId)) redirect('/dashboard');
  return { userId: user.userId, organizationId: user.organizationId };
}
