import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { InsightArticleView } from '@/components/marketing/insight-article-view';
import { getInsightBySlug, getRelatedInsights } from '@/lib/insights-content';

const slug = 'continuity-crisis';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const article = getInsightBySlug(slug);

  if (!article) {
    return {
      title: 'Insight Not Found | UnionEyes',
      description: 'The requested insight article could not be found.',
    };
  }

  return {
    title: `${article.title} | Insights | UnionEyes`,
    description: article.excerpt,
  };
}

export default async function ContinuityCrisisPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const article = getInsightBySlug(slug);

  if (!article) {
    notFound();
  }

  const related = getRelatedInsights(article.slug, 3);

  return <InsightArticleView article={article} related={related} locale={locale} />;
}
