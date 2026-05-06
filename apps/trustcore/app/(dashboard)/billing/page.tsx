/**
 * TrustCore — Billing Page
 *
 * /billing
 *
 * Shows the current plan, feature comparison table, and upgrade CTA.
 * Upgrade button calls POST /api/billing/create-checkout-session.
 */

import { getAuthContext } from '@/lib/auth/getAuthContext'
import { getResolvedSubscription } from '@/lib/billing/getSubscription'
import { FREE_REMINDER_LIMIT } from '@/lib/billing/featureAccess'
import {
  CheckCircleIcon,
  XCircleIcon,
  SparklesIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline'
import { UpgradeButton } from '@/components/billing/UpgradeButton'

export const dynamic = 'force-dynamic'

// ── Types ──────────────────────────────────────────────────────────────────

interface Feature {
  label: string
  free: boolean | string
  pro: boolean | string
  premium: boolean | string
}

// ── Feature matrix ─────────────────────────────────────────────────────────

const FEATURES: Feature[] = [
  {
    label: 'Compliance dashboard',
    free: true,
    pro: true,
    premium: true,
  },
  {
    label: 'Onboarding wizard',
    free: true,
    pro: true,
    premium: true,
  },
  {
    label: 'Active reminders',
    free: `Up to ${FREE_REMINDER_LIMIT}`,
    pro: 'Unlimited',
    premium: 'Unlimited',
  },
  {
    label: 'Audit export (JSON + PDF)',
    free: false,
    pro: true,
    premium: true,
  },
  {
    label: 'Evidence bundle export',
    free: false,
    pro: true,
    premium: true,
  },
  {
    label: 'Public Trust Center',
    free: false,
    pro: true,
    premium: true,
  },
  {
    label: 'Advanced automation',
    free: false,
    pro: false,
    premium: 'Coming soon',
  },
  {
    label: 'Integrations',
    free: false,
    pro: false,
    premium: 'Coming soon',
  },
  {
    label: 'Priority support',
    free: false,
    pro: false,
    premium: true,
  },
]

// ── Cell helper ────────────────────────────────────────────────────────────

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <CheckCircleIcon className="h-5 w-5 text-teal-600 mx-auto" />
  if (value === false) return <XCircleIcon className="h-5 w-5 text-gray-300 mx-auto" />
  return <span className="text-xs text-gray-500 text-center block">{value}</span>
}

// ── Badge ──────────────────────────────────────────────────────────────────

const PLAN_BADGE: Record<string, string> = {
  free: 'bg-gray-100 text-gray-600',
  pro: 'bg-teal-50 text-teal-700',
  premium: 'bg-indigo-50 text-indigo-700',
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function BillingPage() {
  const ctx = await getAuthContext()
  const subscription = await getResolvedSubscription(ctx.orgId)
  const isProOrPremium = subscription.plan === 'pro' || subscription.plan === 'premium'
  const badgeClass = PLAN_BADGE[subscription.plan] ?? PLAN_BADGE.free!

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CreditCardIcon className="h-7 w-7 text-teal-600" />
          Billing &amp; Plan
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your TrustCore subscription and feature access.
        </p>
      </div>

      {/* Current plan card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">
              Current plan
            </p>
            <div className="flex items-center gap-2">
              <span
                className={`text-lg font-bold capitalize ${badgeClass} px-3 py-1 rounded-full`}
              >
                {subscription.plan}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  subscription.isActive
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {subscription.status}
              </span>
            </div>
            {subscription.currentPeriodEnd && (
              <p className="text-xs text-gray-400 mt-1">
                Renews {subscription.currentPeriodEnd.toLocaleDateString()}
              </p>
            )}
          </div>
          {!isProOrPremium && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              <SparklesIcon className="h-4 w-4 shrink-0" />
              Unlock audit reports and Trust Center
            </div>
          )}
        </div>
      </div>

      {/* Feature comparison table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-1/2">
                Feature
              </th>
              <th className="px-4 py-3 text-center">
                <span className={`text-xs font-bold capitalize px-2 py-0.5 rounded-full ${PLAN_BADGE.free}`}>
                  Free
                </span>
              </th>
              <th className="px-4 py-3 text-center">
                <span className={`text-xs font-bold capitalize px-2 py-0.5 rounded-full ${PLAN_BADGE.pro}`}>
                  Pro
                </span>
              </th>
              <th className="px-4 py-3 text-center">
                <span className={`text-xs font-bold capitalize px-2 py-0.5 rounded-full ${PLAN_BADGE.premium}`}>
                  Premium
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((f, i) => (
              <tr
                key={f.label}
                className={`border-b border-gray-100 last:border-0 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}
              >
                <td className="px-6 py-3 text-gray-700 font-medium">{f.label}</td>
                <td className="px-4 py-3"><Cell value={f.free} /></td>
                <td className="px-4 py-3"><Cell value={f.pro} /></td>
                <td className="px-4 py-3"><Cell value={f.premium} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Upgrade CTA */}
      {!isProOrPremium && ctx.role === 'org_admin' && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-6 flex items-center justify-between">
          <div>
            <p className="font-semibold text-teal-800 mb-1">Ready to unlock Pro?</p>
            <p className="text-sm text-teal-600">
              Audit exports, evidence bundles, and your public Trust Center — all in one upgrade.
            </p>
          </div>
          <UpgradeButton targetPlan="pro" />
        </div>
      )}
    </div>
  )
}
