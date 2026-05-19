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
 * Trust & Compliance page.
 * Accessible at /{locale}/trust — fully translated.
 *
 * Demonstrates governance-first substrate design: audit trails,
 * RBAC, Canadian data sovereignty, financial reconciliation,
 * entitlement controls, and defensibility.
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  ShieldCheck,
  Lock,
  MapPin,
  DollarSign,
  ToggleRight,
  Scale,
  ArrowRight,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusPage } from '@/components/monitoring/StatusPage';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { InstitutionalContinuityNote } from '@/components/marketing/institutional-continuity-note';
import { getInstitutionalModeProfile, parseInstitutionalMode, withInstitutionalContext } from '@/lib/institutional-context';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import {
  committeeCoordinationSimulations,
  executiveBriefingFlows,
  governanceFrictionSimulationFlows,
  governanceMaturityDimensions,
  governanceOperationalWalkthroughs,
  governanceReviewSimulationLayers,
  leadershipTransitionContinuityScenarios,
  operationalMaturityPathway,
  operationalDisruptionModels,
  organizationalStabilizationSimulationFlow,
  procurementEvidenceBinder,
} from '@/lib/institutional-legitimacy';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketing.trust' });
  return {
    title: t('pageTitle'),
    description: t('heroDescription'),
    alternates: buildLocaleAlternates(locale, '/trust'),
  };
}

const pillars = [
  { icon: ShieldCheck, key: 'audit' },
  { icon: Lock, key: 'rbac' },
  { icon: MapPin, key: 'data' },
  { icon: DollarSign, key: 'recon' },
  { icon: ToggleRight, key: 'entitlement' },
  { icon: Scale, key: 'defensibility' },
] as const;

const TRUST_COPY = {
  'en-CA': {
    contextLabel: 'context',
    reviewProof: 'Review the proof record',
    beginBriefing: 'Begin a continuity briefing',
    tabs: {
      foundations: 'Foundations',
      governance: 'Governance',
      proof: 'Proof Layer',
      status: 'Status',
    },
    labourSafeTitle: 'Labour-Safe AI',
    labourSafeBody:
      'UnionEyes is designed from the ground up for deployment in labour environments. Our labour-safe posture is not a policy addendum — it is an architectural commitment enforced at every layer of the substrate.',
    labourSafeItems: [
      { label: 'Zero worker surveillance', desc: 'No worker conduct grading, monitoring, or performance tracking.' },
      { label: 'No workforce analytics', desc: 'Intelligence is institutional, not individual. Workers are never the subject of analysis.' },
      { label: 'Human oversight required', desc: 'All intelligence recommendations require human review before any action.' },
      { label: 'Democratic governance controls', desc: 'AI systems operate within democratic governance structures, never replacing them.' },
      { label: 'Transparent data use', desc: 'What data is used, how it is used, and why — documented and available for review.' },
      { label: 'Anti-monitoring by design', desc: 'No capability path in the substrate can be re-purposed for individual monitoring.' },
    ],
    explainabilityTitle: 'Explainability Standards',
    explainabilityBody:
      'Every UnionEyes intelligence output is traceable to its source evidence and explainable in plain institutional language. Explainability is enforced — not aspirational.',
    explainabilityItems: [
      'Every recommendation traces to specific source evidence',
      'Reasoning pathways are visible and auditable',
      'Plain-language explanations for every intelligence output',
      'No output without a human-readable justification',
      'Audit log for all system intelligence actions',
      'Evidence lineage preserved for governance review',
    ],
    trustOpsTitle: 'Trust-Center Operationalization',
    trustOpsBody:
      'Trust in UnionEyes is operational, not symbolic. Institutions can review how explainability, governance checkpoints, and oversight pathways are executed in deployment practice.',
    trustOpsCards: [
      { title: 'Explainability Philosophy', desc: 'Every recommendation remains grounded in evidence lineage, plain-language rationale, and institutional context.' },
      { title: 'Implementation Safeguards', desc: 'Human oversight, review gates, and auditable governance pathways remain active at every rollout stage.' },
      { title: 'Operational Transparency', desc: 'Leadership and procurement teams can verify boundaries, controls, and modernization posture before expansion.' },
    ],
    maturityTitle: 'Governance Maturity Scoring Model',
    maturityBody:
      'Maturity scores are directional institutional signals used for deployment planning. They are never used for worker evaluation or productivity scoring.',
    maturityPathwayTitle: 'Operational Maturity Pathway',
    proofTitle: 'Trust-Center Operational Proof Layer',
    proofBody:
      'The trust surface now includes implementation-aware proof. Reviewers can trace safeguards, governance review, and continuity protection in operational terms rather than symbolic claims.',
    proofCards: [
      { title: 'Implementation safeguards', desc: 'Phased activation, bounded scope, and review windows remain visible.' },
      { title: 'Governance review structure', desc: 'Oversight checkpoints and human validation layers stay explicit.' },
      { title: 'Continuity protection principles', desc: 'Transition safety, resilience, and memory retention remain central.' },
    ],
    proofLink: 'Review the institutional proof page',
    walkthroughsTitle: 'Governance Operational Walkthroughs',
    walkthroughsBody:
      'Walkthroughs model how governance holds in real modernization situations: transitions, committee coordination, onboarding pressure, and procurement review.',
    simulationTitle: 'Governance review simulation layers',
    binderTitle: 'Procurement Evidence Binder',
    binderBody:
      'Trust documentation is packaged as a procurement-ready binder for disciplined due diligence, not sales collateral.',
    statusTitle: 'System Status',
    statusBody: 'Real-time operational status of UnionEyes substrate services.',
    finalHeading: 'Ready to see governance in action?',
    finalBody: "Start a controlled pilot scoped to your organization's governance requirements.",
    startPilot: 'Start a Pilot',
    viewPricing: 'View Pricing & Deployment',
  },
  'fr-CA': {
    contextLabel: 'contexte',
    reviewProof: 'Examiner le registre de preuve',
    beginBriefing: 'Commencer un breffage de continuité',
    tabs: {
      foundations: 'Fondations',
      governance: 'Gouvernance',
      proof: 'Couche de preuve',
      status: 'Statut',
    },
    labourSafeTitle: 'IA sûre pour le travail',
    labourSafeBody:
      'UnionEyes est conçu dès le départ pour les environnements syndicaux. Cette posture n’est pas un ajout de politique : c’est un engagement architectural appliqué à chaque couche.',
    labourSafeItems: [
      { label: 'Aucune surveillance des travailleuses et travailleurs', desc: 'Aucune notation, surveillance ou mesure de performance individuelle.' },
      { label: 'Aucune analytique de main-d’œuvre', desc: 'L’intelligence est institutionnelle, pas individuelle. Les personnes ne sont jamais le sujet de l’analyse.' },
      { label: 'Surveillance humaine requise', desc: 'Toute recommandation d’intelligence exige une revue humaine avant toute action.' },
      { label: 'Contrôles de gouvernance démocratique', desc: 'Les systèmes IA opèrent dans les structures démocratiques, sans les remplacer.' },
      { label: 'Utilisation transparente des données', desc: 'Les données utilisées, leur usage et la raison de cet usage sont documentés et révisables.' },
      { label: 'Anti-surveillance par conception', desc: 'Aucun chemin de capacité ne peut être réutilisé pour surveiller des personnes.' },
    ],
    explainabilityTitle: 'Normes d’explicabilité',
    explainabilityBody:
      'Chaque résultat d’intelligence UnionEyes est traçable à ses preuves sources et explicable en langage institutionnel clair. L’explicabilité est imposée, pas souhaitée.',
    explainabilityItems: [
      'Chaque recommandation renvoie à des preuves sources précises',
      'Les voies de raisonnement sont visibles et vérifiables',
      'Des explications en langage clair accompagnent chaque résultat',
      'Aucun résultat sans justification lisible par un humain',
      'Journal d’audit pour toutes les actions d’intelligence système',
      'Lignée des preuves préservée pour la revue de gouvernance',
    ],
    trustOpsTitle: 'Opérationnalisation du centre de confiance',
    trustOpsBody:
      'La confiance dans UnionEyes est opérationnelle, pas symbolique. Les institutions peuvent examiner comment l’explicabilité, les points de gouvernance et les voies de surveillance fonctionnent en déploiement.',
    trustOpsCards: [
      { title: 'Philosophie d’explicabilité', desc: 'Chaque recommandation demeure ancrée dans la lignée des preuves, une justification claire et le contexte institutionnel.' },
      { title: 'Garde-fous de mise en œuvre', desc: 'Surveillance humaine, points de revue et voies de gouvernance vérifiables restent actifs à chaque étape.' },
      { title: 'Transparence opérationnelle', desc: 'Leadership et approvisionnement peuvent vérifier limites, contrôles et posture de modernisation avant l’expansion.' },
    ],
    maturityTitle: 'Modèle de maturité de gouvernance',
    maturityBody:
      'Les scores de maturité sont des signaux institutionnels directionnels pour la planification du déploiement. Ils ne servent jamais à évaluer des personnes ou la productivité.',
    maturityPathwayTitle: 'Parcours de maturité opérationnelle',
    proofTitle: 'Couche de preuve opérationnelle du centre de confiance',
    proofBody:
      'La surface de confiance inclut des preuves conscientes de la mise en œuvre. Les réviseurs peuvent tracer les garde-fous, la revue de gouvernance et la protection de continuité en termes opérationnels.',
    proofCards: [
      { title: 'Garde-fous de mise en œuvre', desc: 'Activation par phases, portée bornée et fenêtres de revue restent visibles.' },
      { title: 'Structure de revue de gouvernance', desc: 'Les points de surveillance et les couches de validation humaine restent explicites.' },
      { title: 'Principes de protection de la continuité', desc: 'Sécurité des transitions, résilience et mémoire institutionnelle restent centrales.' },
    ],
    proofLink: 'Examiner la page de preuve institutionnelle',
    walkthroughsTitle: 'Parcours opérationnels de gouvernance',
    walkthroughsBody:
      'Les parcours modélisent comment la gouvernance tient dans des situations réelles de modernisation : transitions, coordination de comités, pression d’intégration et revue d’approvisionnement.',
    simulationTitle: 'Couches de simulation de revue de gouvernance',
    binderTitle: 'Dossier de preuve pour l’approvisionnement',
    binderBody:
      'La documentation de confiance est préparée comme dossier de diligence raisonnable pour l’approvisionnement, pas comme matériel de vente.',
    statusTitle: 'Statut du système',
    statusBody: 'État opérationnel en temps réel des services de substrat UnionEyes.',
    finalHeading: 'Prêt à voir la gouvernance en action?',
    finalBody: 'Démarrez un pilote contrôlé selon les exigences de gouvernance de votre organisation.',
    startPilot: 'Démarrer un pilote',
    viewPricing: 'Voir tarification et déploiement',
  },
};

export default async function TrustPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ context?: string }>;
}) {
  const { locale } = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const contextMode = parseInstitutionalMode(resolvedSearch?.context);
  const contextProfile = getInstitutionalModeProfile(contextMode);
  const t = await getTranslations({ locale, namespace: 'marketing.trust' });
  const tNote = await getTranslations({ locale, namespace: 'continuityNotes.trust' });
  const copy = TRUST_COPY[locale as keyof typeof TRUST_COPY] ?? TRUST_COPY['en-CA'];
  const operationalMaturityPathwayArr =
    operationalMaturityPathway[locale as keyof typeof operationalMaturityPathway] ??
    operationalMaturityPathway['en-CA'];
  const leadershipTransitionArr =
    leadershipTransitionContinuityScenarios[locale as keyof typeof leadershipTransitionContinuityScenarios] ??
    leadershipTransitionContinuityScenarios['en-CA'];
  const governanceFrictionArr =
    governanceFrictionSimulationFlows[locale as keyof typeof governanceFrictionSimulationFlows] ??
    governanceFrictionSimulationFlows['en-CA'];
  const operationalDisruptionArr =
    operationalDisruptionModels[locale as keyof typeof operationalDisruptionModels] ??
    operationalDisruptionModels['en-CA'];
  const organizationalStabilizationArr =
    organizationalStabilizationSimulationFlow[locale as keyof typeof organizationalStabilizationSimulationFlow] ??
    organizationalStabilizationSimulationFlow['en-CA'];
  const committeeCoordinationArr =
    committeeCoordinationSimulations[locale as keyof typeof committeeCoordinationSimulations] ??
    committeeCoordinationSimulations['en-CA'];
  const executiveBriefingArr =
    executiveBriefingFlows[locale as keyof typeof executiveBriefingFlows] ??
    executiveBriefingFlows['en-CA'];
  const governanceOperationalArr =
    governanceOperationalWalkthroughs[locale as keyof typeof governanceOperationalWalkthroughs] ??
    governanceOperationalWalkthroughs['en-CA'];
  const governanceReviewArr =
    governanceReviewSimulationLayers[locale as keyof typeof governanceReviewSimulationLayers] ??
    governanceReviewSimulationLayers['en-CA'];
  const procurementBinderArr =
    procurementEvidenceBinder[locale as keyof typeof procurementEvidenceBinder] ??
    procurementEvidenceBinder['en-CA'];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero with Imagery */}
      <MarketingHeroSection
        imageUrl={heroImagery.trust}
        badge={
          <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm">
            <ShieldCheck className="h-4 w-4" />
            <span>{t('badge')}</span>
          </div>
        }
        heading={t('heroHeading')}
        description={t('heroDescription')}
        contextKicker={`${contextProfile.label} ${copy.contextLabel}`}
        contextNote={contextProfile.heroFraming}
        cta={
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={withInstitutionalContext(`/${locale}/proof`, contextMode)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/20 px-6 py-3 font-semibold text-white transition-colors hover:bg-white/30"
            >
              {copy.reviewProof}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={withInstitutionalContext(`/${locale}/pilot-request`, contextMode)}
              className="border-electric/40 bg-electric inline-flex items-center gap-2 rounded-xl border px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
            >
              {copy.beginBriefing}
            </Link>
          </div>
        }
      />

      <InstitutionalContinuityNote
        surface={tNote('label')}
        posture={tNote('posture')}
      />

      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
        <Tabs defaultValue="foundations" className="space-y-8">
          <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/95 backdrop-blur-sm">
            <TabsList className="my-3 grid h-auto w-full grid-cols-2 gap-2 bg-transparent p-0 md:grid-cols-5">
              <TabsTrigger value="foundations" className="data-[state=active]:border-navy/70 data-[state=active]:text-navy rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold tracking-[0.12em] uppercase data-[state=active]:shadow-none">
                {copy.tabs.foundations}
              </TabsTrigger>
              <TabsTrigger value="governance" className="data-[state=active]:border-navy/70 data-[state=active]:text-navy rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold tracking-[0.12em] uppercase data-[state=active]:shadow-none">
                {copy.tabs.governance}
              </TabsTrigger>
              <TabsTrigger value="scenario" className="data-[state=active]:border-navy/70 data-[state=active]:text-navy rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold tracking-[0.12em] uppercase data-[state=active]:shadow-none">
                {t('phase6.tabScenario')}
              </TabsTrigger>
              <TabsTrigger value="proof" className="data-[state=active]:border-navy/70 data-[state=active]:text-navy rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold tracking-[0.12em] uppercase data-[state=active]:shadow-none">
                {copy.tabs.proof}
              </TabsTrigger>
              <TabsTrigger value="status" className="data-[state=active]:border-navy/70 data-[state=active]:text-navy rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold tracking-[0.12em] uppercase data-[state=active]:shadow-none">
                {copy.tabs.status}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="foundations" className="space-y-16">
            <div className="mb-20 grid grid-cols-1 gap-8 md:grid-cols-2">
          {pillars.map(({ icon: Icon, key }) => (
            <div
              key={key}
              className="hover:border-navy/20 rounded-xl border border-slate-200 p-8 transition-all hover:shadow-sm"
            >
              <Icon className="text-navy mb-4 h-8 w-8" />
              <h3 className="mb-3 text-lg font-semibold text-slate-900">
                {t(`${key}Title`)}
              </h3>
              <p className="leading-relaxed text-slate-600">
                {t(`${key}Desc`)}
              </p>
            </div>
          ))}
            </div>

        {/* Labour-Safe AI */}
        <section id="labour-safe" className="mb-20 scroll-mt-24">
          <h2 className="mb-3 text-2xl font-bold text-slate-900">{copy.labourSafeTitle}</h2>
          <p className="mb-6 max-w-2xl leading-relaxed text-slate-600">
            {copy.labourSafeBody}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {copy.labourSafeItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <div className="mb-1 text-sm font-bold text-slate-900">{item.label}</div>
                <div className="text-sm text-slate-600">{item.desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Explainability Standards */}
        <section id="explainability" className="mb-20 scroll-mt-24">
          <h2 className="mb-3 text-2xl font-bold text-slate-900">{copy.explainabilityTitle}</h2>
          <p className="mb-6 max-w-2xl leading-relaxed text-slate-600">
            {copy.explainabilityBody}
          </p>
          <div className="space-y-3">
            {copy.explainabilityItems.map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <ShieldCheck className="text-navy mt-0.5 h-4 w-4 shrink-0" />
                <p className="text-sm text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </section>

          </TabsContent>

          <TabsContent value="governance" className="space-y-16">

        <section id="trust-operationalization" className="mb-20 scroll-mt-24">
          <h2 className="mb-3 text-2xl font-bold text-slate-900">{copy.trustOpsTitle}</h2>
          <p className="mb-6 max-w-3xl leading-relaxed text-slate-600">
            {copy.trustOpsBody}
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {copy.trustOpsCards.map((item) => (
              <article key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="mb-2 text-sm font-bold text-slate-900">{item.title}</h3>
                <p className="text-sm text-slate-600">{item.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="governance-maturity" className="mb-20 scroll-mt-24">
          <h2 className="mb-3 text-2xl font-bold text-slate-900">{copy.maturityTitle}</h2>
          <p className="mb-6 max-w-3xl leading-relaxed text-slate-600">
            {copy.maturityBody}
          </p>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {governanceMaturityDimensions.map((dimension) => (
              <article key={dimension.key} className="rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="mb-1 text-sm font-semibold text-slate-900">{dimension.label}</h3>
                <p className="text-xs text-slate-600">{dimension.focus}</p>
              </article>
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="mb-3 text-sm font-bold text-slate-900">{copy.maturityPathwayTitle}</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {operationalMaturityPathwayArr.map((stage, index) => (
                <div key={stage} className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                  {index + 1}. {stage}
                </div>
              ))}
            </div>
          </div>
        </section>

          </TabsContent>

          <TabsContent value="scenario" className="space-y-16">

        <section className="mb-20">
          <h2 className="mb-3 text-2xl font-bold text-slate-900">{t('phase6.leadershipTitle')}</h2>
          <p className="mb-6 max-w-3xl leading-relaxed text-slate-600">
            {t('phase6.leadershipDesc')}
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {leadershipTransitionArr.map((item) => (
              <article key={item.scenario} className="rounded-xl border border-slate-200 bg-white p-5">
                <p className="mb-1 text-[11px] tracking-widest text-slate-400 uppercase">{item.focus}</p>
                <h3 className="mb-2 text-sm font-bold text-slate-900">{item.scenario}</h3>
                <p className="mb-2 text-sm text-slate-600">{item.livedSignal}</p>
                <p className="text-xs text-slate-700"><span className="font-semibold">{t('phase6.stabilizationMoveLabel')}</span> {item.stabilizationMove}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-20 grid gap-6 lg:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-slate-50 p-6">
            <h3 className="mb-3 text-lg font-bold text-slate-900">{t('phase6.frictionTitle')}</h3>
            <div className="space-y-3">
              {governanceFrictionArr.map((item) => (
                <div key={item.friction} className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="mb-1 text-sm font-semibold text-slate-900">{item.friction}</p>
                  <p className="mb-1 text-sm text-slate-600">{item.continuityImpact}</p>
                  <p className="text-xs text-slate-700"><span className="font-semibold">{t('phase6.manageThroughLabel')}</span> {item.managementPath}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="mb-3 text-lg font-bold text-slate-900">{t('phase6.disruptionTitle')}</h3>
            <div className="space-y-3">
              {operationalDisruptionArr.map((item) => (
                <div key={item.area} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-1 text-xs tracking-widest text-slate-400 uppercase">{item.focus}</p>
                  <p className="mb-1 text-sm font-semibold text-slate-900">{item.area}</p>
                  <p className="mb-1 text-sm text-slate-600">{item.signal}</p>
                  <p className="text-xs text-slate-700"><span className="font-semibold">{t('phase6.stabilizeWithLabel')}</span> {item.mitigation}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mb-20 grid gap-6 lg:grid-cols-2">
          <article className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="mb-3 text-lg font-bold text-slate-900">{t('phase6.stabilizationTitle')}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {organizationalStabilizationArr.map((stage, index) => (
                <div key={stage} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {index + 1}. {stage}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-slate-200 bg-slate-50 p-6">
            <h3 className="mb-3 text-lg font-bold text-slate-900">{t('phase6.committeeTitle')}</h3>
            <div className="space-y-3">
              {committeeCoordinationArr.map((item) => (
                <div key={item.simulation} className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="mb-1 text-sm font-semibold text-slate-900">{item.simulation}</p>
                  <p className="mb-1 text-sm text-slate-600">{item.coordinationSignal}</p>
                  <p className="text-xs text-slate-700"><span className="font-semibold">{t('phase6.stabilizeWithLabel')}</span> {item.stabilizationApproach}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

          </TabsContent>

          <TabsContent value="proof" className="space-y-16">

        <section id="proof-layer" className="mb-20 scroll-mt-24">
          <h2 className="mb-3 text-2xl font-bold text-slate-900">{copy.proofTitle}</h2>
          <p className="mb-6 max-w-3xl leading-relaxed text-slate-600">
            {copy.proofBody}
          </p>
          <div className="mb-6 grid gap-4 md:grid-cols-3">
            {copy.proofCards.map((item) => (
              <article key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="mb-2 text-sm font-bold text-slate-900">{item.title}</h3>
                <p className="text-sm text-slate-600">{item.desc}</p>
              </article>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {executiveBriefingArr.map((item) => (
              <span key={item} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                {item}
              </span>
            ))}
          </div>
          <div className="mt-6">
            <Link href={withInstitutionalContext(`/${locale}/proof`, contextMode)} className="text-electric inline-flex items-center gap-2 text-sm font-semibold hover:text-blue-700">
              {copy.proofLink} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section id="governance-walkthroughs" className="mb-20 scroll-mt-24">
          <h2 className="mb-3 text-2xl font-bold text-slate-900">{copy.walkthroughsTitle}</h2>
          <p className="mb-6 max-w-3xl leading-relaxed text-slate-600">
            {copy.walkthroughsBody}
          </p>
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            {governanceOperationalArr.map((walkthrough) => (
              <article key={walkthrough.type} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="mb-1 text-[11px] tracking-widest text-slate-400 uppercase">{walkthrough.focus}</p>
                <h3 className="mb-2 text-sm font-bold text-slate-900">{walkthrough.type}</h3>
                <p className="text-sm text-slate-600">{walkthrough.narrative}</p>
              </article>
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-bold text-slate-900">{copy.simulationTitle}</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {governanceReviewArr.map((layer) => (
                <div key={layer} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  {layer}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="procurement-binder" className="mb-20 scroll-mt-24">
          <h2 className="mb-3 text-2xl font-bold text-slate-900">{copy.binderTitle}</h2>
          <p className="mb-6 max-w-3xl leading-relaxed text-slate-600">
            {copy.binderBody}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {procurementBinderArr.map((item) => (
              <article key={item} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                {item}
              </article>
            ))}
          </div>
        </section>

          </TabsContent>

          <TabsContent value="status" className="space-y-16">

        {/* CTA */}
        {/* System Status */}
        <section id="system-status" className="mb-20 scroll-mt-24">
          <h2 className="mb-6 text-2xl font-bold text-slate-900">{copy.statusTitle}</h2>
          <p className="mb-8 text-slate-600">
            {copy.statusBody}
          </p>
          <StatusPage />
        </section>

        {/* CTA */}
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center">
          <h2 className="mb-3 text-2xl font-bold text-slate-900">
            {copy.finalHeading}
          </h2>
          <p className="mx-auto mb-6 max-w-lg text-slate-600">
            {copy.finalBody}
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href={withInstitutionalContext(`/${locale}/pilot-request`, contextMode)}
              className="bg-navy hover:bg-navy/90 inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-colors"
            >
              {copy.startPilot} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/pricing`}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              {copy.viewPricing}
            </Link>
          </div>
        </section>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
