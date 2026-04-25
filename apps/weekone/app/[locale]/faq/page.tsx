import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingSiteNavigation } from '@/components/marketing/site-navigation'
import { MarketingSiteFooter } from '@/components/marketing/site-footer'

export const metadata: Metadata = {
  title: 'WeekOne FAQ | Founder execution platform answers',
  description: 'Frequently asked questions about WeekOne pricing, onboarding, stakeholder reporting, and implementation.',
}

const faqs = [
  {
    q: 'Who is WeekOne for?',
    a: 'WeekOne is built for founder-led teams that need a weekly operating rhythm across founders, operators, and leadership stakeholders.',
  },
  {
    q: 'How quickly can we launch?',
    a: 'Most teams complete onboarding and run their first weekly cycle in under 10 minutes.',
  },
  {
    q: 'Can we start before inviting the full team?',
    a: 'Yes. Many companies start with one founder or operator and expand once the weekly system is established.',
  },
  {
    q: 'How does WeekOne support stakeholder reporting?',
    a: 'WeekOne structures runway, pipeline, and execution outcomes so leadership and advisors can review one consistent operating narrative.',
  },
  {
    q: 'Do you offer support during rollout?',
    a: 'Yes. We provide launch support and office-hour guidance for early teams implementing a new operating cadence.',
  },
]

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <MarketingSiteNavigation locale={locale} />

      <section className="border-b border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">FAQ</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-bold leading-tight sm:text-6xl">Answers for founders, operators, and stakeholders.</h1>
          <p className="mt-5 max-w-2xl text-base text-slate-200 sm:text-lg">
            Everything you need to evaluate WeekOne as your execution operating system.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="space-y-4">
          {faqs.map((item) => (
            <article key={item.q} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">{item.q}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{item.a}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-blue-200 bg-blue-50 p-6 text-center">
          <p className="text-sm font-semibold text-slate-900">Still have questions?</p>
          <p className="mt-2 text-sm text-slate-700">We can walk your team through setup, rollout, and stakeholder reporting flow.</p>
          <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href={`/${locale}/contact`} className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
              Contact us
            </Link>
            <Link href={`/${locale}/resources`} className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white">
              Browse resources
            </Link>
          </div>
        </div>
      </section>

      <MarketingSiteFooter locale={locale} />
    </main>
  )
}
