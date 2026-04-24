import { z } from 'zod'

export const BILLING_WEBHOOK_EVENTS = {
  CHECKOUT_COMPLETED: 'checkout.session.completed',
  PAYMENT_FAILED: 'invoice.payment_failed',
  SUBSCRIPTION_UPDATED: 'customer.subscription.updated',
  SUBSCRIPTION_CANCELED: 'customer.subscription.deleted',
} as const

export type BillingWebhookEventType = (typeof BILLING_WEBHOOK_EVENTS)[keyof typeof BILLING_WEBHOOK_EVENTS]

export const billingWebhookEventSchema = z.object({
  type: z.string().min(1),
  orgId: z.string().min(1).optional(),
  customerId: z.string().min(1).optional(),
  subscriptionId: z.string().min(1).optional(),
  priceId: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  currentPeriodEnd: z.string().datetime().optional(),
})

export type BillingWebhookEventInput = z.infer<typeof billingWebhookEventSchema>

export function classifyBillingWebhook(eventType: string):
  | 'checkout_completed'
  | 'payment_failed'
  | 'subscription_updated'
  | 'subscription_canceled'
  | 'ignored' {
  if (eventType === BILLING_WEBHOOK_EVENTS.CHECKOUT_COMPLETED) return 'checkout_completed'
  if (eventType === BILLING_WEBHOOK_EVENTS.PAYMENT_FAILED) return 'payment_failed'
  if (eventType === BILLING_WEBHOOK_EVENTS.SUBSCRIPTION_UPDATED) return 'subscription_updated'
  if (eventType === BILLING_WEBHOOK_EVENTS.SUBSCRIPTION_CANCELED) return 'subscription_canceled'
  return 'ignored'
}
