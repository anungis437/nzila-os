'use client'

import { useState } from 'react'

type Plan = 'solo' | 'team' | 'growth'
type Interval = 'monthly' | 'annual'

export function BillingCheckoutClient({ locale }: { locale: string }) {
  const [plan, setPlan] = useState<Plan>('team')
  const [interval, setInterval] = useState<Interval>('annual')
  const [couponCode, setCouponCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCheckout() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, interval, couponCode: couponCode || undefined, locale }),
      })

      const json = await response.json()
      if (!response.ok || !json.checkoutUrl) {
        setError(json.error ?? 'Unable to start checkout')
        return
      }

      window.location.href = json.checkoutUrl
    } catch {
      setError('Checkout unavailable right now. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Plan</span>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={plan}
            onChange={(event) => setPlan(event.target.value as Plan)}
          >
            <option value="solo">Solo</option>
            <option value="team">Team</option>
            <option value="growth">Growth</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Interval</span>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={interval}
            onChange={(event) => setInterval(event.target.value as Interval)}
          >
            <option value="monthly">Monthly</option>
            <option value="annual">Annual (save 20%)</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Coupon code</span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={couponCode}
            onChange={(event) => setCouponCode(event.target.value.trim())}
            placeholder="FOUNDERS20"
          />
        </label>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Conversion analytics: weekone.billing.checkout_initiated
        </p>
        <button
          onClick={handleCheckout}
          disabled={loading}
          className="rounded-md bg-electric px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? 'Redirecting...' : 'Continue to Checkout'}
        </button>
      </div>
    </section>
  )
}
