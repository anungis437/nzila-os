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
 * Outcomes feature page.
 * Accessible at /{locale}/features/analytics.
 */
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Download,
  Calendar,
  Share2,
  ArrowRight,
  DollarSign,
} from 'lucide-react';
import { buildLocaleAlternates } from '@/lib/marketing-seo';

export async function generateMetadata({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return {
    title: 'Outcomes | UnionEyes',
    description:
      'Track resolutions, follow-through, and reporting so union leadership can see what representation delivered and what still needs action.',
    alternates: buildLocaleAlternates(locale, '/features/analytics'),
  };
}

const features = [
  {
    icon: BarChart3,
    title: 'Resolution tracking',
    description:
      'Capture how matters close, what was secured, and what the union still needs to watch after the case itself is resolved.',
  },
  {
    icon: TrendingUp,
    title: 'Pattern reporting',
    description:
      'See repeat issues across employers, locals, categories, or representatives so leadership can act on trends instead of anecdotes.',
  },
  {
    icon: DollarSign,
    title: 'Commitment visibility',
    description:
      'Track monetary commitments, remediation steps, and other concrete outcomes that matter to members and leadership.',
  },
  {
    icon: PieChart,
    title: 'Outcome categories that mean something',
    description:
      'Separate withdrawn, settled, escalated, remedied, and unresolved matters so reporting reflects reality instead of vanity metrics.',
  },
  {
    icon: Share2,
    title: 'Follow-through across teams',
    description:
      'Outcomes stay visible to the people who must complete next actions after the formal case work is done.',
  },
  {
    icon: Calendar,
    title: 'Post-resolution deadlines',
    description:
      'Surface deadlines tied to commitments, settlements, and monitoring so outcomes do not disappear once the meeting ends.',
  },
  {
    icon: Download,
    title: 'Leadership-ready exports',
    description:
      'Share structured reporting with officers and executives who need a clear picture of what representation delivered.',
  },
];

export default async function LocaleAnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const briefingCta = locale === 'fr-CA' ? 'Commencer la réflexion de continuité (gratuite)' : 'Start the free Continuity Reflection';

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full text-sm text-amber-700 font-medium mb-6">
            <BarChart3 className="h-4 w-4" />
            <span>Results & Follow-Through</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            Outcomes show what representation actually delivered
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
            Resolution is not the end of the story. Outcomes tracks the result,
            the commitments that follow from it, and the patterns leadership needs to see.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-xl border border-slate-200 hover:border-amber-200 hover:shadow-sm transition-all"
            >
              <feature.icon className="h-8 w-8 text-amber-600 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-600 leading-relaxed text-sm">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <section className="mb-20 bg-amber-50 rounded-2xl border border-amber-200 p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">
            Outcomes serves the people accountable for follow-through
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-3xl font-bold text-amber-700 mb-2">Stewards</p>
              <p className="text-sm text-slate-600">Close the loop on member follow-through, commitments, and unresolved next steps.</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-amber-700 mb-2">Officers</p>
              <p className="text-sm text-slate-600">Understand what the organization is resolving, where risk is accumulating, and what needs escalation.</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-amber-700 mb-2">Leadership</p>
              <p className="text-sm text-slate-600">See patterns across locals and employers instead of relying on isolated case anecdotes.</p>
            </div>
          </div>
        </section>

        <section className="text-center bg-slate-50 rounded-2xl border border-slate-200 p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            See how Outcomes closes the loop
          </h2>
          <p className="text-slate-600 mb-6 max-w-lg mx-auto">
            Outcomes makes sense because it is connected to Work and Intelligence, not because it is just another analytics dashboard.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={`/${locale}/organizational-continuity-risk`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 transition-colors text-sm"
            >
              {briefingCta} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/features/ai-workbench`}
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm"
            >
              See Intelligence
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
