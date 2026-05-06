import {
  getTrustcoreSubscription,
  upsertTrustcoreSubscription,
} from '@nzila/db/queries/trustcore'
import {
  createBillingService,
  type BillingService,
  type CreateSubscriptionInput,
} from '@nzila/platform-billing'
import type {
  Entitlement,
  PlanTier,
  Subscription,
  SubscriptionStatus,
} from '@nzila/platform-contracts/entitlement'

type TrustcorePlan = 'free' | 'pro' | 'premium'
type TrustcoreStatus = 'active' | 'trialing' | 'past_due' | 'canceled'

const FEATURES_BY_PLAN: Record<TrustcorePlan, string[]> = {
  free: [],
  pro: ['audit_export', 'evidence_export', 'trust_center', 'reminders'],
  premium: ['audit_export', 'evidence_export', 'trust_center', 'reminders'],
}

function mapTrustcorePlanToPlatform(plan: TrustcorePlan): PlanTier {
  switch (plan) {
    case 'free':
      return 'free'
    case 'pro':
      return 'professional'
    case 'premium':
      return 'enterprise'
  }
}

function mapPlatformPlanToTrustcore(plan: PlanTier): TrustcorePlan {
  switch (plan) {
    case 'professional':
      return 'pro'
    case 'enterprise':
    case 'custom':
      return 'premium'
    case 'free':
    case 'starter':
      return 'free'
  }
}

function mapStatus(status: string | null | undefined): SubscriptionStatus {
  switch (status) {
    case 'active':
    case 'trialing':
    case 'past_due':
    case 'canceled':
    case 'paused':
      return status
    default:
      return 'active'
  }
}

function toEntitlements(plan: TrustcorePlan, active: boolean): Entitlement[] {
  return FEATURES_BY_PLAN[plan].map((key) => ({ key, active }))
}

function toPlatformSubscription(record: NonNullable<Awaited<ReturnType<typeof getTrustcoreSubscription>>>): Subscription {
  const status = mapStatus(record.status)
  const active = status === 'active' || status === 'trialing'
  const currentPeriodStart = record.currentPeriodStart?.toISOString() ?? new Date().toISOString()
  const currentPeriodEnd = record.currentPeriodEnd?.toISOString() ?? currentPeriodStart

  return {
    id: record.id,
    orgId: record.orgId,
    plan: mapTrustcorePlanToPlatform(record.plan as TrustcorePlan),
    status,
    entitlements: toEntitlements(record.plan as TrustcorePlan, active),
    enabledModules: ['trustcore'],
    currentPeriodStart,
    currentPeriodEnd,
    externalId: record.stripeSubscriptionId ?? undefined,
  }
}

const trustcoreBillingServiceImpl: BillingService = {
  async getSubscription(orgId) {
    const record = await getTrustcoreSubscription(orgId)
    return record ? toPlatformSubscription(record) : null
  },

  async upsertSubscription(input: CreateSubscriptionInput) {
    const record = await upsertTrustcoreSubscription({
      orgId: input.orgId,
      plan: mapPlatformPlanToTrustcore(input.plan),
      status: mapStatus(input.status) as TrustcoreStatus,
      currentPeriodStart: input.currentPeriodStart ? new Date(input.currentPeriodStart) : undefined,
      currentPeriodEnd: input.currentPeriodEnd ? new Date(input.currentPeriodEnd) : undefined,
      stripeSubscriptionId: input.externalId,
    })

    return toPlatformSubscription(record)
  },

  async checkEntitlement(orgId, featureKey) {
    const subscription = await this.getSubscription(orgId)
    if (!subscription) {
      return { key: featureKey, active: false }
    }

    const entitlement = subscription.entitlements.find((entry) => entry.key === featureKey)
    return { key: featureKey, active: entitlement?.active ?? false }
  },

  async listEntitlements(orgId) {
    const subscription = await this.getSubscription(orgId)
    return subscription?.entitlements ?? []
  },

  async canAccessModule(orgId, moduleId) {
    const subscription = await this.getSubscription(orgId)
    return subscription?.enabledModules.includes(moduleId) ?? false
  },
}

const trustcoreBillingService = createBillingService({
  mode: 'external',
  externalService: trustcoreBillingServiceImpl,
})

export function getTrustcoreBillingService(): BillingService {
  return trustcoreBillingService
}
