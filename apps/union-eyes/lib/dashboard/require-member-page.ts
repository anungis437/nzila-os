import { redirect } from 'next/navigation';
import { getUserRole, requireUser } from '@/lib/api-auth-guard';
import { getDashboardExperience, getRoleLandingPath } from '@/lib/dashboard/role-experience';

/**
 * Member destinations are for members. Another role reaching one by URL is sent to its own landing
 * page; the layout allow-list remains the first barrier and this is the page-level confirmation.
 */
export async function requireMemberPage(): Promise<void> {
  const user = await requireUser();
  const role = await getUserRole(user.userId, user.organizationId);
  if (getDashboardExperience(role) !== 'member') redirect(getRoleLandingPath(role));
}
