/**
 * Explainable Intelligence — Platform module page
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { Eye, FileSearch, GitBranch, ShieldCheck, Users, CheckCircle } from 'lucide-react';
import { MarketingHeroSection } from '@/components/marketing/MarketingHeroSection';
import { heroImagery } from '@/lib/marketing-hero-imagery';

export const metadata: Metadata = {
  title: 'Explainable Intelligence | Union Eyes Platform',
  description:
    'All Union Eyes intelligence is explainable, evidence-traceable, and human-overseen. Explainable Organizational Intelligence built for labour institutions.',
};

const capabilities = [
  { icon: Eye,        title: 'Source Evidence Tracing',     desc: 'Every intelligence output traces back to its source evidence — documents, decisions, historical records. No black-box outputs.' },
  { icon: FileSearch, title: 'Human-Readable Explanations', desc: 'All intelligence is surfaced in plain, institutional language that executives and governance leaders can act on.' },
  { icon: GitBranch,  title: 'Reasoning Transparency',      desc: 'The pathway from source evidence to institutional insight is visible, auditable, and governance-safe.' },
  { icon: ShieldCheck,'title': 'Governance Audit Readiness',desc: 'All intelligence operations are logged, auditable, and export-ready for governance review or regulatory compliance.' },
  { icon: Users,      title: 'Human Oversight Required',    desc: 'Intelligence recommends; humans decide. Human oversight is not optional — it is structurally enforced.' },
  { icon: CheckCircle,'title': 'Explainability Standards',  desc: 'Built to the Union Eyes Explainability Standard — the institutional AI governance framework for labour organizations.' },
];

const commitments = [
  'No recommendation without traceable evidence',
  'No decision without human review',
  'No output without a plain-language explanation',
  'No system action without an audit trail',
  'No intelligence output that surveils workers',
];

export default function ExplainableIntelligencePage() {
  return (
    <div className="bg-white min-h-screen">
      <MarketingHeroSection
        imageUrl={heroImagery.explainableIntelligenceModule}
        badge={
          <span className="inline-block px-4 py-1.5 text-xs font-semibold tracking-widest uppercase rounded-full bg-white/20 text-white">
            Platform · Explainable Intelligence
          </span>
        }
        heading={<>"Because the AI said so"<br />is never acceptable here.</>}
        description="Every piece of institutional intelligence from Union Eyes is evidence-traceable, human-readable, and human-reviewed. Explainability is not a feature — it is the non-negotiable foundation of institutional trust."
        cta={
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/pilot-request" className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-electric/30">
              Request a Demo
            </Link>
            <Link href="/trust" className="inline-flex items-center justify-center px-7 py-3.5 bg-white/15 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-all">
              View Trust Center
            </Link>
          </div>
        }
      />

      {/* ── Explainability Commitments ── */}
      <section className="py-16 bg-gray-50 border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-lg font-bold text-navy mb-6 text-center">Explainability commitments</h2>
          <div className="space-y-3">
            {commitments.map((c) => (
              <div key={c} className="flex items-start gap-3 p-4 rounded-xl bg-white border border-gray-100">
                <CheckCircle className="h-4 w-4 text-electric mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium text-navy">{c}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Capabilities ── */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-navy mb-3 text-center">How Explainable Intelligence works</h2>
          <p className="text-gray-600 text-center max-w-2xl mx-auto mb-12">
            Built into every layer of the platform — not bolted on as an afterthought.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((c) => (
              <div key={c.title} className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
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
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Intelligence your institution can trust</h2>
          <p className="text-white/70 mb-8">
            See Explainable Intelligence in action — every output, fully traceable.
          </p>
          <Link href="/pilot-request" className="inline-flex items-center justify-center px-7 py-3.5 bg-electric text-white font-bold rounded-xl hover:bg-blue-700 transition-all">
            Request a Demo
          </Link>
        </div>
      </section>
    </div>
  );
}
