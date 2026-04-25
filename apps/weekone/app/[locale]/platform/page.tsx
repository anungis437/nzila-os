import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingSiteNavigation } from '@/components/marketing/site-navigation'
import { MarketingSiteFooter } from '@/components/marketing/site-footer'

export const metadata: Metadata = {
  title: 'WeekOne Platform | Weekly execution operating system',
  description: 'Explore the WeekOne platform for founder execution: planning cadence, scorecards, risk visibility, and accountability loops.',
}

export default async function PlatformPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <MarketingSiteNavigation locale={locale} />

      <section className="border-b border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Platform</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-bold leading-tight sm:text-6xl">
            One execution system for founders, operators, and leadership teams.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-slate-200 sm:text-lg">
            WeekOne combines planning, operating metrics, and accountability rituals in one platform so every week starts clear and ends shipped.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-14 sm:grid-cols-2 sm:px-6 sm:py-20">
        {[
          {
            title: 'Weekly planning lane',
            body: 'Define top outcomes, align owners, and lock weekly commitments before noise takes over.',
          },
          {
            title: 'Runway and cash visibility',
            body: 'Keep funding reality visible with runway trend tracking and budget confidence snapshots.',
          },
          {
            title: 'Pipeline confidence',
            body: 'Track opportunity health and conversion confidence so growth planning is grounded in signal.',
          },
          {
            title: 'Execution accountability',
            body: 'Close every week with a review loop that improves team discipline without adding admin burden.',
          },
        ].map((item) => (
          <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{item.body}</p>
          </article>
        ))}
      </section>

      <section className="border-y border-slate-200 bg-slate-50 py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-4xl">Built for stakeholder confidence</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">Founders</p>
              <p className="mt-2 text-sm text-slate-600">Know what matters this week and where execution is drifting.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">Operators</p>
              <p className="mt-2 text-sm text-slate-600">Run reliable weekly rituals with clear owners and measurable outcomes.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">Board and advisors</p>
              <p className="mt-2 text-sm text-slate-600">Get credible, concise updates on runway, pipeline, and operating momentum.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={`/${locale}/how-it-works`} className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
              See how it works
            </Link>
            <Link href={`/${locale}/pricing`} className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white">
              View pricing
            </Link>
          </div>
        </div>
      </section>

      <MarketingSiteFooter locale={locale} />
    </main>
  )
}
