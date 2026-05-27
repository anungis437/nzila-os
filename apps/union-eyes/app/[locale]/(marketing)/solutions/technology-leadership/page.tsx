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
import { Cpu, ShieldCheck, Lock, Eye, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';
import { getCarouselNav } from '@/lib/solutions-carousel';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.solutions.technology' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: buildLocaleAlternates(locale, '/solutions/technology-leadership'),
  };
}

const PAGE_COPY = {
  'en-CA': {
    badge: 'Solutions · Technology Leadership',
    heading: 'AI your institution can trust.',
    description:
      'Labour organizations need AI that is explainable, governed, safe for workers, and trustworthy. UnionEyes is built to meet that standard.',
    primaryCta: 'Start a review',
    secondaryCta: 'View Trust Center',
    principlesHeading: 'Core technical principles',
    principles: [
      { label: 'Canadian data residency', sub: 'All data stays in Canada' },
      { label: 'No worker surveillance', sub: 'Built into the architecture' },
      { label: 'Human oversight required', sub: 'Built in by design' },
      { label: 'Full audit trails', sub: 'Every action is logged' },
      { label: 'Explainable outputs only', sub: 'Evidence is always traceable' },
      { label: 'Modular deployment', sub: 'No forced big-bang rollout' },
    ],
    outcomesHeading: 'What technology leaders gain',
    outcomes: [
      { icon: ShieldCheck, title: 'Governance-safe AI', desc: 'AI that works within democratic governance structures, with explainable outputs and human oversight.' },
      { icon: Lock, title: 'Security and residency', desc: 'Canadian data residency, SOC 2-aligned infrastructure, and audit support for compliance.' },
      { icon: Eye, title: 'Clear explainability', desc: 'Every output links to source evidence. No opaque results in a labour setting.' },
      { icon: Cpu, title: 'Modular deployment', desc: 'Deploy the modules you need in the sequence that matches readiness.' },
      { icon: CheckCircle, title: 'No monitoring path', desc: 'The architecture cannot be repurposed for worker monitoring or conduct grading.' },
    ],
    relatedHeading: 'Explore related solutions',
    finalHeading: 'AI your institution can trust',
    finalBody: 'Request a technical briefing or live walkthrough.',
  },
  'fr-CA': {
    badge: 'Solutions · Direction technologique',
    heading: 'Une IA digne de confiance pour votre institution.',
    description:
      'Les organisations syndicales ont besoin d’une IA explicable, gouvernée, sûre pour le travail et fiable. UnionEyes est conçu pour respecter cette exigence.',
    primaryCta: 'Faire le bilan',
    secondaryCta: 'Voir le centre de confiance',
    principlesHeading: 'Principes techniques de base',
    principles: [
      { label: 'Résidence des données au Canada', sub: 'Toutes les données restent au Canada' },
      { label: 'Aucune surveillance des travailleurs', sub: 'Intégrée à l architecture' },
      { label: 'Surveillance humaine requise', sub: 'Intégrée par conception' },
      { label: 'Pistes d’audit complètes', sub: 'Chaque action est consignée' },
      { label: 'Résultats explicables seulement', sub: 'Les preuves sources restent traçables' },
      { label: 'Déploiement modulaire', sub: 'Aucune adoption massive forcée' },
    ],
    outcomesHeading: 'Ce que les responsables technologiques gagnent',
    outcomes: [
      { icon: ShieldCheck, title: 'IA sûre pour la gouvernance', desc: 'Des systèmes IA qui fonctionnent dans des structures démocratiques avec des résultats explicables et une supervision humaine.' },
      { icon: Lock, title: 'Sécurité et résidence des données', desc: 'Résidence canadienne, infrastructure alignée SOC 2 et soutien d audit pour la conformité.' },
      { icon: Eye, title: 'Explicabilité claire', desc: 'Chaque résultat est relié aux preuves sources. Aucun résultat opaque dans un milieu syndical.' },
      { icon: Cpu, title: 'Déploiement modulaire', desc: 'Déployez les modules nécessaires selon votre niveau de préparation.' },
      { icon: CheckCircle, title: 'Aucune voie de surveillance', desc: 'L architecture ne peut pas être réutilisée pour surveiller des personnes ou noter leur conduite.' },
    ],
    relatedHeading: 'Explorer les solutions connexes',
    finalHeading: 'Une IA à laquelle votre institution peut faire confiance',
    finalBody: 'Demandez un breffage technique ou une visite guidée.',
  },
};

export default async function TechnologyLeadershipPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const carousel = getCarouselNav('technology-leadership', locale);
  const copy = PAGE_COPY[locale as keyof typeof PAGE_COPY] ?? PAGE_COPY['en-CA'];
  return (
    <div className="bg-white min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.technologyLeadership}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white backdrop-blur-sm">
            {copy.badge}
          </span>
        }
        heading={<>{copy.heading}</>}
        description={copy.description}
        cta={
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/${locale}/organizational-continuity-risk`} className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30">
              {copy.primaryCta}
            </Link>
            <Link href="../trust" className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-navy font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all">
              {copy.secondaryCta}
            </Link>
          </div>
        }
      />

      {/* Technical principles */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-navy mb-6">{copy.principlesHeading}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {copy.principles.map((p) => (
              <div key={p.label} className="p-5 rounded-xl bg-white border border-gray-100">
                <div className="text-sm font-bold text-navy mb-1">{p.label}</div>
                <div className="text-xs text-gray-500">{p.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-navy mb-10 text-center">{copy.outcomesHeading}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {copy.outcomes.map((o) => (
              <div key={o.title} className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-electric/10 flex items-center justify-center mb-4">
                  <o.icon className="h-5 w-5 text-electric" />
                </div>
                <h3 className="text-sm font-bold text-navy mb-2">{o.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{o.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-base font-bold text-navy mb-6">{copy.relatedHeading}</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {carousel.previous ? (
              <Link href={carousel.previous.href} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-gray-200 text-sm font-medium text-navy hover:text-electric transition-colors">
                <ArrowLeft className="h-4 w-4" /> {carousel.previous.label}
              </Link>
            ) : null}
            {carousel.next ? (
              <Link href={carousel.next.href} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-gray-200 text-sm font-medium text-navy hover:text-electric transition-colors">
                {carousel.next.label} <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="py-16 bg-navy text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">{copy.finalHeading}</h2>
          <p className="text-white/70 mb-8">{copy.finalBody}</p>
          <Link href={`/${locale}/organizational-continuity-risk`} className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all">
            {copy.primaryCta}
          </Link>
        </div>
      </section>
    </div>
  );
}
