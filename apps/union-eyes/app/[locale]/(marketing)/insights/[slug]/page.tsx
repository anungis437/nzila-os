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
import { buildLocaleAlternates } from '@/lib/marketing-seo';

type InsightArticlePageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams?: Promise<{ context?: string }>;
};

export function generateStaticParams() {
  return insightArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: InsightArticlePageProps): Promise<Metadata> {
  const { slug, locale } = await params;

  if (slug === 'doctrine') {
    return {
      title: 'Doctrine | Insights | UnionEyes',
      description: 'Editorial standards and narrative architecture for organizational continuity insights.',
      alternates: buildLocaleAlternates(locale, '/insights/doctrine'),
    };
  }

  if (slug === 'methodology') {
    return {
      title: 'Methodology | Insights | UnionEyes',
      description: 'Canonical frameworks and continuity visualization for organizational modernization.',
      alternates: buildLocaleAlternates(locale, '/insights/methodology'),
    };
  }

  if (slug === 'resonance') {
    return {
      title: 'Resonance | Insights | UnionEyes',
      description: 'Executive emotional resonance, conference memory anchors, and continuity symbolism.',
      alternates: buildLocaleAlternates(locale, '/insights/resonance'),
    };
  }

  if (slug === 'categories') {
    return {
      title: 'Categories | Insights | UnionEyes',
      description: 'Browse the governance domains and topic pathways in the UnionEyes Insights system.',
      alternates: buildLocaleAlternates(locale, '/insights/categories'),
    };
  }

  const article = getInsightBySlug(slug);

  if (!article) {
    return {
      title: 'Insight Not Found | UnionEyes',
      description: 'The requested insight article could not be found.',
      alternates: buildLocaleAlternates(locale, `/insights/${slug}`),
    };
  }

  return {
    title: `${article.title} | Insights | UnionEyes`,
    description: article.excerpt,
    alternates: buildLocaleAlternates(locale, `/insights/${slug}`),
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://unioneyes.app';
  const articleUrl = `${siteUrl}/${locale}/insights/${article.slug}`;
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    author: {
      '@type': 'Organization',
      name: article.author || 'UnionEyes',
    },
    publisher: {
      '@type': 'Organization',
      name: 'UnionEyes',
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/images/brand/icon.png`,
      },
    },
    datePublished: article.publishedOn,
    dateModified: article.publishedOn,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
    articleSection: article.categoryName,
    inLanguage: locale,
    isAccessibleForFree: true,
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <InsightArticleView
        article={article}
        related={related}
        locale={locale}
        contextMode={contextMode}
        backHref={withInstitutionalContext(`/${locale}/insights`, contextMode)}
      />
    </>
  );
}
