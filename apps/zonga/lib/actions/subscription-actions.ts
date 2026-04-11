/**
 * Zonga Server Actions — Subscription Management.
 *
 * Handles listener premium subscriptions and creator label subscriptions
 * via Stripe Checkout (subscription mode) and Billing Portal.
 */
'use server'

import { resolveOrgContext, resolveListenerContext } from '@/lib/resolve-org'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import {
  createCustomer,
  createSubscriptionCheckoutSession,
  createPortalSession,
} from '@nzila/payments-stripe'
import { getStripePriceId, type ListenerPlan, type CreatorPlan } from '@/lib/plans'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'

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
  const ctx = await resolveListenerContext()

  try {
    const rows = (await platformDb.execute(
      sql`SELECT
        plan,
        subscription_status as "subscriptionStatus",
        stripe_customer_id as "stripeCustomerId",
        stripe_subscription_id as "stripeSubscriptionId",
        current_period_end as "currentPeriodEnd"
      FROM zonga_listeners
      WHERE user_id = ${ctx.actorId}
      ORDER BY created_at DESC
      LIMIT 1`,
    )) as unknown as ListenerSubscription[]

    return rows[0] ?? null
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

/* ─── My Creator Plan (by user_id, no org required) ─── */

export interface MyCreatorSubscription {
  id: string
  plan: string
  subscriptionStatus: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  displayName: string | null
}

/**
 * Fetch the current user's creator profile & plan by user_id.
 * Does NOT require org context — avoids the orgId→UUID mismatch.
 */
export async function getMyCreatorSubscription(): Promise<MyCreatorSubscription | null> {
  const ctx = await resolveListenerContext()

  try {
    const rows = (await platformDb.execute(
      sql`SELECT
        id,
        plan,
        subscription_status as "subscriptionStatus",
        stripe_customer_id as "stripeCustomerId",
        stripe_subscription_id as "stripeSubscriptionId",
        display_name as "displayName"
      FROM zonga_creators
      WHERE user_id = ${ctx.actorId}
      ORDER BY created_at DESC
      LIMIT 1`,
    )) as unknown as MyCreatorSubscription[]

    return rows[0] ?? null
  } catch (error) {
    logger.error('getMyCreatorSubscription failed', { error })
    return null
  }
}

/* ─── Listener Premium Checkout ─── */

export async function createListenerPremiumCheckout(): Promise<{
  url: string | null
  error?: string
}> {
  const ctx = await resolveListenerContext()

  try {
    // Get or create Stripe customer
    let stripeCustomerId: string | null = null

    const [listener] = (await platformDb.execute(
      sql`SELECT stripe_customer_id as "stripeCustomerId", email, display_name as "displayName"
      FROM zonga_listeners
      WHERE user_id = ${ctx.actorId}`,
    )) as unknown as [{ stripeCustomerId: string | null; email: string; displayName: string } | undefined]

    if (!listener) {
      return { url: null, error: 'Listener profile not found' }
    }

    stripeCustomerId = listener.stripeCustomerId

    if (!stripeCustomerId) {
      const customer = await createCustomer({
        email: listener.email,
        name: listener.displayName,
        orgId: ctx.orgId ?? 'listener',
        metadata: { listener_id: ctx.actorId, plan_type: 'listener_premium' },
      })
      stripeCustomerId = customer.id

      await platformDb.execute(
        sql`UPDATE zonga_listeners
        SET stripe_customer_id = ${stripeCustomerId}, updated_at = NOW()
        WHERE user_id = ${ctx.actorId}`,
      )
    }

    const priceId = getStripePriceId('premium')
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3011'

    const { url } = await createSubscriptionCheckoutSession({
      priceId,
      orgId: ctx.orgId ?? 'listener',
      customerId: stripeCustomerId,
      successUrl: `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseUrl}/dashboard/subscription`,
      trialDays: 7,
      metadata: {
        listener_id: ctx.actorId,
        plan_type: 'listener_premium',
      },
    })

    const pack = buildEvidencePackFromAction({
      actionType: 'LISTENER_PREMIUM_CHECKOUT_CREATED',
      orgId: ctx.orgId ?? 'listener',
      executedBy: ctx.actorId,
      actionId: crypto.randomUUID(),
    })
    await processEvidencePack(pack)

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

    const pack = buildEvidencePackFromAction({
      actionType: 'LABEL_PLAN_CHECKOUT_CREATED',
      orgId: ctx.orgId,
      executedBy: ctx.actorId,
      actionId: crypto.randomUUID(),
    })
    await processEvidencePack(pack)

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
  const ctx = await resolveListenerContext()

  try {
    const [listener] = (await platformDb.execute(
      sql`SELECT stripe_customer_id as "stripeCustomerId"
      FROM zonga_listeners
      WHERE user_id = ${ctx.actorId}`,
    )) as unknown as [{ stripeCustomerId: string | null } | undefined]

    if (!listener?.stripeCustomerId) {
      return { url: null, error: 'No active subscription found' }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3011'

    const session = await createPortalSession({
      customerId: listener.stripeCustomerId,
      returnUrl: `${baseUrl}/dashboard/settings`,
    })

    const pack = buildEvidencePackFromAction({
      actionType: 'LISTENER_PORTAL_SESSION_CREATED',
      orgId: ctx.orgId ?? 'listener',
      executedBy: ctx.actorId,
      actionId: crypto.randomUUID(),
    })
    await processEvidencePack(pack)

    return { url: session.url }
  } catch (error) {
    logger.error('createListenerPortalSession failed', { error })
    const msg =
      error instanceof Error && error.message.includes('No such customer')
        ? 'Stripe customer not found — subscription may need to be re-created'
        : 'Failed to create portal session'
    return { url: null, error: msg }
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

    const pack = buildEvidencePackFromAction({
      actionType: 'CREATOR_PORTAL_SESSION_CREATED',
      orgId: ctx.orgId,
      executedBy: ctx.actorId,
      actionId: crypto.randomUUID(),
    })
    await processEvidencePack(pack)

    return { url: session.url }
  } catch (error) {
    logger.error('createCreatorPortalSession failed', { error })
    return { url: null, error: 'Failed to create portal session' }
  }
}
