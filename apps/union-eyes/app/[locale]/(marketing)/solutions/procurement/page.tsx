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
import { Briefcase, FileCheck, CheckCircle2, BarChart3, Layers, ArrowRight, ArrowLeft } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { getCarouselNav } from '@/lib/solutions-carousel';
import {
  governanceOperationalWalkthroughs,
  governanceMaturityDimensions,
  governanceModernizationJourney,
  governanceReviewSimulationLayers,
  institutionalRolloutPathway,
  operationalMaturityPathway,
  deploymentTimelines,
  executiveScenarioModels,
  procurementEvidenceBinder,
} from '@/lib/institutional-legitimacy';
import { buildLocaleAlternates } from '@/lib/marketing-seo';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.solutions.procurement' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: buildLocaleAlternates(locale, '/solutions/procurement'),
  };
}

const PAGE_COPY = {
  'en-CA': {
    badge: 'Solutions · Procurement Stakeholders',
    heading: 'Procurement clarity for organizational deployment.',
    description:
      'UnionEyes gives procurement teams a coexistence-oriented, sovereignty-conscious deployment path: clear scope, governance-safe deployment controls, federation-aware operations, and evidence provenance for leadership confidence.',
    primaryCta: 'Request an Executive Briefing',
    secondaryCta: 'Review Trust Center',
    challengeHeading: 'The procurement challenge',
    challenges: [
      'Procurement processes often miss governance and labour-safety requirements unique to unions',
      'Vendors present broad AI claims without explainability or audit-ready evidence',
      'Implementation risk rises when rollout plans ignore organizational readiness',
      'Stakeholders find it difficult to compare options without clear continuity and trust criteria',
    ],
    outcomesHeading: 'What procurement stakeholders gain',
    outcomes: [
      { icon: Briefcase, title: 'Procurement-ready scope', desc: 'Clear module boundaries, staged rollout options, and governance-safe implementation paths.' },
      { icon: FileCheck, title: 'Trust documentation in hand', desc: 'Explainability standards, governance controls, and security posture are documented for due diligence.' },
      { icon: CheckCircle2, title: 'Implementation risk reduced', desc: 'Phased deployment avoids big-bang risk and aligns with organizational change capacity.' },
      { icon: BarChart3, title: 'Value visibility for leadership', desc: 'Outcomes are measured in operational terms: cycle time, admin burden, and continuity health.' },
      { icon: Layers, title: 'Cross-stakeholder alignment', desc: 'Operations, governance, policy, and technology teams align around one shared implementation plan.' },
    ],
    confidenceHeading: 'Build confidence through coexistence-safe, governance-safe deployment',
    confidenceBody:
      'Procurement teams can evaluate deployment safety through explicit implementation boundaries, continuity safeguards, sovereignty-conscious deployment pacing, and federation-aware operations — additive to existing organizational systems, never displacing them.',
    confidenceCards: [
      { title: 'Implementation Boundaries', body: 'Clear scope definitions for pilot modules, governance ownership, and continuity requirements.' },
      { title: 'Governance Review Pathways', body: 'Documented oversight, explainability standards, and audit-ready decision pathways for due diligence.' },
      { title: 'Phased Adoption Controls', body: 'Sequenced rollout checkpoints that align deployment speed with organizational change capacity.' },
    ],
    rolloutHeading: 'Organizational rollout sequence for procurement planning',
    rolloutBody:
      'This canonical pathway helps procurement and leadership teams validate deployability, risk posture, and implementation realism before commitment.',
    phaseLabel: 'Phase',
    rolloutPathway: institutionalRolloutPathway,
    governanceJourneyHeading: 'Governance journey map',
    governanceJourney: governanceModernizationJourney,
    maturityHeading: 'Operational maturity model',
    operationalMaturityPathway,
    maturityDimensionsHeading: 'Governance maturity dimensions',
    governanceMaturityDimensions,
    pacingHeading: 'Phased pacing for procurement and leadership confidence',
    pacingBody:
      'Reviewers can see how deployment would be staged over time, where governance stays engaged, and how continuity is protected during adoption.',
    deploymentTimelines,
    executiveScenarioModels,
    dueDiligenceHeading: 'Due diligence content as evidence provenance, not procurement theatre',
    dueDiligenceBody:
      'Procurement teams receive implementation-aware evidence organized for reviewability, chronology-linked trust, and continuity-aware, governance-safe deployment decisions — under operational stewardship, not vendor pressure.',
    procurementEvidenceBinder: procurementEvidenceBinder['en-CA'],
    governanceOperationalWalkthroughs: governanceOperationalWalkthroughs['en-CA'],
    simulationHeading: 'Governance review simulation layers',
    governanceReviewSimulationLayers: governanceReviewSimulationLayers['en-CA'],
    relatedHeading: 'Explore related solutions',
    finalHeading: 'Run an evidence-backed procurement process',
    finalBody: 'Get a guided demo and implementation brief for your team.',
  },
  'fr-CA': {
    badge: 'Solutions · Parties prenantes à l’approvisionnement',
    heading: 'Clarté d’approvisionnement pour un déploiement organisationnel.',
    description:
      'UnionEyes donne aux équipes d’approvisionnement une voie de déploiement orientée vers la coexistence et la souveraineté : portée claire, contrôles sûrs pour la gouvernance, opérations conscientes des fédérations et provenance des preuves pour la confiance du leadership.',
    primaryCta: 'Demander un breffage exécutif',
    secondaryCta: 'Examiner le centre de confiance',
    challengeHeading: 'Le défi d’approvisionnement',
    challenges: [
      'Les processus d’approvisionnement ratent souvent les exigences de gouvernance et de sécurité syndicale propres aux syndicats',
      'Les fournisseurs présentent de grandes affirmations IA sans explicabilité ni preuves prêtes pour l’audit',
      'Le risque de mise en œuvre augmente lorsque le déploiement ignore la préparation organisationnelle',
      'Les parties prenantes comparent difficilement les options sans critères clairs de continuité et de confiance',
    ],
    outcomesHeading: 'Ce que les parties prenantes à l’approvisionnement gagnent',
    outcomes: [
      { icon: Briefcase, title: 'Portée prête pour l’approvisionnement', desc: 'Frontières de modules claires, options de déploiement par étapes et parcours sûrs pour la gouvernance.' },
      { icon: FileCheck, title: 'Documentation de confiance disponible', desc: 'Normes d’explicabilité, contrôles de gouvernance et posture de sécurité documentés pour la diligence raisonnable.' },
      { icon: CheckCircle2, title: 'Risque de mise en œuvre réduit', desc: 'Le déploiement par phases évite le risque de bascule massive et respecte la capacité de changement organisationnelle.' },
      { icon: BarChart3, title: 'Visibilité de valeur pour le leadership', desc: 'Les résultats sont mesurés en termes opérationnels : délais, charge administrative et santé de continuité.' },
      { icon: Layers, title: 'Alignement entre parties prenantes', desc: 'Opérations, gouvernance, politique et technologie s’alignent autour d’un même plan de mise en œuvre.' },
    ],
    confidenceHeading: 'Bâtir la confiance par un déploiement sûr pour la coexistence et la gouvernance',
    confidenceBody:
      'Les équipes d’approvisionnement peuvent évaluer la sécurité du déploiement au moyen de limites explicites, de garde-fous de continuité, d’un rythme sensible à la souveraineté et d’opérations conscientes des fédérations — en ajout aux systèmes organisationnels existants, jamais en remplacement.',
    confidenceCards: [
      { title: 'Limites de mise en œuvre', body: 'Définitions claires de la portée des modules pilotes, de la propriété de gouvernance et des exigences de continuité.' },
      { title: 'Voies de revue de gouvernance', body: 'Surveillance documentée, normes d’explicabilité et voies décisionnelles prêtes pour l’audit.' },
      { title: 'Contrôles d’adoption par phases', body: 'Points de contrôle séquencés qui alignent la vitesse de déploiement avec la capacité de changement.' },
    ],
    rolloutHeading: 'Séquence de déploiement organisationnel pour la planification d’approvisionnement',
    rolloutBody:
      'Ce parcours aide les équipes d’approvisionnement et de direction à valider la déployabilité, la posture de risque et le réalisme de mise en œuvre avant l’engagement.',
    phaseLabel: 'Phase',
    rolloutPathway: [
      'Évaluation',
      'Revue de continuité',
      'Cartographie de gouvernance',
      'Alignement du pilote',
      'Adoption opérationnelle',
      'Stabilisation organisationnelle',
      'Résilience à long terme',
    ],
    governanceJourneyHeading: 'Carte du parcours de gouvernance',
    governanceJourney: [
      { stage: 'Étape 1 - Opérations fragmentées', detail: 'La gouvernance et les opérations sont actives, mais le contexte de continuité est dispersé.' },
      { stage: 'Étape 2 - Visibilité de continuité', detail: 'La mémoire organisationnelle et le risque de continuité deviennent visibles dans une vue exploitable.' },
      { stage: 'Étape 3 - Alignement de gouvernance', detail: 'Le raisonnement, les frontières de responsabilité et les parcours opérationnels deviennent lisibles.' },
      { stage: 'Étape 4 - Coordination explicable', detail: 'Les équipes coordonnent leurs décisions avec une justification transparente et des voies de revue claires.' },
      { stage: 'Étape 5 - Résilience organisationnelle', detail: 'L’institution maintient la continuité pendant les transitions sans déstabilisation opérationnelle ou de gouvernance.' },
    ],
    maturityHeading: 'Modèle de maturité opérationnelle',
    operationalMaturityPathway: ['Réactif', 'Coordonné', 'Explicable', 'Conscient de la continuité', 'Résilient institutionnellement'],
    maturityDimensionsHeading: 'Dimensions de maturité de gouvernance',
    governanceMaturityDimensions: [
      { key: 'continuity', label: 'Continuité', focus: 'Résilience organisationnelle' },
      { key: 'governance', label: 'Gouvernance', focus: 'Explicabilité et surveillance' },
      { key: 'operations', label: 'Opérations', focus: 'Coordination et cohérence' },
      { key: 'memory', label: 'Mémoire organisationnelle', focus: 'Préservation et transfert' },
      { key: 'trust', label: 'Confiance', focus: 'Révisabilité et transparence' },
    ],
    pacingHeading: 'Rythme par phases pour la confiance de l’approvisionnement et du leadership',
    pacingBody:
      'Les évaluateurs peuvent voir comment le déploiement serait séquencé, où la gouvernance demeure engagée et comment la continuité est protégée pendant l’adoption.',
    deploymentTimelines: [
      { title: 'Calendrier pilote', purpose: 'Préparation opérationnelle', detail: 'Évaluation, activation ciblée et points de stabilisation pour la première fenêtre de déploiement.' },
      { title: 'Déploiement de gouvernance', purpose: 'Séquençage de surveillance', detail: 'Activation des voies de revue, cartographie des responsabilités et rythme d’approbation.' },
      { title: 'Adoption de continuité', purpose: 'Stabilisation organisationnelle', detail: 'Adoption progressive qui protège la continuité pendant l’ajustement des équipes.' },
      { title: 'Alignement organisationnel', purpose: 'Rythme du changement', detail: 'Période où leadership, opérations et gouvernance convergent autour du nouveau modèle.' },
      { title: 'Progression de maturité', purpose: 'Résilience à long terme', detail: 'Pratiques de preuve soutenues qui préservent la résilience à mesure que l’organisation change.' },
    ],
    executiveScenarioModels: [
      { title: 'Transition de leadership', summary: 'Montre comment les preuves de continuité préservent la connaissance opérationnelle lors d’un changement de direction.' },
      { title: 'Opérations de gouvernance fragmentées', summary: 'Montre comment les voies de revue et les responsabilités réduisent l’incertitude.' },
      { title: 'Instabilité d’intégration', summary: 'Montre comment les artefacts de déploiement contrôlé gardent les nouvelles équipes alignées.' },
      { title: 'Perte de mémoire organisationnelle', summary: 'Montre comment les dossiers de preuve préservent le raisonnement, les précédents et le contexte.' },
      { title: 'Coordination multi-comités', summary: 'Montre comment les points de revue coordonnés évitent les décisions retardées ou dupliquées.' },
      { title: 'Dérive de gouvernance', summary: 'Montre comment les journaux de preuve gardent les décisions de modernisation alignées avec l’intention initiale.' },
    ],
    dueDiligenceHeading: 'La diligence raisonnable comme provenance de preuve, pas comme théâtre d’approvisionnement',
    dueDiligenceBody:
      'Les équipes d’approvisionnement reçoivent des preuves conscientes de la mise en œuvre, organisées pour la revue, la confiance liée à la chronologie et les décisions de déploiement sûres pour la gouvernance.',
    procurementEvidenceBinder: [
      'Garde-fous de mise en œuvre',
      'Structures de surveillance de gouvernance',
      'Philosophie d’explicabilité',
      'Séquençage du déploiement',
      'Limites opérationnelles',
      'Principes de protection de la continuité',
      'Garde-fous de gouvernance pilote',
      'Engagements de révisabilité',
    ],
    governanceOperationalWalkthroughs: [
      { type: 'Transition de leadership', focus: 'Préservation de la continuité', narrative: 'Maintient la mémoire organisationnelle et la continuité de gouvernance pendant le roulement.' },
      { type: 'Revue de gouvernance', focus: 'Explicabilité', narrative: 'Montre comment les décisions restent traçables par des points de revue et des voies de justification.' },
      { type: 'Coordination de comités', focus: 'Cohérence opérationnelle', narrative: 'Aligne les rôles et les transferts afin que les décisions restent coordonnées.' },
      { type: 'Stabilisation d’intégration', focus: 'Mémoire organisationnelle', narrative: 'Préserve le contexte de continuité lorsque de nouvelles équipes héritent de responsabilités.' },
      { type: 'Réduction de fragmentation', focus: 'Alignement', narrative: 'Réduit les silos par un langage de gouvernance partagé et un rythme de revue.' },
      { type: 'Revue d’approvisionnement', focus: 'Confiance de gouvernance', narrative: 'Soutient la diligence raisonnable avec garde-fous, limites et engagements de preuve.' },
    ],
    simulationHeading: 'Couches de simulation de revue de gouvernance',
    governanceReviewSimulationLayers: [
      'Points de revue',
      'Voies d’explicabilité',
      'Niveaux d’approbation',
      'Responsabilité de gouvernance',
      'Validation opérationnelle',
    ],
    relatedHeading: 'Explorer les solutions connexes',
    finalHeading: 'Menez un processus d’approvisionnement fondé sur les preuves',
    finalBody: 'Obtenez une démonstration guidée et un breffage de mise en œuvre pour votre équipe.',
  },
};

export default async function ProcurementPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const carousel = getCarouselNav('procurement', locale);
  const copy = PAGE_COPY[locale as keyof typeof PAGE_COPY] ?? PAGE_COPY['en-CA'];
  const resolveLocaleArray = <T,>(value: T[] | { 'en-CA': readonly T[]; 'fr-CA': readonly T[] }): T[] =>
    Array.isArray(value)
      ? value
      : [
          ...(value[locale as 'en-CA' | 'fr-CA'] ?? value['en-CA']),
        ];
  const rolloutPathway = resolveLocaleArray(copy.rolloutPathway as typeof copy.rolloutPathway & { 'en-CA': readonly string[]; 'fr-CA': readonly string[] });
  const governanceJourney = resolveLocaleArray(copy.governanceJourney as typeof copy.governanceJourney & { 'en-CA': readonly { stage: string; detail: string }[]; 'fr-CA': readonly { stage: string; detail: string }[] });
  const operationalMaturityPathwayList = resolveLocaleArray(copy.operationalMaturityPathway as typeof copy.operationalMaturityPathway & { 'en-CA': readonly string[]; 'fr-CA': readonly string[] });
  return (
    <div className="bg-white min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.procurementLeadership}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white backdrop-blur-sm">
            {copy.badge}
          </span>
        }
        heading={<>{copy.heading}</>}
        description={copy.description}
        cta={
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/${locale}/pilot-request`} className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30">
              {copy.primaryCta}
            </Link>
            <Link href="../trust" className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-navy font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all">
              {copy.secondaryCta}
            </Link>
          </div>
        }
      />

      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-navy mb-4">{copy.challengeHeading}</h2>
            <ul className="space-y-3">
              {copy.challenges.map((c) => (
                <li key={c} className="flex items-start gap-3 text-gray-700 text-sm leading-relaxed">
                  <div className="w-1.5 h-1.5 rounded-full bg-electric mt-1.5 shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
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

      <section className="py-16 bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">          <h2 className="text-2xl font-bold text-navy mb-3">{copy.confidenceHeading}</h2>
          <p className="text-sm text-gray-600 max-w-3xl mb-6">
            {copy.confidenceBody}
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {copy.confidenceCards.map((card) => (
              <article key={card.title} className="p-5 rounded-xl bg-white border border-gray-100">
                <h3 className="text-sm font-bold text-navy mb-2">{card.title}</h3>
                <p className="text-xs text-gray-600">{card.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-navy mb-3">{copy.rolloutHeading}</h2>
          <p className="text-sm text-gray-600 mb-6 max-w-3xl">
            {copy.rolloutBody}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-7 gap-3 text-sm">
            {rolloutPathway.map((stage, index) => (
              <article key={stage} className="p-3 rounded-lg bg-gray-50 border border-gray-100 text-center">
                <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-2">{copy.phaseLabel} {index + 1}</p>
                  <p className="font-semibold text-navy text-center">{stage}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold text-navy mb-4">{copy.governanceJourneyHeading}</h3>
              <div className="space-y-3">
                {governanceJourney.map((stage) => (
                  <article key={stage.stage} className="p-4 rounded-lg bg-white border border-gray-100">
                    <h4 className="text-sm font-semibold text-navy mb-1">{stage.stage}</h4>
                      <p className="text-xs text-gray-600 text-center">{stage.detail}</p>
                  </article>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xl font-bold text-navy mb-4">{copy.maturityHeading}</h3>
              <div className="space-y-3 mb-5">
                {operationalMaturityPathwayList.map((stage, index) => (
                  <div key={stage} className="p-3 rounded-lg bg-white border border-gray-100 text-sm text-gray-700">
                      {index + 1}. <span className="font-semibold text-navy text-center">{stage}</span>
                  </div>
                ))}
              </div>
              <h4 className="text-sm font-bold text-navy mb-2">{copy.maturityDimensionsHeading}</h4>
              <div className="grid sm:grid-cols-2 gap-2">
                {copy.governanceMaturityDimensions.map((dimension) => (
                  <div key={dimension.key} className="p-3 rounded-lg bg-white border border-gray-100">
                    <p className="text-xs font-semibold text-navy">{dimension.label}</p>
                    <p className="text-xs text-gray-600">{dimension.focus}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">          <h2 className="text-2xl font-bold text-navy mb-3">{copy.pacingHeading}</h2>
          <p className="text-sm text-gray-600 max-w-3xl mb-6">
            {copy.pacingBody}
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            {copy.deploymentTimelines.map((timeline) => (
              <article key={timeline.title} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <h3 className="text-sm font-bold text-navy mb-1">{timeline.title}</h3>
                <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-2">{timeline.purpose}</p>
                <p className="text-xs text-gray-600 leading-relaxed">{timeline.detail}</p>
              </article>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {copy.executiveScenarioModels.map((scenario) => (
              <article key={scenario.title} className="p-5 rounded-xl border border-gray-100 bg-gray-50">
                <h3 className="text-sm font-bold text-navy mb-2">{scenario.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{scenario.summary}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">          <h2 className="text-2xl font-bold text-navy mb-3">{copy.dueDiligenceHeading}</h2>
          <p className="text-sm text-gray-600 max-w-3xl mb-6">
            {copy.dueDiligenceBody}
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {copy.procurementEvidenceBinder.map((item) => (
              <article key={item} className="p-4 rounded-lg bg-white border border-gray-100 text-sm text-gray-700">
                {item}
              </article>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {copy.governanceOperationalWalkthroughs.map((walkthrough) => (
              <article key={walkthrough.type} className="p-5 rounded-xl bg-white border border-gray-100">
                <p className="text-[11px] uppercase tracking-widest text-gray-400 mb-1">{walkthrough.focus}</p>
                <h3 className="text-sm font-bold text-navy mb-2">{walkthrough.type}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{walkthrough.narrative}</p>
              </article>
            ))}
          </div>
          <div className="mt-6 p-5 rounded-xl bg-white border border-gray-100">
            <h3 className="text-sm font-bold text-navy mb-3">{copy.simulationHeading}</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {copy.governanceReviewSimulationLayers.map((layer) => (
                <div key={layer} className="text-xs text-gray-700 px-3 py-2 rounded border border-gray-100 bg-gray-50">
                  {layer}
                </div>
              ))}
            </div>
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
          </div>
        </div>
      </section>

      <section className="py-16 bg-navy text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">{copy.finalHeading}</h2>
          <p className="text-white/70 mb-8">{copy.finalBody}</p>
          <Link href={`/${locale}/pilot-request`} className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all">
            {copy.primaryCta}
          </Link>
        </div>
      </section>
    </div>
  );
}
