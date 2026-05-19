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
 * Intelligence feature page.
 * Accessible at /{locale}/features/ai-workbench.
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
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
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return {
    title: 'Intelligence | UnionEyes',
    description:
      'Research, analytics, reporting, and AI-assisted decision support for union teams that need better context before they act.',
    alternates: buildLocaleAlternates(locale, '/features/ai-workbench'),
  };
}

const capabilities = [
  {
    icon: Search,
    title: 'Precedent and pattern research',
    description:
      'Search similar matters, supporting materials, and recurring issues faster than manual review across disconnected records.',
  },
  {
    icon: FileText,
    title: 'CBA and document analysis',
    description:
      'Pull clauses, obligations, and key references into context so representatives do not lose time searching for the right language.',
  },
  {
    icon: Brain,
    title: 'AI-assisted decision support',
    description:
      'Optional AI helps summarize records, draft working notes, and surface useful signals without replacing human judgment.',
  },
  {
    icon: Scale,
    title: 'Case brief preparation',
    description:
      'Turn case history into structured briefings that are easier to review, discuss, and defend internally.',
  },
  {
    icon: Eye,
    title: 'Leadership reporting',
    description:
      'Executives and officers get the context behind trends, not just dashboards without explanation.',
  },
];

const safeguards = [
  {
    icon: ToggleRight,
    title: 'Human controlled',
    description:
      'Recommendations assist union representatives and officers. They do not decide outcomes for them.',
  },
  {
    icon: ShieldCheck,
    title: 'Governed access',
    description:
      'Admins decide which intelligence capabilities are enabled and who can use them.',
  },
  {
    icon: Scale,
    title: 'Auditable use',
    description:
      'Research and generated support remain visible within the governed operating model instead of becoming black-box advice.',
  },
];

export default async function LocaleAIWorkbenchPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const briefingCta = locale === 'fr-CA' ? 'Demander un breffage exécutif' : 'Request an Executive Briefing';

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full text-sm text-emerald-700 font-medium mb-6">
            <Brain className="h-4 w-4" />
            <span>Research & Reporting Surface</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            Intelligence gives union teams better context before they act
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
            This is not just an AI workbench. Intelligence brings together research,
            reporting, document analysis, and optional AI assistance to support better
            stewardship and leadership decisions.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">
            What Intelligence is for
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

        <section className="mb-20 bg-slate-50 rounded-2xl border border-slate-200 p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">
            Governed by design
          </h2>
          <p className="text-slate-600 text-center mb-8 max-w-2xl mx-auto">
            Intelligence is advisory and role-controlled. UnionEyes keeps human judgment, entitlements, and traceability at the center.
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

        <section className="text-center bg-slate-50 rounded-2xl border border-slate-200 p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            See how Intelligence supports real representation work
          </h2>
          <p className="text-slate-600 mb-6 max-w-lg mx-auto">
            Intelligence is valuable because it is connected to Inbox, Work, and Outcomes, not because it is a standalone AI demo.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/${locale}/pilot-request`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-colors text-sm"
            >
              {briefingCta} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/features/analytics`}
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm"
            >
              See Outcomes
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
