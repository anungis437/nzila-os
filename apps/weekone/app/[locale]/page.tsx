import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ExitIntentCta } from '@/components/marketing/exit-intent-cta'
import { NewsletterSignup, TemplateDownloadCta, WaitlistSignup } from '@/components/marketing/lead-forms'
import { TrackedCtaLink } from '@/components/marketing/tracked-cta-link'
import { MarketingSiteFooter } from '@/components/marketing/site-footer'
import { MarketingSiteNavigation } from '@/components/marketing/site-navigation'
import { WEEKONE_ANALYTICS_EVENTS } from '@/lib/analytics/track'

export const metadata: Metadata = {
  title: 'WeekOne | Startup operating baseline for founders',
  description:
    'The founder baseline for your first operating system: priorities, cash, clients, execution, and governance in one practical weekly rhythm.',
  openGraph: {
    title: 'WeekOne | Startup Operating Baseline',
    description:
      'A practical Light Corp Services framework for founders who just started and need structure fast.',
    type: 'website',
  },
}

const logos = ['SaaS Operators', 'Service Firms', 'Product Studios', 'Marketplace Teams', 'Venture Builders', 'Scale Studios']

export default async function LocalePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const waitlistMode = process.env.NEXT_PUBLIC_WEEKONE_WAITLIST_MODE === 'true'

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'WeekOne',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: 'Weekly execution system for founders and operators',
    offers: [
      { '@type': 'Offer', price: '0', priceCurrency: 'CAD', name: 'Free' },
      { '@type': 'Offer', price: '39', priceCurrency: 'CAD', name: 'Pro' },
      { '@type': 'Offer', price: '99', priceCurrency: 'CAD', name: 'Team' },
    ],
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <MarketingSiteNavigation locale={locale} />

      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 text-white">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-amber-300/20 blur-3xl" />

        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-100">
                Light Corp Services for founder-led teams
              </p>
              <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-6xl">
                Just started your startup? <span className="text-amber-200">Here is what to run first.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base text-blue-100 sm:text-lg">
                WeekOne gives you a startup operating baseline so you can run like a company before you can afford one: clear priorities, cash discipline, client pipeline, execution cadence, and lightweight governance.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <TrackedCtaLink
                  href={waitlistMode ? `/${locale}/#waitlist` : `/${locale}/onboarding`}
                  eventName={WEEKONE_ANALYTICS_EVENTS.LANDING_CTA_CLICK}
                  context={{ source: 'hero_primary' }}
                  className="inline-flex items-center justify-center rounded-xl bg-amber-300 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-200 sm:text-base"
                >
                  {waitlistMode ? 'Join waitlist' : 'Start free'}
                </TrackedCtaLink>
                <TrackedCtaLink
                  href={`/${locale}/pricing`}
                  eventName={WEEKONE_ANALYTICS_EVENTS.LANDING_CTA_CLICK}
                  context={{ source: 'hero_secondary' }}
                  className="inline-flex items-center justify-center rounded-xl border border-white/25 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 sm:text-base"
                >
                  View pricing
                </TrackedCtaLink>
              </div>

              <div className="mt-8 grid max-w-lg grid-cols-3 gap-3 text-center">
                {[
                  { value: '5 lanes', label: 'Baseline system' },
                  { value: '30 days', label: 'Founder ramp' },
                  { value: 'Every week', label: 'Execution rhythm' },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-xl border border-white/20 bg-white/10 px-3 py-3 backdrop-blur">
                    <p className="text-sm font-bold text-white sm:text-base">{metric.value}</p>
                    <p className="text-[11px] text-blue-100">{metric.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/10 p-3 shadow-2xl backdrop-blur">
                <div className="overflow-hidden rounded-2xl border border-white/15 bg-slate-900">
                  <Image
                    src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1400&q=80"
                    alt="Founder team planning weekly execution"
                    width={1400}
                    height={560}
                    className="h-48 w-full object-cover sm:h-56"
                    priority
                  />
                  <div className="grid gap-3 p-4">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-wider text-blue-100">This week</p>
                      <p className="mt-1 text-sm font-semibold text-white">Baseline active: cash, clients, execution, and risk reviewed.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-[11px] text-blue-100">Runway</p>
                        <p className="mt-1 text-lg font-bold text-white">14.2 months</p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <p className="text-[11px] text-blue-100">Pipeline confidence</p>
                        <p className="mt-1 text-lg font-bold text-amber-200">Strong</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-5 -left-5 hidden rounded-xl border border-white/20 bg-white/90 p-3 text-slate-900 shadow-xl sm:block">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">Operator note</p>
                <p className="mt-1 text-xs">Our first founder meeting now ends with decisions, not confusion.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-gradient-to-r from-blue-50 via-white to-amber-100/40 py-7">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-4 text-center sm:grid-cols-3 sm:px-6 lg:grid-cols-6">
          {logos.map((logo) => (
            <div key={logo} className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-600 backdrop-blur">
              {logo}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Startup baseline framework</p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">The Light Corp Services stack for your first 30 days</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700 sm:text-base">
            Most early teams are not missing ideas. They are missing operating scaffolding. WeekOne gives SMB founders a practical framework to run core company services without heavy overhead.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {[
              {
                title: '1. Direction',
                body: 'Lock the top three outcomes for the week and define what done means.',
              },
              {
                title: '2. Cash',
                body: 'Track runway, upcoming obligations, and confidence before spending decisions.',
              },
              {
                title: '3. Clients',
                body: 'Keep pipeline, pilots, and renewals visible so growth is not guesswork.',
              },
              {
                title: '4. Delivery',
                body: 'Assign owners, run checkpoints, and close the week with shipped evidence.',
              },
              {
                title: '5. Governance',
                body: 'Capture decisions, risks, and commitments so stakeholder trust compounds.',
              },
            ].map((lane) => (
              <article key={lane.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">{lane.title}</h3>
                <p className="mt-2 text-xs leading-6 text-slate-600">{lane.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-blue-200 bg-white p-5">
            <p className="text-sm font-semibold text-slate-900">First 30 days in WeekOne</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {[
                {
                  title: 'Days 1-7: Baseline setup',
                  body: 'Define outcomes, map cash commitments, and align your first operating rhythm.',
                },
                {
                  title: 'Days 8-21: Weekly discipline',
                  body: 'Run two full weekly loops with checkpoint and closeout evidence.',
                },
                {
                  title: 'Days 22-30: Stakeholder story',
                  body: 'Package runway, pipeline, risks, and shipped outcomes into one credible narrative.',
                },
              ].map((phase) => (
                <article key={phase.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">{phase.title}</h3>
                  <p className="mt-2 text-xs leading-6 text-slate-600">{phase.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-10 text-center">
          <p className="mt-12 text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Operational guidance by page</p>
          <h2 className="mt-3 text-3xl font-bold text-slate-900 sm:text-5xl">Use the right page for the right founder question</h2>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'Platform',
              body: 'Deep dive into planning, scorecards, runway, and accountability architecture.',
              href: `/${locale}/platform`,
            },
            {
              title: 'How it works',
              body: 'See the weekly operating loop and how teams sustain it without process fatigue.',
              href: `/${locale}/how-it-works`,
            },
            {
              title: 'Outcomes',
              body: 'Review execution results and stakeholder-facing proof points from operating teams.',
              href: `/${locale}/outcomes`,
            },
            {
              title: 'Pricing',
              body: 'Choose the plan that fits your stage and rollout scope.',
              href: `/${locale}/pricing`,
            },
            {
              title: 'FAQ',
              body: 'Get implementation, reporting, and deployment answers in one place.',
              href: `/${locale}/faq`,
            },
            {
              title: 'Resources',
              body: 'Access guides, changelog updates, and trust/security information.',
              href: `/${locale}/resources`,
            },
          ].map((item) => (
            <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.body}</p>
              <Link href={item.href} className="mt-4 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-700">
                Visit page
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-amber-50 p-5">
          <p className="text-sm font-semibold text-slate-900">Built for operators, founders, and small-team leadership.</p>
          <p className="mt-1 text-sm text-slate-600">WeekOne acts as your light corporate services layer: it guides what to run, when to review, and how to explain progress with confidence.</p>
          <TrackedCtaLink
            href={waitlistMode ? `/${locale}/#waitlist` : `/${locale}/onboarding`}
            eventName={WEEKONE_ANALYTICS_EVENTS.LANDING_CTA_CLICK}
            context={{ source: 'home_multiplace_signup' }}
            className="mt-3 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            Start my baseline
          </TrackedCtaLink>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-4 md:grid-cols-2">
          <NewsletterSignup />
          <TemplateDownloadCta />
        </div>

        {waitlistMode && <div className="mt-4"><WaitlistSignup /></div>}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">Referral: invite a founder, get 1 month Pro.</p>
          <p className="mt-1 text-sm text-slate-600">Share WeekOne with another founder and unlock one month of Pro when they activate.</p>
          <TrackedCtaLink
            href={`/${locale}/dashboard`}
            eventName={WEEKONE_ANALYTICS_EVENTS.REFERRAL_SHARE}
            context={{ source: 'landing_referral' }}
            className="mt-3 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Open referral center
          </TrackedCtaLink>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-900">Founder support</p>
          <p className="mt-1 text-xs text-slate-600">Launch support includes baseline setup coaching and weekly rhythm guidance for early SMB teams.</p>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-900 py-14 text-white sm:py-18">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold sm:text-4xl">Ready for your calmest operating week yet?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-200 sm:text-base">
            Launch WeekOne and turn startup uncertainty into an operating system your team and stakeholders can trust.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <TrackedCtaLink
              href={waitlistMode ? `/${locale}/#waitlist` : `/${locale}/onboarding`}
              eventName={WEEKONE_ANALYTICS_EVENTS.LANDING_CTA_CLICK}
              context={{ source: 'final_cta_primary' }}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              {waitlistMode ? 'Join waitlist' : 'Start free'}
            </TrackedCtaLink>
            <TrackedCtaLink
              href={`/${locale}/resources`}
              eventName={WEEKONE_ANALYTICS_EVENTS.LANDING_CTA_CLICK}
              context={{ source: 'final_cta_secondary' }}
              className="inline-flex items-center justify-center rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white"
            >
              Explore resources
            </TrackedCtaLink>
          </div>
        </div>
      </section>

      <MarketingSiteFooter locale={locale} />

      <ExitIntentCta locale={locale} />
    </main>
  )
}
