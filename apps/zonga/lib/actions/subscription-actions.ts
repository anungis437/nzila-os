/**
 * Zonga Server Actions — Subscription Management.
 *
 * Handles listener premium subscriptions and creator label subscriptions
 * via Stripe Checkout (subscription mode) and Billing Portal.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import {
  createCustomer,
  createSubscriptionCheckoutSession,
  createPortalSession,
} from '@nzila/payments-stripe'
import { getStripePriceId, type ListenerPlan, type CreatorPlan } from '@/lib/plans'

/* ─── Types ─── */

export interface ListenerSubscription {
  plan: ListenerPlan
  subscriptionStatus: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  currentPeriodEnd: Date | null
}

export interface CreatorSubscription {
  plan: CreatorPlan
  subscriptionStatus: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
}

/* ─── Read Plan Status ─── */

export async function getListenerSubscription(): Promise<ListenerSubscription | null> {
  const ctx = await resolveOrgContext()

  try {
    const [row] = (await platformDb.execute(
      sql`SELECT
        plan,
        subscription_status as "subscriptionStatus",
        stripe_customer_id as "stripeCustomerId",
        stripe_subscription_id as "stripeSubscriptionId",
        current_period_end as "currentPeriodEnd"
      FROM zonga_listeners
      WHERE id = ${ctx.actorId} AND org_id = ${ctx.orgId}`,
    )) as unknown as [ListenerSubscription | undefined]

    return row ?? null
  } catch (error) {
    logger.error('getListenerSubscription failed', { error })
    return null
  }
}

export async function getCreatorSubscription(creatorId: string): Promise<CreatorSubscription | null> {
  const ctx = await resolveOrgContext()

  try {
    const [row] = (await platformDb.execute(
      sql`SELECT
        plan,
        subscription_status as "subscriptionStatus",
        stripe_customer_id as "stripeCustomerId",
        stripe_subscription_id as "stripeSubscriptionId"
      FROM zonga_creators
      WHERE id = ${creatorId} AND org_id = ${ctx.orgId}`,
    )) as unknown as [CreatorSubscription | undefined]

    return row ?? null
  } catch (error) {
    logger.error('getCreatorSubscription failed', { error })
    return null
  }
}

/* ─── Listener Premium Checkout ─── */

export async function createListenerPremiumCheckout(): Promise<{
  url: string | null
  error?: string
}> {
  const ctx = await resolveOrgContext()

  try {
    // Get or create Stripe customer
    let stripeCustomerId: string | null = null

    const [listener] = (await platformDb.execute(
      sql`SELECT stripe_customer_id as "stripeCustomerId", email, display_name as "displayName"
      FROM zonga_listeners
      WHERE id = ${ctx.actorId} AND org_id = ${ctx.orgId}`,
    )) as unknown as [{ stripeCustomerId: string | null; email: string; displayName: string } | undefined]

    if (!listener) {
      return { url: null, error: 'Listener profile not found' }
    }

    stripeCustomerId = listener.stripeCustomerId

    if (!stripeCustomerId) {
      const customer = await createCustomer({
        email: listener.email,
        name: listener.displayName,
        orgId: ctx.orgId,
        metadata: { listener_id: ctx.actorId, plan_type: 'listener_premium' },
      })
      stripeCustomerId = customer.id

      await platformDb.execute(
        sql`UPDATE zonga_listeners
        SET stripe_customer_id = ${stripeCustomerId}, updated_at = NOW()
        WHERE id = ${ctx.actorId} AND org_id = ${ctx.orgId}`,
      )
    }

    const priceId = getStripePriceId('premium')
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3011'

    const { url } = await createSubscriptionCheckoutSession({
      priceId,
      orgId: ctx.orgId,
      customerId: stripeCustomerId,
      successUrl: `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/pricing`,
      trialDays: 7,
      metadata: {
        listener_id: ctx.actorId,
        plan_type: 'listener_premium',
      },
    })

    return { url }
  } catch (error) {
    logger.error('createListenerPremiumCheckout failed', { error })
    return { url: null, error: 'Failed to create checkout session' }
  }
}

/* ─── Label Plan Checkout ─── */

export async function createLabelPlanCheckout(creatorId: string): Promise<{
  url: string | null
  error?: string
}> {
  const ctx = await resolveOrgContext()

  try {
    const [creator] = (await platformDb.execute(
      sql`SELECT c.stripe_customer_id as "stripeCustomerId", ca.email, c.display_name as "displayName"
      FROM zonga_creators c
      LEFT JOIN zonga_creator_accounts ca ON ca.creator_id = c.id
      WHERE c.id = ${creatorId} AND c.org_id = ${ctx.orgId}`,
    )) as unknown as [{ stripeCustomerId: string | null; email: string; displayName: string } | undefined]

    if (!creator) {
      return { url: null, error: 'Creator not found' }
    }

    let stripeCustomerId = creator.stripeCustomerId

    if (!stripeCustomerId) {
      const customer = await createCustomer({
        email: creator.email,
        name: creator.displayName,
        orgId: ctx.orgId,
        metadata: { creator_id: creatorId, plan_type: 'label' },
      })
      stripeCustomerId = customer.id

      await platformDb.execute(
        sql`UPDATE zonga_creators
        SET stripe_customer_id = ${stripeCustomerId}, updated_at = NOW()
        WHERE id = ${creatorId} AND org_id = ${ctx.orgId}`,
      )
    }

    const priceId = getStripePriceId('label')
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3011'

    const { url } = await createSubscriptionCheckoutSession({
      priceId,
      orgId: ctx.orgId,
      customerId: stripeCustomerId,
      successUrl: `${baseUrl}/dashboard/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/dashboard/settings`,
      metadata: {
        creator_id: creatorId,
        plan_type: 'label',
      },
    })

    return { url }
  } catch (error) {
    logger.error('createLabelPlanCheckout failed', { error })
    return { url: null, error: 'Failed to create checkout session' }
  }
}

/* ─── Billing Portal ─── */

export async function createListenerPortalSession(): Promise<{
  url: string | null
  error?: string
}> {
  const ctx = await resolveOrgContext()

  try {
    const [listener] = (await platformDb.execute(
      sql`SELECT stripe_customer_id as "stripeCustomerId"
      FROM zonga_listeners
      WHERE id = ${ctx.actorId} AND org_id = ${ctx.orgId}`,
    )) as unknown as [{ stripeCustomerId: string | null } | undefined]

    if (!listener?.stripeCustomerId) {
      return { url: null, error: 'No active subscription found' }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3011'

    const session = await createPortalSession({
      customerId: listener.stripeCustomerId,
      returnUrl: `${baseUrl}/settings`,
    })

    return { url: session.url }
  } catch (error) {
    logger.error('createListenerPortalSession failed', { error })
    return { url: null, error: 'Failed to create portal session' }
  }
}

export async function createCreatorPortalSession(creatorId: string): Promise<{
  url: string | null
  error?: string
}> {
  const ctx = await resolveOrgContext()

  try {
    const [creator] = (await platformDb.execute(
      sql`SELECT stripe_customer_id as "stripeCustomerId"
      FROM zonga_creators
      WHERE id = ${creatorId} AND org_id = ${ctx.orgId}`,
    )) as unknown as [{ stripeCustomerId: string | null } | undefined]

    if (!creator?.stripeCustomerId) {
      return { url: null, error: 'No active subscription found' }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3011'

    const session = await createPortalSession({
      customerId: creator.stripeCustomerId,
      returnUrl: `${baseUrl}/dashboard/settings`,
    })

    return { url: session.url }
  } catch (error) {
    logger.error('createCreatorPortalSession failed', { error })
    return { url: null, error: 'Failed to create portal session' }
  }
}
