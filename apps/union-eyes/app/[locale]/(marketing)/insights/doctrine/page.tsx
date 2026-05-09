import type { Metadata } from 'next';
import { InsightsDoctrinePageView } from '@/components/marketing/insights-section-pages';
import { parseInstitutionalMode } from '@/lib/institutional-context';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return {
    title: `Doctrine | Insights | Union Eyes`,
    description: `Editorial standards and narrative architecture for institutional continuity insights.`,
  };
}

export default async function DoctrinePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ context?: string }>;
}) {
  const { locale } = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const contextMode = parseInstitutionalMode(resolvedSearch?.context);

  return <InsightsDoctrinePageView locale={locale} contextMode={contextMode} />;
}
