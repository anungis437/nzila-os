import type { Metadata } from 'next';
import { InsightsMethodologyPageView } from '@/components/marketing/insights-section-pages';
import { parseInstitutionalMode } from '@/lib/institutional-context';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Methodology | Insights | UnionEyes',
    description: 'Canonical frameworks and continuity visualization for institutional modernization.',
    alternates: buildLocaleAlternates(locale, '/insights/methodology'),
  };
}

export default async function MethodologyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ context?: string }>;
}) {
  const { locale } = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const contextMode = parseInstitutionalMode(resolvedSearch?.context);

  return <InsightsMethodologyPageView locale={locale} contextMode={contextMode} />;
}
