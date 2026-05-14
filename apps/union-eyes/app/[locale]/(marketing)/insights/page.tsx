/**
 * Institutional Positioning Manifest (UnionEyes marketing surface)
 *
 * Narrative pillars: governance, continuity (institutional memory, succession, stewardship),
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
 * institutional trust for democratic infrastructure.
 */
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
  parseInstitutionalMode,
  withInstitutionalContext,
} from '@/lib/institutional-context';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import {
  getFeaturedInsights,
  getInsightHref,
} from '@/lib/insights-content';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  const title = 'Insights | Institutional Governance & Continuity Library — UnionEyes';
  const description =
    'A doctrine library for unions and democratic organizations: institutional governance, continuity preservation, representational coordination, and audit-grade transparency. Bilingual, sovereignty-conscious, executive-grade.';
  return {
    title,
    description,
    keywords: [
      'institutional governance',
      'institutional continuity',
      'institutional memory',
      'representational coordination',
      'union governance doctrine',
      'audit-grade transparency',
      'explainable assistive intelligence',
      'bilingual continuity infrastructure',
    ],
    alternates: buildLocaleAlternates(locale, '/insights'),
    openGraph: {
      title,
      description,
      type: 'website',
      locale,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

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
  const featuredInsights = getFeaturedInsights();
  const quickLinks = insightsHubSections.filter((section) => section.key !== 'overview');

  const pillars = [
    {
      eyebrow: 'Governance',
      title: 'Bylaw-aligned procedural cadence',
      body: 'Constitutional fidelity, motion lifecycle, quorum integrity, and decision provenance — modernization without rupture.',
    },
    {
      eyebrow: 'Continuity',
      title: 'Institutional memory preservation',
      body: 'Succession-safe knowledge, doctrine archives, and representational lineage that survive turnover and political cycles.',
    },
    {
      eyebrow: 'Coordination',
      title: 'Representational workflow integrity',
      body: 'Intake, casework, grievance lifecycle, and steward operations woven into a single coherent operational fabric.',
    },
    {
      eyebrow: 'Trust',
      title: 'Audit-grade transparency',
      body: 'Evidence trails, oversight ergonomics, and explainable assistive intelligence — every action operator-initiated and reviewable.',
    },
  ];

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'UnionEyes Institutional Governance & Continuity Library',
    description:
      'Institutional doctrine, governance modernization, continuity preservation, and representational coordination — executive-grade publications for democratic organizations.',
    inLanguage: locale,
    isPartOf: { '@type': 'WebSite', name: 'UnionEyes' },
    about: [
      'Institutional governance',
      'Institutional continuity',
      'Representational coordination',
      'Audit-grade transparency',
    ],
    hasPart: featuredInsights.map((insight) => ({
      '@type': 'Article',
      headline: insight.title,
      description: insight.excerpt,
      url: getInsightHref(insight.slug, locale),
      articleSection: insight.categoryName,
    })),
  };

  return (
    <div className="institution-shell min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}
      />

      {/* ── Hero ── */}
      <MarketingHeroSection
        imageUrl={heroImagery.insights}
        tone="dark"
        revealTempo="conference"
        heading={<>Institutional continuity and governance intelligence</>}
        description="A doctrine publication movement for executive teams preserving institutional memory, reducing fragmentation risk, and operationalizing explainable modernization with continuity confidence."
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

      {/* ── Four institutional pillars (thematic spine) ── */}
      <section className="py-14 bg-[#f8f6f2] border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={0.04} duration={0.85} distance={14} tempo="conference">
            <p className="text-xs tracking-[0.2em] uppercase text-slate-500 mb-3">Doctrine spine</p>
            <h2 className="text-3xl font-semibold text-navy mb-4">Four pillars organizing every publication</h2>
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-10">
              Every doctrine brief, methodology guide, and resonance essay is anchored in one of four institutional pillars. The library reads as a continuity instrument — not a content marketing surface.
            </p>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 narrative-sequence">
            {pillars.map((pillar) => (
              <article key={pillar.eyebrow} className="institution-panel calm-elevation p-5">
                <p className="text-[11px] tracking-[0.18em] uppercase text-[#1f5b84] mb-2">{pillar.eyebrow}</p>
                <h3 className="text-sm font-semibold text-navy mb-2 leading-snug">{pillar.title}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{pillar.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

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
