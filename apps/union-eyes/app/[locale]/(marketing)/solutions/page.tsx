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
    challenge: 'Leadership transitions get risky when too much knowledge lives in a few people.',
    scenario:
      'A national union is preparing for a leadership transition. UnionEyes helps turn the outgoing team’s knowledge into a record the next team can use.',
    outcomes: [
      'Continuity visibility across leadership transitions',
      'Strategic coherence through succession and change',
      'Clear operational summaries without technical complexity',
    ],
    cta: 'Executive leadership solutions',
  },
  {
    icon: ShieldCheck,
    audience: 'Governance Leadership',
    href: 'solutions/governance-leadership',
    challenge: 'Governance work needs clear reasoning and human review.',
    scenario:
      'A board is asked to approve AI-assisted policy interpretation. Counsel needs to see the evidence, the confidence level, and where human review happens.',
    outcomes: [
      'Clear policy recommendations with human oversight',
      'Governance modernization with full audit trails',
      'Continuity oversight across governance transitions',
    ],
    cta: 'Governance leadership solutions',
  },
  {
    icon: Settings,
    audience: 'Operations Leadership',
    href: 'solutions/operations-leadership',
    challenge: 'Operations get harder when files, decisions, and context are spread out.',
    scenario:
      'A federation’s work lives across inboxes, shared drives, and an old intake form. UnionEyes pulls the record together so onboarding is faster.',
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
    challenge: 'Labour organizations need AI that is secure and explainable.',
    scenario:
      'A CIO is asked to evaluate AI that will touch sensitive labour data. The security team needs Canadian hosting and explanations that hold up in an audit.',
    outcomes: [
      'Explainable AI with clear governance controls',
      'Enterprise security and Canadian data residency',
      'Organizational trust infrastructure with audit capabilities',
    ],
    cta: 'Technology leadership solutions',
  },
  {
    icon: Heart,
    audience: 'Policy & Labour Leadership',
    href: 'solutions/labour-leadership',
    challenge: 'AI in labour environments needs worker protections and human oversight.',
    scenario:
      'A labour policy team is reviewing a member-services modernization. UnionEyes keeps the boundary clear so the team can discuss it without compromising labour values.',
    outcomes: [
      'Anti-monitoring by design — no individual conduct grading',
      'Human oversight on all recommendations',
      'Labour-safe modernization with democratic governance controls',
    ],
    cta: 'Policy & labour solutions',
  },
  {
    icon: Briefcase,
    audience: 'Procurement Stakeholders',
    href: 'solutions/procurement',
    challenge: 'Procurement teams need proof that a rollout is practical and ready.',
    scenario:
      'A procurement officer needs a clear case for a continuity engagement. The trust center outputs and audit-ready exports make the review easier.',
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
    heading: 'Built for the people who run the work',
    description:
      'UnionEyes is organized around what each team needs to do.',
    ctaHeading: 'Ready to find the right starting point?',
    ctaDescription:
      'Start with a short review and see where your organization is most exposed.',
    cta: 'Take the review',
    solutions,
  },
  'fr-CA': {
    badge: 'Solutions',
    heading: 'Conçu pour les personnes qui font avancer le travail',
    description:
      'UnionEyes s’organise autour des besoins de chaque équipe.',
    ctaHeading: 'Prêt à trouver le bon point de départ?',
    ctaDescription:
      'Commencez par un court bilan et voyez où votre organisation est la plus exposée.',
    cta: 'Faire le bilan',
    solutions: [
      {
        icon: Users,
        audience: 'Direction exécutive syndicale',
        href: 'solutions/executive-leadership',
        challenge:
          'Les transitions de leadership deviennent risquées quand trop de savoir vit chez quelques personnes.',
        scenario:
          'Un syndicat national prépare une transition de leadership. Des décennies de précédents, d’engagements et de savoir-faire vivent dans la mémoire d’un seul dirigeant sortant. Le bilan montre où se trouvent les dépendances, puis UnionEyes aide à créer un dossier que la prochaine équipe peut réellement reprendre.',
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
          'Le travail de gouvernance a besoin de raisonnement clair et de revue humaine, pas d’une IA opaque.',
        scenario:
          'Un conseil doit approuver une interprétation de politiques assistée par IA. Le conseiller juridique doit voir les preuves utilisées, le niveau de confiance et l’endroit où la revue humaine intervient avant toute action.',
        outcomes: [
          'Recommandations claires avec supervision humaine',
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
          'Les opérations deviennent plus difficiles quand les dossiers, les décisions et le contexte sont dispersés.',
        scenario:
          'Le travail d’une fédération vit dans des boîtes courriel, des lecteurs partagés et un ancien formulaire d’entrée. Les nouveaux responsables héritent de dossiers sans historique clair. UnionEyes rassemble le dossier opérationnel pour accélérer l’intégration et rendre les décisions plus défendables.',
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
          'Les organisations syndicales ont besoin d’une IA sécuritaire, explicable et facile à gouverner.',
        scenario:
          'Un directeur informatique doit évaluer une IA qui touche des données syndicales sensibles. L’équipe de sécurité veut un hébergement canadien, des modes de défaillance sûrs et des explications qui tiennent en audit. Le Centre de confiance répond à ces questions avant le premier appel fournisseur.',
        outcomes: [
          'IA explicable avec contrôles de gouvernance clairs',
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
          'L’IA en milieu syndical exige des protections claires pour les travailleurs et une supervision humaine.',
        scenario:
          'Une équipe de politiques syndicales examine une modernisation des services aux membres. Tout outil qui classe, note ou surveille les travailleurs est exclu. UnionEyes garde cette limite claire pour permettre la conversation sans compromettre les valeurs syndicales.',
        outcomes: [
          'Anti-surveillance par conception — aucune notation de conduite individuelle',
          'Supervision humaine sur toutes les recommandations',
          'Modernisation respectueuse du travail avec contrôles démocratiques',
        ],
        cta: 'Solutions politiques et travail',
      },
      {
        icon: Briefcase,
        audience: 'Parties prenantes à l’approvisionnement',
        href: 'solutions/procurement',
        challenge:
          'Les équipes d’approvisionnement ont besoin de preuves claires qu’un déploiement est réaliste, sûr et prêt à être mis en œuvre.',
        scenario:
          'Un agent d’approvisionnement doit monter un dossier clair pour un engagement de continuité. Le Centre de confiance, les résultats du bilan, les engagements de gouvernance et les exports prêts pour l’audit transforment des mois de vérification fournisseur en dossier plus simple à évaluer.',
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
            href={`/${locale}/organizational-continuity-risk`}
            className="inline-flex items-center justify-center px-8 py-4 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30"
          >
            {copy.cta}
          </Link>
        </div>
      </section>
    </div>
  );
}
