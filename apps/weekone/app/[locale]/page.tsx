import type { Metadata } from 'next'
import { ExitIntentCta } from '@/components/marketing/exit-intent-cta'
import { NewsletterSignup, TemplateDownloadCta, WaitlistSignup } from '@/components/marketing/lead-forms'
import { StickyCtaHeader } from '@/components/marketing/sticky-cta-header'
import { TrackedCtaLink } from '@/components/marketing/tracked-cta-link'
import { WEEKONE_ANALYTICS_EVENTS } from '@/lib/analytics/track'

export const metadata: Metadata = {
  title: 'WeekOne | Weekly execution system for founders and operators',
  description:
    'Turn chaotic weeks into consistent execution with one weekly system for priorities, scorecards, and accountability.',
  openGraph: {
    title: 'WeekOne | Weekly execution system',
    description:
      'A world-class micro SaaS for founders and operators who want focus, momentum, and less drift.',
    type: 'website',
  },
}

const logos = ['Northline Studio', 'Horizon Labs', 'Operator Union', 'Daily Build Co', 'Early Stage Ops']

const faq = [
  {
    q: 'Who is WeekOne for?',
    a: 'Founders and operators who want one weekly execution system, not fragmented tools.',
  },
  {
    q: 'Can I start free?',
    a: 'Yes. Start with Free and upgrade when you need analytics, templates, and team controls.',
  },
  {
    q: 'How long does setup take?',
    a: 'Most teams set up their first weekly cycle in under 3 minutes.',
  },
]

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
      { '@type': 'Offer', price: '0', priceCurrency: 'USD', name: 'Free' },
      { '@type': 'Offer', price: '29', priceCurrency: 'USD', name: 'Pro' },
      { '@type': 'Offer', price: '79', priceCurrency: 'USD', name: 'Team' },
    ],
  }

  return (
    <main className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <StickyCtaHeader locale={locale} waitlistMode={waitlistMode} />

      <section className="mx-auto max-w-6xl px-4 pb-14 pt-10 sm:px-6 sm:pb-20 sm:pt-14">
        <p className="text-xs font-semibold uppercase tracking-wider text-electric">Weekly execution system for founders and operators</p>
        <h1 className="mt-3 text-4xl font-bold leading-tight text-navy sm:text-6xl">
          End weekly chaos. Run your company with calm execution.
        </h1>
        <p className="mt-4 max-w-3xl text-base text-muted-foreground sm:text-lg">
          WeekOne gives founders and operators one trusted weekly system for priorities, scorecards, accountability, and momentum.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <TrackedCtaLink
            href={waitlistMode ? `/${locale}/#waitlist` : `/${locale}/onboarding`}
            eventName={WEEKONE_ANALYTICS_EVENTS.LANDING_CTA_CLICK}
            context={{ source: 'hero_primary' }}
            className="inline-flex items-center justify-center rounded-xl bg-electric px-6 py-3 text-sm font-bold text-white sm:text-base"
          >
            {waitlistMode ? 'Join waitlist' : 'Start free'}
          </TrackedCtaLink>
          <TrackedCtaLink
            href={`/${locale}/pricing`}
            eventName={WEEKONE_ANALYTICS_EVENTS.LANDING_CTA_CLICK}
            context={{ source: 'hero_secondary' }}
            className="inline-flex items-center justify-center rounded-xl border border-border px-6 py-3 text-sm font-semibold text-foreground sm:text-base"
          >
            View pricing
          </TrackedCtaLink>
        </div>
      </section>

      <section className="border-y border-border bg-gray-50 py-6">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-4 text-center sm:grid-cols-5 sm:px-6">
          {logos.map((logo) => (
            <div key={logo} className="rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-muted-foreground">
              {logo}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="text-2xl font-bold text-navy sm:text-3xl">Pain points founders tell us every week</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            'Chaos: too many tools, no weekly source of truth.',
            'Lack of focus: urgent tasks replace strategic moves.',
            'Inconsistent execution: momentum resets every Monday.',
          ].map((pain) => (
            <article key={pain} className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">{pain}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-electric/20 bg-electric/5 p-5">
          <p className="text-sm font-semibold text-navy">Simple systems beat chaos.</p>
          <p className="mt-1 text-sm text-muted-foreground">WeekOne is opinionated on weekly execution so your team ships consistently.</p>
          <TrackedCtaLink
            href={waitlistMode ? `/${locale}/#waitlist` : `/${locale}/onboarding`}
            eventName={WEEKONE_ANALYTICS_EVENTS.LANDING_CTA_CLICK}
            context={{ source: 'inline_pain_to_signup' }}
            className="mt-3 inline-flex rounded-lg bg-electric px-4 py-2 text-sm font-bold text-white"
          >
            Start your first week
          </TrackedCtaLink>
        </div>
      </section>

      <section className="border-y border-border bg-gray-50 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-navy sm:text-3xl">How it works</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              { step: '1', title: 'Plan the week', text: 'Set your top outcomes and focus lanes.' },
              { step: '2', title: 'Run scorecards', text: 'Track runway, pipeline, and risks in one view.' },
              { step: '3', title: 'Close with accountability', text: 'Ship, review, reset, repeat.' },
            ].map((item) => (
              <article key={item.step} className="rounded-2xl border border-border bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-electric">Step {item.step}</p>
                <h3 className="mt-1 text-lg font-semibold text-navy">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="text-2xl font-bold text-navy sm:text-3xl">Product snapshots</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {['Weekly dashboard', 'Monday reset template', 'Founder scorecard panel'].map((shot) => (
            <div key={shot} className="aspect-video rounded-2xl border border-dashed border-border bg-gray-50 p-4">
              <p className="text-sm font-semibold text-navy">{shot}</p>
              <p className="mt-1 text-xs text-muted-foreground">Screenshot placeholder</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-gray-50 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-navy sm:text-3xl">Outcomes teams report</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              'More focus on high-impact work',
              'More shipped outcomes each week',
              'Less operational drift and rework',
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-border bg-white p-5">
                <p className="text-sm font-semibold text-navy">{item}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              {
                quote: 'WeekOne gave us one weekly language for execution.',
                by: 'Founder, services startup',
              },
              {
                quote: 'Our Monday planning time dropped while weekly output improved.',
                by: 'Operator, agency team',
              },
              {
                quote: 'The dashboard made risks obvious before they became fires.',
                by: 'COO, early-stage SaaS',
              },
            ].map((item) => (
              <blockquote key={item.quote} className="rounded-2xl border border-border bg-card p-5">
                <p className="text-sm text-foreground">&quot;{item.quote}&quot;</p>
                <footer className="mt-2 text-xs text-muted-foreground">{item.by}</footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <h2 className="text-2xl font-bold text-navy sm:text-3xl">Pricing preview</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Free</p>
            <p className="mt-2 text-3xl font-bold text-navy">$0</p>
            <p className="mt-2 text-sm text-muted-foreground">Weekly planner and basic dashboard.</p>
          </div>
          <div className="rounded-2xl border border-electric bg-electric/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-electric">Pro</p>
            <p className="mt-2 text-3xl font-bold text-navy">$29</p>
            <p className="mt-2 text-sm text-muted-foreground">Streaks, analytics, integrations, templates.</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team</p>
            <p className="mt-2 text-3xl font-bold text-navy">$79</p>
            <p className="mt-2 text-sm text-muted-foreground">Collaborators, shared boards, admin controls.</p>
          </div>
        </div>

        <TrackedCtaLink
          href={`/${locale}/pricing`}
          eventName={WEEKONE_ANALYTICS_EVENTS.LANDING_CTA_CLICK}
          context={{ source: 'pricing_preview' }}
          className="mt-5 inline-flex rounded-lg bg-electric px-4 py-2 text-sm font-bold text-white"
        >
          Compare plans
        </TrackedCtaLink>
      </section>

      <section className="border-y border-border bg-gray-50 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-bold text-navy sm:text-3xl">FAQ</h2>
          <div className="mt-5 space-y-3">
            {faq.map((item) => (
              <article key={item.q} className="rounded-xl border border-border bg-white p-4">
                <h3 className="text-sm font-semibold text-navy">{item.q}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-4 md:grid-cols-2">
          <NewsletterSignup />
          <TemplateDownloadCta />
        </div>

        {waitlistMode && <div className="mt-4"><WaitlistSignup /></div>}

        <div className="mt-6 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm font-semibold text-navy">Referral: invite a founder, get 1 month Pro.</p>
          <p className="mt-1 text-sm text-muted-foreground">Share WeekOne with another founder and unlock one month of Pro when they activate.</p>
          <TrackedCtaLink
            href={`/${locale}/dashboard`}
            eventName={WEEKONE_ANALYTICS_EVENTS.REFERRAL_SHARE}
            context={{ source: 'landing_referral' }}
            className="mt-3 inline-flex rounded-lg border border-border px-4 py-2 text-sm font-semibold"
          >
            Open referral center
          </TrackedCtaLink>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-gray-50 p-5">
          <p className="text-sm font-semibold text-navy">Live chat</p>
          <p className="mt-1 text-xs text-muted-foreground">Live chat widget placeholder. Connect your provider here for launch support.</p>
        </div>
      </section>

      <section className="border-t border-border bg-navy py-12 text-white sm:py-16">
        <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold sm:text-4xl">Ready for your calmest Monday yet?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-blue-100 sm:text-base">
            Start your first WeekOne cycle today and run your company with focus, accountability, and momentum.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <TrackedCtaLink
              href={waitlistMode ? `/${locale}/#waitlist` : `/${locale}/onboarding`}
              eventName={WEEKONE_ANALYTICS_EVENTS.LANDING_CTA_CLICK}
              context={{ source: 'final_cta_primary' }}
              className="inline-flex items-center justify-center rounded-xl bg-electric px-6 py-3 text-sm font-bold text-white"
            >
              {waitlistMode ? 'Join waitlist' : 'Start free'}
            </TrackedCtaLink>
            <TrackedCtaLink
              href={`/${locale}/pricing`}
              eventName={WEEKONE_ANALYTICS_EVENTS.LANDING_CTA_CLICK}
              context={{ source: 'final_cta_secondary' }}
              className="inline-flex items-center justify-center rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white"
            >
              See pricing
            </TrackedCtaLink>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs text-blue-200">
            <a href={`/${locale}/about`} className="hover:text-white">About</a>
            <a href={`/${locale}/changelog`} className="hover:text-white">Changelog</a>
            <a href={`/${locale}/privacy`} className="hover:text-white">Privacy</a>
            <a href={`/${locale}/terms`} className="hover:text-white">Terms</a>
            <a href={`/${locale}/blog`} className="hover:text-white">Blog</a>
          </div>
        </div>
      </section>

      <ExitIntentCta locale={locale} />
    </main>
  )
}
