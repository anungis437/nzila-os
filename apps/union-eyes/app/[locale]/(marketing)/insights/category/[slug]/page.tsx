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
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { InsightsHubSubmenu } from '@/components/marketing/insights-hub-navigation';
import ScrollReveal from '@/components/public/scroll-reveal';
import {
  getInstitutionalModeProfile,
  parseInstitutionalMode,
  withInstitutionalContext,
} from '@/lib/institutional-context';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import {
  getInsightCategory,
  getInsightCategoryCounts,
  getInsightHref,
  getInsightsByCategory,
  getInsightCategories,
  insightCategories,
} from '@/lib/insights-content';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

type InsightCategoryPageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams?: Promise<{ context?: string }>;
};

function getCategoryLabel(name: string, locale: string) {
  if (locale !== 'fr-CA') return name;

  const labels: Record<string, string> = {
    'Organizational Continuity': 'Continuite organisationnelle',
    'Governance Modernization': 'Modernisation de la gouvernance',
    'Explainable Governance Reasoning': 'Raisonnement de gouvernance explicable',
    'Labour-Safe AI': 'IA sure pour le travail',
    'Organizational Memory': 'Memoire organisationnelle',
    'Governance Resilience': 'Resilience de gouvernance',
    'Operational Fragility': 'Fragilite operationnelle',
  };

  return labels[name] ?? name;
}

function getCategoryDescription(slug: string, fallback: string, locale: string) {
  if (locale !== 'fr-CA') return fallback;

  const descriptions: Record<string, string> = {
    'institutional-continuity': 'Comment les organisations renforcent la memoire organisationnelle, traversent les transitions de leadership et stabilisent la continuite.',
    'governance-modernization': 'Comment moderniser les operations de gouvernance avec une intelligence explicable et des controles de revue clairs.',
    'explainable-intelligence': 'Pourquoi l explicabilite est indispensable et comment l operationnaliser.',
    'labour-safe-ai': 'Principes, pratiques et garde-fous de gouvernance pour une IA responsable.',
    'organizational-memory': 'Preserver la memoire organisationnelle et la rendre utilisable a travers les transitions.',
    'governance-resilience': 'Renforcer des structures de gouvernance capables de resister aux transitions et a la pression de modernisation.',
    'operational-fragility': 'Reperer et reduire les ruptures de coordination qui affaiblissent l organisation.',
  };

  return descriptions[slug] ?? fallback;
}

export function generateStaticParams() {
  return insightCategories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: InsightCategoryPageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  const category = getInsightCategory(slug, locale);
  const isFr = locale === 'fr-CA';

  if (!category) {
    return {
      title: isFr ? 'Categorie introuvable | Perspectives | UnionEyes' : 'Category Not Found | Insights | UnionEyes',
      description: isFr
        ? 'La categorie de perspectives demandee est introuvable.'
        : 'The requested insight category could not be found.',
      alternates: buildLocaleAlternates(locale, `/insights/category/${slug}`),
    };
  }

  return {
    title: `${getCategoryLabel(category.name, locale)} | ${isFr ? 'Perspectives' : 'Insights'} | UnionEyes`,
    description: isFr
      ? 'Parcourez les publications de cette categorie avec une lecture orientee gouvernance, continuite et confiance operationnelle.'
      : category.description,
    alternates: buildLocaleAlternates(locale, `/insights/category/${slug}`),
  };
}

export default async function InsightCategoryPage({ params, searchParams }: InsightCategoryPageProps) {
  const { slug, locale } = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const contextMode = parseInstitutionalMode(resolvedSearch?.context);
  const profile = getInstitutionalModeProfile(contextMode);
  const category = getInsightCategory(slug, locale);

  if (!category) {
    notFound();
  }

  const categoryArticles = getInsightsByCategory(slug, locale);
  const categoryCounts = getInsightCategoryCounts(locale);
  const isFr = locale === 'fr-CA';
  const ctaCopy = locale === 'fr-CA'
    ? {
        heading: 'Commencez par une revue de continuité',
        body: 'Une évaluation organisationnelle ciblée, sans engagement.',
        primary: 'Commencer la revue',
        secondary: 'Retour aux perspectives',
      }
    : {
        heading: 'Start with a review',
        body: 'A scoped organizational continuity assessment. No commitment.',
        primary: 'Start the review',
        secondary: 'Back to Insights',
      };

  const pageCopy = isFr
    ? {
        roleCategory: 'Categorie',
        framing: 'cadrage',
        articlesHeading: 'Articles de cette categorie',
        noArticles: 'Aucun article publie pour cette categorie pour le moment.',
        readLabel: 'de lecture',
        browseHeading: 'Parcourir toutes les categories',
        articleCountLabel: 'articles',
      }
    : {
        roleCategory: 'Category',
        framing: 'framing',
        articlesHeading: 'Articles in this category',
        noArticles: 'No articles published yet in this category.',
        readLabel: 'read',
        browseHeading: 'Browse all categories',
        articleCountLabel: 'articles',
      };

  const localizedCategories = getInsightCategories(locale);

  return (
    <div className="bg-white min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.insights}
        revealTempo="conference"
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white backdrop-blur-sm">
            {profile.label} {pageCopy.roleCategory}
          </span>
        }
        heading={<>{getCategoryLabel(category.name, locale)}</>}
        description={getCategoryDescription(category.slug, category.description, locale)}
        contextKicker={`${profile.label} ${pageCopy.framing}`}
        contextNote={profile.continuityCallout}
      />

      <InsightsHubSubmenu locale={locale} active="categories" contextMode={contextMode} />

      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={0.03} duration={0.82} distance={12} tempo="conference">
            <h2 className="text-2xl font-bold text-navy mb-8">{pageCopy.articlesHeading}</h2>
          </ScrollReveal>
          {categoryArticles.length === 0 ? (
            <p className="text-sm text-gray-600">{pageCopy.noArticles}</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-6 narrative-sequence">
              {categoryArticles.map((article) => (
                <Link
                  key={article.slug}
                  href={withInstitutionalContext(getInsightHref(article.slug, locale), contextMode)}
                  className="block p-6 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all"
                >
                  <h3 className="text-base font-bold text-navy mb-2 leading-snug">{article.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">{article.excerpt}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>{article.readTime} {pageCopy.readLabel}</span>
                    <span>{article.format}</span>
                    <span>{article.publishedOn}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-16 bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={0.03} duration={0.82} distance={12} tempo="conference">
            <h2 className="text-2xl font-bold text-navy mb-8">{pageCopy.browseHeading}</h2>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 narrative-sequence">
            {localizedCategories.map((item) => (
              <Link
                key={item.slug}
                href={withInstitutionalContext(`/${locale}/insights/category/${item.slug}`, contextMode)}
                className={`block p-5 rounded-xl border transition-all ${
                  item.slug === slug
                    ? 'bg-electric/5 border-electric/40'
                    : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
                }`}
              >
                <h3 className="text-sm font-bold text-navy mb-1">{getCategoryLabel(item.name, locale)}</h3>
                <p className="text-xs text-gray-500 leading-relaxed mb-3">{getCategoryDescription(item.slug, item.description, locale)}</p>
                <span className="text-xs text-gray-400">{categoryCounts[item.slug] ?? 0} {pageCopy.articleCountLabel}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-navy text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal delay={0.04} duration={0.88} distance={14} tempo="conference">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">{ctaCopy.heading}</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.1} duration={0.9} distance={14} tempo="conference">
            <p className="text-white/70 mb-8">{ctaCopy.body}</p>
          </ScrollReveal>
          <div className="flex flex-col sm:flex-row gap-4 justify-center narrative-sequence">
            <Link
              href={`/${locale}/organizational-continuity-risk`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all"
            >
              {ctaCopy.primary}
            </Link>
            <Link
              href={withInstitutionalContext(`/${locale}/insights`, contextMode)}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all"
            >
              {ctaCopy.secondary}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
