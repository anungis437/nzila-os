'use client'

import { useState } from 'react'
import { FLOW_BILLING_PLANS, type FlowBillingPlan, type BillingInterval } from '@/lib/billing-plans'

export function BillingClient() {
  const [plan, setPlan] = useState<FlowBillingPlan>('growth')
  const [interval, setInterval] = useState<BillingInterval>('monthly')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handlePlanChange() {
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/billing/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan, interval }),
      })
      const data = (await res.json()) as { ok: boolean; checkoutUrl?: string; error?: string }

      if (!res.ok || !data.ok) {
        setMessage(data.error ?? 'Could not start billing checkout.')
        return
      }

      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl)
        return
      }

      setMessage('Plan updated successfully.')
    } catch {
      setMessage('Could not update plan right now. Please retry.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-navy">Subscription</h2>
      <p className="mt-1 text-sm text-gray-600">
        Upgrade or downgrade your workspace plan. Changes are tracked for analytics and billing history.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {FLOW_BILLING_PLANS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setPlan(entry.id)}
            className={`rounded-lg border p-4 text-left transition-colors ${
              plan === entry.id
                ? 'border-electric bg-electric/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            aria-pressed={plan === entry.id}
          >
            <p className="text-sm font-semibold text-navy">{entry.name}</p>
            <p className="mt-1 text-sm text-gray-600">
              CAD {entry.monthlyCad}/mo or CAD {entry.annualCad}/yr
            </p>
            <p className="mt-2 text-xs text-gray-500">Up to {entry.maxUsers} users</p>
          </button>
        ))}
      </div>

      <label className="mt-4 block text-sm font-medium text-gray-700" htmlFor="billing-interval">
        Billing interval
      </label>
      <select
        id="billing-interval"
        className="mt-2 w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
        value={interval}
        onChange={(event) => setInterval(event.target.value as BillingInterval)}
      >
        <option value="monthly">Monthly</option>
        <option value="annual">Annual</option>
      </select>

      <button
        type="button"
        onClick={handlePlanChange}
        disabled={loading}
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-electric px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Continue to checkout'}
      </button>

      {message && <p className="mt-3 text-sm text-gray-600">{message}</p>}
    </section>
  )
}
