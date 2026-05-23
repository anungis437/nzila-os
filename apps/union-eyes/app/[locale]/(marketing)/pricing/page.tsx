/**
 * Institutional Continuity Engagement Architecture
 *
 * This page is intentionally NOT a SaaS pricing matrix. UnionEyes is continuity
 * infrastructure — OCI (Operational Continuity Index) diagnostics, OCRA
 * (Operational Continuity Risk Analysis) deepening, governance mapping, then
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
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Network,
  Map,
  Layers,
  Infinity as InfinityIcon,
  Sparkles,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { InstitutionalContinuityNote } from '@/components/marketing/institutional-continuity-note';
import ScrollReveal from '@/components/public/scroll-reveal';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

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
// SECTION 4 — Engagement Layers
// Replaces "tiers". These are institutional continuity engagement layers —
// not SaaS plans. Each one is a distinct posture and a distinct conversation.
// ─────────────────────────────────────────────────────────────────────────────
const engagementLayers = [
  {
    key: 'oci',
    icon: Compass,
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
    icon: Network,
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
    icon: Layers,
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
    icon: InfinityIcon,
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
    icon: Sparkles,
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
    key: 'oci', icon: Compass,
    name: 'OCI — Évaluation de continuité',
    posture: 'Diagnostics institutionnels',
    layer: 'Couche 1 · Intelligence de continuité',
    fit: 'Fédérations et institutions établissant une base de continuité avant toute décision d’outillage.',
    feels: 'Diagnostic. Discret. Stratégique.',
    deliverables: ['Aperçu OCI — base de continuité ciblée', 'Note exécutive de continuité', 'Revue d’entropie de gouvernance', 'Atelier institutionnel de continuité'],
    range: 'Engagement — généralement 18 k$ à 45 k$',
  },
  {
    key: 'ocra', icon: Network,
    name: 'OCRA — Intelligence de continuité adaptative',
    posture: 'Approfondissement structurel des risques',
    layer: 'Couche 2 · Topologie de continuité',
    fit: 'Institutions disposant d’une base et nécessitant une profondeur structurelle : analyse des dépendances, parcours de modernisation, interprétation consciente du niveau de confiance.',
    feels: 'Structurel. Interprétatif. Tourné vers l’avenir.',
    deliverables: ['Analyse structurelle de continuité', 'Cartographie de la topologie de continuité', 'Évaluation des parcours de modernisation', 'Interprétation opérationnelle consciente du niveau de confiance'],
    range: 'Engagement — généralement 35 k$ à 90 k$',
  },
  {
    key: 'platform', icon: Layers,
    name: 'Activation de plateforme',
    posture: 'Infrastructure de continuité',
    layer: 'Couche 3 · Infrastructure opérationnelle de continuité',
    fit: 'Institutions prêtes à activer une infrastructure de continuité sur une base évaluée — pas un déploiement SaaS générique.',
    feels: 'Opérationnel. Respectueux de la gouvernance. Transmissible.',
    deliverables: ['Activation d’outils opérationnels de continuité', 'Alignement d’infrastructure de gouvernance', 'Systèmes de preuve et décisions officielles', 'Flux de travail respectueux de la continuité pour dirigeants, délégués et personnel'],
    range: 'Programme annuel — généralement 40 k$ à 140 k$',
  },
  {
    key: 'longitudinal', icon: InfinityIcon,
    name: 'Soutien longitudinal de continuité',
    posture: 'Intendance de continuité',
    layer: 'Couche 4 · Couche de continuité de gouvernance',
    fit: 'Syndicats nationaux et fédérations soutenant la continuité à travers les cycles de leadership, les mandats et la coordination fédérative.',
    feels: 'Durable. Transmissible. À l’échelle fédérative.',
    deliverables: ['Surveillance continue de l’entropie de gouvernance', 'Intelligence exécutive longitudinale de continuité', 'Coordination fédérative de continuité', 'Maintien de la posture de souveraineté opérationnelle'],
    range: 'Engagement stratégique — défini avec la direction exécutive',
  },
  {
    key: 'founding', icon: Sparkles,
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
    description: 'UnionEyes is continuity infrastructure — assessment, intelligence, then activation. Every engagement starts with the OCI (Operational Continuity Index), not with a procurement form. Software is the fourth stage of the journey, not the entry point.',
    section1Heading: 'Continuity starts before software',
    section1Body: 'Most institutions discover that the platform decision was actually a continuity decision in disguise. We exist because continuity fragility is rarely measured before it is procured against.',
    section2Heading: 'When organizations typically engage us',
    section2Body: 'There is no single trigger — but these are the operational moments that consistently bring federations and unions to the OCI conversation.',
    section3Heading: 'The Continuity Journey',
    section3Body: 'A maturity-oriented engagement pathway. Five sequential stages, each one earning the next. Platform activation appears at stage four — never stage one.',
    stageLabel: 'Stage',
    outcomeLabel: 'Outcome',
    section4Heading: 'Engagement layers',
    section4Body: 'Five institutional continuity engagement layers. Each is a coherent posture and a distinct conversation — not a feature bundle or a seat-licensing tier.',
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
    continuityFragility, engagementMoments, continuityJourney, engagementLayers, procurementCommitments,
  },
  'fr-CA': {
    heading: <>Architecture d’engagement de continuité institutionnelle,<br />pas une grille tarifaire logicielle.</>,
    description: 'UnionEyes est une infrastructure de continuité — évaluation, intelligence, puis activation. Chaque engagement commence par l’OCI (Indice de continuité opérationnelle), pas par un formulaire d’approvisionnement. Le logiciel est la quatrième étape du parcours, jamais le point d’entrée.',
    section1Heading: 'La continuité commence avant le logiciel',
    section1Body: 'La plupart des institutions découvrent que la décision de plateforme était en réalité une décision de continuité déguisée. Nous existons parce que la fragilité de la continuité est rarement mesurée avant d’être contournée par un achat.',
    section2Heading: 'Quand les organisations nous engagent typiquement',
    section2Body: 'Il n’y a pas de déclencheur unique — mais voici les moments opérationnels qui amènent constamment les fédérations et les syndicats à la conversation OCI.',
    section3Heading: 'Le parcours de continuité',
    section3Body: 'Un parcours d’engagement orienté maturité. Cinq étapes séquentielles, chacune méritant la suivante. L’activation de plateforme apparaît à l’étape quatre — jamais à l’étape un.',
    stageLabel: 'Étape',
    outcomeLabel: 'Résultat',
    section4Heading: 'Couches d’engagement',
    section4Body: 'Cinq couches d’engagement de continuité institutionnelle. Chacune est une posture cohérente et une conversation distincte — pas un ensemble de fonctionnalités ni un palier de licences par siège.',
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
    continuityFragility: frContinuityFragility,
    engagementMoments: frEngagementMoments,
    continuityJourney: frContinuityJourney,
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

      {/* ── SECTION 1 — Continuity starts before software ── */}
      <section className="py-16 bg-white border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={0.08} duration={0.95} distance={16} tempo="conference">
            <h2 className="text-3xl font-semibold text-navy mb-3">{copy.section1Heading}</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.14} duration={0.9} distance={14} tempo="conference">
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-8">
              {copy.section1Body}
            </p>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 narrative-sequence">
            {copy.continuityFragility.map((item) => (
              <article key={item.title} className="institution-panel calm-elevation p-5">
                <h3 className="text-sm font-semibold text-navy mb-2">{item.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 2 — When organizations typically engage us ── */}
      <section className="py-16 bg-[#f8f6f2] border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={0.08} duration={0.95} distance={16} tempo="conference">
            <h2 className="text-3xl font-semibold text-navy mb-3">{copy.section2Heading}</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.14} duration={0.9} distance={14} tempo="conference">
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-8">
              {copy.section2Body}
            </p>
          </ScrollReveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 narrative-sequence">
            {copy.engagementMoments.map((item) => (
              <article key={item.title} className="institution-panel calm-elevation p-5">
                <h3 className="text-sm font-semibold text-navy mb-2">{item.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 3 — The Continuity Journey ── */}
      <section className="py-16 bg-white border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={0.08} duration={0.95} distance={16} tempo="conference">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-slate-100 text-navy text-xs font-semibold tracking-wide uppercase mb-4">
              <Map className="h-3.5 w-3.5" />
              {copy.stageLabel} 1 → 5
            </div>
            <h2 className="text-3xl font-semibold text-navy mb-3">{copy.section3Heading}</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.14} duration={0.9} distance={14} tempo="conference">
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-8">
              {copy.section3Body}
            </p>
          </ScrollReveal>

          <ol className="space-y-4 narrative-sequence">
            {copy.continuityJourney.map((step) => (
              <li
                key={step.stage}
                className="institution-panel calm-elevation p-5 flex flex-col md:flex-row md:items-start gap-4"
              >
                <div className="flex items-center gap-3 md:w-56 shrink-0">
                  <div
                    aria-hidden="true"
                    className="w-10 h-10 rounded-full bg-navy text-white text-base font-bold flex items-center justify-center shrink-0"
                  >
                    {step.stage}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                      {copy.stageLabel} {step.stage}
                    </div>
                    <div className="text-sm font-semibold text-navy leading-tight">{step.name}</div>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-wider text-[#1f5b84] font-semibold mb-1">
                    {copy.outcomeLabel} — {step.outcome}
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{step.summary}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── SECTION 4 — Engagement layers ── */}
      <section className="py-16 bg-[#f8f6f2] border-b border-slate-200/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={0.08} duration={0.95} distance={16} tempo="conference">
            <h2 className="text-3xl font-semibold text-navy mb-3">{copy.section4Heading}</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.14} duration={0.9} distance={14} tempo="conference">
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-8">
              {copy.section4Body}
            </p>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-5 narrative-sequence">
            {copy.engagementLayers.map((tier) => {
              const Icon = tier.icon;
              return (
                <article key={tier.key} className="institution-panel calm-elevation p-6 flex flex-col">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-navy" />
                    </div>
                    <div className="flex-1">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                        {tier.layer}
                      </div>
                      <h3 className="text-lg font-semibold text-navy leading-tight">{tier.name}</h3>
                      <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-wider">{tier.posture}</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 italic mb-4">{tier.feels}</p>

                  <p className="text-sm text-slate-700 leading-relaxed mb-5">
                    <span className="font-semibold text-navy">{copy.fitPrefix}</span>{tier.fit}
                  </p>

                  <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">
                    {copy.deliverablesLabel}
                  </div>
                  <ul className="space-y-2 mb-5">
                    {tier.deliverables.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-slate-700 leading-relaxed">
                        <CheckCircle2 className="h-4 w-4 text-[#1f5b84] mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-4 border-t border-slate-200/70">
                    <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1">
                      {copy.investmentLabel}
                    </div>
                    <p className="text-sm font-semibold text-navy">{tier.range}</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {copy.rangeNote}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Friendly fit-finder — OCI-first */}
          <div className="institution-panel calm-elevation mt-8 p-6 md:p-7 flex flex-col md:flex-row md:items-center gap-5">
            <div className="flex-1">
              <h3 className="text-base font-semibold text-navy mb-1">{copy.unsureTitle}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {copy.unsureBody}
              </p>
            </div>
            <Link
              href={`/${locale}/contact`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-navy text-white text-sm font-semibold rounded-xl hover:bg-[#1f5b84] transition-colors whitespace-nowrap"
            >
              {copy.unsureCta} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── SECTION 5 — Procurement-safe institutional commitments ── */}
      <section className="py-16 bg-white border-b border-slate-200/70">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal delay={0.08} duration={0.95} distance={16} tempo="conference">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 bg-slate-100 text-navy text-xs font-semibold tracking-wide uppercase mb-4">
              <ShieldCheck className="h-3.5 w-3.5" />
              {copy.procurementLabel}
            </div>
            <h2 className="text-3xl font-semibold text-navy mb-3">{copy.commitmentsHeading}</h2>
          </ScrollReveal>
          <ScrollReveal delay={0.14} duration={0.9} distance={14} tempo="conference">
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-8">
              {copy.commitmentsBody}
            </p>
          </ScrollReveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 narrative-sequence">
            {copy.procurementCommitments.map((item) => (
              <article key={item.title} className="institution-panel calm-elevation p-5">
                <h3 className="text-sm font-semibold text-navy mb-2">{item.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{item.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-5">
            <Link
              href={`/${locale}/trust`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1f5b84] hover:text-navy transition-colors"
            >
              {copy.trustCenter} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/governance`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1f5b84] hover:text-navy transition-colors"
            >
              {copy.governanceStructure} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/proof`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1f5b84] hover:text-navy transition-colors"
            >
              {copy.institutionalProof} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

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
