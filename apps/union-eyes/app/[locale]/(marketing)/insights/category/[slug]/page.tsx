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
  insightCategories,
} from '@/lib/insights-content';

type InsightCategoryPageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams?: Promise<{ context?: string }>;
};

export function generateStaticParams() {
  return insightCategories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({ params }: InsightCategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = getInsightCategory(slug);

  if (!category) {
    return {
      title: 'Category Not Found | Insights | Union Eyes',
      description: 'The requested insight category could not be found.',
    };
  }

  return {
    title: `${category.name} | Insights | Union Eyes`,
    description: category.description,
  };
}

export default async function InsightCategoryPage({ params, searchParams }: InsightCategoryPageProps) {
  const { slug, locale } = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const contextMode = parseInstitutionalMode(resolvedSearch?.context);
  const profile = getInstitutionalModeProfile(contextMode);
  const category = getInsightCategory(slug);

  if (!category) {
    notFound();
  }

  const categoryArticles = getInsightsByCategory(slug);
  const categoryCounts = getInsightCategoryCounts();

  return (
    <div className="bg-white min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.insights}
        revealTempo="conference"
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white backdrop-blur-sm">
            {profile.label} Category
          </span>
        }
        heading={<>{category.name}</>}
        description={category.description}
        contextKicker={`${profile.label} framing`}
        contextNote={profile.continuityCallout}
      />

      <InsightsHubSubmenu locale={locale} active="categories" contextMode={contextMode} />

      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={0.03} duration={0.82} distance={12} tempo="conference">
            <h2 className="text-2xl font-bold text-navy mb-8">Articles in this category</h2>
          </ScrollReveal>
          {categoryArticles.length === 0 ? (
            <p className="text-sm text-gray-600">No articles published yet in this category.</p>
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
                    <span>{article.readTime} read</span>
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
            <h2 className="text-2xl font-bold text-navy mb-8">Browse all categories</h2>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 narrative-sequence">
            {insightCategories.map((item) => (
              <Link
                key={item.slug}
                href={withInstitutionalContext(`/${locale}/insights/category/${item.slug}`, contextMode)}
                className={`block p-5 rounded-xl border transition-all ${
                  item.slug === slug
                    ? 'bg-electric/5 border-electric/40'
                    : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
                }`}
              >
                <h3 className="text-sm font-bold text-navy mb-1">{item.name}</h3>
                <p className="text-xs text-gray-500 leading-relaxed mb-3">{item.description}</p>
                <span className="text-xs text-gray-400">{categoryCounts[item.slug] ?? 0} articles</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-navy text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal delay={0.04} duration={0.88} distance={14} tempo="conference">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Need a category-specific executive briefing?</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.1} duration={0.9} distance={14} tempo="conference">
            <p className="text-white/70 mb-8">We can tailor a briefing around your leadership, governance, and modernization priorities.</p>
          </ScrollReveal>
          <div className="flex flex-col sm:flex-row gap-4 justify-center narrative-sequence">
            <Link
              href="/pilot-request"
              className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all"
            >
              Request a Briefing
            </Link>
            <Link
              href={withInstitutionalContext(`/${locale}/insights`, contextMode)}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all"
            >
              Back to Insights
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
