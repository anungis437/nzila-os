import type { Metadata } from 'next';
import Link from 'next/link';
import { Cpu, ShieldCheck, Lock, Eye, CheckCircle, ArrowRight } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';

export const metadata: Metadata = {
  title: 'Technology Leadership | Solutions | Union Eyes',
  description: 'Governance-safe AI with full explainability, enterprise security, and Canadian data residency. Union Eyes for technology leaders in labour organizations.',
};

const outcomes = [
  { icon: ShieldCheck, title: 'Governance-safe AI architecture',        desc: 'AI systems that operate within democratic governance structures — explainable outputs, human oversight enforced by design.' },
  { icon: Lock,        title: 'Enterprise security & data residency',   desc: 'Canadian data residency, SOC 2-aligned infrastructure, and full audit capabilities for compliance and regulatory requirements.' },
  { icon: Eye,         title: 'Full explainability guarantees',         desc: 'Every intelligence output is traceable to source evidence. No black-box outputs in a labour environment.' },
  { icon: Cpu,         title: 'Modular, safe deployment architecture',  desc: 'Deploy the modules your organization needs, in the sequence that matches your readiness — no big-bang implementations.' },
  { icon: CheckCircle,'title': 'Anti-surveillance by design',           desc: 'No capability path in the platform can be repurposed for workforce surveillance or worker scoring. Enforced architecturally.' },
];

const technicalPrinciples = [
  { label: 'Canadian data residency',           sub: 'All data stays in Canada' },
  { label: 'Zero worker surveillance',           sub: 'Enforced at architecture level' },
  { label: 'Human oversight required',           sub: 'Structurally enforced' },
  { label: 'Full audit trails',                  sub: 'Every action logged' },
  { label: 'Explainable outputs only',           sub: 'Source evidence always traceable' },
  { label: 'Modular deployment',                 sub: 'No forced big-bang adoption' },
];

export default function TechnologyLeadershipPage() {
  return (
    <div className="bg-white min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.technologyLeadership}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white backdrop-blur-sm">
            Solutions · Technology Leadership
          </span>
        }
        heading={<>Enterprise-safe AI that your<br />institution can trust.</>}
        description="Labour organizations need AI that is explainable, governed, labour-safe, and institutionally trustworthy — not experimental. Union Eyes is built to meet that standard at every architectural layer."
        cta={
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/pilot-request" className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30">
              Request a Demo
            </Link>
            <Link href="../trust" className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all">
              View Trust Center
            </Link>
          </div>
        }
      />

      {/* Technical principles */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl font-bold text-navy mb-6">Technical governance principles</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {technicalPrinciples.map((p) => (
              <div key={p.label} className="p-5 rounded-xl bg-white border border-gray-100">
                <div className="text-sm font-bold text-navy mb-1">{p.label}</div>
                <div className="text-xs text-gray-500">{p.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-navy mb-10 text-center">What technology leaders gain with Union Eyes</h2>
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
              { label: 'Procurement Stakeholders', href: './procurement' },
              { label: 'Governance Leadership',    href: './governance-leadership' },
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
          <h2 className="text-2xl md:text-3xl font-bold mb-4">AI your institution can trust</h2>
          <p className="text-white/70 mb-8">Request a technical briefing or platform demonstration.</p>
          <Link href="/pilot-request" className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all">
            Request a Demo
          </Link>
        </div>
      </section>
    </div>
  );
}
