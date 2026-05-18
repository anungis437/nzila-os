/**
 * Feature Flag Service
 * 
 * Centralized feature flag evaluation for LRO progressive rollout.
 * 
 * Use cases:
 * - Progressive rollout (5% → 25% → 50% → 100%)
 * - A/B testing (control vs. treatment groups)
 * - Organization-specific pilot programs
 * - User preference toggles
 * - Emergency kill switches
 * 
 * @example
 * ```typescript
 * // Check if LRO signals UI is enabled for user
 * const hasSignalsUI = await isFeatureEnabled('lro_signals_ui', {
 *   userId: 'user_123',
 *   organizationId: 'org_456'
 * });
 * 
 * // Get configuration for auto-refresh feature
 * const config = await getFeatureConfig('auto_refresh_dashboard', {
 *   userId: 'user_123'
 * });
 * ```
 */

import { db } from '@/db/db';
import { featureFlags, type FeatureFlag } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { LRO_FEATURES as _LRO, AI_FEATURES as _AI } from './feature-flags.constants';

/**
 * Context for feature flag evaluation
 */
export interface FeatureFlagContext {
  userId?: string;
  organizationId?: string;
  localNumber?: string;
  userRole?: string;
  customAttributes?: Record<string, unknown>;
}

/**
 * Feature flag evaluation result
 */
export interface FeatureFlagResult {
  enabled: boolean;
  variant?: 'control' | 'treatment';
  config?: Record<string, unknown>;
  reason: string; // Why this result was returned (for debugging)
}

export { LRO_FEATURES, AI_FEATURES } from './feature-flags.constants';

/**
 * Default configurations for LRO features
 */
const FEATURE_DEFAULTS: Record<string, Record<string, unknown>> = {
  [_LRO.AUTO_REFRESH]: {
    intervalMs: 60000, // 1 minute
    enabledByDefault: true,
    minIntervalMs: 30000,
    maxIntervalMs: 300000,
  },
  [_LRO.DASHBOARD_WIDGET]: {
    maxSignalsToShow: 10,
    showCriticalOnly: false,
    groupBySeverity: true,
  },
  [_LRO.CASE_LIST_FILTERS]: {
    defaultFilter: 'all',
    enabledFilters: ['severity', 'state', 'search'],
    defaultSort: 'severity_desc',
  },
  [_LRO.SIGNALS_UI]: {
    showBadges: true,
    showDots: true,
    expandDetailsOnClick: true,
  },
};

/**
 * Check if a feature is enabled for a given context
 * 
 * Evaluation order:
 * 1. Global kill switch (always disabled if active)
 * 2. User-specific override
 * 3. Organization-specific override
 * 4. Percentage-based rollout
 * 5. Global enabled flag
 */
export async function isFeatureEnabled(
  featureName: string,
  context: FeatureFlagContext = {}
): Promise<boolean> {
  const result = await evaluateFeature(featureName, context);
  return result.enabled;
}

/**
 * Get feature configuration
 * 
 * Returns default config merged with any overrides.
 */
export async function getFeatureConfig(
  featureName: string,
  context: FeatureFlagContext = {}
): Promise<Record<string, unknown>> {
  const result = await evaluateFeature(featureName, context);
  
  if (!result.enabled) {
    return {};
  }
  
  return {
    ...FEATURE_DEFAULTS[featureName],
    ...result.config,
  };
}

/**
 * Evaluate a feature flag with full context
 * 
 * Returns detailed result including reason for debugging.
 */
export async function evaluateFeature(
  featureName: string,
  context: FeatureFlagContext = {}
): Promise<FeatureFlagResult> {
  try {
    // Fetch feature flag from database
    const flag = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.name, featureName),
    });
    
    // Feature doesn&apos;t exist → disabled by default
    if (!flag) {
      return {
        enabled: false,
        reason: 'Feature flag not found in database',
      };
    }
    
    // Global enabled check
    if (!flag.enabled) {
      return {
        enabled: false,
        reason: 'Feature globally disabled',
      };
    }
    
    // Evaluate based on flag type
    switch (flag.type) {
      case 'boolean':
        return evaluateBooleanFlag(flag);
      
      case 'percentage':
        return evaluatePercentageFlag(flag, context);
      
      case 'tenant':
        return evaluateOrgFlag(flag, context);
      
      case 'user':
        return evaluateUserFlag(flag, context);
      
      default:
        return {
          enabled: false,
          reason: `Unknown flag type: ${flag.type}`,
        };
    }
  } catch (error) {
    logger.error('Feature flag evaluation error', { error, featureName });
    // Fail safe: disable feature on error
    return {
      enabled: false,
      reason: `Evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Evaluate boolean flag (simple on/off)
 */
function evaluateBooleanFlag(flag: FeatureFlag): FeatureFlagResult {
  return {
    enabled: flag.enabled,
    reason: 'Boolean flag enabled globally',
  };
}

/**
 * Evaluate percentage-based rollout
 * 
 * Uses deterministic hashing to ensure consistent results for same user.
 */
function evaluatePercentageFlag(
  flag: FeatureFlag,
  context: FeatureFlagContext
): FeatureFlagResult {
  if (!flag.percentage) {
    return {
      enabled: false,
      reason: 'Percentage not configured',
    };
  }
  
  // Need userId for consistent hashing
  if (!context.userId) {
    return {
      enabled: false,
      reason: 'UserId required for percentage rollout',
    };
  }
  
  // Deterministic hash: userId + featureName → 0-99
  const hash = hashString(`${context.userId}:${flag.name}`);
  const bucket = hash % 100;
  
  const enabled = bucket < flag.percentage;
  
  return {
    enabled,
    reason: enabled 
      ? `User in rollout (${flag.percentage}% bucket)`
      : `User outside rollout (${flag.percentage}% bucket)`,
  };
}

/**
 * Evaluate org/organization-specific flag
 */
function evaluateOrgFlag(
  flag: FeatureFlag,
  context: FeatureFlagContext
): FeatureFlagResult {
  const allowedOrgs = flag.allowedOrganizations as string[] | null;
  
  if (!allowedOrgs || allowedOrgs.length === 0) {
    return {
      enabled: false,
      reason: 'No organizations configured',
    };
  }
  
  if (!context.organizationId) {
    return {
      enabled: false,
      reason: 'OrganizationId required for org flag',
    };
  }
  
  const enabled = allowedOrgs.includes(context.organizationId);
  
  return {
    enabled,
    reason: enabled
      ? 'Organization in allowlist'
      : 'Organization not in allowlist',
  };
}

/**
 * Evaluate user-specific flag
 */
function evaluateUserFlag(
  flag: FeatureFlag,
  context: FeatureFlagContext
): FeatureFlagResult {
  const allowedUsers = flag.allowedUsers as string[] | null;
  
  if (!allowedUsers || allowedUsers.length === 0) {
    return {
      enabled: false,
      reason: 'No users configured',
    };
  }
  
  if (!context.userId) {
    return {
      enabled: false,
      reason: 'UserId required for user flag',
    };
  }
  
  const enabled = allowedUsers.includes(context.userId);
  
  return {
    enabled,
    reason: enabled
      ? 'User in allowlist'
      : 'User not in allowlist',
  };
}

/**
 * Simple deterministic hash function
 * 
 * Returns integer 0-2^32
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Bulk evaluate multiple features
 * 
 * More efficient than multiple individual calls.
 */
export async function evaluateFeatures(
  featureNames: string[],
  context: FeatureFlagContext = {}
): Promise<Record<string, boolean>> {
  const results = await Promise.all(
    featureNames.map(name => evaluateFeature(name, context))
  );
  
  return featureNames.reduce((acc, name, index) => {
    acc[name] = results[index].enabled;
    return acc;
  }, {} as Record<string, boolean>);
}

/**
 * Get all enabled features for a context
 * 
 * Useful for debugging and feature discovery.
 */
export async function getEnabledFeatures(
  context: FeatureFlagContext = {}
): Promise<string[]> {
  const allFlags = await db.query.featureFlags.findMany({
    where: eq(featureFlags.enabled, true),
  });
  
  const evaluations = await Promise.all(
    allFlags.map(flag => evaluateFeature(flag.name, context))
  );
  
  return allFlags
    .filter((_, index) => evaluations[index].enabled)
    .map(flag => flag.name);
}

/**
 * Admin function: Create or update feature flag
 */
export async function upsertFeatureFlag(
  name: string,
  config: {
    type: 'boolean' | 'percentage' | 'tenant' | 'user';
    enabled: boolean;
    description?: string;
    percentage?: number;
    allowedOrgs?: string[];
    allowedUsers?: string[];
    tags?: string[];
  },
  actorId: string
): Promise<FeatureFlag> {
  const existing = await db.query.featureFlags.findFirst({
    where: eq(featureFlags.name, name),
  });
  
  if (existing) {
    // Update existing flag
    const [updated] = await db
      .update(featureFlags)
      .set({
        ...config,
        updatedAt: new Date(),
        lastModifiedBy: actorId,
      })
      .where(eq(featureFlags.id, existing.id))
      .returning();
    
    return updated;
  } else {
    // Create new flag
    const [created] = await db
      .insert(featureFlags)
      .values({
        name,
        ...config,
        createdBy: actorId,
        lastModifiedBy: actorId,
      })
      .returning();
    
    return created;
  }
}

/**
 * Admin function: Enable feature flag
 */
export async function enableFeature(
  featureName: string,
  actorId: string
): Promise<void> {
  await db
    .update(featureFlags)
    .set({
      enabled: true,
      updatedAt: new Date(),
      lastModifiedBy: actorId,
    })
    .where(eq(featureFlags.name, featureName));
}

/**
 * Admin function: Disable feature flag (kill switch)
 */
export async function disableFeature(
  featureName: string,
  actorId: string
): Promise<void> {
  await db
    .update(featureFlags)
    .set({
      enabled: false,
      updatedAt: new Date(),
      lastModifiedBy: actorId,
    })
    .where(eq(featureFlags.name, featureName));
}

/**
 * Admin function: Set percentage rollout
 */
export async function setRolloutPercentage(
  featureName: string,
  percentage: number,
  actorId: string
): Promise<void> {
  if (percentage < 0 || percentage > 100) {
    throw new Error('Percentage must be between 0 and 100');
  }
  
  await db
    .update(featureFlags)
    .set({
      type: 'percentage',
      percentage,
      updatedAt: new Date(),
      lastModifiedBy: actorId,
    })
    .where(eq(featureFlags.name, featureName));
}

/**
 * Admin function: Add organization to pilot
 */
export async function addOrganizationToPilot(
  featureName: string,
  organizationId: string,
  actorId: string
): Promise<void> {
  const flag = await db.query.featureFlags.findFirst({
    where: eq(featureFlags.name, featureName),
  });
  
  if (!flag) {
    throw new Error(`Feature flag not found: ${featureName}`);
  }
  
  const allowedOrganizations = (flag.allowedOrganizations as string[] | null) || [];
  
  if (!allowedOrganizations.includes(organizationId)) {
    allowedOrganizations.push(organizationId);
    
    await db
      .update(featureFlags)
      .set({
        type: 'tenant',
        allowedOrganizations,
        updatedAt: new Date(),
        lastModifiedBy: actorId,
      })
      .where(eq(featureFlags.id, flag.id));
  }
}

/**
 * Admin function: Remove organization from pilot
 */
export async function removeOrganizationFromPilot(
  featureName: string,
  organizationId: string,
  actorId: string
): Promise<void> {
  const flag = await db.query.featureFlags.findFirst({
    where: eq(featureFlags.name, featureName),
  });
  
  if (!flag) {
    throw new Error(`Feature flag not found: ${featureName}`);
  }
  
  const allowedOrganizations = (flag.allowedOrganizations as string[] | null) || [];
  const filtered = allowedOrganizations.filter(id => id !== organizationId);
  
  await db
    .update(featureFlags)
    .set({
      allowedOrganizations: filtered,
      updatedAt: new Date(),
      lastModifiedBy: actorId,
    })
    .where(eq(featureFlags.id, flag.id));
}

