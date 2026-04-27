export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireUser, hasMinRole } from '@/lib/api-auth-guard';
import { CampaignDetailConsole } from '@/components/organizing/campaign-detail-console';

type PageProps = {
  params: Promise<{ locale: string; campaignId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'organizingCampaignDetailPage' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function CampaignDetailsPage({
  params,
}: PageProps) {
  await requireUser();
  const authorized = await hasMinRole('member');
  if (!authorized) {
    redirect('/login');
  }

  const { campaignId } = await params;

  return <CampaignDetailConsole campaignId={campaignId} />;
}
