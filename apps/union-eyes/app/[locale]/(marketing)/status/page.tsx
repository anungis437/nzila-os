/**
 * Locale-aware Status page
 * Accessible at /{locale}/status
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { StatusPage } from '@/components/monitoring/StatusPage';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import type { StatusLabels } from '@/components/monitoring/StatusPage';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.status' });
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
  };
}

export default async function LocaleStatusPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.statusBody' });

  const labels: StatusLabels = {
    systemStatus: t('systemStatus'),
    statusDescription: t('statusDescription'),
    allOperational: t('allOperational'),
    someDegraded: t('someDegraded'),
    systemIssues: t('systemIssues'),
    systemInformation: t('systemInformation'),
    uptime: t('uptime'),
    version: t('version'),
    timestamp: t('timestamp'),
    services: t('services'),
    monitored: t('monitored'),
    responseTime: t('responseTime'),
    statusLabel: t('statusLabel'),
    lastChecked: t('lastChecked'),
    loadError: t('loadError'),
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section with Imagery */}
      <MarketingHeroSection
        imageUrl={heroImagery.status}
        heading={t('pageTitle')}
        description={t('pageDescription')}
      />

      <StatusPage labels={labels} />
    </div>
  );
}
