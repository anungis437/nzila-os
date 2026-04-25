import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingSiteNavigation } from '@/components/marketing/site-navigation'
import { MarketingSiteFooter } from '@/components/marketing/site-footer'

export const metadata: Metadata = {
  title: 'Contact WeekOne | Founder execution platform',
  description: 'Contact the WeekOne team for rollout support, stakeholder alignment, and onboarding guidance.',
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <MarketingSiteNavigation locale={locale} />

      <section className="border-b border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Contact</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-bold leading-tight sm:text-6xl">Let’s build your weekly operating system.</h1>
          <p className="mt-5 max-w-2xl text-base text-slate-200 sm:text-lg">
            Talk to us about launch support, stakeholder reporting needs, and rollout sequencing for your team.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="grid gap-5 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Email</h2>
            <p className="mt-2 text-sm text-slate-600">hello@weekone.app</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Response time</h2>
            <p className="mt-2 text-sm text-slate-600">Most inquiries are answered within one business day.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Scope</h2>
            <p className="mt-2 text-sm text-slate-600">Onboarding, rollout strategy, and stakeholder-ready reporting setup.</p>
          </article>
        </div>

        <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-xl font-semibold text-slate-900">Start with the essentials</h2>
          <p className="mt-3 text-sm leading-7 text-slate-700">
            If you are evaluating WeekOne, we recommend reviewing platform fit and pricing first so conversations stay focused on rollout outcomes.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Link href={`/${locale}/platform`} className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-white">
              Explore platform
            </Link>
            <Link href={`/${locale}/pricing`} className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
              View pricing
            </Link>
          </div>
        </div>
      </section>

      <MarketingSiteFooter locale={locale} />
    </main>
  )
}
