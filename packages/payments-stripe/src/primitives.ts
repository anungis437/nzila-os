/**
 * @nzila/payments-stripe — Payment primitives
 *
 * Stripe SDK wrappers for customer creation, checkout sessions,
 * and refund execution. Used by the console API routes.
 */
import { getStripeClient } from './client'
import { getStripeEnv } from './env'
import type { NzilaStripeMetadata } from './types'
import type Stripe from 'stripe'

// ── Customer Creation ───────────────────────────────────────────────────────

export interface CreateCustomerInput {
  email: string
  name: string
  orgId: string
  ventureId?: string
  metadata?: Record<string, string>
}

export async function createCustomer(input: CreateCustomerInput): Promise<Stripe.Customer> {
  const stripe = getStripeClient()

  const metadata: NzilaStripeMetadata = {
    org_id: input.orgId,
    ...(input.ventureId && { venture_id: input.ventureId }),
    ...input.metadata,
  }

  return stripe.customers.create({
    email: input.email,
    name: input.name,
    metadata: metadata as Stripe.MetadataParam,
  })
}

// ── Checkout Session Creation ───────────────────────────────────────────────

export interface CreateCheckoutSessionInput {
  orgId: string
  ventureId?: string
  customerId?: string
  lineItems: Array<{
    priceId?: string
    name?: string
    amountCents: number
    quantity: number
  }>
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, string>
}

export async function createCheckoutSession(
  input: CreateCheckoutSessionInput,
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient()
  const env = getStripeEnv()

  const metadata: NzilaStripeMetadata = {
    org_id: input.orgId,
    ...(input.ventureId && { venture_id: input.ventureId }),
    ...input.metadata,
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = input.lineItems.map(
    (item) => {
      if (item.priceId) {
        return { price: item.priceId, quantity: item.quantity }
      }
      return {
        price_data: {
          currency: env.STRIPE_DEFAULT_CURRENCY.toLowerCase(),
          product_data: { name: item.name ?? 'Payment' },
          unit_amount: item.amountCents,
        },
        quantity: item.quantity,
      }
    },
  )

  return stripe.checkout.sessions.create({
    mode: 'payment',
    customer: input.customerId,
    line_items: lineItems,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: metadata as Stripe.MetadataParam,
  })
}

// ── Refund Execution ────────────────────────────────────────────────────────

export interface ExecuteRefundInput {
  paymentIntentId: string
  amountCents?: number
  reason?: Stripe.RefundCreateParams.Reason
}

/**
 * Execute a refund via Stripe API.
 * Only call this if the refund is BELOW the approval threshold,
 * or if it has been explicitly approved.
 */
export async function executeRefund(input: ExecuteRefundInput): Promise<Stripe.Refund> {
  const stripe = getStripeClient()

  return stripe.refunds.create({
    payment_intent: input.paymentIntentId,
    ...(input.amountCents !== undefined && { amount: input.amountCents }),
    ...(input.reason && { reason: input.reason }),
  })
}

/**
 * Check if a refund amount requires approval.
 */
export function requiresApproval(amountCents: number): boolean {
  const env = getStripeEnv()
  return amountCents >= env.STRIPE_REFUND_APPROVAL_THRESHOLD_CENTS
}

// ── Subscription Creation ───────────────────────────────────────────────────

export interface CreateSubscriptionInput {
  customerId: string
  priceId: string
  orgId: string
  ventureId?: string
  trialDays?: number
  metadata?: Record<string, string>
}

export interface CreateSubscriptionResult {
  subscriptionId: string
  clientSecret: string | null
  status: string
  currentPeriodEnd: number
}

/**
 * Create a Stripe Subscription with payment_behavior='default_incomplete'.
 * Returns the subscription ID and the PaymentIntent clientSecret needed
 * by the frontend <PaymentElement> to confirm the first payment.
 */
export async function createSubscription(
  input: CreateSubscriptionInput,
): Promise<CreateSubscriptionResult> {
  const stripe = getStripeClient()

  const metadata = {
    org_id: input.orgId,
    ...(input.ventureId && { venture_id: input.ventureId }),
    ...input.metadata,
  }

  const subscription = await stripe.subscriptions.create({
    customer: input.customerId,
    items: [{ price: input.priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.confirmation_secret'],
    ...(input.trialDays && { trial_period_days: input.trialDays }),
    metadata,
  })

  // Endive invoices expose a confirmation secret, not invoice.payment_intent.
  const invoice = typeof subscription.latest_invoice === 'string' ? null : subscription.latest_invoice

  // Subscription periods belong to subscription items.
  const firstItem = subscription.items.data[0]

  return {
    subscriptionId: subscription.id,
    clientSecret: invoice?.confirmation_secret?.client_secret ?? null,
    status: subscription.status,
    currentPeriodEnd: firstItem.current_period_end,
  }
}

// ── Customer Portal ─────────────────────────────────────────────────────────

export interface CreatePortalSessionInput {
  customerId: string
  returnUrl: string
}

export async function createPortalSession(
  input: CreatePortalSessionInput,
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripeClient()

  return stripe.billingPortal.sessions.create({
    customer: input.customerId,
    return_url: input.returnUrl,
  })
}

// ── Subscription Checkout Session (Stripe-hosted page) ─────────────────────

export interface CreateSubscriptionCheckoutSessionInput {
  priceId: string
  orgId: string
  customerId?: string
  ventureId?: string
  successUrl: string
  cancelUrl: string
  trialDays?: number
  metadata?: Record<string, string>
}

/**
 * Create a Stripe Checkout Session in subscription mode.
 * Returns a session URL for the user to be redirected to.
 * After payment, Stripe redirects to successUrl with ?session_id=...
 */
export async function createSubscriptionCheckoutSession(
  input: CreateSubscriptionCheckoutSessionInput,
): Promise<{ sessionId: string; url: string }> {
  const stripe = getStripeClient()

  const metadata = {
    org_id: input.orgId,
    ...(input.ventureId && { venture_id: input.ventureId }),
    ...input.metadata,
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: input.priceId, quantity: 1 }],
    ...(input.customerId && { customer: input.customerId }),
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    ...(input.trialDays && {
      subscription_data: { trial_period_days: input.trialDays, metadata },
    }),
    ...(!input.trialDays && {
      subscription_data: { metadata },
    }),
    metadata: metadata as Stripe.MetadataParam,
  })

  return { sessionId: session.id, url: session.url! }
}

// ── Customer Session (for embedded components) ──────────────────────────────

export interface CreateCustomerSessionInput {
  customerId: string
}

export async function createCustomerSession(
  input: CreateCustomerSessionInput,
): Promise<Stripe.CustomerSession> {
  const stripe = getStripeClient()

  return stripe.customerSessions.create({
    customer: input.customerId,
    components: {
      payment_element: {
        enabled: true,
        features: {
          payment_method_redisplay: 'enabled',
          payment_method_save: 'enabled',
          payment_method_save_usage: 'off_session',
          payment_method_remove: 'enabled',
        },
      },
    },
  })
}

