import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { InsightArticleView } from '@/components/marketing/insight-article-view';
import {
  InsightsCategoriesPageView,
  InsightsDoctrinePageView,
  InsightsMethodologyPageView,
  InsightsResonancePageView,
} from '@/components/marketing/insights-section-pages';
import { parseInstitutionalMode, withInstitutionalContext } from '@/lib/institutional-context';
import { getInsightBySlug, getRelatedInsights, insightArticles } from '@/lib/insights-content';

type InsightArticlePageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams?: Promise<{ context?: string }>;
};

export function generateStaticParams() {
  return insightArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: InsightArticlePageProps): Promise<Metadata> {
  const { slug } = await params;

  if (slug === 'doctrine') {
    return {
      title: 'Doctrine | Insights | Union Eyes',
      description: 'Editorial standards and narrative architecture for institutional continuity insights.',
    };
  }

  if (slug === 'methodology') {
    return {
      title: 'Methodology | Insights | Union Eyes',
      description: 'Canonical frameworks and continuity visualization for institutional modernization.',
    };
  }

  if (slug === 'resonance') {
    return {
      title: 'Resonance | Insights | Union Eyes',
      description: 'Executive emotional resonance, conference memory anchors, and continuity symbolism.',
    };
  }

  if (slug === 'categories') {
    return {
      title: 'Categories | Insights | Union Eyes',
      description: 'Browse the governance domains and topic pathways in the Union Eyes Insights system.',
    };
  }

  const article = getInsightBySlug(slug);

  if (!article) {
    return {
      title: 'Insight Not Found | Union Eyes',
      description: 'The requested insight article could not be found.',
    };
  }

  return {
    title: `${article.title} | Insights | Union Eyes`,
    description: article.excerpt,
  };
}

export default async function InsightArticlePage({ params, searchParams }: InsightArticlePageProps) {
  const { slug, locale } = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const contextMode = parseInstitutionalMode(resolvedSearch?.context);

  if (slug === 'doctrine') {
    return <InsightsDoctrinePageView locale={locale} contextMode={contextMode} />;
  }

  if (slug === 'methodology') {
    return <InsightsMethodologyPageView locale={locale} contextMode={contextMode} />;
  }

  if (slug === 'resonance') {
    return <InsightsResonancePageView locale={locale} contextMode={contextMode} />;
  }

  if (slug === 'categories') {
    return <InsightsCategoriesPageView locale={locale} contextMode={contextMode} />;
  }

  const article = getInsightBySlug(slug);

  if (!article) {
    notFound();
  }

  const related = getRelatedInsights(article.slug, 3);

  return (
    <InsightArticleView
      article={article}
      related={related}
      locale={locale}
      contextMode={contextMode}
      backHref={withInstitutionalContext(`/${locale}/insights`, contextMode)}
    />
  );
}
