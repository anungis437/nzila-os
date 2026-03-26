/**
 * Intelligence & Insights — Platform module page
 *
 * Describes AI capabilities: triage, precedent matching, document intelligence.
 * Tone: Honest about AI — useful tool, not magic. Always under human control.
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Metadata } from 'next';
import {
  Brain,
  Search,
  FileText,
  ShieldCheck,
  ToggleRight,
  Eye,
  ArrowRight,
  Scale,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'AI Workbench | Union Eyes',
  description:
    'AI tools built for union stewards — grievance triage, precedent research, CBA clause extraction, and draft generation. Always governed, always optional.',
};

const capabilities = [
  {
    icon: Scale,
    title: 'Grievance Triage',
    description:
      'AI scores incoming grievances by priority, complexity, and category. Suggests relevant CBA clauses and precedents to accelerate early-stage decisions.',
  },
  {
    icon: Search,
    title: 'Precedent Research',
    description:
      'Find similar labour arbitration cases by describing your situation. Get outcome analysis with strengths, weaknesses, and critical factors surfaced.',
  },
  {
    icon: FileText,
    title: 'CBA Clause Extraction',
    description:
      'Upload a collective bargaining agreement PDF and the AI extracts, tags, and cross-references clauses automatically. No manual indexing required.',
  },
  {
    icon: Brain,
    title: 'Draft Generation',
    description:
      'Generate structured legal memorandums, argument summaries, and case briefs for arbitration prep. Always reviewed and edited by stewards before use.',
  },
  {
    icon: Eye,
    title: 'Executive Insights',
    description:
      'Trend forecasts, hotspot predictions, and pattern detection across grievance data. Help leadership see the bigger picture and allocate resources proactively.',
  },
];

const safeguards = [
  {
    icon: ToggleRight,
    title: 'Feature-Flagged',
    description:
      'Every AI capability is off by default. Organization admins enable them individually when they\'re ready.',
  },
  {
    icon: ShieldCheck,
    title: 'Transparency Engine',
    description:
      'Every AI decision includes a reasoning chain — you can see exactly why a suggestion was made and override it.',
  },
  {
    icon: Scale,
    title: 'Budget-Capped',
    description:
      'AI usage is budget-capped per organization. No runaway costs, no surprises.',
  },
];

export default function AIWorkbenchPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full text-sm text-emerald-700 font-medium mb-6">
            <Brain className="h-4 w-4" />
            <span>AI Tools</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            AI that helps stewards, not replaces them
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
            Research precedents in minutes instead of hours. Get suggested
            arguments based on case history. Draft briefs that used to take
            days. All under your control, all transparent, all optional.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Capabilities */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">
            What the workbench can do
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {capabilities.map((cap) => (
              <div
                key={cap.title}
                className="p-6 rounded-xl border border-slate-200 hover:border-emerald-200 hover:shadow-sm transition-all"
              >
                <cap.icon className="h-8 w-8 text-emerald-600 mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {cap.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {cap.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Safeguards */}
        <section className="mb-20 bg-slate-50 rounded-2xl border border-slate-200 p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">
            Built with safeguards, not hype
          </h2>
          <p className="text-slate-600 text-center mb-8 max-w-2xl mx-auto">
            We don&apos;t believe AI should make decisions for workers. These tools assist — you decide.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {safeguards.map((s) => (
              <div key={s.title} className="text-center">
                <s.icon className="h-8 w-8 text-emerald-600 mx-auto mb-3" />
                <h4 className="font-semibold text-slate-900 mb-1">{s.title}</h4>
                <p className="text-sm text-slate-500">{s.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center bg-slate-50 rounded-2xl border border-slate-200 p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Curious about AI for your union?
          </h2>
          <p className="text-slate-600 mb-6 max-w-lg mx-auto">
            The workbench is in pilot with unions across Canada.
            Book a walkthrough to see how it handles real grievance data.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/pilot-request"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors text-sm"
            >
              Request a Pilot <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/features/grievance-tracking"
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm"
            >
              See Grievance Tracking
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
