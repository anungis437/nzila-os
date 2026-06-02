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
 * Organizational Continuity — Core substrate capability page
 *
 * Positions UE as the organizational continuity intelligence substrate.
 * Hides internal engine complexity. Exposes operational outcomes.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, Users, ShieldCheck, BarChart3, Network, RefreshCw, ArrowRight } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import {
  evidenceArchitecture,
  governanceModernizationJourney,
  institutionalBeforeAfterMap,
  institutionalRolloutPathway,
  institutionalRolloutSimulationFlow,
  operationalMaturityPathway,
  organizationalTransformationPathway,
} from '@/lib/institutional-legitimacy';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const isFr = locale === 'fr-CA';
  return {
    title: isFr ? 'Continuité organisationnelle | UnionEyes' : 'Organizational Continuity | UnionEyes',
    description: isFr
      ? 'Préservez la mémoire organisationnelle, renforcez la résilience organisationnelle et maintenez la continuité à travers les transitions de leadership.'
      : 'Preserve organizational memory, strengthen organizational resilience, and maintain continuity through leadership transitions with UnionEyes.',
    alternates: buildLocaleAlternates(locale, '/organizational-continuity'),
  };
}

const englishPillars = [
  {
    icon: BookOpen,
    title: 'Organizational Memory',
    desc: 'Capture the organizational knowledge that lives in individuals — decisions, precedents, relationships, and operational history — and make it outlast any leadership transition.',
  },
  {
    icon: RefreshCw,
    title: 'Continuity Through Transition',
    desc: 'Maintain operational coherence and strategic continuity during succession, reorganization, or growth.',
  },
  {
    icon: Network,
    title: 'Longitudinal Organizational Visibility',
    desc: 'Surface the historical and relational context that informs present decisions.',
  },
  {
    icon: Users,
    title: 'Continuity Planning',
    desc: 'Identify continuity risks early and build resilience pathways.',
  },
  {
    icon: ShieldCheck,
    title: 'Labour-Safe by Design',
    desc: 'All continuity intelligence operates with full human oversight, explicit governance controls, and zero worker surveillance.',
  },
  {
    icon: BarChart3,
    title: 'Explainable Intelligence',
    desc: 'Every organizational insight is traceable to its source evidence — no opaque outputs or unexplained recommendations.',
  },
];

const englishJourneySteps = [
  { step: '01', label: 'Fragmentation Problem',     desc: 'Knowledge fragmentation and continuity risk become visible across the organization.' },
  { step: '02', label: 'Organizational Memory',          desc: 'Organizational memory is captured, preserved, and made operationally accessible at scale.' },
   { step: '03', label: 'Continuity Visibility',      desc: 'Leadership gains a clear view of context and resilience status.' },
   { step: '04', label: 'Explainable Intelligence',   desc: 'Every continuity insight is traceable and human-readable.' },
  { step: '05', label: 'Governance Continuity',      desc: 'Governance structures are preserved and modernized without losing organizational coherence.' },
  { step: '06', label: 'Resilience Outcome',         desc: 'The organization emerges stronger, more resilient, and strategically coherent through change.' },
];

const pageCopy = {
  'en-CA': {
    badge: 'Platform · Organizational Continuity',
    heading: <>Preserve what your organization<br />knows. Protect what it can do.</>,
    description:
      'Organizational Continuity is the UnionEyes capability that preserves organizational memory, strengthens resilience through transitions, and ensures governance structures survive beyond any individual leader.',
    primaryCta: 'Request an Executive Briefing',
    secondaryCta: 'View Governance Structure',
    tabs: {
      challenge: 'Challenge',
      pathways: 'Pathways',
      proof: 'Proof',
      action: 'Action',
    },
    problemHeading: 'Knowledge that lives in people disappears when they leave',
    problemBody1:
      'Labour organizations face a persistent continuity crisis: decades of organizational knowledge — negotiation history, relationship maps, governance decisions, operational precedents — lives in people, not in systems. When leaders leave, retire, or transition, that knowledge walks out with them.',
    problemBody2:
      'UnionEyes Organizational Continuity turns fragmented knowledge into governed, accessible, and explainable records so your organization stays stronger through every leadership transition.',
    journeyHeading: 'From fragmentation to organizational resilience',
    pillarsHeading: 'Six continuity capabilities. One integrated system.',
    pillarsBody:
      'Each capability is modular and can be deployed independently — or together as one integrated continuity system.',
    trustSignals: [
      { label: 'Labour-safe by design', sub: 'Zero individual conduct grading or monitoring' },
      { label: 'Human oversight required', sub: 'All intelligence is human-reviewed' },
      { label: 'Explainable intelligence', sub: 'Every insight is evidence-traceable' },
    ],
    finalHeading: 'Ready to strengthen organizational continuity?',
    finalBody:
      'See how UnionEyes preserves organizational memory and builds resilience through leadership transitions.',
    finalSecondary: 'Explore Organizational Memory',
    journeySteps: englishJourneySteps,
    pillars: englishPillars,
  },
  'fr-CA': {
    badge: 'Plateforme · Continuité organisationnelle',
    heading: <>Préserver ce que votre organisation<br />sait. Protéger ce qu’elle peut faire.</>,
    description:
      'La continuité organisationnelle est la capacité UnionEyes qui préserve la mémoire organisationnelle, renforce la résilience pendant les transitions et aide les structures de gouvernance à survivre au-delà de toute personne.',
    primaryCta: 'Demander une présentation exécutive',
    secondaryCta: 'Voir la structure de gouvernance',
    tabs: {
      challenge: 'Défi',
      pathways: 'Parcours',
      proof: 'Preuves',
      action: 'Action',
    },
    problemHeading: 'La connaissance détenue par des personnes disparaît lorsqu’elles partent',
    problemBody1:
      'Les organisations syndicales font face à un risque de continuité persistant : des décennies de savoir organisationnel — historique de négociation, relations, décisions de gouvernance et précédents opérationnels — vivent chez des personnes plutôt que dans des systèmes.',
    problemBody2:
      'UnionEyes transforme ce savoir fragmenté en structures gouvernées, accessibles et explicables, afin que l’organisation se renforce à travers chaque transition de leadership.',
    journeyHeading: 'De la fragmentation à la résilience organisationnelle',
    pillarsHeading: 'Six capacités de continuité. Un système intégré.',
    pillarsBody:
      'Chaque capacité peut être déployée seule ou avec les autres comme système unifié de continuité organisationnelle.',
    trustSignals: [
      { label: 'Respectueux du travail par conception', sub: 'Aucune notation ni surveillance individuelle' },
      { label: 'Supervision humaine requise', sub: 'Toute intelligence est revue par des humains' },
      { label: 'Intelligence explicable', sub: 'Chaque signal est traçable à ses preuves' },
    ],
    finalHeading: 'Prêt à renforcer la continuité organisationnelle?',
    finalBody:
      'Voyez comment UnionEyes préserve la mémoire organisationnelle et renforce la résilience pendant vos transitions de leadership.',
    finalSecondary: 'Explorer la mémoire organisationnelle',
    journeySteps: [
      { step: '01', label: 'Problème de fragmentation', desc: 'Les risques liés à la fragmentation du savoir et à la continuité deviennent visibles dans l’organisation.' },
      { step: '02', label: 'Mémoire organisationnelle', desc: 'La mémoire organisationnelle est capturée, préservée et rendue accessible à l’échelle opérationnelle.' },
      { step: '03', label: 'Visibilité de continuité', desc: 'La direction obtient une vue longitudinale du contexte organisationnel et de la résilience.' },
      { step: '04', label: 'Intelligence explicable', desc: 'Chaque signal de continuité est traçable, lisible et respectueux de la gouvernance.' },
      { step: '05', label: 'Continuité de gouvernance', desc: 'Les structures de gouvernance sont préservées et modernisées sans perdre la cohérence organisationnelle.' },
      { step: '06', label: 'Résilience', desc: 'L’organisation traverse le changement avec plus de force, de cohérence et de résilience.' },
    ],
    pillars: [
      { icon: BookOpen, title: 'Mémoire organisationnelle', desc: 'Préserver les décisions, précédents, relations et historiques opérationnels qui doivent survivre aux transitions.' },
      { icon: RefreshCw, title: 'Continuité pendant les transitions', desc: 'Maintenir la cohérence opérationnelle et stratégique pendant la succession, la réorganisation ou l’expansion.' },
      { icon: Network, title: 'Visibilité organisationnelle longitudinale', desc: 'Faire ressortir le contexte historique et relationnel qui éclaire les décisions actuelles.' },
      { icon: Users, title: 'Planification de continuité', desc: 'Repérer les risques de continuité et établir des parcours de résilience avant qu’ils deviennent vulnérables.' },
      { icon: ShieldCheck, title: 'Respectueux du travail par conception', desc: 'Toute intelligence de continuité fonctionne avec supervision humaine, contrôles de gouvernance et sans surveillance des travailleurs.' },
      { icon: BarChart3, title: 'Intelligence explicable', desc: 'Chaque aperçu organisationnel est traçable à ses preuves sources — sans boîte noire.' },
    ],
  },
} as const;

export default async function OrganizationalContinuityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const copy = pageCopy[locale as keyof typeof pageCopy] ?? pageCopy['en-CA'];

  // Select locale-aware arrays for imported content
  const rolloutPathway = institutionalRolloutPathway[locale as keyof typeof institutionalRolloutPathway] ?? institutionalRolloutPathway['en-CA'];
  const modernizationJourney = governanceModernizationJourney[locale as keyof typeof governanceModernizationJourney] ?? governanceModernizationJourney['en-CA'];
  const maturityPathway = operationalMaturityPathway[locale as keyof typeof operationalMaturityPathway] ?? operationalMaturityPathway['en-CA'];
  const transformationPathway = organizationalTransformationPathway[locale as keyof typeof organizationalTransformationPathway] ?? organizationalTransformationPathway['en-CA'];
  const evidence = evidenceArchitecture[locale as keyof typeof evidenceArchitecture] ?? evidenceArchitecture['en-CA'];

  return (
    <div className="bg-white min-h-screen">

      {/* ── Hero ── */}
      <MarketingHeroSection
        imageUrl={heroImagery.organizationalContinuity}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white">
            {copy.badge}
          </span>
        }
        heading={copy.heading}
        description={copy.description}
        cta={
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/${locale}/pilot/apply`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30"
            >
              {copy.primaryCta}
            </Link>
            <Link
              href={`/${locale}/governance`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all"
            >
              {copy.secondaryCta}
            </Link>
          </div>
        }
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Tabs defaultValue="challenge" className="space-y-8">
          <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/95 backdrop-blur-sm">
            <TabsList className="grid h-auto w-full grid-cols-2 md:grid-cols-4 gap-2 bg-transparent p-0 my-3">
              <TabsTrigger value="challenge" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                {copy.tabs.challenge}
              </TabsTrigger>
              <TabsTrigger value="pathways" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                {copy.tabs.pathways}
              </TabsTrigger>
              <TabsTrigger value="proof" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                {copy.tabs.proof}
              </TabsTrigger>
              <TabsTrigger value="action" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                {copy.tabs.action}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="challenge" className="space-y-12">

      {/* ── The Core Problem ── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">            <h2 className="text-3xl font-bold text-navy mb-4">
              {copy.problemHeading}
            </h2>
            <p className="text-gray-700 text-lg leading-relaxed mb-6">
              {copy.problemBody1}
            </p>
            <p className="text-gray-700 text-lg leading-relaxed">
              {copy.problemBody2}
            </p>
          </div>
        </div>
      </section>

      {/* ── Continuity Journey ── */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">            <h2 className="text-3xl font-bold text-navy mb-2">
              {copy.journeyHeading}
            </h2>
          </div>
          <div className="space-y-0">
            {copy.journeySteps.map((step, i) => {
              const hasNext = i < copy.journeySteps.length - 1;
              return (
                <div
                  key={step.step}
                  className={`flex gap-6 py-6 ${hasNext ? 'border-b border-gray-100' : ''}`}
                >
                  <div className="w-12">
                    <span className="text-xs font-bold text-electric tracking-wider">{step.step}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-navy mb-1">{step.label}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
                  </div>
                  {hasNext ? (
                    <div className="self-end pb-1">
                      <ArrowRight className="h-4 w-4 text-gray-300" />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Pillars ── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-navy mb-3">
              {copy.pillarsHeading}
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              {copy.pillarsBody}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {copy.pillars.map((p) => (
              <div key={p.title} className="p-6 rounded-2xl bg-white border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-electric/10 flex items-center justify-center mb-4">
                  <p.icon className="h-5 w-5 text-electric" />
                </div>
                <h3 className="text-base font-bold text-navy mb-2">{p.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust Signal ── */}
      <section className="py-16 bg-white border-y border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-3 gap-6 text-center">
            {copy.trustSignals.map((item) => (
              <div key={item.label} className="p-6 rounded-xl bg-gray-50 border border-gray-100">
                <div className="text-sm font-bold text-navy mb-1">{item.label}</div>
                <div className="text-xs text-gray-500">{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
          </TabsContent>

          <TabsContent value="pathways" className="space-y-12">

      <section className="py-16 bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">          <h2 className="text-3xl font-bold text-navy mb-3">Canonical deployment pathway for governed adoption</h2>
          <p className="text-gray-600 max-w-3xl mb-8">
            UnionEyes rollout sequencing is intentionally calm, reviewable, and operationally realistic for organizational modernization environments.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {rolloutPathway.map((stage, idx) => (
              <article key={stage} className="p-4 rounded-xl bg-white border border-gray-100 text-center">
                <p className="text-[11px] tracking-widest uppercase text-gray-400 mb-2">Phase {idx + 1}</p>
                <p className="text-xs sm:text-sm font-semibold text-navy leading-relaxed">{stage}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">          <h2 className="text-3xl font-bold text-navy mb-8">How modernization safely becomes operational</h2>
          <div className="space-y-3">
            {modernizationJourney.map((item) => (
              <article key={item.stage} className="p-5 rounded-xl bg-gray-50 border border-gray-100">
                <h3 className="text-sm font-bold text-navy mb-2">{item.stage}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-10">
            <div>              <h3 className="text-2xl font-bold text-navy mb-3">Directional maturity, not performance ranking</h3>
              <p className="text-sm text-gray-600 mb-6">
                Organizations can locate current operating maturity and progress safely through governed continuity stages.
              </p>
              <div className="space-y-3">
                {maturityPathway.map((stage, idx) => (
                  <div key={stage} className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-100">
                    <div className="w-8 h-8 rounded-full bg-electric/10 text-electric text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </div>
                    <p className="text-sm font-semibold text-navy">{stage}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>              <h3 className="text-2xl font-bold text-navy mb-3">Stabilizing organizational evolution sequence</h3>
              <p className="text-sm text-gray-600 mb-6">
                UnionEyes focuses on coherent progression from fragmentation risk to continuity-centered resilience.
              </p>
              <div className="space-y-3">
                {transformationPathway.map((stage, idx) => (
                  <div key={stage} className="flex items-center justify-between p-3 rounded-lg bg-white border border-gray-100">
                    <p className="text-sm font-semibold text-navy">{stage}</p>
                    {idx < transformationPathway.length - 1 ? <ArrowRight className="h-4 w-4 text-gray-300" /> : <span className="text-xs text-emerald-700 font-semibold">Target</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">          <h2 className="text-3xl font-bold text-navy mb-8">Operational reassurance for leadership and procurement review</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <article className="p-5 rounded-xl bg-gray-50 border border-gray-100">
              <h3 className="text-sm font-bold text-navy mb-2">Deployment Simplicity</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Phased implementation pacing, explicit governance checkpoints, and non-disruptive adoption sequencing.
              </p>
            </article>
            <article className="p-5 rounded-xl bg-gray-50 border border-gray-100">
              <h3 className="text-sm font-bold text-navy mb-2">Organizational Stability</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Continuity safeguards, oversight visibility, and explainable coordination preserve operational calm.
              </p>
            </article>
            <article className="p-5 rounded-xl bg-gray-50 border border-gray-100">
              <h3 className="text-sm font-bold text-navy mb-2">Long-Term Resilience</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Leadership transition continuity, organizational memory transfer, and governance coherence strengthening.
              </p>
            </article>
          </div>
        </div>
      </section>

          </TabsContent>

          <TabsContent value="proof" className="space-y-12">

      <section className="py-20 bg-gray-50 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-bold text-navy mb-3">Proof surfaces that make deployment reviewable</h2>
              <p className="text-gray-600 max-w-3xl">
                Evidence is presented as operational artifacts, not marketing claims. Reviewers can inspect rollout paths, governance checks, continuity summaries, and trust-center proof in one coherent structure.
              </p>
            </div>
            <Link href="/proof" className="inline-flex items-center gap-2 text-sm font-semibold text-electric hover:text-blue-700">
              Open the proof page <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {evidence.map((item) => (
              <article key={item.title} className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">{item.purpose}</p>
                <h3 className="text-base font-bold text-navy mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.note}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-8">
            <div>              <h2 className="text-2xl font-bold text-navy mb-3">Operational continuity as a gradual path</h2>
              <div className="space-y-2">
                {institutionalBeforeAfterMap.map((stage, index) => (
                  <article key={stage} className="p-3 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-between">
                    <span className="text-sm font-semibold text-navy">{stage}</span>
                    <span className="text-xs text-gray-400">Step {index + 1}</span>
                  </article>
                ))}
              </div>
            </div>
            <div>              <h2 className="text-2xl font-bold text-navy mb-3">How adoption remains calm and governable</h2>
              <div className="space-y-2">
                {institutionalRolloutSimulationFlow.map((stage, index) => (
                  <article key={stage} className="p-3 rounded-lg border border-gray-100 bg-white">
                    <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">Phase {index + 1}</p>
                    <p className="text-sm font-semibold text-navy">{stage}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

          </TabsContent>

          <TabsContent value="action" className="space-y-8">

      {/* ── CTA ── */}
      <section className="py-16 bg-navy text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            {copy.finalHeading}
          </h2>
          <p className="text-white/70 mb-8">
            {copy.finalBody}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/${locale}/pilot/apply`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all"
            >
              {copy.primaryCta}
            </Link>
            <Link
              href={`/${locale}/platform/organizational-memory`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all"
            >
              {copy.finalSecondary}
            </Link>
          </div>
        </div>
      </section>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
