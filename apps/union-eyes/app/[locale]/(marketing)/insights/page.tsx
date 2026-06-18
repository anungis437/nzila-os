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
/**
 * Insights — Organizational Thought Leadership Hub
 *
 * Category authority through organizational thought leadership.
 * Governance modernization, continuity intelligence, labour-safe AI.
 */
import Link from 'next/link';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { InsightsHubSubmenu, getInsightsHubSections } from '@/components/marketing/insights-hub-navigation';
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

const insightsCopy = {
  'en-CA': {
    title: 'Insights | Practical guides for union teams | UnionEyes',
    description:
      'Practical UnionEyes guides for union teams: keep work moving, make better decisions, and stay ready for review.',
    heroHeading: <>Clear guidance for union leaders</>,
    heroDescription:
      'Use these plain-language guides to protect team knowledge, keep handoffs smooth, and make decisions faster.',
    ctaPrimary: 'Start a review',
    ctaSecondary: 'Get updates by email',
    doctrineSpine: 'Library map',
    pillarsHeading: 'Four themes in this library',
    pillarsBody:
      'Every article fits into one of four themes so you can find what you need quickly.',
    themeHeading: 'Browse by theme',
    themeBody:
      'Use the menu to jump between methods, themes, and categories.',
    featuredHeading: 'Featured articles leaders are using',
    featuredBody:
      'Teams use these in planning sessions, leadership transitions, and review meetings.',
    read: 'read',
    bestFor: 'Best for: ',
    trustLabel: 'Email updates',
    newsletterHeading: 'Keep your leadership team in sync',
    newsletterBody:
      'Get new guides and templates as soon as they are published.',
    newsletterCta: 'Stay updated',
    pillars: [
      {
        eyebrow: 'Governance',
        title: 'Better decisions, simpler work',
        body: 'Simple ways to run meetings, track decisions, and keep process clear.',
      },
      {
        eyebrow: 'Continuity',
        title: 'Keep knowledge through turnover',
        body: 'Protect key know-how so new leaders can step in without losing context.',
      },
      {
        eyebrow: 'Coordination',
        title: 'Make daily work easier to coordinate',
        body: 'Practical patterns for intake, casework, and handoffs across your team.',
      },
      {
        eyebrow: 'Trust',
        title: 'Show your work clearly',
        body: 'Keep clear records and review trails so decisions are easy to explain.',
      },
    ],
  },
  'fr-CA': {
    title: 'Perspectives | Guides pratiques pour equipes syndicales | UnionEyes',
    description:
      'Guides pratiques UnionEyes pour les equipes syndicales: proteger la memoire, faciliter les transitions et mieux decider.',
    heroHeading: <>Des guides clairs pour les equipes syndicales</>,
    heroDescription:
      'Des ressources en langage simple pour garder le contexte, mieux transmettre le travail et avancer plus vite.',
    ctaPrimary: 'Faire le bilan',
    ctaSecondary: 'Recevoir les mises a jour',
    doctrineSpine: 'Plan de la bibliotheque',
    pillarsHeading: 'Quatre themes pour vous orienter',
    pillarsBody:
      'Chaque publication est classee dans un theme pour trouver rapidement la bonne ressource.',
    themeHeading: 'Parcourir par theme',
    themeBody:
      'Utilisez le menu pour passer rapidement entre methodes, themes et categories.',
    featuredHeading: 'Articles en vedette utilises sur le terrain',
    featuredBody:
      'Ces ressources servent dans les ateliers, les transitions de direction et les revues de travail.',
    read: 'de lecture',
    bestFor: 'Utile pour : ',
    trustLabel: 'Mises a jour email',
    newsletterHeading: 'Gardez votre equipe de direction alignee',
    newsletterBody:
      'Recevez les nouveaux guides et modeles des leur publication.',
    newsletterCta: 'Rester informe',
    pillars: [
      {
        eyebrow: 'Gouvernance',
        title: 'Mieux decider, avec moins de friction',
        body: 'Des pratiques simples pour les reunions, les decisions et le suivi.',
      },
      {
        eyebrow: 'Continuité',
        title: 'Conserver le savoir pendant les transitions',
        body: 'Proteger le contexte essentiel pour que les nouveaux responsables prennent le relais rapidement.',
      },
      {
        eyebrow: 'Coordination',
        title: 'Mieux coordonner le travail quotidien',
        body: 'Des modeles pratiques pour l intake, les dossiers et les transferts.',
      },
      {
        eyebrow: 'Confiance',
        title: 'Montrer clairement ce qui a ete fait',
        body: 'Des traces claires et verifiables pour expliquer chaque decision.',
      },
    ],
  },
} as const;

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

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  const copy = insightsCopy[locale as keyof typeof insightsCopy] ?? insightsCopy['en-CA'];
  const title = copy.title;
  const description = copy.description;
  return {
    title,
    description,
    keywords: [
      'organizational governance',
      'organizational continuity',
      'organizational memory',
      'representational coordination',
      'union leadership guides',
      'transparent decision records',
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
  const featuredInsights = getFeaturedInsights(locale);
  const quickLinks = getInsightsHubSections(locale).filter((section) => section.key !== 'overview');
  const copy = insightsCopy[locale as keyof typeof insightsCopy] ?? insightsCopy['en-CA'];

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: copy.title,
    description: copy.description,
    inLanguage: locale,
    isPartOf: { '@type': 'WebSite', name: 'UnionEyes' },
    about: [
      'Organizational governance',
      'Organizational continuity',
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
        heading={copy.heroHeading}
        description={copy.heroDescription}
        cta={
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={withInstitutionalContext(`/${locale}/organizational-continuity-risk`, contextMode)} className="inline-flex items-center justify-center px-7 py-3.5 bg-white text-navy font-semibold rounded-xl hover:bg-slate-100 transition-all">
              {copy.ctaPrimary}
            </Link>
            <Link href={withInstitutionalContext(`/${locale}/contact`, contextMode)} className="inline-flex items-center justify-center px-7 py-3.5 bg-white/90 text-navy font-semibold rounded-xl border border-white hover:bg-white transition-all">
              {copy.ctaSecondary}
            </Link>
          </div>
        }
      />

      <InsightsHubSubmenu locale={locale} active="overview" contextMode={contextMode} />

      {/* ── Four organizational pillars (thematic spine) ── */}
      <section className="py-14 bg-[#f8f6f2] border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={0.04} duration={0.85} distance={14} tempo="conference">
            <p className="text-xs tracking-[0.2em] uppercase text-slate-500 mb-3">{copy.doctrineSpine}</p>
            <h2 className="text-3xl font-semibold text-navy mb-4">{copy.pillarsHeading}</h2>
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-10">
              {copy.pillarsBody}
            </p>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 narrative-sequence">
            {copy.pillars.map((pillar) => (
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
            <h2 className="text-3xl font-semibold text-navy mb-4">{copy.themeHeading}</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.14} duration={0.9} distance={14} tempo="conference">
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-8">
              {copy.themeBody}
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
            <h2 className="text-3xl font-semibold text-navy mb-3">{copy.featuredHeading}</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.14} duration={0.9} distance={14} tempo="conference">
            <p className="text-sm text-slate-600 mb-8 max-w-3xl">
              {copy.featuredBody}
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
                  {getCategoryLabel(insight.categoryName, locale)}
                </span>
                <h3 className="text-lg font-semibold text-navy mb-2 leading-snug group-hover:text-[#1f5b84] transition-colors">
                  {insight.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-4 line-clamp-3">
                  {insight.excerpt}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mb-4">
                  <span>{insight.readTime} {copy.read}</span>
                  <span>{insight.format}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {copy.bestFor}{insight.audience}
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
            <p className="text-xs tracking-[0.2em] uppercase text-white/70 mb-3">{copy.trustLabel}</p>
          </ScrollReveal>
          <ScrollReveal delay={0.08} duration={0.9} distance={15} tempo="conference">
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">
              {copy.newsletterHeading}
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={0.14} duration={0.9} distance={14} tempo="conference">
            <p className="text-white/80 mb-6 max-w-lg mx-auto leading-relaxed">
              {copy.newsletterBody}
            </p>
          </ScrollReveal>
          <ScrollReveal delay={0.2} duration={0.88} distance={12} tempo="conference">
            <Link
              href={withInstitutionalContext(`/${locale}/contact`, contextMode)}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white text-navy font-semibold rounded-xl hover:bg-slate-100 transition-all"
            >
              {copy.newsletterCta}
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
