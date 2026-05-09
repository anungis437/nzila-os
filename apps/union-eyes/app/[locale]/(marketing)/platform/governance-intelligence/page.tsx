/**
 * Governance Intelligence — Platform module page
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, FileCheck, Users, Eye, GitBranch, AlertCircle } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';

export const metadata: Metadata = {
  title: 'Governance Intelligence | Union Eyes Platform',
  description:
    'Explainable governance intelligence for labour organizations — modernize governance with human oversight, audit trails, and full explainability.',
};

const capabilities = [
  { icon: ShieldCheck, title: 'Explainable Governance Outputs',  desc: 'Every governance intelligence output is traceable to its source evidence — no opaque recommendations, no unexplained decisions.' },
  { icon: FileCheck,   title: 'Governance Audit Trails',         desc: 'Complete audit trails for all governance intelligence actions, human review decisions, and system outputs.' },
  { icon: Users,       title: 'Democratic Oversight Controls',   desc: 'Governance modernization respects democratic structures — all intelligence surfaces to human decision-makers, never replacing them.' },
  { icon: Eye,         title: 'Continuity Oversight',            desc: 'Track governance structure continuity across leadership transitions, policy changes, and organizational evolution.' },
  { icon: GitBranch,   title: 'Governance Evolution Mapping',    desc: 'Surface how governance structures, bylaws, and policies have evolved over time — with institutional context intact.' },
  { icon: AlertCircle, title: 'Governance Risk Visibility',       desc: 'Identify governance continuity risks before they become crises — knowledge gaps, succession vulnerabilities, structural fragilities.' },
];

export default function GovernanceIntelligencePage() {
  return (
    <div className="bg-white min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.governanceIntelligenceModule}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white">
            Platform · Governance Intelligence
          </span>
        }
        heading={<>Governance modernization.<br />Explainable by design.</>}
        description="Governance Intelligence helps labour organizations modernize governance operations with explainable intelligence, full audit trails, and human oversight — without compromising democratic legitimacy."
        cta={
          <Link href="/pilot-request" className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30">
            Request a Demo
          </Link>
        }
      />

      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-navy mb-3 text-center">Governance intelligence that earns trust</h2>
          <p className="text-gray-600 text-center max-w-2xl mx-auto mb-12">
            Built for institutions where governance legitimacy is non-negotiable.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((c) => (
              <div key={c.title} className="p-6 rounded-2xl bg-white border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-electric/10 flex items-center justify-center mb-4">
                  <c.icon className="h-5 w-5 text-electric" />
                </div>
                <h3 className="text-sm font-bold text-navy mb-2">{c.title}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-navy text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to modernize governance intelligence?</h2>
          <p className="text-white/70 mb-8">See Governance Intelligence in a live pilot demonstration.</p>
          <Link href="/pilot-request" className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all">
            Request a Demo
          </Link>
        </div>
      </section>
    </div>
  );
}
