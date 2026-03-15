export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { CampaignDetailConsole } from '@/components/organizing/campaign-detail-console';

export default async function CampaignDetailsPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  await requireUser();
  const authorized = await hasMinRole('member');
  if (!authorized) {
    redirect('/login');
  }

  const { campaignId } = await params;

  return <CampaignDetailConsole campaignId={campaignId} />;
}
