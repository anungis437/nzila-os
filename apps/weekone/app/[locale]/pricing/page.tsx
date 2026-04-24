import type { Metadata } from 'next'
import Link from 'next/link'
import { PricingClient } from './pricing-client'

export const metadata: Metadata = {
  title: 'WeekOne Pricing | Weekly execution system for founders',
  description: 'Choose Free, Pro, or Team plans for WeekOne and launch a calmer, more accountable weekly operating rhythm.',
  openGraph: {
    title: 'WeekOne Pricing',
    description: 'Simple pricing built for founder execution and team accountability.',
    type: 'website',
  },
}

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-wider text-electric">Pricing</p>
        <h1 className="mt-3 text-3xl font-bold text-navy sm:text-5xl">Pick the plan that matches your operating cadence.</h1>
        <p className="mt-3 max-w-3xl text-sm text-muted-foreground sm:text-base">
          WeekOne is a weekly execution system for founders and operators. Start free, then upgrade when you need deeper analytics and team control.
        </p>

        <div className="mt-8">
          <PricingClient locale={locale} />
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-card p-5 text-center">
          <p className="text-sm text-muted-foreground">Need procurement or custom rollout support?</p>
          <Link href={`/${locale}/about`} className="mt-3 inline-flex rounded-lg border border-border px-4 py-2 text-sm font-semibold">
            Talk to the WeekOne team
          </Link>
        </div>
      </section>
    </main>
  )
}
