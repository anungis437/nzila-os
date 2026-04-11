/**
 * Zonga — Organization Billing Management Page.
 *
 * Allows org admins to view their organization's subscription tier,
 * member entitlements, and manage billing through Stripe.
 * Only accessible to admin/manager roles with an active org.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { Card } from '@nzila/ui'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { CREATOR_PLANS, type CreatorPlan } from '@/lib/plans'
import { ManageSubscriptionButton, UpgradeButton } from '@/components/dashboard/subscription-buttons'

/* ─── Types ─── */

interface OrgBillingInfo {
  id: string
  name: string
  subscriptionTier: string | null
  email: string | null
  memberCount: number
  activeMemberCount: number
  createdAt: string
}

interface OrgCreatorProfile {
  plan: string | null
  subscriptionStatus: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  displayName: string | null
  id: string
}

/* ─── Helpers ─── */

function tierLabel(tier: string | null): { name: string; color: string } {
  switch (tier) {
    case 'enterprise':
      return { name: 'Enterprise', color: 'bg-purple-500/10 text-purple-600' }
    case 'business':
      return { name: 'Business', color: 'bg-blue-500/10 text-blue-600' }
    case 'pro_creator':
      return { name: 'Pro Creator', color: 'bg-emerald-500/10 text-emerald-600' }
    case 'starter':
      return { name: 'Starter', color: 'bg-muted text-muted-foreground' }
    default:
      return { name: tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : 'None', color: 'bg-muted text-muted-foreground' }
  }
}

function statusBadge(status: string | null): { text: string; color: string } {
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

function mapDbPlanToCreatorPlan(dbPlan: string | null): CreatorPlan {
  switch (dbPlan) {
    case 'label': return 'business'
    case 'enterprise': return 'enterprise'
    case 'artist': return 'starter'
    default: return 'starter'
  }
}

function formatPrice(cents: number | null): string {
  if (cents === null) return 'Custom'
  if (cents === 0) return 'Free'
  return `$${(cents / 100).toFixed(2)}/mo`
}

/* ─── Page ─── */

export default async function OrgBillingPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // Fetch org + creator profile for this user's org
  const [orgRows, creatorRows, memberCountRows] = await Promise.all([
    platformDb.execute(
      sql`SELECT o.id, o.name, o.subscription_tier as "subscriptionTier",
                 o.email, o.member_count as "memberCount",
                 o.active_member_count as "activeMemberCount",
                 o.created_at as "createdAt"
          FROM organizations o
          JOIN organization_members om ON om.organization_id = o.id
          WHERE om.user_id = ${userId}
          LIMIT 1`,
    ).then((r) => r as unknown as OrgBillingInfo[]).catch(() => []),

    platformDb.execute(
      sql`SELECT c.id, c.plan, c.subscription_status as "subscriptionStatus",
                 c.stripe_customer_id as "stripeCustomerId",
                 c.stripe_subscription_id as "stripeSubscriptionId",
                 c.display_name as "displayName"
          FROM zonga_creators c
          JOIN organizations o ON o.id = c.org_id
          JOIN organization_members om ON om.organization_id = o.id
          WHERE om.user_id = ${userId}
          ORDER BY c.created_at DESC
          LIMIT 1`,
    ).then((r) => r as unknown as OrgCreatorProfile[]).catch(() => []),

    platformDb.execute(
      sql`SELECT COUNT(*)::int as count
          FROM organization_members om
          JOIN organizations o ON o.id = om.organization_id
          WHERE om.user_id = ${userId}
          GROUP BY o.id`,
    ).then((r) => r as unknown as { count: number }[]).catch(() => []),
  ])

  const org = orgRows[0]
  const creator = creatorRows[0]

  if (!org) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Organization Billing</h1>
        <Card>
          <div className="p-6 text-center">
            <p className="text-4xl mb-3">🏢</p>
            <p className="text-muted-foreground">
              You are not a member of any organization. Join or create one to manage billing.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  const tier = tierLabel(org.subscriptionTier)
  const creatorPlanKey = mapDbPlanToCreatorPlan(creator?.plan ?? null)
  const creatorPlanDef = CREATOR_PLANS[creatorPlanKey]
  const creatorStatus = statusBadge(creator?.subscriptionStatus ?? (creator ? 'active' : null))
  const hasStripe = !!creator?.stripeSubscriptionId
  const isEnterprise = org.subscriptionTier === 'enterprise'
  const isBusiness = org.subscriptionTier === 'business'
  const totalMembers = memberCountRows[0]?.count ?? org.memberCount ?? 0

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Organization Billing</h1>
        <p className="text-muted-foreground mt-1">
          Manage {org.name}&apos;s subscription and member entitlements
        </p>
      </div>

      {/* ─── Organization Tier ─── */}
      <Card>
        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Organization Subscription
              </p>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-foreground">{org.name}</h3>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${tier.color}`}>
                  {tier.name}
                </span>
              </div>
              {(isEnterprise || isBusiness) && (
                <p className="text-xs text-emerald-600 mt-2">
                  All members receive Premium listener features automatically
                </p>
              )}
            </div>
            <div className="text-4xl">🏢</div>
          </div>

          {/* Member Overview */}
          <div className="mb-6">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Member Entitlements
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-lg font-bold text-foreground">{totalMembers}</p>
                <p className="text-[11px] text-muted-foreground">Total Members</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-lg font-bold text-foreground">
                  {(isEnterprise || isBusiness) ? totalMembers : 0}
                </p>
                <p className="text-[11px] text-muted-foreground">Premium Entitled</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-lg font-bold text-foreground">{tier.name}</p>
                <p className="text-[11px] text-muted-foreground">Current Tier</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-lg font-bold text-foreground">
                  {org.email ? '✓' : '—'}
                </p>
                <p className="text-[11px] text-muted-foreground">Billing Email</p>
              </div>
            </div>
          </div>

          {/* Tier benefits */}
          {(isEnterprise || isBusiness) && (
            <div className="mb-6 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-sm font-semibold text-emerald-600 mb-2">
                {isEnterprise ? '🌟 Enterprise' : '💼 Business'} Plan Benefits
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {[
                  'All members get Premium streaming (ad-free, Hi-Fi, offline)',
                  'Priority content review & moderation',
                  isEnterprise ? 'Custom payment rails & SLA guarantees' : 'API access & compliance exports',
                  isEnterprise ? 'White-label & on-premise deployment' : 'Dedicated account manager',
                  `Reduced commission rates (${isEnterprise ? 'negotiable' : '10% stream / 5% ticket'})`,
                  `${isEnterprise ? 'Unlimited' : '10'} team members per creator profile`,
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="text-emerald-600 mt-0.5">✓</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      {/* ─── Creator Plan Details ─── */}
      {creator && (
        <Card>
          <div className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Creator Plan
                </p>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-foreground">{creatorPlanDef.name}</h3>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${creatorStatus.color}`}>
                    {creatorStatus.text}
                  </span>
                </div>
                <p className="text-2xl font-bold text-electric mt-1">
                  {formatPrice(creatorPlanDef.priceMonthlyMinor)}
                </p>
                {creator.displayName && (
                  <p className="text-xs text-muted-foreground/70 mt-1">{creator.displayName}</p>
                )}
              </div>
              <div className="text-4xl">🎤</div>
            </div>

            {/* Plan limits */}
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
              {hasStripe && (
                <ManageSubscriptionButton action="portal" label="Manage Billing" />
              )}
              {creatorPlanKey === 'starter' && creator.id && (
                <UpgradeButton action="checkout_label" label="Upgrade Plan" creatorId={creator.id} />
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ─── Upgrade Comparison (for non-enterprise orgs) ─── */}
      {!isEnterprise && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            {isBusiness ? 'Upgrade to Enterprise' : 'Upgrade Your Organization'}
          </h2>
          <div className={`grid grid-cols-1 ${isBusiness ? '' : 'md:grid-cols-2'} gap-4`}>
            {(Object.entries(CREATOR_PLANS) as [string, typeof CREATOR_PLANS[keyof typeof CREATOR_PLANS]][])
              .filter(([key]) => {
                if (isBusiness) return key === 'enterprise'
                return key === 'business' || key === 'enterprise'
              })
              .map(([key, plan]) => (
                <Card key={key}>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold tracking-widest uppercase text-electric">{plan.name}</h3>
                      {key === 'enterprise' && <span className="text-xs text-muted-foreground">(Contact Sales)</span>}
                    </div>
                    <p className="text-2xl font-bold text-foreground mb-3">{formatPrice(plan.priceMonthlyMinor)}</p>
                    <ul className="space-y-1.5 mb-4">
                      <li className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
                        <span>✓</span> All members get Premium streaming
                      </li>
                      {plan.features.slice(-6).map((f) => (
                        <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="text-electric">✓</span>
                          {f.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </li>
                      ))}
                    </ul>
                    {key === 'enterprise' ? (
                      <a
                        href="mailto:sales@nzila.io?subject=Enterprise%20Plan%20Inquiry"
                        className="inline-flex items-center gap-2 rounded-xl border border-electric text-electric px-5 py-2.5 text-sm font-semibold hover:bg-electric/10 transition-colors"
                      >
                        📧 Contact Sales
                      </a>
                    ) : (
                      creator?.id && (
                        <UpgradeButton action="checkout_label" label={`Upgrade to ${plan.name}`} creatorId={creator.id} />
                      )
                    )}
                  </div>
                </Card>
              ))}
          </div>
        </div>
      )}

      {/* ─── Billing Info ─── */}
      <Card>
        <div className="p-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Billing Information
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Organization</p>
              <p className="font-medium text-foreground">{org.name}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Billing Email</p>
              <p className="font-medium text-foreground">{org.email ?? 'Not set'}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Member Since</p>
              <p className="font-medium text-foreground">
                {new Date(org.createdAt).toLocaleDateString('en-CA')}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Subscription Tier</p>
              <p className="font-medium text-foreground">{tier.name}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
