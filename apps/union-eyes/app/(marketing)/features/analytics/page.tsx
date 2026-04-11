/**
 * Financial Allocation & Billing — Platform module page
 *
 * Describes reporting, dashboards, and data tools.
 * Tone: Practical — leadership needs data, stewards need simplicity.
 */

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Metadata } from 'next';
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

export const metadata: Metadata = {
  title: 'Analytics & Reporting | UnionEyes',
  description:
    'Custom reports, leadership dashboards, financial summaries, and grievance analytics — built for union executives who need real data, not dashboards for show.',
};

const features = [
  {
    icon: BarChart3,
    title: 'Custom Report Builder',
    description:
      'Drag-and-drop report creation. Select fields, apply filters, choose your visualization. Save reports to your library and share with your team.',
  },
  {
    icon: TrendingUp,
    title: 'Leadership Dashboard',
    description:
      'KPIs at a glance: active cases, average resolution time, win rate, member satisfaction, evidence seal rate, and pilot health indicators.',
  },
  {
    icon: DollarSign,
    title: 'Financial Reports',
    description:
      'Dues revenue, operating expenses, strike fund balance, tax slips, and per capita payments. Consolidate across funds with one view.',
  },
  {
    icon: PieChart,
    title: 'Grievance Analytics',
    description:
      'Outcome distribution, time-in-state analysis, settlement patterns, and trend lines. Understand where cases stall and why.',
  },
  {
    icon: Share2,
    title: 'Report Sharing Hub',
    description:
      'Share reports with access controls. Executives, stewards, and members each see what they need — no more, no less.',
  },
  {
    icon: Calendar,
    title: 'Scheduled Exports',
    description:
      'Set up daily, weekly, or monthly report exports. Get the data you need delivered automatically without logging in.',
  },
  {
    icon: Download,
    title: 'Membership Reports',
    description:
      'Member growth, demographics, retention rates, and dues collection status. Know your membership inside and out.',
  },
];

export default function AnalyticsReportingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <header className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-full text-sm text-amber-700 font-medium mb-6">
            <BarChart3 className="h-4 w-4" />
            <span>Core Module</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            Data your executive board will actually read
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
            Custom reports, financial summaries, and grievance analytics — built
            for the people who need to make decisions and the people who need to
            explain them.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Feature Grid */}
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

        {/* Use case callout */}
        <section className="mb-20 bg-amber-50 rounded-2xl border border-amber-200 p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">
            Built for real union reporting needs
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-3xl font-bold text-amber-700 mb-2">Stewards</p>
              <p className="text-sm text-slate-600">
                Quick case stats and workload views. See what&apos;s overdue
                without digging through spreadsheets.
              </p>
            </div>
            <div>
              <p className="text-3xl font-bold text-amber-700 mb-2">Officers</p>
              <p className="text-sm text-slate-600">
                Grievance trends, member engagement, and cross-local
                comparisons to present at executive board meetings.
              </p>
            </div>
            <div>
              <p className="text-3xl font-bold text-amber-700 mb-2">Treasurers</p>
              <p className="text-sm text-slate-600">
                Financial consolidation, dues collection status, and tax slips
                — all in one view instead of three different files.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center bg-slate-50 rounded-2xl border border-slate-200 p-10">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            See the reports in action
          </h2>
          <p className="text-slate-600 mb-6 max-w-lg mx-auto">
            We&apos;re piloting the analytics suite with Canadian unions.
            Request a walkthrough to see real dashboards, not mockups.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/pilot-request"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white font-semibold rounded-xl hover:bg-amber-700 transition-colors text-sm"
            >
              Request a Pilot <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/features/ai-workbench"
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors text-sm"
            >
              See AI Workbench
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
