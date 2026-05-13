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
 * Institutional Continuity — Core platform capability page
 *
 * Positions UE as the institutional continuity intelligence platform.
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
  return {
    title: 'Institutional Continuity | UnionEyes',
    description:
      'Preserve organizational memory, strengthen institutional resilience, and maintain continuity through leadership transitions. UnionEyes Institutional Continuity platform.',
    alternates: buildLocaleAlternates(locale, '/institutional-continuity'),
  };
}

const pillars = [
  {
    icon: BookOpen,
    title: 'Corporate Memory',
    desc: 'Capture the institutional knowledge that lives in individuals — decisions, precedents, relationships, and operational history — and make it outlast any leadership transition.',
  },
  {
    icon: RefreshCw,
    title: 'Continuity Through Transition',
    desc: 'Maintain operational coherence and strategic continuity during succession, reorganization, or expansion — without losing institutional context.',
  },
  {
    icon: Network,
    title: 'Longitudinal Institutional Visibility',
    desc: 'Surface the historical and relational context that informs present decisions — from collective agreements to governance evolution over time.',
  },
  {
    icon: Users,
    title: 'Continuity Planning',
    desc: 'Proactively identify continuity risks and build resilience pathways before they become vulnerabilities.',
  },
  {
    icon: ShieldCheck,
    title: 'Labour-Safe by Design',
    desc: 'All continuity intelligence operates with full human oversight, explicit governance controls, and zero worker surveillance.',
  },
  {
    icon: BarChart3,
    title: 'Explainable Intelligence',
    desc: 'Every institutional insight is traceable to its source evidence — no black box outputs, no unexplained recommendations.',
  },
];

const journeySteps = [
  { step: '01', label: 'Fragmentation Problem',     desc: 'Knowledge fragmentation and continuity risk become visible across the organization.' },
  { step: '02', label: 'Corporate Memory',          desc: 'Corporate memory is captured, preserved, and made operationally accessible at scale.' },
  { step: '03', label: 'Continuity Visibility',      desc: 'Leadership gains a longitudinal view of organizational context and resilience status.' },
  { step: '04', label: 'Explainable Intelligence',   desc: 'Every continuity insight is traceable, human-readable, and governance-safe.' },
  { step: '05', label: 'Governance Continuity',      desc: 'Governance structures are preserved and modernized without losing institutional coherence.' },
  { step: '06', label: 'Resilience Outcome',         desc: 'The organization emerges stronger, more resilient, and strategically coherent through change.' },
];

export default async function InstitutionalContinuityPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="bg-white min-h-screen">

      {/* ── Hero ── */}
      <MarketingHeroSection
        imageUrl={heroImagery.institutionalContinuity}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white">
            Platform · Institutional Continuity
          </span>
        }
        heading={<>Preserve what your organization<br />knows. Protect what it can do.</>}
        description="Institutional Continuity is the UnionEyes capability that preserves organizational memory, strengthens resilience through transitions, and ensures governance structures survive beyond any individual leader."
        cta={
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/${locale}/pilot-request`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30"
            >
              Request an Institutional Briefing
            </Link>
            <Link
              href={`/${locale}/governance`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all"
            >
              View Governance Structure
            </Link>
          </div>
        }
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Tabs defaultValue="challenge" className="space-y-8">
          <div className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/95 backdrop-blur-sm">
            <TabsList className="grid h-auto w-full grid-cols-2 md:grid-cols-4 gap-2 bg-transparent p-0 my-3">
              <TabsTrigger value="challenge" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                Challenge
              </TabsTrigger>
              <TabsTrigger value="pathways" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                Pathways
              </TabsTrigger>
              <TabsTrigger value="proof" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                Proof
              </TabsTrigger>
              <TabsTrigger value="action" className="rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] data-[state=active]:border-electric/70 data-[state=active]:text-electric data-[state=active]:shadow-none">
                Action
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="challenge" className="space-y-12">

      {/* ── The Core Problem ── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">            <h2 className="text-3xl font-bold text-navy mb-4">
              Knowledge that lives in people disappears when they leave
            </h2>
            <p className="text-gray-700 text-lg leading-relaxed mb-6">
              Labour organizations face a persistent continuity crisis: decades of institutional
              knowledge — negotiation history, relationship maps, governance decisions, operational
              precedents — lives in people, not in systems. When leaders leave, retire, or transition,
              that knowledge walks out with them.
            </p>
            <p className="text-gray-700 text-lg leading-relaxed">
              UnionEyes Institutional Continuity transforms fragmented institutional knowledge
              into governed, accessible, and explainable organizational intelligence — so your
              organization is stronger through every leadership transition.
            </p>
          </div>
        </div>
      </section>

      {/* ── Continuity Journey ── */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">            <h2 className="text-3xl font-bold text-navy mb-2">
              From fragmentation to institutional resilience
            </h2>
          </div>
          <div className="space-y-0">
            {journeySteps.map((step, i) => (
              <div
                key={step.step}
                className={`flex gap-6 py-6 ${i < journeySteps.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <div className="flex-shrink-0 w-12">
                  <span className="text-xs font-bold text-electric tracking-wider">{step.step}</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-navy mb-1">{step.label}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
                </div>
                {i < journeySteps.length - 1 && (
                  <div className="flex-shrink-0 self-end pb-1">
                    <ArrowRight className="h-4 w-4 text-gray-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pillars ── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-navy mb-3">
              Six continuity capabilities. One integrated system.
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Each capability is modular and deployable independently — or together as a
              unified institutional continuity platform.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pillars.map((p) => (
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
            {[
              { label: 'Labour-safe by design',     sub: 'Zero individual conduct grading or monitoring' },
              { label: 'Human oversight required',  sub: 'All intelligence is human-reviewed' },
              { label: 'Explainable intelligence',  sub: 'Every insight is evidence-traceable' },
            ].map((item) => (
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
            UnionEyes rollout sequencing is intentionally calm, reviewable, and operationally realistic for institutional modernization environments.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {institutionalRolloutPathway.map((stage, idx) => (
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
            {governanceModernizationJourney.map((item) => (
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
                {operationalMaturityPathway.map((stage, idx) => (
                  <div key={stage} className="flex items-center gap-3 p-3 rounded-lg bg-white border border-gray-100">
                    <div className="w-8 h-8 rounded-full bg-electric/10 text-electric text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </div>
                    <p className="text-sm font-semibold text-navy">{stage}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>              <h3 className="text-2xl font-bold text-navy mb-3">Stabilizing institutional evolution sequence</h3>
              <p className="text-sm text-gray-600 mb-6">
                UnionEyes focuses on coherent progression from fragmentation risk to continuity-centered resilience.
              </p>
              <div className="space-y-3">
                {organizationalTransformationPathway.map((stage, idx) => (
                  <div key={stage} className="flex items-center justify-between p-3 rounded-lg bg-white border border-gray-100">
                    <p className="text-sm font-semibold text-navy">{stage}</p>
                    {idx < organizationalTransformationPathway.length - 1 ? <ArrowRight className="h-4 w-4 text-gray-300" /> : <span className="text-xs text-emerald-700 font-semibold">Target</span>}
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
              <h3 className="text-sm font-bold text-navy mb-2">Institutional Stability</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Continuity safeguards, oversight visibility, and explainable coordination preserve operational calm.
              </p>
            </article>
            <article className="p-5 rounded-xl bg-gray-50 border border-gray-100">
              <h3 className="text-sm font-bold text-navy mb-2">Long-Term Resilience</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Leadership transition continuity, institutional memory transfer, and governance coherence strengthening.
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
            {evidenceArchitecture.map((item) => (
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
            <div>              <h2 className="text-2xl font-bold text-navy mb-3">Operational transformation as a gradual pathway</h2>
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
            Ready to strengthen institutional continuity?
          </h2>
          <p className="text-white/70 mb-8">
            See how UnionEyes preserves organizational memory and builds resilience
            through your leadership transitions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/${locale}/pilot-request`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all"
            >
              Request an Institutional Briefing
            </Link>
            <Link
              href={`/${locale}/platform/organizational-memory`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all"
            >
              Explore Organizational Memory
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
