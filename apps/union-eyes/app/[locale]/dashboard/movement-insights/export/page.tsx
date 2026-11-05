export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { CapabilityUnavailable } from '@/components/system/capability-unavailable';

/**
 * Legislative brief export.
 *
 * There is no export to offer. The page used to read the last thirty days of movement_trends, which nothing in the application
 * populates (it is filled out of band), and pass the rows through a type cast into a brief generator that reads fields the
 * table does not have, so it showed a brief of NaN and -Infinity figures, an "Export PDF" button that did nothing, and filter
 * badges that filtered nothing. A PDF is not produced anywhere, and a cross-union export of aggregated data needs the privacy
 * thresholds of the aggregation service applied to rows that really carry their contributing organizations. It says so instead
 * of presenting a brief.
 */
interface ExportPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: ExportPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'movementInsightsExportPage.metadata' });

  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function LegislativeBriefExportPage({ params }: ExportPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'movementInsightsExportPage' });

  return (
    <div className="container mx-auto max-w-4xl space-y-8 py-8">
      <div className="flex items-start justify-between">
        <h1 className="text-4xl font-bold">{t('header.title')}</h1>

        <Button asChild>
          <Link href={`/${locale}/dashboard/movement-insights`}>{t('header.backToInsights')}</Link>
        </Button>
      </div>

      <CapabilityUnavailable locale={locale} capability="UE-MOVEMENT-INSIGHTS-LEGISLATIVE-BRIEF" />
    </div>
  );
}
