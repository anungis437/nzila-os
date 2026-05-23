/**
 * Institutional Continuity Engagement Architecture
 *
 * This page is intentionally NOT a SaaS pricing matrix. UnionEyes is continuity
 * infrastructure — OCI (Organizational Continuity Index) diagnostics, OCRA
 * (Organizational Continuity Risk Analysis) deepening, governance mapping, then
 * platform activation, then longitudinal support. Software is the *fourth*
 * stage of the engagement, not the entry point.
 *
 * Narrative posture: maturity-oriented institutional engagement, not feature
 * bundling. Every layer is governance-safe, procurement-readable, and assumes
 * human oversight by design. Pricing ranges are starting points for joint
 * scoping with executive and procurement leadership — not self-serve tiers.
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Users } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { InstitutionalContinuityNote } from '@/components/marketing/institutional-continuity-note';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';
import PricingTabs from './_components/pricing-tabs';

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
// fragile inside an institution — before any tooling is procured.
// ─────────────────────────────────────────────────────────────────────────────
const continuityFragility = [
  {
    title: 'Continuity fragility',
    body: 'Procedural knowledge concentrated in a few experienced people. One retirement, one rotation, and the institution loses years of judgment.',
  },
  {
    title: 'Onboarding burden',
    body: 'Every new officer, staff member, or steward inherits unfinished casework with no operating record, no precedent map, and no continuity briefing.',
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
    title: 'Institutional dependency',
    body: 'The federation depends on individuals more than the individuals know. When they leave, the dependency surfaces — usually under operational pressure.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 2 — When Organizations Typically Engage Us
// Operational moments that bring institutions to the OCI conversation.
// Grounds the offerings in concrete institutional reality.
// ─────────────────────────────────────────────────────────────────────────────
const engagementMoments = [
  { title: 'Leadership transitions', body: 'An incoming president, executive director, or general counsel needs continuity inherited — not reconstructed.' },
  { title: 'Modernization initiatives', body: 'A federation is reviewing tooling and wants to understand continuity risk before procuring anything.' },
  { title: 'Operational fragmentation', body: 'Locals, committees, and staff operating without a shared operating record — coordination cost rising every quarter.' },
  { title: 'Onboarding strain', body: 'New stewards and officers are arriving faster than the institution can transfer judgment to them.' },
  { title: 'Governance restructuring', body: 'A merger, reorganization, or constitutional review needs a continuity baseline before any structural decision.' },
  { title: 'Continuity concerns', body: 'Leadership has named succession and institutional memory as strategic risks and wants them measurable.' },
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
    summary: 'A scoped institutional diagnostic that surfaces where continuity actually breaks — and where it quietly holds.',
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
    outcome: 'Sustain institutional continuity',
    summary: 'Ongoing continuity stewardship: governance entropy review, executive intelligence, and federation-level continuity health.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 3.5 — Assessment Ladder (GTM entry funnel)
// Mirrors the three entry tiers on /institutional-continuity-risk so the
// pricing page reflects the actual go-to-market motion: a free ICRA reflection,
// a paid Executive Continuity Brief at $1,200, and a facilitated Institutional
// Continuity Diagnostic at $6,500. These precede the larger engagement layers.
// ─────────────────────────────────────────────────────────────────────────────
const assessmentLadder = [
  {
    key: 'continuity_reflection',
    name: 'Continuity Reflection',
    price: 'Free',
    pricePosture: 'Pseudonymous · no login required',
    summary:
      'A scoped institutional continuity assessment that surfaces fragility, signals, and burden — without commitment. The ICRA entry point.',
    includes: [
      'OCI band and continuity score',
      'Quiet-risk signal observations',
      'Continuity burden index',
      'One recommendation to start a conversation',
    ],
    cta: 'Start the assessment',
    ctaHref: '/continuity-assessment/start',
    featured: false,
  },
  {
    key: 'executive_continuity_brief',
    name: 'Executive Continuity Brief',
    price: '$1,200 CAD',
    pricePosture: 'One-time · delivered as a governance-readable document',
    summary:
      'A deeper institutional reading of the same assessment — governance entropy, continuity debt, dependency review, and modernization risk surfaced for executive and board conversation.',
    includes: [
      'Everything in Continuity Reflection',
      'Governance entropy analysis',
      'Continuity debt analysis',
      'Institutional dependency review',
      'Modernization risk layer',
      'Full prioritized recommendations',
    ],
    cta: 'Begin with the brief',
    ctaHref: '/continuity-assessment/start?intendedTier=executive_continuity_brief',
    featured: true,
  },
  {
    key: 'institutional_continuity_diagnostic',
    name: 'Institutional Continuity Diagnostic',
    price: '$6,500 CAD',
    pricePosture: 'Facilitated engagement · executive workshop included',
    summary:
      'A full diagnostic engagement: facilitated review, institutional continuity workshop, memory lineage mapping, and an executive briefing note your board can act on.',
    includes: [
      'Everything in the Executive Continuity Brief',
      'Facilitated diagnostic review',
      'Institutional continuity workshop',
      'Memory lineage mapping',
      'Executive briefing note',
    ],
    cta: 'Request this diagnostic',
    ctaHref: '/contact?topic=institutional-continuity-diagnostic',
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
      "Une évaluation institutionnelle ciblée qui révèle la fragilité, les signaux et le fardeau — sans engagement. Le point d'entrée ICRA.",
    includes: [
      'Bande OCI et indice de continuité',
      'Observations sur les signaux de risque silencieux',
      'Indice de fardeau de continuité',
      'Une recommandation pour amorcer la conversation',
    ],
    cta: "Commencer l'évaluation",
    ctaHref: '/continuity-assessment/start',
    featured: false,
  },
  {
    key: 'executive_continuity_brief',
    name: 'Note de continuité exécutive',
    price: '1 200 $ CAD',
    pricePosture: 'Ponctuel · livré sous forme de document lisible par la gouvernance',
    summary:
      "Une lecture institutionnelle approfondie de la même évaluation — entropie de gouvernance, dette de continuité, revue des dépendances et risque de modernisation, mis en forme pour la conversation exécutive.",
    includes: [
      'Tout ce qui est dans la Réflexion sur la continuité',
      "Analyse de l'entropie de gouvernance",
      'Analyse de la dette de continuité',
      'Revue des dépendances institutionnelles',
      'Couche de risque de modernisation',
      'Recommandations priorisées complètes',
    ],
    cta: 'Commencer par la note',
    ctaHref: '/continuity-assessment/start?intendedTier=executive_continuity_brief',
    featured: true,
  },
  {
    key: 'institutional_continuity_diagnostic',
    name: 'Diagnostic institutionnel de continuité',
    price: '6 500 $ CAD',
    pricePosture: 'Engagement facilité · atelier exécutif inclus',
    summary:
      "Un engagement diagnostic complet : revue facilitée, atelier institutionnel de continuité, cartographie de la lignée mémorielle, et note de synthèse exécutive sur laquelle votre conseil peut agir.",
    includes: [
      'Tout ce qui est dans la Note exécutive',
      'Revue diagnostique facilitée',
      'Atelier institutionnel de continuité',
      'Cartographie de la lignée mémorielle',
      'Note de synthèse exécutive',
    ],
    cta: 'Demander ce diagnostic',
    ctaHref: '/contact?topic=institutional-continuity-diagnostic',
    featured: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 4 — Engagement Layers
// Replaces "tiers". These are institutional continuity engagement layers —
// not SaaS plans. Each one is a distinct posture and a distinct conversation.
// ─────────────────────────────────────────────────────────────────────────────
const engagementLayers = [
  {
    key: 'oci',
    icon: 'compass',
    name: 'OCI — Continuity Assessment',
    posture: 'Institutional diagnostics',
    layer: 'Layer 1 · Continuity intelligence',
    fit: 'Federations and institutions establishing a continuity baseline before any tooling decision.',
    feels: 'Diagnostic. Discreet. Strategic.',
    deliverables: [
      'OCI Snapshot — scoped continuity baseline',
      'Executive Continuity Brief',
      'Governance Entropy Review',
      'Institutional Continuity Workshop',
    ],
    range: 'Engagement — typically $18K–$45K',
  },
  {
    key: 'ocra',
    icon: 'network',
    name: 'OCRA — Adaptive Continuity Intelligence',
    posture: 'Structural risk deepening',
    layer: 'Layer 2 · Continuity topology',
    fit: 'Institutions that have a baseline and need structural depth: dependency analysis, modernization pathways, confidence-aware interpretation.',
    feels: 'Structural. Interpretive. Forward-looking.',
    deliverables: [
      'Structural continuity analysis',
      'Continuity topology mapping',
      'Modernization pathway evaluation',
      'Confidence-aware operational interpretation',
    ],
    range: 'Engagement — typically $35K–$90K',
  },
  {
    key: 'platform',
    icon: 'layers',
    name: 'Platform Activation',
    posture: 'Continuity infrastructure',
    layer: 'Layer 3 · Operational continuity infrastructure',
    fit: 'Institutions ready to activate continuity infrastructure on top of an assessed baseline — not generic SaaS onboarding.',
    feels: 'Operational. Governance-safe. Inherited.',
    deliverables: [
      'Operational continuity tooling activation',
      'Governance infrastructure alignment',
      'Evidence and decisions-of-record systems',
      'Continuity-safe workflows for officers, stewards, and staff',
    ],
    range: 'Annual program — typically $40K–$140K',
  },
  {
    key: 'longitudinal',
    icon: 'infinity',
    name: 'Longitudinal Continuity Support',
    posture: 'Continuity stewardship',
    layer: 'Layer 4 · Governance continuity layer',
    fit: 'National unions and federations sustaining continuity across leadership cycles, mandates, and federation-wide coordination.',
    feels: 'Durable. Inherited. Federation-grade.',
    deliverables: [
      'Continuous governance entropy monitoring',
      'Longitudinal executive continuity intelligence',
      'Federation-level continuity coordination',
      'Operational sovereignty posture maintenance',
    ],
    range: 'Strategic engagement — scoped with executive leadership',
  },
  {
    key: 'founding',
    icon: 'sparkles',
    name: 'Founding Partner Cohort',
    posture: 'Strategic institutional collaboration',
    layer: 'Layer 5 · Cohort engagement',
    fit: 'A small number of institutions co-developing continuity infrastructure with us — operationally embedded, doctrinally close.',
    feels: 'Co-developed. Privileged. Long-cycle.',
    deliverables: [
      'Direct co-design with the founding team',
      'Reserved governance influence on platform doctrine',
      'Privileged access to OCRA and continuity research',
      'Named cohort recognition in institutional materials',
    ],
    range: 'Cohort terms — by invitation and mutual fit',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SECTION 5 — Procurement-Safe Institutional Commitments
// These are positions, not features. They distinguish continuity infrastructure
// from generic AI tooling — and are the procurement department's first real read.
// ─────────────────────────────────────────────────────────────────────────────
const procurementCommitments = [
  { title: 'Human oversight by design', body: 'Every operational pathway assumes a named human owner. Cognition surfaces are operator-initiated and operator-reviewable.' },
  { title: 'Governance-safe AI', body: 'Reasoning operates under institutional governance — not autonomous agent assumptions. Explainability is structural, not optional.' },
  { title: 'No worker surveillance', body: 'UnionEyes does not rank, score, or monitor individual workers. Continuity infrastructure is institutional, not personal.' },
  { title: 'Explainable interpretation', body: 'Every interpretive surface exposes its confidence posture and its dependency chain. No black-box decisions.' },
  { title: 'Continuity-focused interpretation', body: 'All cognition is oriented toward institutional continuity — not productivity scoring or behavioural analysis.' },
  { title: 'No institutional ranking', body: 'We do not benchmark, league-table, or compare unions against each other. Continuity is sovereign to each institution.' },
  { title: 'Canadian residency', body: 'Canadian-hosted, sovereignty-conscious institutional trust. Data residency and sovereign hosting are structural commitments.' },
  { title: 'Fail-closed degradation', body: 'When systems degrade, they degrade safely — operations remain governable, not opaque.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// French (fr-CA) parallel content
// ─────────────────────────────────────────────────────────────────────────────
const frContinuityFragility = [
  { title: 'Fragilité de la continuité', body: 'Le savoir procédural est concentré chez quelques personnes expérimentées. Un départ à la retraite, une rotation — et l’institution perd des années de jugement.' },
  { title: 'Charge d’intégration', body: 'Chaque nouveau dirigeant, employé ou délégué hérite de dossiers inachevés sans registre opérationnel, sans carte des précédents, sans transmission de continuité.' },
  { title: 'Incohérence de gouvernance', body: 'Décisions, motions et engagements dispersés entre courriels, lecteurs et notes de réunion — défendables sur le moment, non documentés à travers les cycles.' },
  { title: 'Risque de modernisation', body: 'Les décisions d’outillage prises sans évaluation de continuité accélèrent généralement la fragmentation plutôt que de la résoudre.' },
  { title: 'Dépendance institutionnelle', body: 'La fédération dépend des individus plus que les individus ne le savent. Leur départ révèle la dépendance — généralement sous pression opérationnelle.' },
];

const frEngagementMoments = [
  { title: 'Transitions de leadership', body: 'Un nouveau président, directeur exécutif ou conseiller général a besoin que la continuité soit transmise — pas reconstruite.' },
  { title: 'Initiatives de modernisation', body: 'Une fédération examine son outillage et souhaite comprendre le risque de continuité avant tout investissement.' },
  { title: 'Fragmentation opérationnelle', body: 'Sections locales, comités et personnel opérant sans registre partagé — les coûts de coordination augmentent à chaque trimestre.' },
  { title: 'Pression sur l’intégration', body: 'Les nouveaux délégués et dirigeants arrivent plus vite que l’institution ne peut leur transférer son jugement.' },
  { title: 'Restructuration de la gouvernance', body: 'Une fusion, une réorganisation ou une révision constitutionnelle requiert une base de continuité avant toute décision structurelle.' },
  { title: 'Préoccupations de continuité', body: 'La direction a nommé la succession et la mémoire institutionnelle comme risques stratégiques et veut les rendre mesurables.' },
  { title: 'Croissance de la coordination fédérative', body: 'Un organisme national ou sectoriel coordonnant plusieurs sections locales a besoin de topologie opérationnelle, pas de réunions supplémentaires.' },
];

const frContinuityJourney = [
  { stage: '1', name: 'Évaluation OCI', outcome: 'Comprendre la fragilité de la continuité', summary: 'Un diagnostic institutionnel ciblé qui révèle où la continuité se rompt — et où elle tient silencieusement.' },
  { stage: '2', name: 'Approfondissement OCRA', outcome: 'Identifier les risques structurels de continuité', summary: 'Intelligence de continuité adaptative : topologie, parcours de modernisation, interprétation consciente du niveau de confiance.' },
  { stage: '3', name: 'Cartographie de gouvernance', outcome: 'Clarifier les dépendances opérationnelles', summary: 'Traduire les constats en une carte lisible par la gouvernance des dépendances, des décisions officielles et des obligations de continuité.' },
  { stage: '4', name: 'Activation de plateforme', outcome: 'Stabiliser les opérations de continuité', summary: 'Ce n’est qu’ici que la plateforme entre en jeu — comme infrastructure de continuité activée sur la base de l’évaluation.' },
  { stage: '5', name: 'Soutien longitudinal', outcome: 'Soutenir la continuité institutionnelle', summary: 'Intendance continue de continuité : revue d’entropie de gouvernance, intelligence exécutive et santé fédérative.' },
];

const frEngagementLayers = [
  {
    key: 'oci', icon: 'compass',
    name: 'OCI — Évaluation de continuité',
    posture: 'Diagnostics institutionnels',
    layer: 'Couche 1 · Intelligence de continuité',
    fit: 'Fédérations et institutions établissant une base de continuité avant toute décision d’outillage.',
    feels: 'Diagnostic. Discret. Stratégique.',
    deliverables: ['Aperçu OCI — base de continuité ciblée', 'Note exécutive de continuité', 'Revue d’entropie de gouvernance', 'Atelier institutionnel de continuité'],
    range: 'Engagement — généralement 18 k$ à 45 k$',
  },
  {
    key: 'ocra', icon: 'network',
    name: 'OCRA — Intelligence de continuité adaptative',
    posture: 'Approfondissement structurel des risques',
    layer: 'Couche 2 · Topologie de continuité',
    fit: 'Institutions disposant d’une base et nécessitant une profondeur structurelle : analyse des dépendances, parcours de modernisation, interprétation consciente du niveau de confiance.',
    feels: 'Structurel. Interprétatif. Tourné vers l’avenir.',
    deliverables: ['Analyse structurelle de continuité', 'Cartographie de la topologie de continuité', 'Évaluation des parcours de modernisation', 'Interprétation opérationnelle consciente du niveau de confiance'],
    range: 'Engagement — généralement 35 k$ à 90 k$',
  },
  {
    key: 'platform', icon: 'layers',
    name: 'Activation de plateforme',
    posture: 'Infrastructure de continuité',
    layer: 'Couche 3 · Infrastructure opérationnelle de continuité',
    fit: 'Institutions prêtes à activer une infrastructure de continuité sur une base évaluée — pas un déploiement SaaS générique.',
    feels: 'Opérationnel. Respectueux de la gouvernance. Transmissible.',
    deliverables: ['Activation d’outils opérationnels de continuité', 'Alignement d’infrastructure de gouvernance', 'Systèmes de preuve et décisions officielles', 'Flux de travail respectueux de la continuité pour dirigeants, délégués et personnel'],
    range: 'Programme annuel — généralement 40 k$ à 140 k$',
  },
  {
    key: 'longitudinal', icon: 'infinity',
    name: 'Soutien longitudinal de continuité',
    posture: 'Intendance de continuité',
    layer: 'Couche 4 · Couche de continuité de gouvernance',
    fit: 'Syndicats nationaux et fédérations soutenant la continuité à travers les cycles de leadership, les mandats et la coordination fédérative.',
    feels: 'Durable. Transmissible. À l’échelle fédérative.',
    deliverables: ['Surveillance continue de l’entropie de gouvernance', 'Intelligence exécutive longitudinale de continuité', 'Coordination fédérative de continuité', 'Maintien de la posture de souveraineté opérationnelle'],
    range: 'Engagement stratégique — défini avec la direction exécutive',
  },
  {
    key: 'founding', icon: 'sparkles',
    name: 'Cohorte de partenaires fondateurs',
    posture: 'Collaboration institutionnelle stratégique',
    layer: 'Couche 5 · Engagement en cohorte',
    fit: 'Un petit nombre d’institutions co-développant l’infrastructure de continuité avec nous — engagement opérationnel et doctrinal rapproché.',
    feels: 'Co-développé. Privilégié. À long cycle.',
    deliverables: ['Co-conception directe avec l’équipe fondatrice', 'Influence de gouvernance réservée sur la doctrine de plateforme', 'Accès privilégié à la recherche OCRA et continuité', 'Reconnaissance nommée de la cohorte dans le matériel institutionnel'],
    range: 'Conditions de cohorte — sur invitation et ajustement mutuel',
  },
];

const frProcurementCommitments = [
  { title: 'Supervision humaine par conception', body: 'Chaque parcours opérationnel suppose un propriétaire humain nommé. Les surfaces cognitives sont déclenchées et révisées par un opérateur.' },
  { title: 'IA respectueuse de la gouvernance', body: 'Le raisonnement opère sous gouvernance institutionnelle — pas selon des hypothèses d’agent autonome. L’explicabilité est structurelle, pas optionnelle.' },
  { title: 'Aucune surveillance des travailleurs', body: 'UnionEyes ne classe pas, n’évalue pas et ne surveille pas les travailleurs. L’infrastructure de continuité est institutionnelle, pas personnelle.' },
  { title: 'Interprétation explicable', body: 'Chaque surface interprétative expose sa posture de confiance et sa chaîne de dépendance. Aucune décision en boîte noire.' },
  { title: 'Interprétation orientée continuité', body: 'Toute cognition est orientée vers la continuité institutionnelle — pas vers l’évaluation de productivité ou l’analyse comportementale.' },
  { title: 'Aucun classement institutionnel', body: 'Nous ne comparons pas les syndicats entre eux. La continuité est souveraine à chaque institution.' },
  { title: 'Résidence canadienne', body: 'Hébergement canadien, confiance institutionnelle consciente de la souveraineté. La résidence et l’hébergement souverain sont des engagements structurels.' },
  { title: 'Dégradation sécuritaire', body: 'Lorsque les systèmes se dégradent, ils le font de manière gouvernable et non opaque.' },
];

const pricingCopy = {
  'en-CA': {
    heading: <>Institutional continuity engagement architecture,<br />not software pricing tiers.</>,
    description: 'UnionEyes is continuity infrastructure — assessment, intelligence, then activation. Every engagement starts with the OCI (Organizational Continuity Index), not with a procurement form. Software is the fourth stage of the journey, not the entry point.',
    section1Heading: 'Continuity starts before software',
    section1Body: 'Most institutions discover that the platform decision was actually a continuity decision in disguise. We exist because continuity fragility is rarely measured before it is procured against.',
    section2Heading: 'When organizations typically engage us',
    section2Body: 'There is no single trigger — but these are the operational moments that consistently bring federations and unions to the OCI conversation.',
    section3Heading: 'The Continuity Journey',
    section3Body: 'A maturity-oriented engagement pathway. Five sequential stages, each one earning the next. Platform activation appears at stage four — never stage one.',
    stageLabel: 'Stage',
    outcomeLabel: 'Outcome',
    tabStartHere: 'Start here',
    tabEngagementLayers: 'Engagement layers',
    tabJourney: 'The journey',
    tabWhy: 'Why this exists',
    tabProcurement: 'Procurement',
    sectionLadderEyebrow: 'Start here',
    sectionLadderHeading: 'The assessment ladder',
    sectionLadderBody: 'Every UnionEyes relationship begins with an assessment, not a procurement form. The first three steps are scoped, named, and priced — so an executive director or board chair can begin the continuity conversation without waiting for a sales cycle.',
    sectionLadderFooter: 'These three steps are the entry funnel to the engagement layers below. Most institutions begin with the free Reflection and only escalate when the surfaced risk warrants it.',
    ladderIncludesLabel: 'What you receive',
    ladderFeaturedBadge: 'Most institutions start here',
    section4Heading: 'Engagement layers',
    section4Body: 'When an assessment surfaces structural continuity risk that cannot be resolved with a brief or a workshop, the relationship escalates into one of these institutional engagement layers. Each is a coherent posture and a distinct conversation — not a feature bundle or a seat-licensing tier.',
    fitPrefix: 'Best for: ',
    deliverablesLabel: 'What you receive',
    investmentLabel: 'Investment',
    rangeNote: 'A starting range. Final scope is shaped jointly with you and your procurement leadership — no self-serve checkout, ever.',
    unsureTitle: 'Not sure which layer fits?',
    unsureBody: 'Most institutions start with an OCI conversation — even when they think they need the platform. A short briefing usually makes the right layer obvious.',
    unsureCta: 'Start with an OCI conversation',
    procurementLabel: 'Procurement-safe by design',
    commitmentsHeading: 'Institutional commitments, not feature claims',
    commitmentsBody: 'Every engagement layer inherits the same institutional commitments. These are the positions that distinguish continuity infrastructure from generic AI tooling — and are usually the first thing procurement reads.',
    trustCenter: 'Trust Center',
    governanceStructure: 'Governance Structure',
    institutionalProof: 'Institutional Proof',
    ctaLabel: 'Begin with assessment, not procurement',
    ctaHeading: 'Start with a continuity conversation',
    ctaBody: 'Tell us where your institution is today. We will help you identify which layer fits, what an OCI engagement looks like in practice, and shape the journey with you — at the pace your governance can sustain.',
    ctaPrimary: 'Request Executive Briefing',
    ctaSecondary: 'Discuss an OCI Engagement',
    ctaFinePrint: 'Engagement layers and ranges are positioning structure for institutional planning. Final scope is set jointly with executive and procurement leadership — never as self-serve subscription.',
    glossaryLabel: 'The two terms used throughout this page',
    glossary: [
      { acronym: 'OCI', expansion: 'Organizational Continuity Index', body: 'A scoped organizational diagnostic that measures continuity fragility — what would break if a key person, a leadership cycle, or a critical decision-of-record were lost tomorrow.' },
      { acronym: 'OCRA', expansion: 'Organizational Continuity Risk Analysis', body: 'A deeper, structural reading of continuity risk: dependency topology, modernization pathways, governance entropy, and confidence-aware operational interpretation.' },
    ],
    continuityFragility, engagementMoments, continuityJourney, assessmentLadder, engagementLayers, procurementCommitments,
  },
  'fr-CA': {
    heading: <>Architecture d’engagement de continuité institutionnelle,<br />pas une grille tarifaire logicielle.</>,
    description: 'UnionEyes est une infrastructure de continuité — évaluation, intelligence, puis activation. Chaque engagement commence par l’OCI (Indice de continuité organisationnelle), pas par un formulaire d’approvisionnement. Le logiciel est la quatrième étape du parcours, jamais le point d’entrée.',
    section1Heading: 'La continuité commence avant le logiciel',
    section1Body: 'La plupart des institutions découvrent que la décision de plateforme était en réalité une décision de continuité déguisée. Nous existons parce que la fragilité de la continuité est rarement mesurée avant d’être contournée par un achat.',
    section2Heading: 'Quand les organisations nous engagent typiquement',
    section2Body: 'Il n’y a pas de déclencheur unique — mais voici les moments opérationnels qui amènent constamment les fédérations et les syndicats à la conversation OCI.',
    section3Heading: 'Le parcours de continuité',
    section3Body: 'Un parcours d’engagement orienté maturité. Cinq étapes séquentielles, chacune méritant la suivante. L’activation de plateforme apparaît à l’étape quatre — jamais à l’étape un.',
    stageLabel: 'Étape',
    outcomeLabel: 'Résultat',
    tabStartHere: 'Commencer ici',
    tabEngagementLayers: 'Couches d’engagement',
    tabJourney: 'Le parcours',
    tabWhy: 'Pourquoi nous existons',
    tabProcurement: 'Approvisionnement',
    sectionLadderEyebrow: 'Commencer ici',
    sectionLadderHeading: 'L’échelle d’évaluation',
    sectionLadderBody: 'Chaque relation avec UnionEyes commence par une évaluation, pas par un formulaire d’approvisionnement. Les trois premières étapes sont délimitées, nommées et tarifées — afin qu’un directeur général ou un président de conseil puisse amorcer la conversation de continuité sans attendre un cycle de vente.',
    sectionLadderFooter: 'Ces trois étapes constituent l’entonnoir d’entrée vers les couches d’engagement ci-dessous. La plupart des institutions commencent par la Réflexion gratuite et n’augmentent l’engagement que lorsque le risque révélé le justifie.',
    ladderIncludesLabel: 'Ce que vous recevez',
    ladderFeaturedBadge: 'La plupart des institutions commencent ici',
    section4Heading: 'Couches d’engagement',
    section4Body: 'Lorsqu’une évaluation révèle un risque structurel de continuité qui ne peut être résolu par une note ou un atelier, la relation s’élève vers l’une de ces couches d’engagement institutionnel. Chacune est une posture cohérente et une conversation distincte — pas un ensemble de fonctionnalités ni un palier de licences par siège.',
    fitPrefix: 'Convient à : ',
    deliverablesLabel: 'Ce que vous recevez',
    investmentLabel: 'Investissement',
    rangeNote: 'Une fourchette de départ. La portée finale est définie conjointement avec votre équipe d’approvisionnement — jamais en libre-service.',
    unsureTitle: 'Vous ne savez pas quelle couche convient?',
    unsureBody: 'La plupart des institutions commencent par une conversation OCI — même lorsqu’elles pensent avoir besoin de la plateforme. Une courte présentation rend généralement la bonne couche évidente.',
    unsureCta: 'Commencer par une conversation OCI',
    procurementLabel: 'Conçu pour l’approvisionnement',
    commitmentsHeading: 'Engagements institutionnels, pas promesses de fonctionnalités',
    commitmentsBody: 'Chaque couche d’engagement hérite des mêmes engagements institutionnels. Ce sont les positions qui distinguent l’infrastructure de continuité des outils d’IA génériques — et habituellement la première chose que l’approvisionnement lit.',
    trustCenter: 'Centre de confiance',
    governanceStructure: 'Structure de gouvernance',
    institutionalProof: 'Preuves institutionnelles',
    ctaLabel: 'Commencer par l’évaluation, pas par l’approvisionnement',
    ctaHeading: 'Commencer par une conversation de continuité',
    ctaBody: 'Dites-nous où en est votre institution aujourd’hui. Nous vous aidons à identifier la bonne couche, à comprendre à quoi ressemble un engagement OCI en pratique, et à façonner le parcours avec vous.',
    ctaPrimary: 'Demander une présentation exécutive',
    ctaSecondary: 'Discuter d’un engagement OCI',
    ctaFinePrint: 'Les couches d’engagement et les fourchettes servent à planifier l’engagement institutionnel. La portée finale est définie avec la direction exécutive et l’approvisionnement — jamais en abonnement libre-service.',
    glossaryLabel: 'Les deux termes utilisés tout au long de cette page',
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

  return (
    <div className="institution-shell min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.pricing}
        tone="dark"
        revealTempo="conference"
        heading={copy.heading}
        description={copy.description}
      />

      <InstitutionalContinuityNote
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
              <div key={term.acronym} className="institution-panel calm-elevation p-5">
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
              href={`/${locale}/pilot-request`}
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
        </div>
      </section>
    </div>
  );
}
