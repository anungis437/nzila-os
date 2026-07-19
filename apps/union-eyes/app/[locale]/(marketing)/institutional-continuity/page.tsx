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
    desc: 'Keep key knowledge in one place so it stays with the organization when leaders change.',
  },
  {
    icon: RefreshCw,
    title: 'Continuity Through Transition',
    desc: 'Keep work stable through leadership changes, restructuring, or growth.',
  },
  {
    icon: Network,
    title: 'Longitudinal Organizational Visibility',
    desc: 'See past decisions and context clearly so current decisions are easier to make.',
  },
  {
    icon: Users,
    title: 'Continuity Planning',
    desc: 'Spot continuity risks early and address them before they become problems.',
  },
  {
    icon: ShieldCheck,
    title: 'Labour-Safe by Design',
    desc: 'Human review is always required, with clear controls and no worker surveillance.',
  },
  {
    icon: BarChart3,
    title: 'Explainable Intelligence',
    desc: 'Every insight links back to evidence. No opaque recommendations.',
  },
];

const englishJourneySteps = [
  { step: '01', label: 'Find the gaps',     desc: 'See where key knowledge is scattered or at risk.' },
  { step: '02', label: 'Capture key knowledge',          desc: 'Bring critical context into one shared, usable record.' },
  { step: '03', label: 'Make continuity visible',      desc: 'Give leaders a clear view of continuity health and risks.' },
  { step: '04', label: 'Keep insights explainable',   desc: 'Make each insight readable and tied to real evidence.' },
  { step: '05', label: 'Strengthen governance',      desc: 'Improve governance processes without losing context.' },
  { step: '06', label: 'Stay resilient',         desc: 'Move through change with less disruption and better continuity.' },
];

const pageCopy = {
  'en-CA': {
    badge: 'Platform · Organizational Continuity',
    heading: <>Preserve what your organization<br />knows. Protect what it can do.</>,
    description:
      'Organizational Continuity helps your team keep key knowledge, stay stable through transitions, and keep governance clear.',
    primaryCta: 'Start a review',
    secondaryCta: 'View Governance Structure',
    tabs: {
      challenge: 'Challenge',
      pathways: 'Pathways',
      proof: 'Proof',
      action: 'Action',
    },
    problemHeading: 'People-held knowledge disappears when they leave',
    problemBody1:
      'Union teams often keep critical history in people, not systems. When leaders leave, that context can leave too.',
    problemBody2:
      'UnionEyes turns scattered knowledge into shared records your team can use during every leadership change.',
    journeyHeading: 'From scattered knowledge to stable continuity',
    pillarsHeading: 'Six continuity capabilities in one system',
    pillarsBody:
      'Start with one capability or roll out all six together.',
    trustSignals: [
      { label: 'Labour-safe by design', sub: 'Zero individual conduct grading or monitoring' },
      { label: 'Human oversight required', sub: 'All intelligence is human-reviewed' },
      { label: 'Explainable intelligence', sub: 'Every insight is evidence-traceable' },
    ],
    finalHeading: 'Ready to improve continuity?',
    finalBody:
      'See how UnionEyes helps your team keep context and stay stable through leadership changes.',
    finalSecondary: 'Explore Organizational Memory',
    journeySteps: englishJourneySteps,
    pillars: englishPillars,
  },
  'fr-CA': {
    badge: 'Plateforme · Continuité organisationnelle',
    heading: <>Préserver ce que votre organisation<br />sait. Protéger ce qu’elle peut faire.</>,
    description:
      'La continuite organisationnelle aide votre equipe a garder le contexte, rester stable pendant les transitions et garder une gouvernance claire.',
    primaryCta: 'Faire le bilan',
    secondaryCta: 'Voir la structure de gouvernance',
    tabs: {
      challenge: 'Défi',
      pathways: 'Parcours',
      proof: 'Preuves',
      action: 'Action',
    },
    problemHeading: 'La connaissance détenue par des personnes disparaît lorsqu elles partent',
    problemBody1:
      'Dans plusieurs equipes syndicales, le savoir cle reste dans les personnes plutot que dans les systemes. Quand des responsables partent, ce contexte part aussi.',
    problemBody2:
      'UnionEyes transforme ce savoir eparpille en dossiers partages, faciles a consulter pendant les transitions.',
    journeyHeading: 'Du savoir eparpillé a une continuite stable',
    pillarsHeading: 'Six capacites de continuite dans un seul systeme',
    pillarsBody:
      'Commencez avec une capacite, puis ajoutez les autres au besoin.',
    trustSignals: [
      { label: 'Respectueux du travail par conception', sub: 'Aucune notation ou surveillance de conduite individuelle' },
      { label: 'Supervision humaine requise', sub: 'Toute intelligence est revue par des humains' },
      { label: 'Intelligence explicable', sub: 'Chaque signal est traçable à ses preuves' },
    ],
    finalHeading: 'Pret a ameliorer la continuite organisationnelle?',
    finalBody:
      'Voyez comment UnionEyes aide votre equipe a garder le contexte et rester stable pendant les transitions de leadership.',
    finalSecondary: 'Explorer la mémoire organisationnelle',
    journeySteps: [
      { step: '01', label: 'Reperer les ecarts', desc: 'Voir ou le savoir cle est disperse ou fragile.' },
      { step: '02', label: 'Capturer le savoir cle', desc: 'Rassembler le contexte essentiel dans un dossier partage.' },
      { step: '03', label: 'Rendre la continuite visible', desc: 'Donner a la direction une vue claire des risques et de la stabilite.' },
      { step: '04', label: 'Rester explicable', desc: 'Chaque signal reste lisible et relie a des preuves.' },
      { step: '05', label: 'Renforcer la gouvernance', desc: 'Ameliorer les processus sans perdre le contexte.' },
      { step: '06', label: 'Rester resilient', desc: 'Traverser les changements avec moins de ruptures.' },
    ],
    pillars: [
      { icon: BookOpen, title: 'Memoire organisationnelle', desc: 'Garder decisions, precedents et contexte dans un espace partage.' },
      { icon: RefreshCw, title: 'Continuite pendant les transitions', desc: 'Maintenir le travail stable pendant succession, reorganisation ou expansion.' },
      { icon: Network, title: 'Visibilite dans le temps', desc: 'Voir le contexte passe qui aide les decisions actuelles.' },
      { icon: Users, title: 'Plan de continuite', desc: 'Detecter les risques tot et preparer une reponse claire.' },
      { icon: ShieldCheck, title: 'Concu pour respecter le travail', desc: 'Supervision humaine obligatoire et aucune surveillance des travailleurs.' },
      { icon: BarChart3, title: 'Intelligence explicable', desc: 'Chaque signal renvoie a des preuves claires.' },
    ],
  },
} as const;

export default async function InstitutionalContinuityPage({
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
        imageUrl={heroImagery.institutionalContinuity}
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
              href={`/${locale}/organizational-continuity-risk`}
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">          <h2 className="text-3xl font-bold text-navy mb-3">A clear rollout path your team can follow</h2>
          <p className="text-gray-600 max-w-3xl mb-8">
            UnionEyes rollout is phased, practical, and easy to review with leadership and governance teams.
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">          <h2 className="text-3xl font-bold text-navy mb-8">How rollout becomes day-to-day operations</h2>
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
              href={`/${locale}/organizational-continuity-risk`}
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
