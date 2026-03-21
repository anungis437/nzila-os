/**
 * Zonga — Subscription Management Page (Server Component).
 *
 * Shows current listener & creator plan status, upgrade/downgrade options,
 * and links to Stripe Billing Portal.
 */
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Card } from '@nzila/ui'
import {
  getListenerSubscription,
} from '@/lib/actions/subscription-actions'
import { LISTENER_PLANS, CREATOR_PLANS } from '@/lib/plans'
import { UpgradeButton, ManageSubscriptionButton } from '@/components/dashboard/subscription-buttons'

function formatPrice(cents: number | null): string {
  if (cents === null) return 'Custom'
  if (cents === 0) return 'Free'
  return `$${(cents / 100).toFixed(2)}/mo`
}

function statusLabel(status: string | null): { text: string; color: string } {
  switch (status) {
    case 'active':
      return { text: 'Active', color: 'bg-emerald-500/10 text-emerald-600' }
    case 'trialing':
      return { text: 'Trial', color: 'bg-blue-500/10 text-blue-600' }
    case 'past_due':
      return { text: 'Past Due', color: 'bg-amber-500/10 text-amber-600' }
    case 'canceled':
      return { text: 'Canceled', color: 'bg-red-500/10 text-red-600' }
    default:
      return { text: 'None', color: 'bg-gray-100 text-gray-500' }
  }
}

export default async function SubscriptionPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const listenerSub = await getListenerSubscription()
  const listenerPlan = listenerSub?.plan ?? 'free'
  const listenerStatus = listenerSub?.subscriptionStatus ?? null
  const listenerStatusInfo = statusLabel(listenerStatus)

  const currentListenerPlanDef = LISTENER_PLANS[listenerPlan]
  const isPremium = listenerPlan === 'premium' && (listenerStatus === 'active' || listenerStatus === 'trialing')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">Subscription</h1>
        <p className="text-gray-500 mt-1">Manage your plans and billing</p>
      </div>

      {/* ─── Listener Plan ─── */}
      <div>
        <h2 className="text-lg font-semibold text-navy mb-4">Listener Plan</h2>
        <Card>
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-navy">{currentListenerPlanDef.name}</h3>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${listenerStatusInfo.color}`}>
                    {listenerStatusInfo.text}
                  </span>
                </div>
                <p className="text-2xl font-bold text-electric mt-1">
                  {formatPrice(currentListenerPlanDef.priceMonthly)}
                </p>
                {listenerSub?.currentPeriodEnd && (
                  <p className="text-xs text-gray-400 mt-1">
                    Renews {new Date(listenerSub.currentPeriodEnd).toLocaleDateString('en-CA')}
                  </p>
                )}
              </div>
              <div className="text-4xl">🎧</div>
            </div>

            <div className="mb-6">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Included Features</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentListenerPlanDef.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="text-electric">✓</span>
                    {f.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center gap-3">
              {!isPremium && (
                <UpgradeButton action="checkout_premium" label="Upgrade to Premium" />
              )}
              {isPremium && (
                <ManageSubscriptionButton action="portal" label="Manage Billing" />
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Premium Comparison ─── */}
      {!isPremium && (
        <div>
          <h2 className="text-lg font-semibold text-navy mb-4">Why Go Premium?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: '🚫', title: 'Ad-Free', desc: 'Uninterrupted listening experience' },
              { icon: '⬇️', title: 'Offline Downloads', desc: 'Listen anywhere, anytime' },
              { icon: '🎵', title: 'Hi-Fi Lossless', desc: 'Studio-quality audio at 1411kbps' },
              { icon: '⭐', title: 'Exclusive Releases', desc: 'Early access to new music' },
              { icon: '📋', title: 'Enhanced Playlists', desc: 'Advanced playlist tools' },
              { icon: '❤️', title: 'Support Artists', desc: 'More revenue per stream' },
            ].map((benefit) => (
              <Card key={benefit.title}>
                <div className="p-4">
                  <span className="text-2xl">{benefit.icon}</span>
                  <h4 className="font-semibold text-navy mt-2">{benefit.title}</h4>
                  <p className="text-xs text-gray-500 mt-1">{benefit.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ─── Creator Plans Reference ─── */}
      <div>
        <h2 className="text-lg font-semibold text-navy mb-4">Creator Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.entries(CREATOR_PLANS) as [string, typeof CREATOR_PLANS[keyof typeof CREATOR_PLANS]][]).map(([key, plan]) => (
            <Card key={key}>
              <div className="p-5">
                <h3 className="text-sm font-semibold tracking-widest uppercase text-electric mb-1">{plan.name}</h3>
                <p className="text-2xl font-bold text-navy mb-3">{formatPrice(plan.priceMonthly)}</p>
                <ul className="space-y-1.5">
                  {plan.features.slice(0, 6).map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="text-electric">✓</span>
                      {f.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </li>
                  ))}
                  {plan.features.length > 6 && (
                    <li className="text-xs text-gray-400">+ {plan.features.length - 6} more</li>
                  )}
                </ul>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
