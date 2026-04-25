import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingSiteNavigation } from '@/components/marketing/site-navigation'
import { MarketingSiteFooter } from '@/components/marketing/site-footer'

export const metadata: Metadata = {
  title: 'WeekOne Outcomes | Results for founder-led teams',
  description: 'See the execution outcomes WeekOne helps teams deliver: focus, delivery speed, and reduced operational drift.',
}

export default async function OutcomesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  const metrics = [
    { value: '25-40%', label: 'Clearer weekly priority focus' },
    { value: '2x', label: 'Faster execution cadence in operator loops' },
    { value: '-35%', label: 'Less drift between planned and shipped work' },
  ]

  const quotes = [
    {
      quote: 'WeekOne gave us one operating language between founder, finance, and delivery.',
      by: 'Founder, Canadian services startup',
    },
    {
      quote: 'We finally review the same facts each Monday instead of debating status reports.',
      by: 'COO, growth-stage SaaS team',
    },
    {
      quote: 'Our board updates got shorter and more credible because the data was already structured.',
      by: 'Operator, venture-backed company',
    },
  ]

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <MarketingSiteNavigation locale={locale} />

      <section className="border-b border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Outcomes</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-bold leading-tight sm:text-6xl">Execution outcomes that stakeholders can trust.</h1>
          <p className="mt-5 max-w-2xl text-base text-slate-200 sm:text-lg">
            WeekOne helps founder-led teams shift from noisy activity to measurable operating progress.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="grid gap-4 md:grid-cols-3">
          {metrics.map((item) => (
            <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
              <p className="text-3xl font-bold text-slate-900">{item.value}</p>
              <p className="mt-2 text-sm font-medium text-slate-600">{item.label}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {quotes.map((item) => (
            <blockquote key={item.quote} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm leading-7 text-slate-700">&quot;{item.quote}&quot;</p>
              <footer className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{item.by}</footer>
            </blockquote>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-xl font-semibold text-slate-900">Why this matters for stakeholders</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            Investors, advisors, and leadership teams need a reliable operating narrative. WeekOne turns weekly execution into a clear signal they can trust.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link href={`/${locale}/pricing`} className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
              View plans
            </Link>
            <Link href={`/${locale}/contact`} className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white">
              Talk to our team
            </Link>
          </div>
        </div>
      </section>

      <MarketingSiteFooter locale={locale} />
    </main>
  )
}
