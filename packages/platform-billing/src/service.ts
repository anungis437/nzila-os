import { z } from 'zod';
import type {
  Subscription,
  Entitlement,
  PlanTier,
} from '@nzila/platform-contracts/entitlement';
import { planTierValues } from '@nzila/platform-contracts/entitlement';

// ---------------------------------------------------------------------------
// Service inputs
// ---------------------------------------------------------------------------

export const createSubscriptionInputSchema = z.object({
  orgId: z.string().min(1),
  plan: z.enum(planTierValues),
  status: z.enum(['active', 'trialing', 'past_due', 'canceled', 'paused']).optional(),
  currentPeriodStart: z.string().datetime().optional(),
  currentPeriodEnd: z.string().datetime().optional(),
  externalId: z.string().optional(),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionInputSchema>;

export const checkEntitlementInputSchema = z.object({
  orgId: z.string().min(1),
  featureKey: z.string().min(1),
});

export type CheckEntitlementInput = z.infer<typeof checkEntitlementInputSchema>;

// ---------------------------------------------------------------------------
// Billing service interface
// ---------------------------------------------------------------------------

export interface BillingService {
  /** Get the active subscription for an org. */
  getSubscription(orgId: string): Promise<Subscription | null>;

  /** Create or update a subscription. */
  upsertSubscription(input: CreateSubscriptionInput): Promise<Subscription>;

  /** Check whether an org has access to a specific feature. */
  checkEntitlement(orgId: string, featureKey: string): Promise<Entitlement>;

  /** List all entitlements for an org's active plan. */
  listEntitlements(orgId: string): Promise<Entitlement[]>;

  /** Check if a module is available for the org's tier. */
  canAccessModule(orgId: string, moduleId: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Default entitlement definitions per tier
// ---------------------------------------------------------------------------

const TIER_ENTITLEMENTS: Record<PlanTier, string[]> = {
  free: ['dashboard', 'basic_reports'],
  starter: ['dashboard', 'basic_reports', 'document_generation', 'email_notifications'],
  professional: [
    'dashboard',
    'basic_reports',
    'document_generation',
    'email_notifications',
    'advanced_analytics',
    'api_access',
    'custom_workflows',
  ],
  enterprise: [
    'dashboard',
    'basic_reports',
    'document_generation',
    'email_notifications',
    'advanced_analytics',
    'api_access',
    'custom_workflows',
    'sso',
    'audit_trail',
    'custom_branding',
    'priority_support',
  ],
  custom: [
    'dashboard',
    'basic_reports',
    'document_generation',
    'email_notifications',
    'advanced_analytics',
    'api_access',
    'custom_workflows',
    'sso',
    'audit_trail',
    'custom_branding',
    'priority_support',
  ],
};

// ---------------------------------------------------------------------------
// In-memory implementation (dev / testing)
// ---------------------------------------------------------------------------

export function createInMemoryBillingService(): BillingService {
  const subscriptions = new Map<string, Subscription>();

  return {
    async getSubscription(orgId) {
      return subscriptions.get(orgId) ?? null;
    },

    async upsertSubscription(input) {
      const parsed = createSubscriptionInputSchema.parse(input);
      const now = new Date();
      const currentPeriodStart = parsed.currentPeriodStart ?? now.toISOString();
      const currentPeriodEnd =
        parsed.currentPeriodEnd ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const entitlements: Entitlement[] = TIER_ENTITLEMENTS[parsed.plan].map((key) => ({
        key,
        active: true,
      }));

      const sub: Subscription = {
        id: crypto.randomUUID(),
        orgId: parsed.orgId,
        plan: parsed.plan,
        status: parsed.status ?? 'active',
        entitlements,
        enabledModules: [...TIER_ENTITLEMENTS[parsed.plan]],
        currentPeriodStart,
        currentPeriodEnd,
        externalId: parsed.externalId,
      };
      subscriptions.set(parsed.orgId, sub);
      return sub;
    },

    async checkEntitlement(orgId, featureKey) {
      const sub = subscriptions.get(orgId);
      if (!sub || sub.status !== 'active') {
        return { key: featureKey, active: false };
      }
      const active = TIER_ENTITLEMENTS[sub.plan].includes(featureKey);
      return {
        key: featureKey,
        active,
      };
    },

    async listEntitlements(orgId) {
      const sub = subscriptions.get(orgId);
      if (!sub || sub.status !== 'active') return [];
      return sub.entitlements;
    },

    async canAccessModule(orgId, moduleId) {
      const ent = await this.checkEntitlement(orgId, moduleId);
      return ent.active;
    },
  };
}
