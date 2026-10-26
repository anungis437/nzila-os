import { redirect } from 'next/navigation';
import { getUserRole, requireUser } from '@/lib/api-auth-guard';
import { getRoleLandingPath } from '@/lib/dashboard/role-experience';
import { caseActionAllowed, casePolicyRole } from '@/lib/cases/case-permissions';

/**
 * The staff conversation workspace is for staff who may handle member conversations. Another role reaching it by URL is
 * sent to its own landing page. This is presentation only: every route the page calls decides again, from the live
 * membership, designation and assignment, whether the caller may see or do anything.
 */
export async function requireStaffMessagesPage(): Promise<{ userId: string }> {
  const user = await requireUser();
  const role = await getUserRole(user.userId, user.organizationId);
  const policyRole = role ? casePolicyRole(role) : null;
  if (!policyRole || !caseActionAllowed('note_add_internal', policyRole)) redirect(getRoleLandingPath(role));
  return { userId: user.userId };
}
