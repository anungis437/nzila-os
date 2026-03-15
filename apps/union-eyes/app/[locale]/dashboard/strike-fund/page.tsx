import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import StrikeFundConsole from '@/components/strike-fund/strike-fund-console';

export const dynamic = 'force-dynamic';

export default async function StrikeFundDashboardPage() {
  await requireUser();
  await hasMinRole('member');

  return <StrikeFundConsole />;
}
