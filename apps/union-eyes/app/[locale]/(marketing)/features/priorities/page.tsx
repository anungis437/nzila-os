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
 * Priorities feature page.
 * Accessible at /{locale}/features/priorities.
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ListChecks,
  AlertTriangle,
  TimerReset,
  Users,
  ArrowRight,
} from 'lucide-react';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return {
    title: 'Priorities | UnionEyes',
    description:
      'Priorities is the role-routed queue for next actions, escalations, assignments, and overdue union representative work.',
    alternates: buildLocaleAlternates(locale, '/features/priorities'),
  };
}

const features = [
  {
    icon: ListChecks,
    title: 'One queue for next actions',
    description:
      'Priorities tells each union representative or officer what needs action next instead of forcing them to interpret raw activity feeds.',
  },
  {
    icon: AlertTriangle,
    title: 'Escalations stay visible',
    description:
      'High-risk matters, stalled cases, and urgent deadlines rise to the top before the organization loses time.',
  },
  {
    icon: TimerReset,
    title: 'Deadlines drive action',
    description:
      'The queue reflects what is aging, what is blocked, and what needs follow-up now.',
  },
  {
    icon: Users,
    title: 'Role-routed accountability',
    description:
      'People see the work they own, the work they must review, and the work that needs handoff across the team.',
  },
];

const flow = [
  'Inbox captures the signal.',
  'Priorities decides what requires attention now.',
  'Work handles the governed case activity.',
  'Outcomes records what happened and what follows from it.',
];

export default async function LocalePrioritiesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 border border-rose-200 rounded-full text-sm text-rose-700 font-medium mb-6">
            <ListChecks className="h-4 w-4" />
            <span>Role-Routed Action Queue</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            Priorities turns signals into the next action the team should take
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
            Not every update belongs in the same queue. Priorities organizes what needs review,
            follow-up, escalation, and assignment for the people responsible.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-xl border border-slate-200 hover:border-rose-200 hover:shadow-sm transition-all"
            >
              <feature.icon className="h-8 w-8 text-rose-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
              <p className="text-slate-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        <section className="mb-20 bg-rose-50 rounded-2xl border border-rose-200 p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">How Priorities fits the workflow</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {flow.map((item) => (
              <div key={item} className="rounded-xl bg-white px-5 py-4 text-sm text-slate-700 border border-rose-100">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="text-center bg-slate-50 rounded-2xl border border-slate-200 p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">See how Priorities leads into Work</h2>
          <p className="text-slate-600 mb-6 max-w-lg mx-auto">
            Priorities is the decision point between raw signals and governed case execution.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/${locale}/pilot-request`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-rose-600 text-white font-semibold rounded-xl hover:bg-rose-700 transition-colors text-sm"
            >
              Request an Executive Briefing <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/features/grievance-tracking`}
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm"
            >
              See Work
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}