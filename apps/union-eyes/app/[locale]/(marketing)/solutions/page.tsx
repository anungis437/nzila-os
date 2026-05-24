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
/**
 * Solutions — Stakeholder-Oriented Organizational Journeys
 *
 * Enterprise IA: Solutions hub surfacing each stakeholder journey.
 * Hides operating-architecture sophistication. Exposes organizational outcomes.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Users,
  ShieldCheck,
  Settings,
  Cpu,
  Heart,
  Briefcase,
  ArrowRight,
} from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.solutions.index' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: buildLocaleAlternates(locale, '/solutions'),
  };
}

const solutions = [
  {
    icon: Users,
    audience: 'Union Executive Leadership',
    href: 'solutions/executive-leadership',
    challenge: 'Strategic continuity is at risk when organizational knowledge lives in individuals, not in the organization.',
    outcomes: [
      'Organizational continuity visibility across leadership transitions',
      'Strategic coherence through succession and change',
      'Executive-grade operational summaries without technical complexity',
    ],
    cta: 'Executive leadership solutions',
  },
  {
    icon: ShieldCheck,
    audience: 'Governance Leadership',
    href: 'solutions/governance-leadership',
    challenge: 'Governance modernization requires explainability, oversight controls, and continuity — not opaque AI.',
    outcomes: [
      'Explainable governance-of-record intelligence with human oversight',
      'Governance modernization with full audit trails',
      'Continuity oversight across governance transitions',
    ],
    cta: 'Governance leadership solutions',
  },
  {
    icon: Settings,
    audience: 'Operations Leadership',
    href: 'solutions/operations-leadership',
    challenge: 'Operational fragmentation erodes organizational resilience over time.',
    outcomes: [
      'Operational coherence across distributed teams',
      'Organizational memory preservation during change',
      'Continuity planning for operational resilience',
    ],
    cta: 'Operations leadership solutions',
  },
  {
    icon: Cpu,
    audience: 'Technology Leadership',
    href: 'solutions/technology-leadership',
    challenge: 'Labour organizations need enterprise-safe AI that is explainable, governed, and trusted — not experimental.',
    outcomes: [
      'Governance-safe AI with full explainability guarantees',
      'Enterprise security and Canadian data residency',
      'Organizational trust infrastructure with audit capabilities',
    ],
    cta: 'Technology leadership solutions',
  },
  {
    icon: Heart,
    audience: 'Policy & Labour Leadership',
    href: 'solutions/labour-leadership',
    challenge: 'AI adoption in labour environments requires unambiguous labour-safe postures and human oversight.',
    outcomes: [
      'Anti-monitoring by design — no individual conduct grading',
      'Human oversight in all intelligence recommendations',
      'Labour-safe modernization with democratic governance controls',
    ],
    cta: 'Policy & labour solutions',
  },
  {
    icon: Briefcase,
    audience: 'Procurement Stakeholders',
    href: 'solutions/procurement',
    challenge: 'Procurement decisions require operational credibility, implementation readiness, and organizational trust validation.',
    outcomes: [
      'Modular deployment with phased implementation pathways',
      'Trust center documentation and audit-ready exports',
      'Pilot readiness assessment and governance briefings',
    ],
    cta: 'Procurement resources',
  },
];

const pageCopy = {
  'en-CA': {
    badge: 'Solutions',
    heading: 'Built for every organizational stakeholder',
    description:
      'UnionEyes organizes around organizational stakeholder journeys — not engineering systems. Every capability surfaces the outcomes that matter for your role.',
    ctaHeading: 'Ready to explore your stakeholder journey?',
    ctaDescription:
      'Request an Executive Briefing tailored to your role and organizational context.',
    cta: 'Request an Executive Briefing',
    solutions,
  },
  'fr-CA': {
    badge: 'Solutions',
    heading: 'Conçu pour chaque partie prenante organisationnelle',
    description:
      'UnionEyes s’organise autour des parcours des parties prenantes organisationnelles, pas autour de systèmes techniques. Chaque capacité met en avant les résultats utiles à votre rôle.',
    ctaHeading: 'Prêt à explorer votre parcours organisationnel?',
    ctaDescription:
      'Demandez une présentation exécutive adaptée à votre rôle et à votre contexte organisationnel.',
    cta: 'Demander une présentation exécutive',
    solutions: [
      {
        icon: Users,
        audience: 'Direction exécutive syndicale',
        href: 'solutions/executive-leadership',
        challenge:
          'La continuité stratégique est fragilisée lorsque la connaissance organisationnelle vit chez des personnes plutôt que dans l’organisation.',
        outcomes: [
          'Visibilité sur la continuité organisationnelle lors des transitions de leadership',
          'Cohérence stratégique pendant la succession et le changement',
          'Synthèses opérationnelles de niveau exécutif sans complexité technique',
        ],
        cta: 'Solutions pour la direction exécutive',
      },
      {
        icon: ShieldCheck,
        audience: 'Direction de la gouvernance',
        href: 'solutions/governance-leadership',
        challenge:
          'La modernisation de la gouvernance exige explicabilité, contrôles de supervision et continuité — pas une IA opaque.',
        outcomes: [
          'Intelligence explicable de gouvernance officielle avec supervision humaine',
          'Modernisation de la gouvernance avec pistes d’audit complètes',
          'Supervision de continuité à travers les transitions de gouvernance',
        ],
        cta: 'Solutions pour la gouvernance',
      },
      {
        icon: Settings,
        audience: 'Direction des opérations',
        href: 'solutions/operations-leadership',
        challenge:
          'La fragmentation opérationnelle affaiblit la résilience organisationnelle avec le temps.',
        outcomes: [
          'Cohérence opérationnelle entre équipes distribuées',
          'Préservation de la mémoire organisationnelle pendant le changement',
          'Planification de continuité pour la résilience opérationnelle',
        ],
        cta: 'Solutions pour les opérations',
      },
      {
        icon: Cpu,
        audience: 'Direction technologique',
        href: 'solutions/technology-leadership',
        challenge:
          'Les organisations syndicales ont besoin d’une IA sécuritaire, explicable, gouvernée et fiable — pas expérimentale.',
        outcomes: [
          'IA respectueuse de la gouvernance avec garanties d’explicabilité',
          'Sécurité d’entreprise et résidence des données au Canada',
          'Infrastructure de confiance organisationnelle avec capacités d’audit',
        ],
        cta: 'Solutions pour la technologie',
      },
      {
        icon: Heart,
        audience: 'Direction des politiques et du travail',
        href: 'solutions/labour-leadership',
        challenge:
          'L’adoption de l’IA en milieu syndical exige une posture clairement respectueuse du travail et de la supervision humaine.',
        outcomes: [
          'Anti-surveillance par conception — aucune notation de conduite individuelle',
          'Supervision humaine dans toutes les recommandations d’intelligence',
          'Modernisation respectueuse du travail avec contrôles démocratiques',
        ],
        cta: 'Solutions politiques et travail',
      },
      {
        icon: Briefcase,
        audience: 'Parties prenantes à l’approvisionnement',
        href: 'solutions/procurement',
        challenge:
          'Les décisions d’approvisionnement exigent crédibilité opérationnelle, préparation de mise en œuvre et validation de confiance organisationnelle.',
        outcomes: [
          'Déploiement modulaire avec parcours de mise en œuvre par phases',
          'Documentation du centre de confiance et exports prêts pour l’audit',
          'Évaluation de préparation au pilote et briefings de gouvernance',
        ],
        cta: 'Ressources d’approvisionnement',
      },
    ],
  },
} as const;

export default async function SolutionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const copy = pageCopy[locale as keyof typeof pageCopy] ?? pageCopy['en-CA'];

  return (
    <div className="bg-white min-h-screen">
      {/* Hero with Imagery */}
      <MarketingHeroSection
        imageUrl={heroImagery.solutions}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white backdrop-blur-sm">
            {copy.badge}
          </span>
        }
        heading={copy.heading}
        description={copy.description}
      />

      {/* ── Solutions Grid ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="space-y-10">
          {copy.solutions.map((sol) => (
            <div
              key={sol.audience}
              className="flex flex-col md:flex-row gap-8 p-8 rounded-2xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors"
            >
              <div className="shrink-0 flex items-start justify-center md:justify-start">
                <div className="w-14 h-14 rounded-2xl bg-electric/10 flex items-center justify-center">
                  <sol.icon className="h-6 w-6 text-electric" />
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-navy mb-2">{sol.audience}</h2>
                <p className="text-gray-600 text-sm mb-4 leading-relaxed">{sol.challenge}</p>
                <ul className="space-y-2 mb-6">
                  {sol.outcomes.map((outcome) => (
                    <li key={outcome} className="flex items-start gap-2 text-sm text-gray-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-electric mt-1.5 shrink-0" />
                      {outcome}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/${locale}/${sol.href}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-electric hover:text-blue-700 transition-colors"
                >
                  {sol.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-navy text-white py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            {copy.ctaHeading}
          </h2>
          <p className="text-white/70 mb-8">
            {copy.ctaDescription}
          </p>
          <Link
            href={`/${locale}/pilot-request`}
            className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30"
          >
            {copy.cta}
          </Link>
        </div>
      </section>
    </div>
  );
}
