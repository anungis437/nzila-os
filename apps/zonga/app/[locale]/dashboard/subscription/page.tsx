/**
 * Zonga — Subscription Management Page (Server Component).
 *
 * Shows current listener & creator plan status, upgrade/downgrade options,
 * and links to Stripe Billing Portal.
 *
 * Creators see their Creator Plan (artist / label / enterprise) with
 * features and status, plus the listener section below.
 * Listeners see only the listener plan section.
 */
import { auth, currentUser } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { Card } from '@nzila/ui'
import {
  getListenerSubscription,
  getMyCreatorSubscription,
} from '@/lib/actions/subscription-actions'
import { LISTENER_PLANS, CREATOR_PLANS } from '@/lib/plans'
import { UpgradeButton, ManageSubscriptionButton } from '@/components/dashboard/subscription-buttons'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import type { ListenerPlan, CreatorPlan } from '@/lib/plans'

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
      return { text: 'None', color: 'bg-muted text-muted-foreground' }
  }
}

/**
 * Map DB creator plan enum (artist | label | enterprise)
 * to the plans.ts CreatorPlan key (starter | pro_creator | business | enterprise).
 */
function mapDbCreatorPlan(dbPlan: string | null): CreatorPlan {
  switch (dbPlan) {
    case 'label':
      return 'business'
    case 'enterprise':
      return 'enterprise'
    case 'artist':
    default:
      return 'starter'
  }
}

export default async function SubscriptionPage() {
  const { userId, orgId, orgRole, sessionClaims } = await auth()
  if (!userId) redirect('/sign-in')

  const [listenerSub, creatorSub, orgTierRows] = await Promise.all([
    getListenerSubscription(),
    getMyCreatorSubscription(),
    platformDb.execute(
      sql`SELECT o.subscription_tier
          FROM organizations o
          JOIN organization_members om ON om.organization_id = o.id
          WHERE om.user_id = ${userId}
          LIMIT 1`,
    ).then((r) => r as unknown as { subscription_tier: string | null }[]).catch(() => []),
  ])

  // Org-level entitlement: enterprise/business orgs grant premium to all members
  const orgTier = orgTierRows[0]?.subscription_tier ?? null
  const orgEntitled = orgTier === 'enterprise' || orgTier === 'business'

  // Detect creator role: DB profile, session metadata, or active org membership
  const user = (!listenerSub || !creatorSub) ? await currentUser() : null
  const sessionRole = (user?.publicMetadata as { zongaRole?: string } | undefined)?.zongaRole
    ?? (sessionClaims as { publicMetadata?: { zongaRole?: string } } | undefined)?.publicMetadata?.zongaRole
  const isCreator = !!creatorSub || !!orgId || sessionRole === 'creator' || orgRole === 'org:creator'

  // ── Listener plan resolution
  const sessionPlan = (user?.publicMetadata as { listenerPlan?: string } | undefined)?.listenerPlan as ListenerPlan | undefined
  const listenerPlan: ListenerPlan = orgEntitled || listenerSub?.plan === 'premium' || sessionPlan === 'premium' ? 'premium' : 'free'
  const listenerStatus = orgEntitled ? 'active' : (listenerSub?.subscriptionStatus ?? (sessionPlan === 'premium' ? 'active' : null))
  const listenerStatusInfo = statusLabel(listenerStatus)
  const currentListenerPlanDef = LISTENER_PLANS[listenerPlan]
  const isPremium = orgEntitled || (listenerPlan === 'premium' && (listenerStatus === 'active' || listenerStatus === 'trialing' || !listenerSub))
  const hasStripeBilling = isPremium && !!listenerSub && !orgEntitled

  // ── Creator plan resolution
  const creatorPlanKey = mapDbCreatorPlan(creatorSub?.plan ?? null)
  const creatorPlanDef = CREATOR_PLANS[creatorPlanKey]
  const creatorStatus = creatorSub?.subscriptionStatus ?? (creatorSub ? 'active' : null)
  const creatorStatusInfo = statusLabel(creatorStatus)
  const hasCreatorStripeBilling = !!creatorSub?.stripeSubscriptionId

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Subscription</h1>
        <p className="text-muted-foreground mt-1">Manage your plans and billing</p>
      </div>

      {/* ─── Creator Plan (shown only for creators) ─── */}
      {isCreator && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Creator Plan</h2>
          <Card>
            <div className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-foreground">{creatorPlanDef.name}</h3>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${creatorStatusInfo.color}`}>
                      {creatorStatusInfo.text}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-electric mt-1">
                    {formatPrice(creatorPlanDef.priceMonthlyMinor)}
                  </p>
                  {creatorSub && (
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {creatorSub.displayName ?? 'Creator Profile'}
                    </p>
                  )}
                </div>
                <div className="text-4xl">🎤</div>
              </div>

              <div className="mb-6">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Included Features</p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {creatorPlanDef.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                      <span className="text-electric">✓</span>
                      {f.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Limits summary */}
              <div className="mb-6">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Plan Limits</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-lg font-bold text-foreground">
                      {creatorPlanDef.limits.uploadLimitPerMonth ?? '∞'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Uploads / mo</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-lg font-bold text-foreground">{creatorPlanDef.limits.teamMembers}</p>
                    <p className="text-[11px] text-muted-foreground">Team Members</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-lg font-bold text-foreground">{creatorPlanDef.limits.splitParties}</p>
                    <p className="text-[11px] text-muted-foreground">Split Parties</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <p className="text-lg font-bold text-foreground">
                      {creatorPlanDef.limits.eventsPerMonth ?? '∞'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Events / mo</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {hasCreatorStripeBilling && (
                  <ManageSubscriptionButton action="portal" label="Manage Creator Billing" />
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ─── Available Creator Plans (upgrade comparison for creators on starter) ─── */}
      {isCreator && creatorPlanKey === 'starter' && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Upgrade Your Creator Plan</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(Object.entries(CREATOR_PLANS) as [string, typeof CREATOR_PLANS[keyof typeof CREATOR_PLANS]][])
              .filter(([key]) => key !== 'starter')
              .map(([key, plan]) => (
                <Card key={key}>
                  <div className="p-5">
                    <h3 className="text-sm font-semibold tracking-widest uppercase text-electric mb-1">{plan.name}</h3>
                    <p className="text-2xl font-bold text-foreground mb-3">{formatPrice(plan.priceMonthlyMinor)}</p>
                    <ul className="space-y-1.5">
                      {plan.features.slice(0, 6).map((f) => (
                        <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="text-electric">✓</span>
                          {f.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </li>
                      ))}
                      {plan.features.length > 6 && (
                        <li className="text-xs text-muted-foreground/70">+ {plan.features.length - 6} more</li>
                      )}
                    </ul>
                  </div>
                </Card>
              ))}
          </div>
        </div>
      )}

      {/* ─── Listener Plan (hidden for creators — creator plan supersedes) ─── */}
      {!isCreator && <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Listener Plan</h2>
        <Card>
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-foreground">{currentListenerPlanDef.name}</h3>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${listenerStatusInfo.color}`}>
                    {listenerStatusInfo.text}
                  </span>
                </div>
                <p className="text-2xl font-bold text-electric mt-1">
                  {formatPrice(currentListenerPlanDef.priceMonthlyMinor)}
                </p>
                {listenerSub?.currentPeriodEnd && !orgEntitled && (
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Renews {new Date(listenerSub.currentPeriodEnd).toLocaleDateString('en-CA')}
                  </p>
                )}
                {orgEntitled && (
                  <p className="text-xs text-emerald-600 mt-1">
                    Included with your organization&apos;s {orgTier} plan
                  </p>
                )}
              </div>
              <div className="text-4xl">🎧</div>
            </div>

            <div className="mb-6">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Included Features</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentListenerPlanDef.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-foreground">
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
              {hasStripeBilling && (
                <ManageSubscriptionButton action="portal" label="Manage Billing" />
              )}
            </div>
          </div>
        </Card>
      </div>}

      {/* ─── Premium Comparison (hidden for creators) ─── */}
      {!isCreator && !isPremium && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Why Go Premium?</h2>
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
                  <h4 className="font-semibold text-foreground mt-2">{benefit.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{benefit.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
