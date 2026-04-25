import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingSiteNavigation } from '@/components/marketing/site-navigation'
import { MarketingSiteFooter } from '@/components/marketing/site-footer'

export const metadata: Metadata = {
  title: 'How WeekOne Works | Startup baseline in 30 days',
  description: 'See the founder-first WeekOne framework: baseline setup, weekly execution loop, and stakeholder-ready operating proof.',
}

export default async function HowItWorksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  const steps = [
    {
      title: '1. Establish your baseline (Days 1-7)',
      body: 'Set your top three outcomes, define cash position and obligations, and create one shared definition of weekly success.',
    },
    {
      title: '2. Run the weekly leadership loop (Days 8-21)',
      body: 'Review runway, pipeline, delivery status, and risks in one place. Keep each checkpoint short and decision-focused.',
    },
    {
      title: '3. Capture evidence, not opinions (Every closeout)',
      body: 'End each week with what shipped, what slipped, and why. This makes your next planning cycle sharper and faster.',
    },
    {
      title: '4. Build your stakeholder narrative (Days 22-30)',
      body: 'Package priorities, cash confidence, pipeline signal, and decision logs into a single operating story for advisors and investors.',
    },
  ]

  const baselineLanes = [
    {
      title: 'Direction',
      body: 'Set outcomes and ownership so everyone knows what matters now.',
    },
    {
      title: 'Cash',
      body: 'Track runway and obligations before committing new spend.',
    },
    {
      title: 'Clients',
      body: 'Keep pipeline and renewals visible so growth planning is grounded.',
    },
    {
      title: 'Delivery',
      body: 'Use weekly checkpoints to prevent drift and unblock work quickly.',
    },
    {
      title: 'Governance',
      body: 'Log decisions and risks so leadership confidence compounds every week.',
    },
  ]

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <MarketingSiteNavigation locale={locale} />

      <section className="border-b border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">How it works</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-bold leading-tight sm:text-6xl">From startup chaos to an operating baseline in 30 days.</h1>
          <p className="mt-5 max-w-2xl text-base text-slate-200 sm:text-lg">
            WeekOne is your Light Corp Services framework: the minimum operating structure founders need before they can hire full corporate support.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">The baseline stack</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Five lanes every early team must run</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {baselineLanes.map((lane) => (
              <article key={lane.title} className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-900">{lane.title}</h3>
                <p className="mt-2 text-xs leading-6 text-slate-600">{lane.body}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {steps.map((step) => (
            <article key={step.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">{step.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{step.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <p className="text-sm font-semibold text-slate-900">Result</p>
          <p className="mt-2 text-sm text-slate-700">
            Instead of improvising operations every week, you run a repeatable company rhythm. That shift improves speed, confidence, and decision quality without heavy process overhead.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href={`/${locale}/outcomes`} className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
            See customer outcomes
          </Link>
          <Link href={`/${locale}/platform`} className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Explore platform
          </Link>
        </div>
      </section>

      <MarketingSiteFooter locale={locale} />
    </main>
  )
}
