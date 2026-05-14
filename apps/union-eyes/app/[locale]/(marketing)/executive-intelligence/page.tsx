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
 * Executive Intelligence — Strategic summaries & leadership continuity
 *
 * Exposes executive-grade operational clarity.
 * Hides internal cognition complexity.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3, FileText, Users, TrendingUp, ShieldCheck, Layers } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return {
    title: 'Executive Intelligence | UnionEyes',
    description:
      'Calm, executive-grade strategic summaries and leadership continuity intelligence for union executives. Operational clarity without technical complexity.',
    alternates: buildLocaleAlternates(locale, '/executive-intelligence'),
  };
}

const surfaces = [
  {
    icon: FileText,
    title: 'Strategic Summaries',
    desc: 'Executive-grade summaries of organizational status, continuity risks, and strategic priorities — human-readable and action-oriented.',
  },
  {
    icon: TrendingUp,
    title: 'Continuity Visibility',
    desc: 'See organizational continuity health at a glance: what knowledge is at risk, where transitions are occurring, and what requires leadership attention.',
  },
  {
    icon: Users,
    title: 'Leadership Continuity Tracking',
    desc: 'Track succession readiness, knowledge transfer progress, and continuity preparedness across the organization.',
  },
  {
    icon: BarChart3,
    title: 'Governance Intelligence Briefings',
    desc: 'Governance modernization progress, explainability audit status, and continuity oversight summaries — built for board-level review.',
  },
  {
    icon: ShieldCheck,
    title: 'Trust & Compliance Dashboards',
    desc: 'Operational trust posture, governance compliance status, and institutional audit readiness — all in one executive surface.',
  },
  {
    icon: Layers,
    title: 'Corporate Memory Snapshots',
    desc: 'Point-in-time views of organizational knowledge, historical precedents, and institutional context available for executive review.',
  },
];

const principles = [
  { label: 'Calm',              desc: 'No technical complexity exposed at executive surfaces' },
  { label: 'Strategic',         desc: 'Focused on organizational direction and continuity' },
  { label: 'Explainable',       desc: 'Every summary traces back to evidence' },
  { label: 'Governance-safe',   desc: 'Full human oversight at all decision points' },
  { label: 'Labour-safe',       desc: 'Zero individual monitoring or worker conduct grading' },
  { label: 'Enterprise-grade',  desc: 'Built for institutional trust, not startup dashboards' },
];

export default function ExecutiveIntelligencePage() {
  return (
    <div className="bg-white min-h-screen">

      {/* ── Hero ── */}
      <MarketingHeroSection
        imageUrl={heroImagery.executiveIntelligenceModule}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white">
            Platform · Executive Intelligence
          </span>
        }
        heading={<>Strategic clarity.<br />Without technical complexity.</>}
        description="Executive Intelligence surfaces institutional continuity, governance modernization status, and organizational health — in calm, executive-readable formats designed for leadership decision-making."
        cta={
          <Link
            href="/pilot-request"
            className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30"
          >
            Request an Institutional Briefing
          </Link>
        }
      />

      {/* ── Design Principles ── */}
      <section className="py-16 bg-gray-50 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs font-semibold tracking-widest uppercase text-gray-400 mb-8">
            Executive Intelligence Design Principles
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {principles.map((p) => (
              <div key={p.label} className="text-center p-4 rounded-xl bg-white border border-gray-100">
                <div className="text-sm font-bold text-navy mb-1">{p.label}</div>
                <div className="text-xs text-gray-500 leading-tight">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Surfaces ── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">            <h2 className="text-3xl font-bold text-navy mb-3">
              Built for institutional leadership
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Not analytics dashboards. Not engineering tools. Executive Intelligence surfaces
              are purpose-built for the strategic clarity that union leaders need.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {surfaces.map((s) => (
              <div key={s.title} className="p-6 rounded-2xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-electric/10 flex items-center justify-center mb-4">
                  <s.icon className="h-5 w-5 text-electric" />
                </div>
                <h3 className="text-base font-bold text-navy mb-2">{s.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stakeholder Journey ── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>              <h2 className="text-3xl font-bold text-navy mb-4">
                For union executives who lead through complexity
              </h2>
              <p className="text-gray-700 leading-relaxed mb-6">
                Executive Intelligence is designed for the president, secretary-treasurer,
                or regional director who needs to lead through leadership transitions, governance
                modernization, and strategic continuity challenges — without wading through
                technical reports or fragmented operational data.
              </p>
              <ul className="space-y-3">
                {[
                  'See continuity risks before they become crises',
                  'Lead governance modernization with explainable intelligence',
                  'Maintain strategic coherence through succession and change',
                  'Communicate institutional health to boards with confidence',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-electric mt-1.5" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              {[
                { q: 'Does this feel strategically trustworthy?',  a: 'Executive Intelligence is built to earn institutional trust through transparency and explainability.' },
                { q: 'Does this feel operationally mature?',       a: 'Calm, modular, and enterprise-grade — not startup dashboards or AI admin panels.' },
                { q: 'Does this feel labour-safe?',                a: 'Zero worker surveillance. Human oversight built into every intelligence output.' },
              ].map((item) => (
                <div key={item.q} className="p-5 rounded-xl bg-white border border-gray-100">
                  <p className="text-sm font-semibold text-navy mb-2">{item.q}</p>
                  <p className="text-sm text-gray-600">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 bg-navy text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to lead with institutional clarity?
          </h2>
          <p className="text-white/70 mb-8">
            Request an institutional briefing to see Executive Intelligence in action for your organization.
          </p>
          <Link
            href="/pilot-request"
            className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all"
          >
            Request an Institutional Briefing
          </Link>
        </div>
      </section>
    </div>
  );
}
