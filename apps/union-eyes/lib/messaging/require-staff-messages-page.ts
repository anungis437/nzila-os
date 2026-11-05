import { redirect } from 'next/navigation';
import { getUserRole, requireUser } from '@/lib/api-auth-guard';
import { conversationAssigneeEligible } from '@/lib/authority/capacity';
import { getRoleLandingPath } from '@/lib/dashboard/role-experience';

/**
 * The staff conversation workspace is for staff whose stored role carries a conversation-assignee capacity.
 * An administrator title is sent to its own landing page. This is presentation only: every route the page calls
 * decides again, from the live membership, designation and assignment, whether the caller may see or do anything.
 */
export async function requireStaffMessagesPage(): Promise<{ userId: string }> {
  const user = await requireUser();
  const role = await getUserRole(user.userId, user.organizationId);
  if (!conversationAssigneeEligible(role)) redirect(getRoleLandingPath(role));
  return { userId: user.userId };
}
