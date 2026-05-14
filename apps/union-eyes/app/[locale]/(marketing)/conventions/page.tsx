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
 * Conventions & Federated Governance — Category-defining surface
 *
 * Positions UE as institutional governance operations infrastructure for
 * federated democratic institutions. Procedural continuity, constitutional
 * traceability, governance-safe coordination across locals, regions, nationals.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BookOpen,
  Users,
  ShieldCheck,
  Network,
  ArrowRight,
  Layers,
  GitBranch,
} from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Conventions & Federated Governance | UnionEyes',
    description:
      'Federated democratic institutions operating with procedural continuity, constitutional traceability, and governance-safe coordination across locals, regions, and nationals.',
    alternates: buildLocaleAlternates(locale, '/conventions'),
  };
}

const pillars = [
  {
    icon: Network,
    title: 'Constitutional & Federated Topology',
    desc: 'Locals, regions, and nationals operate with their own constitutional autonomy, procedural rules, and historical lineage — preserved as a coherent federated structure rather than flattened into a single hierarchy.',
  },
  {
    icon: GitBranch,
    title: 'Resolution Lifecycle Infrastructure',
    desc: 'Resolutions, amendments, and successor language carry their full lineage — origin local, sponsoring committee, prior versions, and procedural disposition — so constitutional intent survives across cycles.',
  },
  {
    icon: Layers,
    title: 'Committee & Procedural Coordination',
    desc: 'Committees, sub-committees, and procedural roles coordinate alongside existing parliamentary practice — without replacing the procedural authority of chairs, parliamentarians, or constitutional officers.',
  },
  {
    icon: Users,
    title: 'Delegate & Representation Continuity',
    desc: 'Delegate context — credentials, mandates, prior interventions, constituency continuity — is preserved across conventions so representation remains coherent rather than starting from zero each cycle.',
  },
  {
    icon: ShieldCheck,
    title: 'Procedural Trust & Auditability',
    desc: 'Every procedural action — recognition, motion, amendment, vote disposition — is traceable to its source record, with human oversight and explainable governance controls throughout.',
  },
  {
    icon: BookOpen,
    title: 'Institutional Memory & Governance Continuity',
    desc: 'Constitutional decisions, precedent rulings, and governance evolution remain accessible across leadership transitions — so institutional memory outlasts any single administration.',
  },
];

const journeySteps = [
  { step: '01', label: 'Procedural Fragmentation',     desc: 'Resolutions, amendments, and delegate context fragment across documents, spreadsheets, and individual memory between cycles.' },
  { step: '02', label: 'Resolution Traceability',       desc: 'Every resolution and amendment carries its lineage — origin, sponsor, prior versions, and disposition — in a reviewable structure.' },
  { step: '03', label: 'Delegate Continuity',           desc: 'Credentials, mandates, and constituency context persist across conventions so representation remains coherent.' },
  { step: '04', label: 'Committee Coordination',        desc: 'Committees coordinate procedural work alongside chairs and parliamentarians, without replacing constitutional authority.' },
  { step: '05', label: 'Constitutional Coherence',      desc: 'Constitutional intent and precedent rulings remain reviewable across cycles, supporting governance-safe decision making.' },
  { step: '06', label: 'Federated Resilience',          desc: 'The federation operates as a coherent institution — locals, regions, and nationals aligned on procedural continuity and shared institutional memory.' },
];

export default async function ConventionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="bg-white min-h-screen">

      {/* ── Hero ── */}
      <MarketingHeroSection
        imageUrl={heroImagery.conventions}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white">
            Platform · Conventions & Federated Governance
          </span>
        }
        heading={<>Federated democratic institutions,<br />operating with procedural continuity.</>}
        description="UnionEyes Conventions & Federated Governance is the continuity layer for institutional governance operations — preserving constitutional intent, delegate continuity, and resolution lifecycle integrity across locals, regions, and nationals."
        cta={
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/${locale}/pilot-request`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30"
            >
              Explore Governance Coordination
            </Link>
            <Link
              href={`/${locale}/governance`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all"
            >
              Book Institutional Discovery
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
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold text-navy mb-4">
              Federated institutions are coordination structures, not events
            </h2>
            <p className="text-gray-700 text-lg leading-relaxed mb-6">
              Federated democratic institutions operate across locals, regions, and nationals — each
              with constitutional autonomy, procedural rules, and historical lineage. Coordination
              breaks when resolutions, amendments, and delegate context fragment across documents,
              spreadsheets, and individual memory between cycles.
            </p>
            <p className="text-gray-700 text-lg leading-relaxed">
              UnionEyes Conventions & Federated Governance is a continuity layer that preserves
              constitutional intent, delegate continuity, and resolution lifecycle integrity —
              alongside existing parliamentary practice, not in place of it.
            </p>
          </div>
        </div>
      </section>

      {/* ── Continuity Journey ── */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-navy mb-2">
              From procedural fragmentation to federated resilience
            </h2>
          </div>
          <div className="space-y-0">
            {journeySteps.map((step, i) => (
              <div
                key={step.step}
                className={`flex gap-6 py-6 ${i < journeySteps.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <div className="shrink-0 w-12">
                  <span className="text-xs font-bold text-electric tracking-wider">{step.step}</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-navy mb-1">{step.label}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{step.desc}</p>
                </div>
                {i < journeySteps.length - 1 && (
                  <div className="shrink-0 self-end pb-1">
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
              Six governance continuity capabilities. One federated structure.
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Each capability is modular and adoptable independently — or together as a coherent
              continuity layer for federated democratic institutions.
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
              { label: 'Procedural neutrality',     sub: 'Alongside existing parliamentary practice' },
              { label: 'Human oversight required',  sub: 'Chairs and parliamentarians retain authority' },
              { label: 'Constitutional traceability', sub: 'Every resolution carries its full lineage' },
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

      {/* ── Coexistence ── */}
      <section className="py-16 bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-navy mb-3">Coexistence with existing systems</h2>
          <p className="text-gray-600 max-w-3xl mb-8">
            UnionEyes operates as overlay infrastructure — a continuity layer that runs alongside
            existing constitutional documents, resolution archives, delegate registration systems,
            and parliamentary practice. Non-disruptive implementation is the default operating
            posture.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { title: 'Overlay infrastructure', desc: 'A continuity layer that augments existing constitutional and procedural systems rather than replacing them.' },
              { title: 'Alongside existing systems', desc: 'Resolution archives, delegate registries, and parliamentary tools continue to operate — UnionEyes adds traceability and continuity.' },
              { title: 'Non-disruptive implementation', desc: 'Phased adoption sequencing with explicit governance checkpoints — operational calm preserved throughout.' },
              { title: 'Coexistence with parliamentary practice', desc: 'Procedural authority remains with chairs, parliamentarians, and constitutional officers; UnionEyes provides supporting continuity.' },
              { title: 'Canadian-hosted', desc: 'Institutional data residency aligned with Canadian governance and procurement expectations.' },
              { title: 'Bilingual-first', desc: 'English and French as first-class procedural surfaces, reflecting how federated Canadian institutions actually operate.' },
            ].map((item) => (
              <article key={item.title} className="p-5 rounded-xl bg-white border border-gray-100">
                <h3 className="text-sm font-bold text-navy mb-2">{item.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Governance-safe AI ── */}
      <section className="py-20 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-navy mb-3">Governance-safe assistive intelligence</h2>
          <p className="text-gray-600 max-w-3xl mb-8">
            Where intelligence supports procedural work, it operates as assistive intelligence under
            full human oversight. Every suggestion is reviewable, explainable, and traceable to its
            source evidence — never autonomous, never substituting for procedural authority.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { title: 'Human oversight', desc: 'Chairs, parliamentarians, and committee officers retain procedural authority over every decision.' },
              { title: 'Explainability', desc: 'Every assistive suggestion is traceable to its source record — constitutional clause, prior resolution, or procedural precedent.' },
              { title: 'Reviewability', desc: 'Procedural artifacts are reviewable end-to-end so disposition can be audited by delegates and constitutional officers.' },
              { title: 'Assistive, not autonomous', desc: 'Intelligence supports procedural continuity; it does not direct, dispose, or replace deliberative authority.' },
            ].map((item) => (
              <article key={item.title} className="p-5 rounded-xl bg-gray-50 border border-gray-100">
                <h3 className="text-sm font-bold text-navy mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Operational reassurance ── */}
      <section className="py-16 bg-gray-50 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-navy mb-8">Operational reassurance for constitutional review</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <article className="p-5 rounded-xl bg-white border border-gray-100">
              <h3 className="text-sm font-bold text-navy mb-2">Adoption Calm</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Phased rollout pacing with explicit governance checkpoints — adoption proceeds at the
                pace constitutional review permits.
              </p>
            </article>
            <article className="p-5 rounded-xl bg-white border border-gray-100">
              <h3 className="text-sm font-bold text-navy mb-2">Procedural Stability</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Constitutional officers and parliamentarians retain procedural authority; UnionEyes
                supports rather than substitutes.
              </p>
            </article>
            <article className="p-5 rounded-xl bg-white border border-gray-100">
              <h3 className="text-sm font-bold text-navy mb-2">Federated Resilience</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Constitutional intent and delegate continuity persist across cycles, leadership
                transitions, and federated coordination.
              </p>
            </article>
          </div>
        </div>
      </section>

          </TabsContent>

          <TabsContent value="proof" className="space-y-12">

      <section className="py-20 bg-gray-50 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-bold text-navy mb-3">Procedural artifacts that make governance reviewable</h2>
              <p className="text-gray-600 max-w-3xl">
                Evidence is presented as procedural artifacts — resolution lineage records, delegate
                continuity registries, amendment trails, and committee disposition logs — not
                marketing claims. Constitutional officers can inspect each surface directly.
              </p>
            </div>
            <Link href="/proof" className="inline-flex items-center gap-2 text-sm font-semibold text-electric hover:text-blue-700">
              Open the proof page <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[
              { purpose: 'Resolution lifecycle', title: 'Amendment Lineage Records', note: 'Every amendment carries origin local, sponsoring committee, prior versions, and procedural disposition in a reviewable structure.' },
              { purpose: 'Delegate continuity', title: 'Credential & Mandate Registry', note: 'Delegate credentials, constituency mandates, and prior interventions persist across cycles for representational coherence.' },
              { purpose: 'Committee coordination', title: 'Committee Disposition Logs', note: 'Committee work — referrals, recommendations, and procedural dispositions — is traceable across the convention lifecycle.' },
              { purpose: 'Constitutional memory', title: 'Precedent Ruling Archive', note: 'Chair rulings and constitutional interpretations persist as institutional memory available to future deliberations.' },
              { purpose: 'Procedural trust', title: 'Recognition & Vote Trails', note: 'Recognition order, motion sequencing, and vote dispositions are traceable to source records for auditability.' },
              { purpose: 'Federated topology', title: 'Federation Structure Map', note: 'Locals, regions, and nationals are represented as a coherent constitutional topology rather than flattened lists.' },
            ].map((item) => (
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
            <div>
              <h2 className="text-2xl font-bold text-navy mb-3">From procedural fragmentation to constitutional coherence</h2>
              <div className="space-y-2">
                {[
                  'Resolutions and amendments fragmented across documents',
                  'Delegate context reset each cycle',
                  'Committee work disconnected from prior cycles',
                  'Resolution lineage preserved across cycles',
                  'Delegate continuity persists across conventions',
                  'Committee work coordinates with prior precedent',
                ].map((stage, index) => (
                  <article key={stage} className="p-3 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-between">
                    <span className="text-sm font-semibold text-navy">{stage}</span>
                    <span className="text-xs text-gray-400">Step {index + 1}</span>
                  </article>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-navy mb-3">How federated adoption remains governable</h2>
              <div className="space-y-2">
                {[
                  'Constitutional review and scoping with federation officers',
                  'Pilot deployment with one local or region',
                  'Resolution lifecycle and delegate continuity onboarding',
                  'Committee coordination and procedural traceability',
                  'Federated rollout across locals, regions, and nationals',
                  'Continuity-centered operating posture established',
                ].map((stage, index) => (
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
            Ready to strengthen federated governance continuity?
          </h2>
          <p className="text-white/70 mb-8">
            See how UnionEyes preserves constitutional intent, delegate continuity, and resolution
            lifecycle integrity across your locals, regions, and nationals.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/${locale}/pilot-request`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all"
            >
              Explore Governance Coordination
            </Link>
            <Link
              href={`/${locale}/governance`}
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all"
            >
              Book Institutional Discovery
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
