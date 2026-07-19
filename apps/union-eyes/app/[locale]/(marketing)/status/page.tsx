/**
 * Organizational Positioning Manifest (UnionEyes marketing surface)
 *
 * Narrative pillars: governance, continuity (organizational memory, succession, stewardship),
 * coordination (operational workflow, intake, case management, representation),
 * trust (audit, transparency, evidence, oversight, explainability).
 *
 * Posture: continuity layer and overlay infrastructure — non-displacing and additive,
 * not replacing. Operates alongside existing systems and respects existing tools.
 *
 * AI policy: assistive intelligence with human oversight, explainability, reviewability,
 * and procedural transparency. Governance-safe AI by default — every action remains operator-initiated and operator-reviewable.
 *
 * Canadian positioning: Canadian-hosted, bilingual-first, sovereignty-conscious
 * organizational trust for democratic infrastructure.
 */
import type { Metadata } from 'next';
/**
 * Locale-aware Status page
 * Accessible at /{locale}/status
 */
export const dynamic = 'force-dynamic';

import { getTranslations } from 'next-intl/server';
import { StatusPage } from '@/components/monitoring/StatusPage';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import type { StatusLabels } from '@/components/monitoring/StatusPage';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

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
    alternates: buildLocaleAlternates(locale, '/status'),
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
