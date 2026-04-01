import { z } from 'zod';
import type {
  Subscription,
  Entitlement,
  PlanTier,
  SubscriptionStatus,
} from '@nzila/platform-contracts/entitlement';

// ---------------------------------------------------------------------------
// Service inputs
// ---------------------------------------------------------------------------

export const createSubscriptionInputSchema = z.object({
  orgId: z.string().min(1),
  planTier: z.enum(['free', 'starter', 'professional', 'enterprise', 'government']),
  billingEmail: z.string().email(),
  startDate: z.string().datetime().optional(),
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
  government: [
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
    'data_residency',
    'compliance_reports',
    'sovereign_hosting',
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
      const sub: Subscription = {
        id: crypto.randomUUID(),
        orgId: parsed.orgId,
        planTier: parsed.planTier,
        status: 'active' as SubscriptionStatus,
        billingEmail: parsed.billingEmail,
        startDate: parsed.startDate ?? new Date().toISOString(),
        features: TIER_ENTITLEMENTS[parsed.planTier],
      };
      subscriptions.set(parsed.orgId, sub);
      return sub;
    },

    async checkEntitlement(orgId, featureKey) {
      const sub = subscriptions.get(orgId);
      if (!sub || sub.status !== 'active') {
        return { featureKey, enabled: false, reason: 'no_active_subscription' };
      }
      const enabled = TIER_ENTITLEMENTS[sub.planTier].includes(featureKey);
      return {
        featureKey,
        enabled,
        reason: enabled ? undefined : 'not_in_plan',
      };
    },

    async listEntitlements(orgId) {
      const sub = subscriptions.get(orgId);
      if (!sub || sub.status !== 'active') return [];
      return TIER_ENTITLEMENTS[sub.planTier].map((featureKey) => ({
        featureKey,
        enabled: true,
      }));
    },

    async canAccessModule(orgId, moduleId) {
      const ent = await this.checkEntitlement(orgId, moduleId);
      return ent.enabled;
    },
  };
}
