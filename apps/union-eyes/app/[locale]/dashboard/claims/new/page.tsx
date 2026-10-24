export const dynamic = 'force-dynamic';

import { requireUser, getUserRole } from '@/lib/api-auth-guard';
import { getDashboardExperience } from '@/lib/dashboard/role-experience';
import { getRoleLevel, UserRole } from '@/lib/auth/roles';
import { NewClaimForm } from '@/components/claims/new-claim-form';

/**
 * /dashboard/claims/new — case intake.
 *
 * Members file and return to My Cases; the staff intake queue is not part of the member journey.
 * Voice transcription mirrors the API's steward-and-above requirement so members never see a
 * control that cannot work for them.
 */
export default async function NewClaimPage() {
  const user = await requireUser();
  const role = await getUserRole(user.userId, user.organizationId);
  const isMember = getDashboardExperience(role) === 'member';

  return (
    <NewClaimForm
      canUseVoice={role !== null && getRoleLevel(role as UserRole) >= getRoleLevel(UserRole.STEWARD)}
      landOnSubmittedCase={isMember}
      returnPath={isMember ? '/dashboard/claims' : '/dashboard/inbox?type=intake'}
    />
  );
}
