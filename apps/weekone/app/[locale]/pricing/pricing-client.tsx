'use client'

import { useEffect, useMemo, useState } from 'react'
import { trackClientEvent, WEEKONE_ANALYTICS_EVENTS } from '@/lib/analytics/track'

type Plan = 'free' | 'pro' | 'team'
type Interval = 'monthly' | 'annual'

const prices = {
  pro: { monthly: 29, annual: 290 },
  team: { monthly: 79, annual: 790 },
} as const

const features: Record<Plan, string[]> = {
  free: ['Weekly planner', 'Basic dashboard'],
  pro: ['Streaks', 'Analytics', 'Integrations', 'Templates'],
  team: ['Collaborators', 'Shared boards', 'Admin controls'],
}

export function PricingClient({ locale }: { locale: string }) {
  const [interval, setInterval] = useState<Interval>('monthly')
  const [loadingPlan, setLoadingPlan] = useState<'pro' | 'team' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void trackClientEvent({
      eventName: WEEKONE_ANALYTICS_EVENTS.PRICING_VIEW,
      context: { locale },
    })
  }, [locale])

  const guaranteeText = useMemo(
    () => '14-day calm Monday guarantee: if WeekOne does not improve your weekly execution rhythm, cancel anytime.',
    [],
  )

  async function startCheckout(plan: 'pro' | 'team') {
    setLoadingPlan(plan)
    setError(null)

    try {
      void trackClientEvent({
        eventName: WEEKONE_ANALYTICS_EVENTS.CHECKOUT_START,
        context: { plan, interval, source: 'pricing_page' },
      })

      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan: plan === 'pro' ? 'growth' : 'team', interval, locale }),
      })

      const payload = (await response.json()) as { checkoutUrl?: string; error?: string }
      if (!response.ok || !payload.checkoutUrl) {
        setError(payload.error ?? 'Could not start checkout')
        return
      }

      window.location.assign(payload.checkoutUrl)
    } catch {
      setError('Could not start checkout right now')
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-center">
        <div className="inline-flex rounded-full border border-border bg-card p-1">
          <button
            className={`rounded-full px-4 py-2 text-sm font-semibold ${interval === 'monthly' ? 'bg-electric text-white' : 'text-muted-foreground'}`}
            onClick={() => setInterval('monthly')}
          >
            Monthly
          </button>
          <button
            className={`rounded-full px-4 py-2 text-sm font-semibold ${interval === 'annual' ? 'bg-electric text-white' : 'text-muted-foreground'}`}
            onClick={() => setInterval('annual')}
          >
            Annual (save 2 months)
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Free</p>
          <p className="mt-2 text-3xl font-bold text-navy">$0</p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {features.free.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
          <a href={`/${locale}/onboarding`} className="mt-5 inline-flex rounded-lg border border-border px-4 py-2 text-sm font-semibold">
            Start free
          </a>
        </div>

        <div className="rounded-2xl border border-electric bg-electric/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-electric">Pro</p>
          <p className="mt-2 text-3xl font-bold text-navy">${prices.pro[interval]}</p>
          <p className="text-xs text-muted-foreground">per month billed {interval}</p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {features.pro.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
          <button
            className="mt-5 inline-flex rounded-lg bg-electric px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            disabled={loadingPlan !== null}
            onClick={() => startCheckout('pro')}
          >
            {loadingPlan === 'pro' ? 'Starting...' : 'Start Pro'}
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team</p>
          <p className="mt-2 text-3xl font-bold text-navy">${prices.team[interval]}</p>
          <p className="text-xs text-muted-foreground">per month billed {interval}</p>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {features.team.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
          <button
            className="mt-5 inline-flex rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            disabled={loadingPlan !== null}
            onClick={() => startCheckout('team')}
          >
            {loadingPlan === 'team' ? 'Starting...' : 'Start Team'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        {guaranteeText}
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-navy">Pricing FAQ</h2>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p><strong>Can I cancel anytime?</strong> Yes. No lock-in contracts.</p>
          <p><strong>Can I switch plans later?</strong> Yes, upgrades and downgrades are instant.</p>
          <p><strong>Do you offer annual billing?</strong> Yes, with a lower effective monthly rate.</p>
        </div>
      </section>

      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  )
}
