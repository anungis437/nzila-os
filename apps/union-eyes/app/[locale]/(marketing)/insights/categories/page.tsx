import type { Metadata } from 'next';
import { InsightsCategoriesPageView } from '@/components/marketing/insights-section-pages';
import { parseInstitutionalMode } from '@/lib/institutional-context';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Categories | Insights | Union Eyes',
    description: 'Browse the governance domains and topic pathways in the Union Eyes Insights system.',
    alternates: buildLocaleAlternates(locale, '/insights/categories'),
  };
}

export default async function CategoriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ context?: string }>;
}) {
  const { locale } = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const contextMode = parseInstitutionalMode(resolvedSearch?.context);

  return <InsightsCategoriesPageView locale={locale} contextMode={contextMode} />;
}
