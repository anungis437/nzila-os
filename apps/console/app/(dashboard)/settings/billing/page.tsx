/**
 * /settings/billing — Billing & Subscription management page
 *
 * Server component: fetches current subscription from DB.
 * Delegates interactive parts to <SubscriptionManager />.
 */
import { CreditCardIcon } from '@heroicons/react/24/outline'
import { platformDb } from '@nzila/db/platform'
import { stripeSubscriptions } from '@nzila/db/schema'
import { eq, desc } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import SubscriptionManager from './SubscriptionManager'

// TODO: replace with real entity resolution once user→entity mapping is wired
const PLACEHOLDER_ENTITY_ID = process.env.DEFAULT_ENTITY_ID ?? ''

export default async function BillingPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const subs = PLACEHOLDER_ENTITY_ID
    ? await platformDb
        .select()
        .from(stripeSubscriptions)
        .where(eq(stripeSubscriptions.entityId, PLACEHOLDER_ENTITY_ID))
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

      <SubscriptionManager activeSub={activeSub ? {
        subscriptionId: activeSub.stripeSubscriptionId,
        customerId: activeSub.stripeCustomerId,
        status: activeSub.status,
        planName: activeSub.planName,
        planInterval: activeSub.planInterval,
        currentPeriodEnd: activeSub.currentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: activeSub.cancelAtPeriodEnd,
      } : null} />
    </div>
  )
}
