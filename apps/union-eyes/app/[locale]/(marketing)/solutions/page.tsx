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
 * Solutions — Stakeholder-Oriented Institutional Journeys
 *
 * Enterprise IA: Solutions hub surfacing each stakeholder journey.
 * Hides operating-architecture sophistication. Exposes institutional outcomes.
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
    challenge: 'Strategic continuity is at risk when institutional knowledge lives in individuals, not in the organization.',
    scenario:
      'A national union prepares for an upcoming presidential transition. Three decades of negotiated precedents, federation-level commitments, and operational doctrine live in one outgoing executive’s memory. OCI (Organizational Continuity Index) surfaces the dependency map; the platform turns it into an inheritable continuity record before the transition window closes.',
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
    scenario:
      'A board of directors is asked to approve an AI-assisted policy interpretation workflow. Their counsel needs to see the dependency chain, the confidence posture, and the human-review checkpoint for every recommendation. Governance-safe cognition makes that readable in the same surface where the decision is recorded.',
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
    challenge: 'Operational fragmentation erodes institutional resilience over time.',
    scenario:
      'A federation’s operational work lives across seven inboxes, three shared drives, and a legacy intake form. New officers inherit cases with no precedent map and no continuity briefing. The platform consolidates the operating record without displacing existing tools — onboarding shortens, decisions become defensible.',
    outcomes: [
      'Operational coherence across distributed teams',
      'Institutional memory preservation during change',
      'Continuity planning for operational resilience',
    ],
    cta: 'Operations leadership solutions',
  },
  {
    icon: Cpu,
    audience: 'Technology Leadership',
    href: 'solutions/technology-leadership',
    challenge: 'Labour organizations need enterprise-safe AI that is explainable, governed, and trusted — not experimental.',
    scenario:
      'A CIO is asked to evaluate an AI procurement that touches sensitive labour data. Their security team needs Canadian residency, fail-closed degradation posture, and an explainability surface that survives an audit. The Trust Center answers those questions before the vendor call begins.',
    outcomes: [
      'Governance-safe AI with full explainability guarantees',
      'Enterprise security and Canadian data residency',
      'Institutional trust infrastructure with audit capabilities',
    ],
    cta: 'Technology leadership solutions',
  },
  {
    icon: Heart,
    audience: 'Policy & Labour Leadership',
    href: 'solutions/labour-leadership',
    challenge: 'AI adoption in labour environments requires unambiguous labour-safe postures and human oversight.',
    scenario:
      'A labour-side policy team is reviewing a member-services modernization. The concern: any tool that ranks, scores, or surveils workers is non-starter. The platform’s anti-monitoring posture, plural-only analytics, and operator-initiated cognition surfaces make the procurement conversation possible without compromising labour values.',
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
    challenge: 'Procurement decisions require operational credibility, implementation readiness, and institutional trust validation.',
    scenario:
      'A procurement officer needs to assemble a defensible institutional case for a continuity-infrastructure engagement. The Trust Center, the OCI assessment artifacts, the governance commitments, and the audit-ready exports collapse what would normally be a months-long vendor due-diligence into a structured procurement-readable package.',
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
    heading: 'Built for every institutional stakeholder',
    description:
      'UnionEyes organizes around institutional stakeholder journeys — not engineering systems. Every capability surfaces the outcomes that matter for your role.',
    ctaHeading: 'Ready to explore your stakeholder journey?',
    ctaDescription:
      'Start with a free Continuity Reflection. No commitment, no sales call — just a scoped look at where institutional continuity sits for your organization today.',
    cta: 'Start the free Continuity Reflection',
    solutions,
  },
  'fr-CA': {
    badge: 'Solutions',
    heading: 'Conçu pour chaque partie prenante institutionnelle',
    description:
      'UnionEyes s’organise autour des parcours des parties prenantes institutionnelles, pas autour de systèmes techniques. Chaque capacité met en avant les résultats utiles à votre rôle.',
    ctaHeading: 'Prêt à explorer votre parcours institutionnel?',
    ctaDescription:
      'Commencez par une réflexion de continuité gratuite. Sans engagement, sans appel commercial — simplement un regard ciblé sur l’état actuel de la continuité institutionnelle de votre organisation.',
    cta: 'Commencer la réflexion de continuité (gratuite)',
    solutions: [
      {
        icon: Users,
        audience: 'Direction exécutive syndicale',
        href: 'solutions/executive-leadership',
        challenge:
          'La continuité stratégique est fragilisée lorsque la connaissance institutionnelle vit chez des personnes plutôt que dans l’organisation.',
        scenario:
          'Un syndicat national prépare une transition présidentielle. Trois décennies de précédents négociés, d’engagements fédéraux et de doctrine opérationnelle vivent dans la mémoire d’un seul dirigeant sortant. L’OCI (Indice de continuité organisationnelle) révèle la carte des dépendances ; la plateforme la transforme en dossier de continuité transmissible avant la fermeture de la fenêtre de transition.',
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
        scenario:
          'Un conseil d’administration doit approuver un flux d’interprétation des politiques assisté par IA. Le conseiller juridique doit voir la chaîne de dépendances, la posture de confiance et le point de révision humaine de chaque recommandation. La cognition gouvernée rend cela lisible dans la même surface où la décision est consignée.',
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
          'La fragmentation opérationnelle affaiblit la résilience institutionnelle avec le temps.',
        scenario:
          'Le travail opérationnel d’une fédération vit à travers sept boîtes courriel, trois lecteurs partagés et un formulaire d’intake hérité. Les nouveaux délégués héritent de dossiers sans carte des précédents ni breffage de continuité. La plateforme consolide le dossier opérationnel sans déplacer les outils existants — l’intégration raccourcit, les décisions deviennent défendables.',
        outcomes: [
          'Cohérence opérationnelle entre équipes distribuées',
          'Préservation de la mémoire institutionnelle pendant le changement',
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
        scenario:
          'Un directeur informatique doit évaluer un achat d’IA qui touche des données syndicales sensibles. L’équipe de sécurité exige une résidence canadienne, une posture de dégradation sécuritaire et une surface d’explicabilité qui résiste à un audit. Le Centre de confiance répond à ces questions avant le premier appel fournisseur.',
        outcomes: [
          'IA respectueuse de la gouvernance avec garanties d’explicabilité',
          'Sécurité d’entreprise et résidence des données au Canada',
          'Infrastructure de confiance institutionnelle avec capacités d’audit',
        ],
        cta: 'Solutions pour la technologie',
      },
      {
        icon: Heart,
        audience: 'Direction des politiques et du travail',
        href: 'solutions/labour-leadership',
        challenge:
          'L’adoption de l’IA en milieu syndical exige une posture clairement respectueuse du travail et de la supervision humaine.',
        scenario:
          'Une équipe de politiques syndicales examine une modernisation des services aux membres. La préoccupation : tout outil qui classe, note ou surveille les travailleurs est rédhibitoire. La posture anti-surveillance, l’analyse uniquement pluraliste et les surfaces de cognition initiées par l’opérateur rendent la conversation d’approvisionnement possible sans compromettre les valeurs syndicales.',
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
          'Les décisions d’approvisionnement exigent crédibilité opérationnelle, préparation de mise en œuvre et validation de confiance institutionnelle.',
        scenario:
          'Un agent d’approvisionnement doit constituer un dossier institutionnel défendable pour un engagement d’infrastructure de continuité. Le Centre de confiance, les artefacts d’évaluation OCI, les engagements de gouvernance et les exports prêts pour l’audit réduisent une diligence fournisseur normalement de plusieurs mois à un dossier structuré et lisible.',
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
                {('scenario' in sol) && sol.scenario && (
                  <blockquote className="border-l-2 border-electric/40 pl-4 mb-5 text-sm text-slate-700 italic leading-relaxed">
                    {sol.scenario}
                  </blockquote>
                )}
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
            href={`/${locale}/institutional-continuity-risk`}
            className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30"
          >
            {copy.cta}
          </Link>
        </div>
      </section>
    </div>
  );
}
