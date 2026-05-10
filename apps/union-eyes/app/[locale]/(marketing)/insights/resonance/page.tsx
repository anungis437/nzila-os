import type { Metadata } from 'next';
import { InsightsResonancePageView } from '@/components/marketing/insights-section-pages';
import { parseInstitutionalMode } from '@/lib/institutional-context';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Resonance | Insights | Union Eyes',
    description: 'Executive emotional resonance, conference memory anchors, and continuity symbolism.',
    alternates: buildLocaleAlternates(locale, '/insights/resonance'),
  };
}

export default async function ResonancePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ context?: string }>;
}) {
  const { locale } = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const contextMode = parseInstitutionalMode(resolvedSearch?.context);

  return <InsightsResonancePageView locale={locale} contextMode={contextMode} />;
}
