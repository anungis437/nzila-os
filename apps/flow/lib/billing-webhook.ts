export type FlowPlan = 'starter' | 'growth' | 'pro'

export function mapStripeSubscriptionStatus(status: string): string {
  const mapped: Record<string, string> = {
    active: 'active',
    trialing: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
    unpaid: 'past_due',
    paused: 'canceled',
  }
  return mapped[status] ?? 'incomplete'
}

export function mapFlowPlanFromPriceId(priceId?: string | null): FlowPlan | null {
  if (!priceId) return null

  const starter = [process.env.STRIPE_FLOW_STARTER_MONTHLY_PRICE_ID, process.env.STRIPE_FLOW_STARTER_ANNUAL_PRICE_ID]
  const growth = [process.env.STRIPE_FLOW_GROWTH_MONTHLY_PRICE_ID, process.env.STRIPE_FLOW_GROWTH_ANNUAL_PRICE_ID]
  const pro = [process.env.STRIPE_FLOW_PRO_MONTHLY_PRICE_ID, process.env.STRIPE_FLOW_PRO_ANNUAL_PRICE_ID]

  if (starter.includes(priceId)) return 'starter'
  if (growth.includes(priceId)) return 'growth'
  if (pro.includes(priceId)) return 'pro'
  return null
}

export function isUuid(value?: string | null): value is string {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
