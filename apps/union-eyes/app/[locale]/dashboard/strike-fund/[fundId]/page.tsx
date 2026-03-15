import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import StrikeFundDetailConsole from '@/components/strike-fund/strike-fund-detail-console';

export const dynamic = 'force-dynamic';

export default async function StrikeFundDetailsPage(props: {
  params: Promise<{ fundId: string }>;
}) {
  await requireUser();
  await hasMinRole('member');

  const { fundId } = await props.params;

  return <StrikeFundDetailConsole fundId={fundId} />;
}
