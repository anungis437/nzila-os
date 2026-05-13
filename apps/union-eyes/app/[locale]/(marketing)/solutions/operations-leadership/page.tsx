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
import type { Metadata } from 'next';
import Link from 'next/link';
import { Network, RefreshCw, Users, AlertCircle, Layers, ArrowRight } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return {
    title: 'Operations Leadership | Solutions | UnionEyes',
    description: 'Maintain operational coherence across distributed teams and leadership transitions. UnionEyes for operations leaders.',
    alternates: buildLocaleAlternates(locale, '/solutions/operations-leadership'),
  };
}

const outcomes = [
  { icon: Network,     title: 'Cross-functional alignment surfaced',      desc: 'See alignment and coherence across distributed teams, regional offices, and functional areas — in one operational view.' },
  { icon: RefreshCw,   title: 'Continuity through organizational change',  desc: 'Maintain operational coherence through reorganization, expansion, and leadership transitions without losing institutional context.' },
  { icon: Users,       title: 'Team continuity planning',                  desc: 'Identify knowledge gaps across teams and build transfer pathways before operational fragilities become crises.' },
  { icon: AlertCircle, title: 'Fragmentation risk made visible',           desc: 'Understand the organizational fragmentation patterns undermining long-term operational effectiveness.' },
  { icon: Layers,      title: 'Corporate Memory for operations',        desc: 'Surface the operational precedents, decisions, and context that inform how your organization actually works.' },
];

const challenges = [
  'Operational knowledge is siloed — regional offices duplicate work because they cannot see what others know',
  'Operational fragility builds invisibly until a leadership change or reorganization triggers a crisis',
  'Cross-functional alignment is assumed but rarely verified — until it breaks down',
  'Institutional processes are undocumented, so every new manager rebuilds from scratch',
];

export default function OperationsLeadershipPage() {
  return (
    <div className="bg-white min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.operationsLeadership}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white backdrop-blur-sm">
            Solutions · Operations Leadership
          </span>
        }
        heading={<>Operational coherence that<br />survives any transition.</>}
        description="UnionEyes Operational Coherence gives operations leaders the institutional memory, fragmentation visibility, and continuity planning tools to keep distributed organizations aligned through any change."
        cta={
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/pilot-request" className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30">
              Request an Institutional Briefing
            </Link>
            <Link href="../platform/operational-coherence" className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all">
              Operational Coherence Architecture
            </Link>
          </div>
        }
      />

      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-navy mb-4">The operational fragmentation problem</h2>
            <ul className="space-y-3">
              {challenges.map((c) => (
                <li key={c} className="flex items-start gap-3 text-gray-700 text-sm leading-relaxed">
                  <div className="w-1.5 h-1.5 rounded-full bg-electric mt-1.5 flex-shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-navy mb-10 text-center">What operations leaders gain with UnionEyes</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {outcomes.map((o) => (
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

      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-base font-bold text-navy mb-6">Explore related solutions</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { label: 'Executive Leadership', href: './executive-leadership' },
              { label: 'Technology Leadership', href: './technology-leadership' },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-gray-200 text-sm font-medium text-navy hover:text-electric transition-colors">
                {l.label} <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-navy text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Maintain coherence through every change</h2>
          <p className="text-white/70 mb-8">See Operational Coherence in a live pilot demonstration.</p>
          <Link href="/pilot-request" className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all">
            Request an Institutional Briefing
          </Link>
        </div>
      </section>
    </div>
  );
}
