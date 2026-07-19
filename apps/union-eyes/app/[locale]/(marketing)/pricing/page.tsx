/**
 * Organizational Continuity Engagement Architecture
 *
 * This page is intentionally not a SaaS pricing matrix. UnionEyes is continuity
 * infrastructure: diagnostics, deeper analysis, governance mapping, platform
 * activation, then longitudinal support. Software is the fourth stage, not the
 * entry point.
 *
 * Narrative posture: maturity-oriented organizational engagement, not feature
 * bundling. Every layer is readable, procurement-friendly, and assumes human
 * oversight. Pricing ranges are starting points for joint scoping with leaders.
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Users } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { OrganizationalContinuityNote } from '@/components/marketing/organizational-continuity-note';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';
import { getUnionEyesSiteTopology } from '@/lib/site-topology';
import PricingTabs, { type EngagementLayer } from './_components/pricing-tabs';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.pricing' });
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
    alternates: buildLocaleAlternates(locale, '/pricing'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 1 — Continuity Starts Before Software
// Why OCI exists before the platform. The conditions that make continuity
// fragile inside an organization — before any tooling is procured.
// ─────────────────────────────────────────────────────────────────────────────
const continuityFragility = [
  {
    title: 'Continuity fragility',
    body: 'Procedural knowledge concentrated in a few experienced people. One retirement, one rotation, and the organization loses years of judgment.',
  },
  {
    title: 'Onboarding burden',
    body: 'Every new officer, staff member, or steward inherits unfinished casework with no operating record or precedent map.',
  },
  {
    title: 'Governance inconsistency',
    body: 'Decisions, motions, and commitments scattered across inboxes, drives, and meeting notes — defensible in the moment, undocumented across cycles.',
  },
  {
    title: 'Modernization risk',
    body: 'Tooling decisions made without continuity assessment usually accelerate fragmentation rather than resolve it. The wrong platform makes things worse.',
  },
  {
    title: 'Organizational dependency',
    body: 'The federation depends on individuals more than the individuals know. When they leave, the dependency surfaces — usually under operational pressure.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — When Organizations Typically Engage Us
// Operational moments that bring organizations to the OCI conversation.
// Grounds the offerings in concrete organizational reality.
// ─────────────────────────────────────────────────────────────────────────────
const engagementMoments = [
  { title: 'Leadership transitions', body: 'An incoming president, executive director, or general counsel needs continuity inherited — not reconstructed.' },
  { title: 'Modernization initiatives', body: 'A federation is reviewing tooling and wants to understand continuity risk before procuring anything.' },
  { title: 'Operational fragmentation', body: 'Locals, committees, and staff operating without a shared operating record — coordination cost rising every quarter.' },
  { title: 'Onboarding strain', body: 'New stewards and officers are arriving faster than the organization can transfer judgment to them.' },
  { title: 'Governance restructuring', body: 'A merger, reorganization, or constitutional review needs a continuity baseline before any structural decision.' },
  { title: 'Continuity concerns', body: 'Leadership has named succession and organizational memory as strategic risks and wants them measurable.' },
  { title: 'Federation coordination growth', body: 'A national or sectoral body coordinating across many locals needs operational topology, not more meetings.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3 — The Continuity Journey™
// The maturity-oriented engagement pathway. Five sequential stages.
// Software (Platform Activation) is stage 4 — never stage 1.
// ─────────────────────────────────────────────────────────────────────────────
const continuityJourney = [
  {
    stage: '1',
    name: 'OCI Assessment',
    outcome: 'Understand continuity fragility',
    summary: 'A scoped organizational diagnostic that surfaces where continuity actually breaks — and where it quietly holds.',
  },
  {
    stage: '2',
    name: 'OCRA Deepening',
    outcome: 'Identify structural continuity risks',
    summary: 'Adaptive continuity intelligence: continuity topology, modernization pathways, and confidence-aware interpretation.',
  },
  {
    stage: '3',
    name: 'Governance Mapping',
    outcome: 'Clarify operational dependencies',
    summary: 'Translate findings into a governance-readable map of dependencies, decisions of record, and continuity obligations.',
  },
  {
    stage: '4',
    name: 'Platform Activation',
    outcome: 'Stabilize continuity operations',
    summary: 'Only here does the platform enter — as continuity infrastructure activated on top of the assessment, not as generic software.',
  },
  {
    stage: '5',
    name: 'Longitudinal Support',
    outcome: 'Sustain organizational continuity',
    summary: 'Ongoing continuity stewardship: governance entropy review, executive intelligence, and federation-level continuity health.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3.5 — Assessment Ladder (GTM entry funnel)
// Mirrors the three entry tiers on /organizational-continuity-risk so the
// pricing page reflects the actual go-to-market motion: a free ICRA reflection,
// a paid Leadership Briefing Report at $1,200, and a facilitated Organizational
// Continuity Diagnostic at $6,500. These precede the larger engagement layers.
// ─────────────────────────────────────────────────────────────────────────────
const assessmentLadder = [
  {
    key: 'continuity_reflection',
    name: 'Free Readiness Check',
    price: 'Free',
    pricePosture: 'Pseudonymous · no login required',
    summary:
      'A scoped organizational continuity assessment that surfaces fragility, signals, and burden — without commitment. The ICRA entry point.',
    includes: [
      'OCI band and continuity score',
      'Quiet-risk signal observations',
      'Continuity burden index',
      'One recommendation to start a conversation',
    ],
    cta: 'Start the assessment',
    ctaHref: '/organizational-continuity-risk',
    featured: false,
  },
  {
    key: 'executive_continuity_brief',
    name: 'Leadership Briefing Report',
    price: '$1,200 CAD',
    pricePosture: 'One-time · delivered as a governance-readable document',
    summary:
      'A deeper organizational reading of the same assessment — governance entropy, continuity debt, dependency review, and modernization risk surfaced for executive and board conversation.',
    includes: [
      'Everything in the Free Readiness Check',
      'Governance entropy analysis',
      'Continuity debt analysis',
      'Organizational dependency review',
      'Modernization risk layer',
      'Full prioritized recommendations',
    ],
    cta: 'Begin with the brief',
    ctaHref: '/organizational-continuity-risk?intendedTier=executive_continuity_brief',
    featured: true,
  },
  {
    key: 'institutional_continuity_diagnostic',
    name: 'Full Diagnostic & Action Plan',
    price: '$6,500 CAD',
    pricePosture: 'Facilitated engagement · executive workshop included · 100% credited toward any subsequent engagement if signed within 90 days',
    summary:
      'A full diagnostic engagement: facilitated review, organizational continuity workshop, memory lineage mapping, and an executive briefing note your board can act on. The full fee credits forward toward a subsequent Assessment, Topology, or Platform Engagement if you proceed within 90 days.',
    includes: [
      'Everything in the Leadership Briefing Report',
      'Facilitated diagnostic review',
      'Organizational continuity workshop',
      'Memory lineage mapping',
      'Executive briefing note',
      '100% credited toward subsequent engagement (within 90 days)',
    ],
    cta: 'Request this diagnostic',
    ctaHref: '/contact?topic=organizational-continuity-diagnostic',
    featured: false,
  },
];

const frAssessmentLadder = [
  {
    key: 'continuity_reflection',
    name: 'Réflexion sur la continuité',
    price: 'Gratuit',
    pricePosture: 'Pseudonyme · aucune connexion requise',
    summary:
      "Une évaluation organisationnelle ciblée qui révèle la fragilité, les signaux et le fardeau — sans engagement. Le point d'entrée ICRA.",
    includes: [
      'Bande OCI et indice de continuité',
      'Observations sur les signaux de risque silencieux',
      'Indice de fardeau de continuité',
      'Une recommandation pour amorcer la conversation',
    ],
    cta: "Commencer l'évaluation",
    ctaHref: '/organizational-continuity-risk',
    featured: false,
  },
  {
    key: 'executive_continuity_brief',
    name: 'Note de continuité exécutive',
    price: '1 200 $ CAD',
    pricePosture: 'Ponctuel · livré sous forme de document lisible par la gouvernance',
    summary:
      "Une lecture organisationnelle approfondie de la même évaluation — entropie de gouvernance, dette de continuité, revue des dépendances et risque de modernisation, mis en forme pour la conversation exécutive.",
    includes: [
      'Tout ce qui est dans la Réflexion sur la continuité',
      "Analyse de l'entropie de gouvernance",
      'Analyse de la dette de continuité',
      'Revue des dépendances organisationnelles',
      'Couche de risque de modernisation',
      'Recommandations priorisées complètes',
    ],
    cta: 'Commencer par la note',
    ctaHref: '/organizational-continuity-risk?intendedTier=executive_continuity_brief',
    featured: true,
  },
  {
    key: 'institutional_continuity_diagnostic',
    name: 'Diagnostic organisationnel de continuité',
    price: '6 500 $ CAD',
    pricePosture: 'Engagement facilité · atelier exécutif inclus · crédité à 100 % sur tout engagement subséquent signé dans les 90 jours',
    summary:
      "Un engagement diagnostic complet : revue facilitée, atelier organisationnel de continuité, cartographie de la lignée mémorielle, et note de synthèse exécutive sur laquelle votre conseil peut agir. Le montant complet est crédité sur un engagement Évaluation, Topologie ou Plateforme subséquent si vous y donnez suite dans les 90 jours.",
    includes: [
      'Tout ce qui est dans la Note exécutive',
      'Revue diagnostique facilitée',
      'Atelier organisationnel de continuité',
      'Cartographie de la lignée mémorielle',
      'Note de synthèse exécutive',
      'Crédité à 100 % sur un engagement subséquent (dans les 90 jours)',
    ],
    cta: 'Demander ce diagnostic',
    ctaHref: '/contact?topic=organizational-continuity-diagnostic',
    featured: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Engagement Layers
// Replaces "tiers". These are organizational continuity engagement layers —
// not SaaS plans. Each one is a distinct posture and a distinct conversation.
// ─────────────────────────────────────────────────────────────────────────────
const engagementLayers: EngagementLayer[] = [
  {
    key: 'oci',
    icon: 'compass',
    name: 'OCI — Continuity Assessment',
    posture: 'Organizational diagnostics',
    layer: 'Assessment Engagement · Continuity intelligence',
    fit: 'Federations and organizations establishing a continuity baseline before any tooling decision.',
    feels: 'Diagnostic. Discreet. Strategic.',
    deliverables: [
      'OCI Snapshot — scoped continuity baseline',
      'Leadership Briefing Report',
      'Governance Entropy Review',
      'Organizational Continuity Workshop',
    ],
    range: '$18,000–$45,000 CAD · one-time engagement',
  },
  {
    key: 'ocra',
    icon: 'network',
    name: 'OCRA — Adaptive Continuity Intelligence',
    posture: 'Structural risk deepening',
    layer: 'Topology Engagement · Continuity topology',
    fit: 'Organizations that have a baseline and need structural depth: dependency analysis, modernization pathways, confidence-aware interpretation.',
    feels: 'Structural. Interpretive. Forward-looking.',
    deliverables: [
      'Structural continuity analysis',
      'Continuity topology mapping',
      'Modernization pathway evaluation',
      'Confidence-aware operational interpretation',
    ],
    range: '$35,000–$90,000 CAD · one-time engagement',
  },
  {
    key: 'platform',
    icon: 'layers',
    name: 'Platform Activation',
    posture: 'Continuity infrastructure (post-diagnostic)',
    layer: 'Platform Engagement · Operational continuity infrastructure',
    fit: 'Organizations ready to activate continuity infrastructure on top of an assessed baseline — not generic SaaS onboarding. Requires a completed Assessment Engagement (or Full Diagnostic) first.',
    feels: 'Operational. Governance-safe. Inherited.',
    deliverables: [
      'Operational continuity tooling activation',
      'Governance infrastructure alignment',
      'Evidence and decisions-of-record systems',
      'Continuity-safe workflows for officers, stewards, and staff',
    ],
    range: '$40,000–$140,000 CAD per year · annual subscription (post-diagnostic)',
  },
  {
    key: 'longitudinal',
    icon: 'infinity',
    name: 'Longitudinal Continuity Support',
    posture: 'Continuity stewardship',
    layer: 'Stewardship Engagement · Governance continuity',
    fit: 'National unions and federations sustaining continuity across leadership cycles, mandates, and federation-wide coordination.',
    feels: 'Durable. Inherited. Federation-grade.',
    deliverables: [
      'Continuous governance entropy monitoring',
      'Longitudinal executive continuity intelligence',
      'Federation-level continuity coordination',
      'Operational sovereignty posture maintenance',
    ],
    range: 'Multi-year stewardship · scoped with executive leadership',
  },
  {
    key: 'founding',
    icon: 'sparkles',
    name: 'Founding Partner Cohort',
    posture: 'Strategic organizational collaboration',
    layer: 'Cohort Engagement · Co-development partnership',
    fit: 'A small number of organizations co-developing continuity infrastructure with us — operationally embedded, doctrinally close.',
    feels: 'Co-developed. Privileged. Long-cycle.',
    deliverables: [
      'Direct co-design with the founding team',
      'Reserved governance influence on platform doctrine',
      'Privileged access to OCRA and continuity research',
      'Named cohort recognition in organizational materials',
    ],
    range: 'Cohort terms · by invitation and mutual fit',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — Procurement-Safe Organizational Commitments
// These are positions, not features. They distinguish continuity infrastructure
// from generic AI tooling — and are the procurement department's first real read.
// ─────────────────────────────────────────────────────────────────────────────
const procurementCommitments = [
  { title: 'Human oversight by design', body: 'Every operational pathway assumes a named human owner. Cognition surfaces are operator-initiated and operator-reviewable.' },
  { title: 'Governance-safe AI', body: 'Reasoning operates under organizational governance — not autonomous agent assumptions. Explainability is structural, not optional.' },
  { title: 'No worker surveillance', body: 'UnionEyes does not rank, score, or monitor individual workers. Continuity infrastructure is organizational, not personal.' },
  { title: 'Explainable interpretation', body: 'Every interpretive surface exposes its confidence posture and dependency chain. No opaque decisions.' },
  { title: 'Continuity-focused interpretation', body: 'All cognition is oriented toward organizational continuity — not productivity scoring or behavioural analysis.' },
  { title: 'No organizational ranking', body: 'We do not benchmark, league-table, or compare unions against each other. Continuity is sovereign to each organization.' },
  { title: 'Canadian residency', body: 'Canadian-hosted, sovereignty-conscious organizational trust. Data residency and sovereign hosting are structural commitments.' },
  { title: 'Fail-closed degradation', body: 'When systems degrade, they degrade safely — operations remain governable, not opaque.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// French (fr-CA) parallel content
// ─────────────────────────────────────────────────────────────────────────────
const frContinuityFragility = [
  { title: 'Fragilité de la continuité', body: 'Le savoir procédural est concentré chez quelques personnes expérimentées. Un départ à la retraite, une rotation — et l’organization perd des années de jugement.' },
  { title: 'Charge d’intégration', body: 'Chaque nouveau dirigeant, employé ou délégué hérite de dossiers inachevés sans registre opérationnel, sans carte des précédents, sans transmission de continuité.' },
  { title: 'Incohérence de gouvernance', body: 'Décisions, motions et engagements dispersés entre courriels, lecteurs et notes de réunion — défendables sur le moment, non documentés à travers les cycles.' },
  { title: 'Risque de modernisation', body: 'Les décisions d’outillage prises sans évaluation de continuité accélèrent généralement la fragmentation plutôt que de la résoudre.' },
  { title: 'Dépendance organisationnelle', body: 'La fédération dépend des individus plus que les individus ne le savent. Leur départ révèle la dépendance — généralement sous pression opérationnelle.' },
];

const frEngagementMoments = [
  { title: 'Transitions de leadership', body: 'Un nouveau président, directeur exécutif ou conseiller général a besoin que la continuité soit transmise — pas reconstruite.' },
  { title: 'Initiatives de modernisation', body: 'Une fédération examine son outillage et souhaite comprendre le risque de continuité avant tout investissement.' },
  { title: 'Fragmentation opérationnelle', body: 'Sections locales, comités et personnel opérant sans registre partagé — les coûts de coordination augmentent à chaque trimestre.' },
  { title: 'Pression sur l’intégration', body: 'Les nouveaux délégués et dirigeants arrivent plus vite que l’organization ne peut leur transférer son jugement.' },
  { title: 'Restructuration de la gouvernance', body: 'Une fusion, une réorganisation ou une révision constitutionnelle requiert une base de continuité avant toute décision structurelle.' },
  { title: 'Préoccupations de continuité', body: 'La direction a nommé la succession et la mémoire organisationnelle comme risques stratégiques et veut les rendre mesurables.' },
  { title: 'Croissance de la coordination fédérative', body: 'Un organisme national ou sectoriel coordonnant plusieurs sections locales a besoin de topologie opérationnelle, pas de réunions supplémentaires.' },
];

const frContinuityJourney = [
  { stage: '1', name: 'Évaluation OCI', outcome: 'Comprendre la fragilité de la continuité', summary: 'Un diagnostic organisationnel ciblé qui révèle où la continuité se rompt — et où elle tient silencieusement.' },
  { stage: '2', name: 'Approfondissement OCRA', outcome: 'Identifier les risques structurels de continuité', summary: 'Intelligence de continuité adaptative : topologie, parcours de modernisation, interprétation consciente du niveau de confiance.' },
  { stage: '3', name: 'Cartographie de gouvernance', outcome: 'Clarifier les dépendances opérationnelles', summary: 'Traduire les constats en une carte lisible par la gouvernance des dépendances, des décisions officielles et des obligations de continuité.' },
  { stage: '4', name: 'Activation de plateforme', outcome: 'Stabiliser les opérations de continuité', summary: 'Ce n’est qu’ici que la plateforme entre en jeu — comme infrastructure de continuité activée sur la base de l’évaluation.' },
  { stage: '5', name: 'Soutien longitudinal', outcome: 'Soutenir la continuité organisationnelle', summary: 'Intendance continue de continuité : revue d’entropie de gouvernance, intelligence exécutive et santé fédérative.' },
];

const frEngagementLayers: EngagementLayer[] = [
  {
    key: 'oci', icon: 'compass',
    name: 'OCI — Évaluation de continuité',
    posture: 'Diagnostics organisationnels',
    layer: 'Engagement Évaluation · Intelligence de continuité',
    fit: 'Fédérations et organizations établissant une base de continuité avant toute décision d’outillage.',
    feels: 'Diagnostic. Discret. Stratégique.',
    deliverables: ['Aperçu OCI — base de continuité ciblée', 'Note exécutive de continuité', 'Revue d’entropie de gouvernance', 'Atelier organisationnel de continuité'],
    range: '18 000 $ à 45 000 $ CAD · engagement ponctuel',
  },
  {
    key: 'ocra', icon: 'network',
    name: 'OCRA — Intelligence de continuité adaptative',
    posture: 'Approfondissement structurel des risques',
    layer: 'Engagement Topologie · Topologie de continuité',
    fit: 'Organizations disposant d’une base et nécessitant une profondeur structurelle : analyse des dépendances, parcours de modernisation, interprétation consciente du niveau de confiance.',
    feels: 'Structurel. Interprétatif. Tourné vers l’avenir.',
    deliverables: ['Analyse structurelle de continuité', 'Cartographie de la topologie de continuité', 'Évaluation des parcours de modernisation', 'Interprétation opérationnelle consciente du niveau de confiance'],
    range: '35 000 $ à 90 000 $ CAD · engagement ponctuel',
  },
  {
    key: 'platform', icon: 'layers',
    name: 'Activation de plateforme',
    posture: 'Infrastructure de continuité (post-diagnostic)',
    layer: 'Engagement Plateforme · Infrastructure opérationnelle de continuité',
    fit: 'Organizations prêtes à activer une infrastructure de continuité sur une base évaluée — pas un déploiement SaaS générique. Requiert un Engagement Évaluation (ou un Diagnostic complet) préalable.',
    feels: 'Opérationnel. Respectueux de la gouvernance. Transmissible.',
    deliverables: ['Activation d’outils opérationnels de continuité', 'Alignement d’infrastructure de gouvernance', 'Systèmes de preuve et décisions officielles', 'Flux de travail respectueux de la continuité pour dirigeants, délégués et personnel'],
    range: '40 000 $ à 140 000 $ CAD par année · abonnement annuel (post-diagnostic)',
  },
  {
    key: 'longitudinal', icon: 'infinity',
    name: 'Soutien longitudinal de continuité',
    posture: 'Intendance de continuité',
    layer: 'Engagement Intendance · Continuité de gouvernance',
    fit: 'Syndicats nationaux et fédérations soutenant la continuité à travers les cycles de leadership, les mandats et la coordination fédérative.',
    feels: 'Durable. Transmissible. À l’échelle fédérative.',
    deliverables: ['Surveillance continue de l’entropie de gouvernance', 'Intelligence exécutive longitudinale de continuité', 'Coordination fédérative de continuité', 'Maintien de la posture de souveraineté opérationnelle'],
    range: 'Intendance pluriannuelle · définie avec la direction exécutive',
  },
  {
    key: 'founding', icon: 'sparkles',
    name: 'Cohorte de déploiement guidé',
    posture: 'Collaboration organisationnelle stratégique',
    layer: 'Engagement Cohorte · Partenariat de co-développement',
    fit: 'Un petit nombre d’organizations co-développant l’infrastructure de continuité avec nous — engagement opérationnel et doctrinal rapproché.',
    feels: 'Co-développé. Privilégié. À long cycle.',
    deliverables: ['Co-conception directe avec l’équipe fondatrice', 'Influence de gouvernance réservée sur la doctrine de plateforme', 'Accès privilégié à la recherche OCRA et continuité', 'Reconnaissance nommée de la cohorte dans le matériel organisationnel'],
    range: 'Conditions de cohorte · sur invitation et ajustement mutuel',
  },
];

const frProcurementCommitments = [
  { title: 'Supervision humaine par conception', body: 'Chaque parcours opérationnel suppose un propriétaire humain nommé. Les surfaces cognitives sont déclenchées et révisées par un opérateur.' },
  { title: 'IA respectueuse de la gouvernance', body: 'Le raisonnement opère sous gouvernance organisationnelle — pas selon des hypothèses d’agent autonome. L’explicabilité est structurelle, pas optionnelle.' },
  { title: 'Aucune surveillance des travailleurs', body: 'UnionEyes ne classe pas, n’évalue pas et ne surveille pas les travailleurs. L’infrastructure de continuité est organisationnelle, pas personnelle.' },
  { title: 'Interprétation explicable', body: 'Chaque surface interprétative expose sa posture de confiance et sa chaîne de dépendance. Aucune décision en boîte noire.' },
  { title: 'Interprétation orientée continuité', body: 'Toute cognition est orientée vers la continuité organisationnelle — pas vers l’évaluation de productivité ou l’analyse comportementale.' },
  { title: 'Aucun classement organisationnel', body: 'Nous ne comparons pas les syndicats entre eux. La continuité est souveraine à chaque organization.' },
  { title: 'Résidence canadienne', body: 'Hébergement canadien, confiance organisationnelle consciente de la souveraineté. La résidence et l’hébergement souverain sont des engagements structurels.' },
  { title: 'Dégradation sécuritaire', body: 'Lorsque les systèmes se dégradent, ils le font de manière gouvernable et non opaque.' },
];

const pricingCopy = {
  'en-CA': {
    heading: <>Organizational continuity engagement architecture,<br />not software pricing tiers.</>,
    description: 'UnionEyes starts with an assessment, then moves into deeper review and rollout support if needed. Most organizations begin by understanding their risks before discussing any software rollout.',
    section1Heading: 'Continuity starts before software',
    section1Body: 'Most organizations discover they have a knowledge and handoff problem before they have a software problem. We help measure that risk first.',
    section2Heading: 'When organizations typically engage us',
    section2Body: 'There is no single trigger — but these are the operational moments that consistently bring federations and unions to the OCI conversation.',
    section3Heading: 'The path most organizations follow',
    section3Body: 'This work usually happens in stages. Organizations start with a check, move into deeper review if needed, and only then decide whether broader rollout support makes sense.',
    stageLabel: 'Stage',
    outcomeLabel: 'Outcome',
    tabStartHere: 'Start here',
    tabEngagementLayers: 'Engagement layers',
    tabJourney: 'The journey',
    tabWhy: 'Why this exists',
    tabProcurement: 'Procurement',
    sectionLadderEyebrow: 'Start here',
    sectionLadderHeading: 'The assessment ladder',
    sectionLadderBody: 'Every UnionEyes relationship begins with an assessment. The first three steps are clear and priced so a leader can start the conversation without waiting for a long sales process.',
    sectionLadderFooter: 'Most organizations start with the free check and only move further when the risks uncovered justify it.',
    ladderIncludesLabel: 'What you receive',
    ladderFeaturedBadge: 'Most organizations start here',
    section4Heading: 'Deeper support options',
    section4Body: 'When an assessment shows bigger continuity risks, organizations can move into deeper support. These are service options, not seat-based software packages.',
    fitPrefix: 'Best for: ',
    deliverablesLabel: 'What you receive',
    investmentLabel: 'Investment',
    rangeNote: 'A starting range. Final scope is shaped jointly with you and your procurement leadership — no self-serve checkout, ever.',
    unsureTitle: 'Not sure which layer fits?',
    unsureBody: 'Most organizations start with a short continuity conversation, even when they think they need software right away.',
    unsureCta: 'Start with a continuity conversation',
    procurementLabel: 'Procurement-safe by design',
    commitmentsHeading: 'What we commit to',
    commitmentsBody: 'Every service option carries the same core commitments. These are usually the first things procurement teams want to review.',
    trustCenter: 'Trust Center',
    governanceStructure: 'Governance Structure',
    organizationalProof: 'Organizational Proof',
    ctaLabel: 'Begin with an assessment',
    ctaHeading: 'Start with a continuity conversation',
    ctaBody: 'Tell us where your organization is today. We will help you understand which option fits and what the next step should be.',
    ctaPrimary: 'Take the review',
    ctaSecondary: 'Discuss your options',
    ctaFinePrint: 'Scope and pricing are finalized with executive and procurement leadership. There is no self-serve subscription path.',
    glossaryLabel: 'Terms used on this page',
    glossary: [
      { acronym: 'OCI', expansion: 'Organizational Continuity Index', body: 'A scoped organizational diagnostic that measures continuity fragility — what would break if a key person, a leadership cycle, or a critical decision-of-record were lost tomorrow.' },
      { acronym: 'OCRA', expansion: 'Organizational Continuity Risk Analysis', body: 'A deeper, structural reading of continuity risk: dependency topology, modernization pathways, governance entropy, and confidence-aware operational interpretation.' },
    ],
    continuityFragility, engagementMoments, continuityJourney, assessmentLadder, engagementLayers, procurementCommitments,
  },
  'fr-CA': {
    heading: <>Architecture d’engagement de continuité organisationnelle,<br />pas une grille tarifaire logicielle.</>,
    description: 'UnionEyes commence par une évaluation, puis passe à une revue plus approfondie et à un soutien au déploiement si nécessaire. La plupart des organisations commencent par comprendre leurs risques avant de parler de déploiement logiciel.',
    section1Heading: 'La continuité commence avant le logiciel',
    section1Body: 'La plupart des organisations découvrent qu’elles ont d’abord un problème de transfert de savoir et de relève, avant d’avoir un problème de logiciel. Nous aidons à mesurer ce risque en premier.',
    section2Heading: 'Quand les organisations nous engagent typiquement',
    section2Body: 'Il n’y a pas de déclencheur unique — mais voici les moments opérationnels qui amènent constamment les fédérations et les syndicats à la conversation OCI.',
    section3Heading: 'Le parcours le plus fréquent',
    section3Body: 'Ce travail se fait généralement par étapes. Les organisations commencent par un bilan, passent à une revue plus approfondie si nécessaire, puis décident si un soutien plus large au déploiement est utile.',
    stageLabel: 'Étape',
    outcomeLabel: 'Résultat',
    tabStartHere: 'Commencer ici',
    tabEngagementLayers: 'Couches d’engagement',
    tabJourney: 'Le parcours',
    tabWhy: 'Pourquoi nous existons',
    tabProcurement: 'Approvisionnement',
    sectionLadderEyebrow: 'Commencer ici',
    sectionLadderHeading: 'L’échelle d’évaluation',
    sectionLadderBody: 'Chaque relation avec UnionEyes commence par une évaluation. Les trois premières étapes sont claires et tarifées afin qu’une direction puisse lancer la conversation sans attendre un long cycle de vente.',
    sectionLadderFooter: 'La plupart des organisations commencent par le bilan gratuit et n’avancent que si les risques révélés le justifient.',
    ladderIncludesLabel: 'Ce que vous recevez',
    ladderFeaturedBadge: 'La plupart des organizations commencent ici',
    section4Heading: 'Options d’accompagnement plus poussées',
    section4Body: 'Quand une évaluation révèle des risques plus importants, une organisation peut passer à un accompagnement plus poussé. Ce sont des options de service, pas des forfaits logiciels par utilisateur.',
    fitPrefix: 'Convient à : ',
    deliverablesLabel: 'Ce que vous recevez',
    investmentLabel: 'Investissement',
    rangeNote: 'Une fourchette de départ. La portée finale est définie conjointement avec votre équipe d’approvisionnement — jamais en libre-service.',
    unsureTitle: 'Vous ne savez pas quelle couche convient?',
    unsureBody: 'La plupart des organisations commencent par une courte conversation sur la continuité, même lorsqu’elles pensent avoir besoin du logiciel immédiatement.',
    unsureCta: 'Commencer par une conversation sur la continuité',
    procurementLabel: 'Conçu pour l’approvisionnement',
    commitmentsHeading: 'Nos engagements',
    commitmentsBody: 'Chaque option de service repose sur les mêmes engagements de base. Ce sont habituellement les premiers éléments que les équipes d’approvisionnement veulent vérifier.',
    trustCenter: 'Centre de confiance',
    governanceStructure: 'Structure de gouvernance',
    organizationalProof: 'Preuves organisationnelles',
    ctaLabel: 'Commencer par une évaluation',
    ctaHeading: 'Commencer par une conversation de continuité',
    ctaBody: 'Dites-nous où en est votre organisation aujourd’hui. Nous vous aidons à comprendre quelle option convient le mieux et quelle devrait être la prochaine étape.',
    ctaPrimary: 'Faire le bilan',
    ctaSecondary: 'Discuter de vos options',
    ctaFinePrint: 'La portée et les prix finaux sont établis avec la direction exécutive et l’approvisionnement. Il n’existe pas de formule libre-service.',
    glossaryLabel: 'Termes utilisés sur cette page',
    glossary: [
      { acronym: 'OCI', expansion: 'Indice de continuité organisationnelle', body: 'Un diagnostic organisationnel ciblé qui mesure la fragilité de la continuité — ce qui se romprait si une personne clé, un cycle de leadership ou une décision critique était perdue demain.' },
      { acronym: 'OCRA', expansion: 'Analyse des risques de continuité organisationnelle', body: 'Une lecture structurelle approfondie du risque de continuité : topologie des dépendances, parcours de modernisation, entropie de gouvernance, et interprétation opérationnelle consciente du niveau de confiance.' },
    ],
    continuityFragility: frContinuityFragility,
    engagementMoments: frEngagementMoments,
    continuityJourney: frContinuityJourney,
    assessmentLadder: frAssessmentLadder,
    engagementLayers: frEngagementLayers,
    procurementCommitments: frProcurementCommitments,
  },
} as const;

export default async function LocalePricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tNote = await getTranslations({ locale, namespace: 'continuityNotes.procurement' });
  const copy = pricingCopy[locale as keyof typeof pricingCopy] ?? pricingCopy['en-CA'];
  const { marketingUrl } = getUnionEyesSiteTopology();

  // Schema.org Service + Offer surface aligned to the GTM funnel on
  // /organizational-continuity-risk. Three concrete tiers (Continuity
  // Reflection / Leadership Briefing Report / Organizational Continuity
  // Diagnostic) plus four engagement layers (priced as ranges) get exposed
  // as a Service with an AggregateOffer so search engines and procurement
  // crawlers see the real entry funnel — not a generic SaaS price band.
  const pricingServiceSchema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'UnionEyes Organizational Continuity Engagement',
    serviceType: 'Organizational continuity assessment and infrastructure',
    provider: {
      '@type': 'Organization',
      name: 'UnionEyes',
      url: marketingUrl,
    },
    areaServed: { '@type': 'Country', name: 'Canada' },
    availableLanguage: ['en-CA', 'fr-CA'],
    url: `${marketingUrl}/${locale}/pricing`,
    description:
      'Organizational continuity engagement architecture for unions, federations, and democratic organizations — Free Readiness Check, Leadership Briefing Report, Full Diagnostic & Action Plan, then layered platform activation and longitudinal support.',
    offers: [
      {
        '@type': 'Offer',
        name: 'Free Readiness Check',
        description:
          'Pseudonymous organizational continuity assessment (ICRA). OCI band, quiet-risk signal observations, continuity burden index, one starter recommendation. No login required.',
        price: '0',
        priceCurrency: 'CAD',
        availability: 'https://schema.org/InStock',
        url: `${marketingUrl}/${locale}/organizational-continuity-risk`,
      },
      {
        '@type': 'Offer',
        name: 'Leadership Briefing Report',
        description:
          'Governance-readable deepening of the continuity assessment: governance entropy, continuity debt, organizational dependency review, modernization risk, prioritized recommendations.',
        price: '1200',
        priceCurrency: 'CAD',
        availability: 'https://schema.org/InStock',
        url: `${marketingUrl}/${locale}/organizational-continuity-risk?intendedTier=executive_continuity_brief`,
      },
      {
        '@type': 'Offer',
        name: 'Full Diagnostic & Action Plan',
        description:
          'Facilitated diagnostic engagement: organizational continuity workshop, memory lineage mapping, and executive briefing note your board can act on.',
        price: '6500',
        priceCurrency: 'CAD',
        availability: 'https://schema.org/InStock',
        url: `${marketingUrl}/${locale}/contact?topic=organizational-continuity-diagnostic`,
      },
      {
        '@type': 'AggregateOffer',
        name: 'OCI — Continuity Assessment engagement layer',
        description:
          'Layered organizational diagnostic engagement: OCI Snapshot, Leadership Briefing Report, Governance Entropy Review, Organizational Continuity Workshop.',
        priceCurrency: 'CAD',
        lowPrice: '18000',
        highPrice: '45000',
        offerCount: 1,
        url: `${marketingUrl}/${locale}/pricing#engagement-layers`,
      },
      {
        '@type': 'AggregateOffer',
        name: 'OCRA — Adaptive Continuity Intelligence engagement layer',
        description:
          'Structural continuity analysis, continuity topology mapping, modernization pathway evaluation, confidence-aware operational interpretation.',
        priceCurrency: 'CAD',
        lowPrice: '35000',
        highPrice: '90000',
        offerCount: 1,
        url: `${marketingUrl}/${locale}/pricing#engagement-layers`,
      },
      {
        '@type': 'AggregateOffer',
        name: 'Platform Activation engagement layer',
        description:
          'Operational continuity tooling activation atop an assessed baseline — governance infrastructure alignment, decisions-of-record systems, continuity-safe workflows.',
        priceCurrency: 'CAD',
        lowPrice: '40000',
        highPrice: '140000',
        offerCount: 1,
        url: `${marketingUrl}/${locale}/pricing#engagement-layers`,
      },
    ],
  };

  return (
    <div className="organization-shell min-h-screen">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- structured data; values are static literals
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingServiceSchema) }}
      />
      <MarketingHeroSection
        imageUrl={heroImagery.pricing}
        tone="dark"
        revealTempo="conference"
        heading={copy.heading}
        description={copy.description}
      />

      <OrganizationalContinuityNote
        surface={tNote('label')}
        posture={tNote('posture')}
      />

      {/* ── Inline glossary — OCI / OCRA definitions on first encounter ── */}
      <section className="py-10 bg-white border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-4">
            {copy.glossaryLabel}
          </p>
          <dl className="grid sm:grid-cols-2 gap-4">
            {copy.glossary.map((term) => (
              <div key={term.acronym} className="organization-panel calm-elevation p-5">
                <dt className="flex items-baseline gap-2 mb-1.5">
                  <span className="text-base font-bold text-navy tracking-wide">{term.acronym}</span>
                  <span className="text-xs text-slate-500 font-medium">{term.expansion}</span>
                </dt>
                <dd className="text-xs text-slate-600 leading-relaxed">{term.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* -- Tabbed pricing surface (replaces six long-scroll sections) -- */}
      <PricingTabs locale={locale} copy={copy} />

      {/* ── Executive briefing CTA ── */}
      <section className="py-16 bg-navy text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-white/10 text-xs font-semibold tracking-wide uppercase mb-4">
            <Users className="h-3.5 w-3.5" />
            {copy.ctaLabel}
          </div>
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            {copy.ctaHeading}
          </h2>
          <p className="text-white/75 text-base max-w-3xl mx-auto mb-8 leading-relaxed">
            {copy.ctaBody}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/${locale}/organizational-continuity-risk`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white text-navy font-semibold rounded-xl hover:bg-slate-100 transition-all"
            >
              {copy.ctaPrimary}
            </Link>
            <Link
              href={`/${locale}/contact`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/90 text-navy font-semibold rounded-xl border border-white hover:bg-white transition-all"
            >
              {copy.ctaSecondary}
            </Link>
          </div>
          <p className="text-xs text-white/55 mt-6 max-w-2xl mx-auto leading-relaxed">
            {copy.ctaFinePrint}
          </p>
          <p className="mt-5 text-sm text-white/80">
            <Link
              href={`/${locale}/whitepaper`}
              className="inline-flex items-center gap-1 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded"
            >
              {locale === 'fr-CA'
                ? 'Lire le livre blanc UnionEyes (~25 min)'
                : 'Read the UnionEyes whitepaper (~25 min read)'}
              <span aria-hidden="true">→</span>
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
