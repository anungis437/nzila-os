/**
 * Feature Flags Service
 * 
 * Centralized feature flag management for gradual rollout and A/B testing.
 * Supports environment-based flags, org/user overrides, and percentage rollouts.
 * 
 * Features:
 * - Boolean flags (simple on/off)
 * - Percentage-based rollouts (gradual activation)
 * - Organization-specific overrides
 * - User-specific overrides
 * - Environment variable defaults
 * - Fallback to defaults when service unavailable
 * 
 * Usage:
 * ```typescript
 * import { isFeatureEnabled } from '@/lib/services/feature-flags-service';
 * 
 * if (await isFeatureEnabled('ai-chatbot', { userId, organizationId })) {
 *   // Show AI chatbot feature
 * }
 * ```
 */

import { db } from '@/db/db';
import { featureFlags } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { cacheGet, cacheSet } from '@/lib/services/cache-service';
import { logger } from '@/lib/logger';

export interface FeatureFlagContext {
  userId?: string;
  organizationId?: string;
}

/**
 * Check if a feature is enabled for a user/organization
 * 
 * Priority order:
 * 1. User-specific allow list
 * 2. Organization-specific allow list
 * 3. Percentage-based rollout (deterministic hash of userId/organizationId)
 * 4. Global enabled flag
 * 5. Environment variable default
 * 6. False (fail-safe)
 */
export async function isFeatureEnabled(
  flagName: string,
  context: FeatureFlagContext = {}
): Promise<boolean> {
  try {
    const cacheKey = `feature-flag:${flagName}:${context.userId || 'none'}:${context.organizationId || 'none'}`;
    
    // Check cache first (5 minute TTL)
    const cached = await cacheGet<boolean>(cacheKey, { namespace: 'feature-flags' });
    if (cached !== null) {
      return cached;
    }

    // Fetch the feature flag
    const flag = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.name, flagName),
    });

    if (!flag) {
      // No database flag, fall back to environment variable
      const envFlag = getEnvironmentFlag(flagName);
      await cacheSet(cacheKey, envFlag, { namespace: 'feature-flags', ttl: 300 });
      return envFlag;
    }

    // Check user-specific override
    if (context.userId && flag.allowedUsers?.includes(context.userId)) {
      await cacheSet(cacheKey, true, { namespace: 'feature-flags', ttl: 300 });
      return true;
    }

    // Check organization-specific override
    if (context.organizationId && flag.allowedOrganizations?.includes(context.organizationId)) {
      await cacheSet(cacheKey, true, { namespace: 'feature-flags', ttl: 300 });
      return true;
    }

    // Check percentage-based rollout
    if (flag.type === 'percentage' && flag.percentage !== null) {
      const identifier = context.userId || context.organizationId || 'anonymous';
      const hash = simpleHash(identifier);
      const enabled = (hash % 100) < flag.percentage;
      await cacheSet(cacheKey, enabled, { namespace: 'feature-flags', ttl: 300 });
      return enabled;
    }

    // Check global enabled flag
    if (flag.enabled) {
      await cacheSet(cacheKey, true, { namespace: 'feature-flags', ttl: 300 });
      return true;
    }

    // Fall back to environment variable
    const envFlag = getEnvironmentFlag(flagName);
    await cacheSet(cacheKey, envFlag, { namespace: 'feature-flags', ttl: 300 });
    return envFlag;

  } catch (error) {
    logger.error('Feature flag check failed', error instanceof Error ? error : new Error(String(error)), {
      flagName,
      context,
    });
    
    // Fail-safe: fall back to environment variable
    return getEnvironmentFlag(flagName);
  }
}

/**
 * Simple deterministic hash function for percentage-based rollouts
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get feature flag from environment variables
 */
function getEnvironmentFlag(flagName: string): boolean {
  const envKey = `FEATURE_${flagName.toUpperCase().replace(/-/g, '_')}`;
  const envValue = process.env[envKey];
  
  if (envValue === undefined) {
    return false; // Default to disabled
  }
  
  return envValue === 'true' || envValue === '1';
}

/**
 * Enable a feature flag globally
 */
export async function enableFeatureFlag(
  flagName: string,
  description?: string,
  modifiedBy?: string
): Promise<void> {
  try {
    await db
      .insert(featureFlags)
      .values({
        name: flagName,
        type: 'boolean',
        enabled: true,
        description: description || `Feature flag for ${flagName}`,
        createdBy: modifiedBy,
        lastModifiedBy: modifiedBy,
      })
      .onConflictDoUpdate({
        target: featureFlags.name,
        set: { 
          enabled: true, 
          updatedAt: new Date(),
          lastModifiedBy: modifiedBy,
        },
      });

    logger.info('Feature flag enabled', { flagName, modifiedBy });
  } catch (error) {
    logger.error('Failed to enable feature flag', error instanceof Error ? error : new Error(String(error)), {
      flagName,
    });
    throw error;
  }
}

/**
 * Disable a feature flag globally
 */
export async function disableFeatureFlag(
  flagName: string,
  modifiedBy?: string
): Promise<void> {
  try {
    await db
      .insert(featureFlags)
      .values({
        name: flagName,
        type: 'boolean',
        enabled: false,
        createdBy: modifiedBy,
        lastModifiedBy: modifiedBy,
      })
      .onConflictDoUpdate({
        target: featureFlags.name,
        set: { 
          enabled: false, 
          updatedAt: new Date(),
          lastModifiedBy: modifiedBy,
        },
      });

    logger.info('Feature flag disabled', { flagName, modifiedBy });
  } catch (error) {
    logger.error('Failed to disable feature flag', error instanceof Error ? error : new Error(String(error)), {
      flagName,
    });
    throw error;
  }
}

/**
 * Add an organization to a feature flag's allow list
 */
export async function addOrganizationToFeatureFlag(
  flagName: string,
  organizationId: string,
  modifiedBy?: string
): Promise<void> {
  try {
    const flag = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.name, flagName),
    });

    if (!flag) {
      throw new Error(`Feature flag '${flagName}' not found`);
    }

    const allowedOrganizations = flag.allowedOrganizations || [];
    if (!allowedOrganizations.includes(organizationId)) {
      allowedOrganizations.push(organizationId);
      
      await db
        .update(featureFlags)
        .set({
          allowedOrganizations,
          updatedAt: new Date(),
          lastModifiedBy: modifiedBy,
        })
        .where(eq(featureFlags.name, flagName));
    }

    logger.info('Organization added to feature flag', { flagName, organizationId, modifiedBy });
  } catch (error) {
    logger.error('Failed to add organization to feature flag', error instanceof Error ? error : new Error(String(error)), {
      flagName,
      organizationId,
    });
    throw error;
  }
}

/**
 * Add a user to a feature flag's allow list
 */
export async function addUserToFeatureFlag(
  flagName: string,
  userId: string,
  modifiedBy?: string
): Promise<void> {
  try {
    const flag = await db.query.featureFlags.findFirst({
      where: eq(featureFlags.name, flagName),
    });

    if (!flag) {
      throw new Error(`Feature flag '${flagName}' not found`);
    }

    const allowedUsers = flag.allowedUsers || [];
    if (!allowedUsers.includes(userId)) {
      allowedUsers.push(userId);
      
      await db
        .update(featureFlags)
        .set({
          allowedUsers,
          updatedAt: new Date(),
          lastModifiedBy: modifiedBy,
        })
        .where(eq(featureFlags.name, flagName));
    }

    logger.info('User added to feature flag', { flagName, userId, modifiedBy });
  } catch (error) {
    logger.error('Failed to add user to feature flag', error instanceof Error ? error : new Error(String(error)), {
      flagName,
      userId,
    });
    throw error;
  }
}

/**
 * Set percentage-based rollout for a feature flag
 */
export async function setFeatureFlagPercentage(
  flagName: string,
  percentage: number,
  modifiedBy?: string
): Promise<void> {
  try {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Percentage must be between 0 and 100');
    }

    await db
      .insert(featureFlags)
      .values({
        name: flagName,
        type: 'percentage',
        enabled: true,
        percentage,
        createdBy: modifiedBy,
        lastModifiedBy: modifiedBy,
      })
      .onConflictDoUpdate({
        target: featureFlags.name,
        set: {
          type: 'percentage',
          enabled: true,
          percentage,
          updatedAt: new Date(),
          lastModifiedBy: modifiedBy,
        },
      });

    logger.info('Feature flag percentage set', { flagName, percentage, modifiedBy });
  } catch (error) {
    logger.error('Failed to set feature flag percentage', error instanceof Error ? error : new Error(String(error)), {
      flagName,
      percentage,
    });
    throw error;
  }
}

/**
 * Get all feature flags with their status
 */
export async function getAllFeatureFlags(): Promise<
  Array<{
    name: string;
    type: string;
    enabled: boolean;
    percentage: number | null;
    description: string | null;
    environmentDefault: boolean;
    allowedOrgs: string[];
    allowedUsers: string[];
  }>
> {
  try {
    const flags = await db.query.featureFlags.findMany({
      orderBy: (flags, { asc }) => [asc(flags.name)],
    });

    return flags.map((flag) => ({
      name: flag.name,
      type: flag.type,
      enabled: flag.enabled,
      percentage: flag.percentage,
      description: flag.description,
      environmentDefault: getEnvironmentFlag(flag.name),
      allowedOrgs: flag.allowedOrganizations || [],
      allowedUsers: flag.allowedUsers || [],
    }));
  } catch (error) {
    logger.error('Failed to get all feature flags', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Common feature flags (for type safety)
 */
export const FEATURE_FLAGS = {
  AI_CHATBOT: 'ai-chatbot',
  DOCUSIGN_INTEGRATION: 'docusign-integration',
  CLC_SYNC: 'clc-sync',
  CONGRESS_SHARING: 'congress-sharing',
  ADVANCED_ANALYTICS: 'advanced-analytics',
  MOBILE_APP: 'mobile-app',
  VOICE_TRANSCRIPTION: 'voice-transcription',
  ML_PREDICTIONS: 'ml-predictions',
  STRIPE_PAYMENTS: 'stripe-payments',
} as const;

