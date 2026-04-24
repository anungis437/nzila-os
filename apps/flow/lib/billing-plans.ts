export type FlowBillingPlan = 'starter' | 'growth' | 'pro'
export type BillingInterval = 'monthly' | 'annual'

export interface FlowPlanDefinition {
  id: FlowBillingPlan
  name: string
  monthlyCad: number
  annualCad: number
  maxUsers: number
  features: string[]
}

export const FLOW_BILLING_PLANS: FlowPlanDefinition[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyCad: 39,
    annualCad: 390,
    maxUsers: 5,
    features: ['Core workflow automation', 'Quote and invoice essentials', 'Email support'],
  },
  {
    id: 'growth',
    name: 'Growth',
    monthlyCad: 149,
    annualCad: 1490,
    maxUsers: 25,
    features: ['Advanced analytics', 'Automation reminders', 'Priority support'],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyCad: 329,
    annualCad: 3290,
    maxUsers: 150,
    features: ['Multi-team governance', 'API and webhook controls', 'Dedicated success manager'],
  },
]

export function getFlowPlan(plan: FlowBillingPlan): FlowPlanDefinition {
  const match = FLOW_BILLING_PLANS.find((entry) => entry.id === plan)
  if (!match) {
    throw new Error(`Unknown plan: ${plan}`)
  }
  return match
}

export function planPriceCad(plan: FlowBillingPlan, interval: BillingInterval): number {
  const definition = getFlowPlan(plan)
  return interval === 'annual' ? definition.annualCad : definition.monthlyCad
}

export function toCheckoutUrl(params: {
  baseUrl: string
  orgId: string
  plan: FlowBillingPlan
  interval: BillingInterval
}): string {
  const query = new URLSearchParams({
    orgId: params.orgId,
    plan: params.plan,
    interval: params.interval,
  })

  return `${params.baseUrl.replace(/\/$/, '')}/billing/checkout?${query.toString()}`
}
