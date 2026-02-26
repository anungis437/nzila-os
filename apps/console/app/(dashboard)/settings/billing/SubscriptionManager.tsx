'use client'

/**
 * SubscriptionManager — Stripe-hosted Checkout integration.
 *
 * If no active subscription:  shows plan picker → redirects to Stripe Checkout
 * If already subscribed:       shows current plan + "Manage billing" portal button
 */
import { useState } from 'react'
import { Card } from '@nzila/ui'
import { validateRedirectUrl } from '@/lib/sanitize'
import { Badge } from '@nzila/ui'
import { CheckCircleIcon, CreditCardIcon } from '@heroicons/react/24/solid'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

// Plans — priceIds come from Stripe Dashboard (env vars)
const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    description: 'Core financials, QBO sync, basic AI insights',
    pricePerMonth: 19,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC ?? '',
    features: ['QuickBooks sync', 'Audit trail', 'PDF reports'],
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Everything in Basic + advanced AI, multi-entity',
    pricePerMonth: 49,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM ?? '',
    features: ['Everything in Basic', 'AI companion', 'Multi-entity', 'Priority support'],
    popular: true,
  },
]

// ── Types ────────────────────────────────────────────────────────────────────

interface ActiveSub {
  subscriptionId: string
  customerId: string
  status: string
  planName: string | null
  planInterval: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

interface Props {
  entityId: string
  activeSub: ActiveSub | null
}

// ── Active subscription card ─────────────────────────────────────────────────

function ActiveSubscriptionCard({ sub }: { sub: ActiveSub }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const statusBadge: 'success' | 'warning' | 'danger' =
    sub.status === 'active' || sub.status === 'trialing'
      ? 'success'
      : sub.status === 'past_due'
        ? 'warning'
        : 'danger'

  async function openPortal() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/customer-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: sub.customerId,
          returnUrl: window.location.href,
        }),
      })
      if (!res.ok) throw new Error('Failed to open billing portal')
      const { url } = await res.json()
      const safeUrl = validateRedirectUrl(url)
      if (!safeUrl) throw new Error('Untrusted redirect URL')
      window.location.href = safeUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error opening portal')
      setLoading(false)
    }
  }

  const periodEnd = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString('en-CA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null

  return (
    <Card variant="bordered">
      <Card.Body className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-500" />
            <div>
              <p className="font-semibold text-gray-900">{sub.planName ?? 'Active Plan'}</p>
              {periodEnd && !sub.cancelAtPeriodEnd && (
                <p className="text-xs text-gray-500">Renews {periodEnd}</p>
              )}
              {periodEnd && sub.cancelAtPeriodEnd && (
                <p className="text-xs text-amber-600">Cancels {periodEnd}</p>
              )}
            </div>
          </div>
          <Badge variant={statusBadge}>{sub.status}</Badge>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={openPortal}
          disabled={loading}
          className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Opening portal…' : 'Manage billing & invoices →'}
        </button>
      </Card.Body>
    </Card>
  )
}

// ── Plan picker (redirects to Stripe-hosted checkout) ────────────────────────

function PlanPicker({ entityId }: { entityId: string }) {
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleChoosePlan(plan: (typeof PLANS)[0]) {
    if (!plan.priceId) {
      setError('Price ID is not configured. Contact support.')
      return
    }

    setLoadingPlanId(plan.id)
    setError(null)

    try {
      const res = await fetch('/api/stripe/checkout/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: plan.priceId,
          entityId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Failed to start checkout')
      }

      const { url } = await res.json()
      const safeUrl = validateRedirectUrl(url)
      if (!safeUrl) throw new Error('Untrusted redirect URL')
      window.location.href = safeUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error starting checkout')
      setLoadingPlanId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className="relative rounded-lg border-2 border-gray-200 bg-white p-5 flex flex-col"
          >
            {plan.popular && (
              <span className="absolute -top-2.5 left-4 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-semibold text-white">
                Popular
              </span>
            )}
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-2xl font-bold text-gray-900">${plan.pricePerMonth}</span>
              <span className="text-sm text-gray-500">/mo CAD</span>
            </div>
            <p className="font-semibold text-gray-900">{plan.name}</p>
            <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
            <ul className="mt-3 space-y-1 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <CheckCircleIcon className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleChoosePlan(plan)}
              disabled={loadingPlanId !== null}
              className="mt-4 w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loadingPlanId === plan.id
                ? 'Redirecting to Stripe…'
                : `Get ${plan.name}`}
            </button>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <ExclamationTriangleIcon className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <p className="text-center text-xs text-gray-400">
        Secure payment powered by Stripe. Cancel anytime.
      </p>
    </div>
  )
}

// ── Root export ──────────────────────────────────────────────────────────────

export default function SubscriptionManager({ entityId, activeSub }: Props) {
  if (activeSub) {
    return <ActiveSubscriptionCard sub={activeSub} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CreditCardIcon className="h-5 w-5 text-indigo-600" />
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Choose a plan</h2>
          <p className="text-sm text-gray-500">Select the plan that fits your team. Cancel or change anytime.</p>
        </div>
      </div>
      <PlanPicker entityId={entityId} />
    </div>
  )
}
