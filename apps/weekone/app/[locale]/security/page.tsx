import type { Metadata } from 'next'
import { MarketingSiteNavigation } from '@/components/marketing/site-navigation'
import { MarketingSiteFooter } from '@/components/marketing/site-footer'

export const metadata: Metadata = {
  title: 'WeekOne Security | Trust and governance',
  description: 'Security and trust overview for WeekOne including access control, data protection, and operational governance principles.',
}

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <MarketingSiteNavigation locale={locale} />

      <section className="border-b border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Security</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-bold leading-tight sm:text-6xl">Trust is an operating requirement, not a feature.</h1>
          <p className="mt-5 max-w-2xl text-base text-slate-200 sm:text-lg">
            WeekOne is designed for teams that need clear controls, reliable access boundaries, and stakeholder confidence in how data is handled.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Controlled access</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">Role-based permission boundaries keep operating data visible to the right decision-makers.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Operational integrity</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">WeekOne workflows are designed to reduce reporting ambiguity and preserve execution context.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Stakeholder transparency</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">Leadership and advisors see a consistent, auditable weekly operating narrative.</p>
          </article>
        </div>
      </section>

      <MarketingSiteFooter locale={locale} />
    </main>
  )
}
