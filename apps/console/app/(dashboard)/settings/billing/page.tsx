/**
 * /settings/billing — Billing & Subscription management page
 *
 * Server component: fetches current subscription from DB.
 * Delegates interactive parts to <SubscriptionManager />.
 */
import { CreditCardIcon } from '@heroicons/react/24/outline'
import { platformDb } from '@nzila/db/platform'
import { stripeSubscriptions, orgMembers } from '@nzila/db/schema'
import { eq, desc } from 'drizzle-orm'
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import SubscriptionManager from './SubscriptionManager'

export default async function BillingPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // Resolve entity from user membership (same pattern as integrations page)
  const [membership] = await platformDb
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(eq(orgMembers.userId, userId))
    .limit(1)

  const orgId = membership?.orgId ?? ''

  const subs = orgId
    ? await platformDb
        .select()
        .from(stripeSubscriptions)
        .where(eq(stripeSubscriptions.orgId, orgId))
        .orderBy(desc(stripeSubscriptions.createdAt))
        .limit(5)
    : []

  const activeSub = subs.find((s) =>
    ['active', 'trialing', 'past_due'].includes(s.status),
  ) ?? null

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <CreditCardIcon className="h-7 w-7 text-gray-700" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
          <p className="text-sm text-gray-500">
            Manage your subscription, payment methods, and invoices.
          </p>
        </div>
      </div>

      <SubscriptionManager
        orgId={orgId}
        activeSub={activeSub ? {
          subscriptionId: activeSub.stripeSubscriptionId,
          customerId: activeSub.stripeCustomerId,
          status: activeSub.status,
          planName: activeSub.planName,
          planInterval: activeSub.planInterval,
          currentPeriodEnd: activeSub.currentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: activeSub.cancelAtPeriodEnd,
        } : null}
      />
    </div>
  )
}
