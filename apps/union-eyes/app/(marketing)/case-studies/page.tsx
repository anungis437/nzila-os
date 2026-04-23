/**
 * Case Studies Public Listing Page
 *
 * Static pilot results published with union approval.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { HumanCenteredCallout } from '@/components/marketing/human-centered-callout';

export const metadata: Metadata = {
  title: 'Pilot Results | UnionEyes',
  description: 'Real results from Canadian unions in the UnionEyes pilot program.',
};

const pilots = [
  {
    org: 'Healthcare Local, Ontario',
    sector: 'Healthcare',
    headline: 'Grievance cycle time cut by 58%',
    body: 'A healthcare local with 3,200 members moved from spreadsheet tracking to UnionEyes. Stewards now triage cases in a shared queue rather than individual inboxes. The result: median cycle time from intake to resolution dropped from 47 days to 20 days over a 6-month pilot.',
    metrics: [
      { label: 'Grievance cycle time', value: '-58%' },
      { label: 'Cases tracked', value: '140+' },
      { label: 'Pilot duration', value: '6 months' },
    ],
  },
  {
    org: 'Regional Council, British Columbia',
    sector: 'Public Sector',
    headline: 'Admin burden per rep down 44%',
    body: 'A regional council representing multiple locals used UnionEyes to consolidate member communications, board reporting, and bargaining prep into a single workflow. Representatives reported spending 44% less time on administrative coordination, leaving more time for direct member contact.',
    metrics: [
      { label: 'Admin burden per rep', value: '-44%' },
      { label: 'Locals consolidated', value: '7' },
      { label: 'Pilot duration', value: '4 months' },
    ],
  },
  {
    org: 'Education Local, Alberta',
    sector: 'Education',
    headline: 'Grievances filed increased 71%',
    body: 'After deploying UnionEyes, this education local saw a sharp increase in grievances filed, not because conditions worsened, but because members now knew how to access the intake process. Lower friction meant more members received the representation they were already entitled to.',
    metrics: [
      { label: 'Grievances filed', value: '+71%' },
      { label: 'Member reach', value: '1,800+' },
      { label: 'Pilot duration', value: '3 months' },
    ],
  },
  {
    org: 'Manufacturing Region',
    sector: 'Manufacturing',
    headline: 'Board report prep time down 88%',
    body: 'Executive leadership at a manufacturing region previously spent 6 to 8 hours compiling monthly board reports from email threads and spreadsheets. UnionEyes generates those reports automatically from live case data, cutting board prep to under an hour.',
    metrics: [
      { label: 'Board report prep', value: '-88%' },
      { label: 'Time saved per cycle', value: '~7 hours' },
      { label: 'Pilot duration', value: '5 months' },
    ],
  },
];

export default function CaseStudiesPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="bg-navy py-20 text-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <span className="mb-6 inline-block rounded-full bg-white/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-white">
            Pilot Results
          </span>
          <h1 className="mb-4 text-4xl font-bold md:text-5xl">
            Real results from Canadian unions
          </h1>
          <p className="max-w-2xl text-lg text-white/80">
            Early pilot outcomes reported by participating organizations. Metrics are
            self-reported by union leadership and anonymized where requested.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <HumanCenteredCallout
          variant="transparency"
          message="All metrics are reported directly by participating unions. Organization names are generalized to protect bargaining strategies. If you ask us in person, we can say more."
          className="mb-12"
        />

        <div className="space-y-10">
          {pilots.map((pilot) => (
            <article
              key={pilot.org}
              className="rounded-2xl border border-gray-100 p-8 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-electric">
                  {pilot.sector}
                </span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-500">{pilot.org}</span>
              </div>
              <h2 className="mb-3 text-2xl font-bold text-navy">{pilot.headline}</h2>
              <p className="mb-6 leading-relaxed text-gray-700">{pilot.body}</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {pilot.metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-center"
                  >
                    <div className="mb-1 text-2xl font-extrabold text-electric">{metric.value}</div>
                    <div className="text-xs text-gray-600">{metric.label}</div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-16 rounded-2xl bg-navy p-10 text-center text-white">
          <h2 className="mb-3 text-2xl font-bold md:text-3xl">Become a pilot partner</h2>
          <p className="mx-auto mb-8 max-w-xl text-lg text-white/80">
            We are running a small cohort of Canadian unions through a structured pilot.
            No long-term commitment. Full data sovereignty from day one.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/pilot-request"
              className="inline-flex items-center justify-center rounded-xl bg-electric px-8 py-4 font-bold text-white shadow-lg shadow-electric/25 transition-all hover:bg-blue-700"
            >
              Apply for the Pilot
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-8 py-4 font-bold text-white transition-all hover:bg-white/20"
            >
              Ask a Question First
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
