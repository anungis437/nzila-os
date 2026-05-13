import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Eye, FileCheck, GitBranch, Vote, ArrowRight } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return {
    title: 'Governance Leadership | Solutions | UnionEyes',
    description: 'Modernize governance operations with explainable intelligence, full audit trails, and democratic oversight controls. UnionEyes for governance leaders.',
    alternates: buildLocaleAlternates(locale, '/solutions/governance-leadership'),
  };
}

const outcomes = [
  { icon: ShieldCheck, title: 'Governance modernization you can defend',  desc: 'Every governance change is explainable, evidence-traceable, and auditable — governance that earns democratic legitimacy.' },
  { icon: Eye,         title: 'Continuity oversight across transitions',   desc: 'Track governance structure health across leadership transitions with full historical context intact.' },
  { icon: FileCheck,   title: 'Audit-ready governance intelligence',       desc: 'Complete audit trails for all governance decisions, intelligence actions, and human review outcomes.' },
  { icon: GitBranch,   title: 'Governance evolution made visible',         desc: 'Surface how bylaws, policies, and governance structures have evolved — with the institutional context that explains why.' },
  { icon: Vote,        title: 'Democratic structures preserved',           desc: 'Intelligence recommends. Democratic structures decide. Human oversight is structurally enforced at every layer.' },
];

const challenges = [
  'Governance decisions lack historical context — the precedent exists, but no one can find it',
  'Modernization efforts stall because the rationale for current structures is undocumented',
  'Audit and compliance requests take weeks to compile when evidence is fragmented across systems',
  'Leadership transitions erode corporate memory faster than it can be rebuilt',
];

export default function GovernanceLeadershipPage() {
  return (
    <div className="bg-white min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.governanceLeadership}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white backdrop-blur-sm">
            Solutions · Governance Leadership
          </span>
        }
        heading={<>Governance modernization that<br />earns democratic trust.</>}
        description="UnionEyes Governance Intelligence gives governance leaders the explainability, audit trails, and institutional context to modernize governance operations without compromising democratic legitimacy."
        cta={
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/pilot-request" className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30">
              Request an Institutional Briefing
            </Link>
            <Link href="../platform/governance-intelligence" className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all">
              Governance Intelligence Platform
            </Link>
          </div>
        }
      />

      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-navy mb-4">The governance continuity problem</h2>
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
          <h2 className="text-2xl font-bold text-navy mb-10 text-center">What governance leaders gain with UnionEyes</h2>
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

      <section className="py-16 bg-gray-50 border-y border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-base font-bold text-navy mb-6">Governance & Trust commitments</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { label: 'Full explainability for every output' },
              { label: 'Complete audit trails, always' },
              { label: 'Human oversight enforced by design' },
              { label: 'Democratic governance structures preserved' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 p-4 rounded-xl bg-white border border-gray-100 text-sm font-medium text-navy">
                <ShieldCheck className="h-4 w-4 text-electric flex-shrink-0" />
                {item.label}
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
              { label: 'Policy & Labour Leadership', href: './labour-leadership' },
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
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Modernize governance with confidence</h2>
          <p className="text-white/70 mb-8">See Governance Intelligence in a live pilot demonstration.</p>
          <Link href="/pilot-request" className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all">
            Request an Institutional Briefing
          </Link>
        </div>
      </section>
    </div>
  );
}
