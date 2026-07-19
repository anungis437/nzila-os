/**
 * Organizational Positioning Manifest (UnionEyes marketing surface)
 *
 * Narrative pillars: governance, continuity (organizational memory, succession, stewardship),
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
 * organizational trust for democratic infrastructure.
 */
/**
 * Work feature page.
 * Accessible at /{locale}/features/grievance-tracking.
 */
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import {
  FileText,
  Search,
  ShieldCheck,
  Clock,
  ArrowRight,
  Scale,
  Layers,
} from 'lucide-react';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return {
    title: 'Work | UnionEyes',
    description:
      'The core UnionEyes representation surface for union representative casework, evidence management, deadlines, and formal grievance flow.',
    alternates: buildLocaleAlternates(locale, '/features/grievance-tracking'),
  };
}

const features = [
  {
    icon: FileText,
    title: 'Convert intake into governed casework',
    description:
      'Union representatives turn intake into official representation records with ownership, context, and next steps captured from the start.',
  },
  {
    icon: Layers,
    title: 'Unified case timeline',
    description:
      'Notes, updates, attachments, status changes, and follow-up all live in one working record instead of scattered across channels.',
  },
  {
    icon: Search,
    title: 'Evidence and precedent access',
    description:
      'Pull supporting material, relevant documents, and precedent research into the same workspace where the case is being handled.',
  },
  {
    icon: ShieldCheck,
    title: 'Defensible evidence chain',
    description:
      'Critical materials stay traceable and audit-ready so the union can explain what was reviewed, added, and relied on.',
  },
  {
    icon: Clock,
    title: 'Deadline and escalation control',
    description:
      'Surface overdue work, procedural deadlines, and stalled activity before representation falls behind.',
  },
  {
    icon: Scale,
    title: 'Formal grievance workflow',
    description:
      'Move work from review to investigation, mediation, arbitration, and resolution with the process visible to the people responsible.',
  },
];

const steps = [
  {
    step: '1',
    label: 'Review intake',
    desc: 'A union representative reviews what arrived through the member-facing intake flow.',
  },
  {
    step: '2',
    label: 'Open work',
    desc: 'The matter becomes governed casework with assignment, context, and deadlines.',
  },
  {
    step: '3',
    label: 'Build the record',
    desc: 'Evidence, notes, research, and updates accumulate in one traceable workspace.',
  },
  {
    step: '4',
    label: 'Represent',
    desc: 'The union advances the matter through investigation, negotiation, or formal grievance steps.',
  },
  {
    step: '5',
    label: 'Resolve',
    desc: 'The result and follow-through move forward into Outcomes for reporting and accountability.',
  },
];

export default async function LocaleGrievanceTrackingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const briefingCta = locale === 'fr-CA' ? 'Faire le bilan' : 'Start a review';

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-50 border border-violet-200 rounded-full text-sm text-violet-700 font-medium mb-6">
            <FileText className="h-4 w-4" />
            <span>Core Admin Surface</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            Work is where representation actually happens
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
            Intake becomes governed casework here. Union representatives manage evidence,
            deadlines, updates, and formal grievance flow in one defensible workspace.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-xl border border-slate-200 hover:border-violet-200 hover:shadow-sm transition-all"
            >
              <feature.icon className="h-8 w-8 text-violet-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <section className="mb-20">
          <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">
            How Work fits the operating model
          </h2>
          <div className="flex flex-col md:flex-row items-start gap-4">
            {steps.map((item, i) => (
              <div key={item.step} className="flex-1 text-center">
                <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 font-bold flex items-center justify-center mx-auto mb-3">
                  {item.step}
                </div>
                <h4 className="font-semibold text-slate-900 mb-1">{item.label}</h4>
                <p className="text-sm text-slate-500">{item.desc}</p>
                {i < 4 && (
                  <ArrowRight className="h-4 w-4 text-slate-300 mx-auto mt-3 hidden md:block" />
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="text-center bg-slate-50 rounded-2xl border border-slate-200 p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            See how Work connects triage to resolution
          </h2>
          <p className="text-slate-600 mb-6 max-w-lg mx-auto">
            Work is the center of steward-led execution, not a standalone filing form or reporting dashboard.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/${locale}/organizational-continuity-risk`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors text-sm"
            >
              {briefingCta} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/features/priorities`}
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm"
            >
              See Priorities
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
