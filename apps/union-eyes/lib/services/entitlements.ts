/**
 * Entitlements Service
 * 
 * Enforces subscription-tier-based feature access and credit consumption.
 * This is the core of the monetization gating system.
 * 
 * Usage:
 * ```typescript
 * import { checkEntitlement, getOrganizationCredits } from '@/lib/services/entitlements';
 * 
 * // Check if feature is allowed
 * const result = await checkEntitlement(orgId, 'ai_summarize');
 * if (!result.allowed) {
 *   return { error: 'Upgrade required', upgradeUrl: '/pricing' };
 * }
 * ```
 *
 * Credits are read, never spent: nothing in the application consumes, adds or resets them, so the credit check below can only fail for an
 * organization whose settings were given a balance of zero or less. (A spending path existed and was removed with UE-CONV-H-019: it had no caller, and
 * every one of its writes replaced the organization's whole settings document with the credit counter.)
 */

import { withRLSContext } from '@/lib/db/with-rls-context';
import { organizations } from '@/db/schema-organizations';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

/** All available features that can be gated */
export type GatedFeature =
  // AI Features
  | 'ai_search'
  | 'ai_summarize'
  | 'ai_classify'
  | 'ai_extract_clauses'
  | 'ai_match_precedents'
  | 'ai_semantic_search'
  | 'ai_mamba'
  | 'ai_feedback'
  | 'ai_ingest'
  | 'voice_transcription'
  // Advanced Features
  | 'advanced_analytics'
  | 'predictive_models'
  | 'custom_workflows'
  | 'api_access'
  | 'webhooks'
  | 'bulk_export'
  | 'third_party_integrations';

/** Subscription tier levels */
export type SubscriptionTier = 'free' | 'basic' | 'professional' | 'enterprise';

/** Result of an entitlement check */
export interface EntitlementCheck {
  allowed: boolean;
  feature: GatedFeature;
  tier: SubscriptionTier;
  reason?: string;
  upgradeUrl?: string;
  currentCredits?: number;
}

/** Credit balance information */
export interface CreditBalance {
  organizationId: string;
  credits: number;
  tier: SubscriptionTier;
  renewalDate?: Date;
}

// ============================================================================
// TIER-TO-FEATURE MAPPING
// ============================================================================

/**
 * Defines which features are available at each subscription tier.
 * Order matters: higher tiers include all features from lower tiers.
 */
export const TIER_FEATURES: Record<SubscriptionTier, GatedFeature[]> = {
  free: [
    // Limited AI access - just enough to demo
    'ai_search',
  ],
  basic: [
    'ai_search',
    'ai_summarize',
    'ai_classify',
  ],
  professional: [
    'ai_search',
    'ai_summarize',
    'ai_classify',
    'ai_extract_clauses',
    'ai_match_precedents',
    'ai_semantic_search',
    'voice_transcription',
    'advanced_analytics',
    'api_access',
  ],
  enterprise: [
    // All features including expensive ones
    'ai_search',
    'ai_summarize',
    'ai_classify',
    'ai_extract_clauses',
    'ai_match_precedents',
    'ai_semantic_search',
    'ai_mamba',
    'ai_feedback',
    'ai_ingest',
    'voice_transcription',
    'advanced_analytics',
    'predictive_models',
    'custom_workflows',
    'api_access',
    'webhooks',
    'bulk_export',
    'third_party_integrations',
  ],
};

/** Features that require credits (consumed per use) */
export const CREDIT_REQUIRING_FEATURES: GatedFeature[] = [
  'ai_search',
  'ai_summarize',
  'ai_classify',
  'ai_extract_clauses',
  'ai_match_precedents',
  'ai_semantic_search',
  'ai_mamba',
  'voice_transcription',
];

/** Credit cost per feature use */
export const CREDIT_COSTS: Record<GatedFeature, number> = {
  ai_search: 1,
  ai_summarize: 2,
  ai_classify: 2,
  ai_extract_clauses: 3,
  ai_match_precedents: 3,
  ai_semantic_search: 2,
  ai_mamba: 5,
  ai_feedback: 0, // Free - encourages improvement
  ai_ingest: 0,   // Free - data ingestion is valuable
  voice_transcription: 1, // actual debit is per provider-reported started minute
  advanced_analytics: 2,
  predictive_models: 5,
  custom_workflows: 1,
  api_access: 0,  // Included in tier
  webhooks: 0,
  bulk_export: 1,
  third_party_integrations: 1,
};

// ============================================================================
// CREDIT ALLOCATION BY TIER
// ============================================================================

/** Monthly credits allocated per tier (0 means unlimited for enterprise) */
export const TIER_CREDITS: Record<SubscriptionTier, number> = {
  free: 5,
  basic: 50,
  professional: 200,
  enterprise: 0, // Unlimited
};

// ============================================================================
// ENTITLEMENT CHECK
// ============================================================================

/**
 * Check if an organization has access to a specific feature.
 * 
 * @param organizationId - The organization to check
 * @param feature - The feature being accessed
 * @returns EntitlementCheck with allowed status and details
 */
export async function checkEntitlement(
  organizationId: string,
  feature: GatedFeature
): Promise<EntitlementCheck> {
  try {
    // Get organization's subscription tier
    const org = await withRLSContext({ organizationId }, (tx) =>
      tx.query.organizations.findFirst({
        where: eq(organizations.id, organizationId),
        columns: {
          subscriptionTier: true,
          featuresEnabled: true,
        },
      }),
    );

    if (!org) {
      logger.warn('Entitlement check for unknown organization', { organizationId, feature });
      return {
        allowed: false,
        feature,
        tier: 'free',
        reason: 'Organization not found',
      };
    }

    const tier = (org.subscriptionTier as SubscriptionTier) || 'free';
    
    // Check if feature is in the tier's allowed list
    const allowedFeatures = TIER_FEATURES[tier];
    const isAllowed = allowedFeatures.includes(feature);

    if (!isAllowed) {
      const nextTier = getNextTier(tier);
      return {
        allowed: false,
        feature,
        tier,
        reason: `Feature "${feature}" requires ${nextTier} tier or higher`,
        upgradeUrl: `/pricing?feature=${feature}&current_tier=${tier}`,
      };
    }

    // For credit-requiring features, check credit balance
    if (CREDIT_REQUIRING_FEATURES.includes(feature)) {
      const balance = await getOrganizationCredits(organizationId);
      
      if (balance.tier !== 'enterprise' && balance.credits <= 0) {
        return {
          allowed: false,
          feature,
          tier,
          reason: 'Insufficient credits. Please upgrade or purchase credits.',
          upgradeUrl: '/pricing?tab=credits',
          currentCredits: 0,
        };
      }

      return {
        allowed: true,
        feature,
        tier,
        currentCredits: balance.credits,
      };
    }

    return {
      allowed: true,
      feature,
      tier,
    };
  } catch (error) {
    logger.error('Entitlement check failed', error instanceof Error ? error : new Error(String(error)), {
      organizationId,
      feature,
    });
    
    // Fail-secure: deny on error
    return {
      allowed: false,
      feature,
      tier: 'free',
      reason: 'Error checking entitlements. Please try again.',
    };
  }
}

/**
 * Check multiple features at once
 */
export async function checkEntitlements(
  organizationId: string,
  features: GatedFeature[]
): Promise<{
  allAllowed: boolean;
  results: EntitlementCheck[];
}> {
  const results = await Promise.all(
    features.map(feature => checkEntitlement(organizationId, feature))
  );
  
  return {
    allAllowed: results.every(r => r.allowed),
    results,
  };
}

// ============================================================================
// CREDIT MANAGEMENT
// ============================================================================

/**
 * Get the current credit balance for an organization
 */
export async function getOrganizationCredits(
  organizationId: string
): Promise<CreditBalance> {
  const org = await withRLSContext({ organizationId }, (tx) =>
    tx.query.organizations.findFirst({
      where: eq(organizations.id, organizationId),
      columns: {
        subscriptionTier: true,
        settings: true,
      },
    }),
  );

  const tier = ((org?.subscriptionTier) as SubscriptionTier) || 'free';

  // Enterprise has unlimited credits
  if (tier === 'enterprise') {
    return {
      organizationId,
      credits: 0, // 0 means unlimited
      tier: 'enterprise',
    };
  }

  // Get credits from settings or use tier default
  const settings = (org?.settings as Record<string, unknown>) || {};
  const credits = (settings.credits as number) ?? TIER_CREDITS[tier];
  const renewalDate = settings.nextCreditRenewal 
    ? new Date(settings.nextCreditRenewal as string)
    : getNextRenewalDate();

  return {
    organizationId,
    credits,
    tier,
    renewalDate,
  };
}


// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the next tier up from current tier
 */
function getNextTier(current: SubscriptionTier): SubscriptionTier {
  const tierOrder: SubscriptionTier[] = ['free', 'basic', 'professional', 'enterprise'];
  const currentIndex = tierOrder.indexOf(current);
  if (currentIndex >= tierOrder.length - 1) {
    return 'enterprise';
  }
  return tierOrder[currentIndex + 1];
}

/**
 * Get the next credit renewal date (28 days from now)
 */
function getNextRenewalDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 28);
  return date;
}

/**
 * Check if a feature requires credits
 */
export function featureRequiresCredits(feature: GatedFeature): boolean {
  return CREDIT_REQUIRING_FEATURES.includes(feature);
}

/**
 * Get the credit cost for a feature
 */
export function getCreditCost(feature: GatedFeature): number {
  return CREDIT_COSTS[feature] || 0;
}

/**
 * Get all available features for a tier
 */
export function getFeaturesForTier(tier: SubscriptionTier): GatedFeature[] {
  return TIER_FEATURES[tier];
}

/**
 * Check if organization has any paid features
 */
export function isPaidTier(tier: SubscriptionTier): boolean {
  return tier !== 'free';
}
