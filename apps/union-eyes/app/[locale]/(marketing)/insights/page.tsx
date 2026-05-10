/**
 * Insights — Institutional Thought Leadership Hub
 *
 * Category authority through institutional thought leadership.
 * Governance modernization, continuity intelligence, labour-safe AI.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { InsightsHubSubmenu, insightsHubSections } from '@/components/marketing/insights-hub-navigation';
import ScrollReveal from '@/components/public/scroll-reveal';
import {
  getInstitutionalModeProfile,
  parseInstitutionalMode,
  withInstitutionalContext,
} from '@/lib/institutional-context';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import {
  getFeaturedInsights,
  getInsightHref,
} from '@/lib/insights-content';

export const metadata: Metadata = {
  title: 'Insights | Union Eyes',
  description:
    'Institutional continuity, governance modernization, and labour-safe organizational intelligence — thought leadership from Union Eyes.',
};

export default async function InsightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ context?: string }>;
}) {
  const { locale } = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const contextMode = parseInstitutionalMode(resolvedSearch?.context);
  const profile = getInstitutionalModeProfile(contextMode);
  const featuredInsights = getFeaturedInsights();
  const quickLinks = insightsHubSections.filter((section) => section.key !== 'overview');

  return (
    <div className="institution-shell min-h-screen">

      {/* ── Hero ── */}
      <MarketingHeroSection
        imageUrl={heroImagery.insights}
        tone="dark"
        revealTempo="conference"
        heading={<>Institutional continuity and governance intelligence</>}
        description="A doctrine publication movement for executive teams preserving institutional memory, reducing fragmentation risk, and operationalizing explainable modernization with continuity confidence."
        contextKicker={`${profile.label} context`}
        contextNote={profile.heroFraming}
        cta={
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={withInstitutionalContext(`/${locale}/pilot-request`, contextMode)} className="inline-flex items-center justify-center px-7 py-3.5 bg-white text-navy font-semibold rounded-xl hover:bg-slate-100 transition-all">
              Request Executive Briefing
            </Link>
            <Link href={withInstitutionalContext(`/${locale}/contact`, contextMode)} className="inline-flex items-center justify-center px-7 py-3.5 bg-white/90 text-navy font-semibold rounded-xl border border-white hover:bg-white transition-all">
              Receive Doctrine Updates
            </Link>
          </div>
        }
      />

      <InsightsHubSubmenu locale={locale} active="overview" contextMode={contextMode} />

      <section className="py-12 bg-white border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={0.02} duration={0.8} distance={12} tempo="conference">          </ScrollReveal>
          <ScrollReveal delay={0.08} duration={0.95} distance={16} tempo="conference">
            <h2 className="text-3xl font-semibold text-navy mb-4">Move through the Insights system by theme</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.14} duration={0.9} distance={14} tempo="conference">
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-8">
              The hub is now the entry point. Use the submenu to move into doctrine, methodology, emotional resonance, or category browsing without scrolling through a single long page.
            </p>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 narrative-sequence">
            {quickLinks.map((section) => (
              <Link key={section.key} href={withInstitutionalContext(section.href(locale), contextMode)} className="institution-panel calm-elevation block p-5 group">
                <h3 className="text-sm font-semibold text-navy mb-2 group-hover:text-[#1f5b84] transition-colors">
                  {section.label}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">{section.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Insights ── */}
      <section className="py-16 bg-[#f8f6f2] border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={0.02} duration={0.8} distance={12} tempo="conference">          </ScrollReveal>
          <ScrollReveal delay={0.08} duration={0.95} distance={16} tempo="conference">
            <h2 className="text-3xl font-semibold text-navy mb-3">Executive publications in active use</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.14} duration={0.9} distance={14} tempo="conference">
            <p className="text-sm text-slate-600 mb-8 max-w-3xl">
              These publications are used in governance workshops, modernization committees, procurement reviews, and transition planning cycles.
            </p>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 gap-6 narrative-sequence">
            {featuredInsights.map((insight) => (
              <Link
                key={insight.slug}
                href={withInstitutionalContext(getInsightHref(insight.slug, locale), contextMode)}
                className="institution-panel calm-elevation block p-6 group"
              >
                <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 mb-3">
                  {insight.categoryName}
                </span>
                <h3 className="text-lg font-semibold text-navy mb-2 leading-snug group-hover:text-[#1f5b84] transition-colors">
                  {insight.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-3">
                  {insight.excerpt}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-4">
                  <span>{insight.readTime} read</span>
                  <span>{insight.format}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Best for: {insight.audience}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Newsletter / Updates ── */}
      <section className="py-16 bg-[#12324a] text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal delay={0.02} duration={0.78} distance={12} tempo="conference">
            <p className="text-xs tracking-[0.2em] uppercase text-white/70 mb-3">Trust Reinforcement</p>
          </ScrollReveal>
          <ScrollReveal delay={0.08} duration={0.9} distance={15} tempo="conference">
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">
              Keep your leadership team aligned
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.14} duration={0.9} distance={14} tempo="conference">
            <p className="text-white/80 mb-6 max-w-lg mx-auto leading-relaxed">
              Receive new doctrine briefs, governance frameworks, and continuity implementation guides as they are published.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.2} duration={0.88} distance={12} tempo="conference">
            <Link
              href={withInstitutionalContext(`/${locale}/contact`, contextMode)}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white text-navy font-semibold rounded-xl hover:bg-slate-100 transition-all"
            >
              Stay Briefed
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
