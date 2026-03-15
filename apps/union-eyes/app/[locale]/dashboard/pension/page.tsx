import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import PensionMemberConsole from '@/components/pension/pension-member-console';

export const dynamic = 'force-dynamic';

export default async function PensionDashboard() {
  await requireUser();
  await hasMinRole('member');

  return <PensionMemberConsole />;
}
