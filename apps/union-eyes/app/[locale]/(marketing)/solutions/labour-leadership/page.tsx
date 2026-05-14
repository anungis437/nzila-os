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
import { ShieldCheck, Users, Eye, Scale, HeartHandshake, ArrowRight } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return {
    title: 'Policy & Labour Leadership | Solutions | UnionEyes',
    description:
      'Advance labour-safe modernization with human oversight, anti-surveillance safeguards, and democratic governance controls.',
    alternates: buildLocaleAlternates(locale, '/solutions/labour-leadership'),
  };
}

const outcomes = [
  {
    icon: ShieldCheck,
    title: 'Labour-safe modernization by design',
    desc: 'Modernize operations without opening a surveillance pathway or weakening member protections.',
  },
  {
    icon: Eye,
    title: 'Human oversight enforced',
    desc: 'No automated decision path bypasses elected leadership, policy review, or representation judgment.',
  },
  {
    icon: Scale,
    title: 'Democratic accountability preserved',
    desc: 'Governance controls keep strategic decisions with people, not opaque systems.',
  },
  {
    icon: Users,
    title: 'Member trust strengthened',
    desc: 'Clear safeguards and explainable outputs increase confidence from members and frontline reps.',
  },
  {
    icon: HeartHandshake,
    title: 'Policy coherence across teams',
    desc: 'Policy, governance, and operations stay aligned through leadership transitions and organizational change.',
  },
];

const challenges = [
  'AI adoption pressure can outpace governance readiness and policy safeguards',
  'Members and representatives need clear guarantees against surveillance misuse',
  'Human review can be inconsistent when standards are not enforced structurally',
  'Policy intent gets diluted when operational teams work from fragmented systems',
];

export default function LabourLeadershipPage() {
  return (
    <div className="bg-white min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.labourLeadership}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white backdrop-blur-sm">
            Solutions · Policy & Labour Leadership
          </span>
        }
        heading={<>Labour-safe modernization<br />without compromise.</>}
        description="UnionEyes gives policy and labour leaders a governance-safe path to modernization: explainable outputs, human oversight, and anti-surveillance protections built into the platform."
        cta={
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/pilot-request" className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30">
              Request an Executive Briefing
            </Link>
            <Link href="../trust" className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all">
              View Governance & Trust
            </Link>
          </div>
        }
      />

      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-navy mb-4">The policy challenge</h2>
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
          <h2 className="text-2xl font-bold text-navy mb-10 text-center">What policy and labour leaders gain</h2>
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
              { label: 'Governance Leadership', href: './governance-leadership' },
              { label: 'Procurement Stakeholders', href: './procurement' },
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
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Build member trust into modernization</h2>
          <p className="text-white/70 mb-8">See a labour-safe implementation path in a guided demo.</p>
          <Link href="/pilot-request" className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all">
            Request an Executive Briefing
          </Link>
        </div>
      </section>
    </div>
  );
}
