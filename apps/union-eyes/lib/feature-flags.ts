/**
 * Feature Flags System
 * 
 * Provides runtime feature toggles for gradual rollouts, A/B testing,
 * and kill switches without deployments.
 * 
 * Usage:
 * - Boolean: if (features.newClaimFlow.enabled) { ... }
 * - Percentage: if (features.mlPredictions.isEnabled(userId)) { ... }
 * - Tenant: if (features.smsNotifications.isEnabledForTenant(orgId)) { ... }
 */

import { cache } from 'react';
import { db } from '@/db';
import { featureFlags } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export type FlagType = 'boolean' | 'percentage' | 'tenant' | 'user';

export interface FeatureFlag {
  name: string;
  type: FlagType;
  enabled: boolean;
  percentage?: number;
  allowedTenants?: string[];
  allowedUsers?: string[];
  description?: string;
  tags?: string[];
}

/**
 * Boolean flag - simple on/off toggle
 */
export class BooleanFlag {
  constructor(
    private name: string,
    private defaultValue: boolean = false
  ) {}

  get enabled(): boolean {
    const config = getFeatureConfig(this.name);
    return config?.enabled ?? this.defaultValue;
  }

  async enable(): Promise<void> {
    await updateFeatureFlag(this.name, { enabled: true });
  }

  async disable(): Promise<void> {
    await updateFeatureFlag(this.name, { enabled: false });
  }
}

/**
 * Percentage flag - gradual rollout based on user ID hash
 */
export class PercentageFlag {
  constructor(
    private name: string,
    private defaultPercentage: number = 0
  ) {}

  isEnabled(userId: string): boolean {
    const config = getFeatureConfig(this.name);
    if (!config?.enabled) return false;

    const percentage = config.percentage ?? this.defaultPercentage;
    const hash = this.hashString(userId);
    return (hash % 100) < percentage;
  }

  async setPercentage(percentage: number): Promise<void> {
    await updateFeatureFlag(this.name, { enabled: true, percentage });
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

/**
 * Tenant flag - enable for specific organizations
 */
export class TenantFlag {
  constructor(
    private name: string,
    private defaultEnabled: boolean = false
  ) {}

  isEnabledForTenant(organizationId: string): boolean {
    const config = getFeatureConfig(this.name);
    if (!config?.enabled) return false;
    
    if (!config.allowedTenants || config.allowedTenants.length === 0) {
      return this.defaultEnabled;
    }
    
    return config.allowedTenants.includes(organizationId);
  }

  async enableForTenant(organizationId: string): Promise<void> {
    const config = getFeatureConfig(this.name) || { allowedTenants: [] };
    const tenants = config.allowedTenants || [];
    
    if (!tenants.includes(organizationId)) {
      await updateFeatureFlag(this.name, {
        enabled: true,
        allowedTenants: [...tenants, organizationId]
      });
    }
  }

  async disableForTenant(organizationId: string): Promise<void> {
    const config = getFeatureConfig(this.name);
    if (!config?.allowedTenants) return;

    await updateFeatureFlag(this.name, {
      enabled: true,
      allowedTenants: config.allowedTenants.filter(id => id !== organizationId)
    });
  }
}

// In-memory cache for feature flags
const flagsCache: Map<string, FeatureFlag> = new Map();
let lastFetchTime = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Get feature flag configuration with caching
 */
function getFeatureConfig(name: string): FeatureFlag | undefined {
  const now = Date.now();
  
  // Refresh cache if expired
  if (now - lastFetchTime > CACHE_TTL) {
    void refreshFeatureFlags();
  }
  
  return flagsCache.get(name);
}

/**
 * Refresh feature flags from database
 */
export const refreshFeatureFlags = cache(async () => {
  try {
    const flags = await db.select().from(featureFlags);
    
    flagsCache.clear();
    flags.forEach(flag => {
      flagsCache.set(flag.name, {
        name: flag.name,
        type: flag.type as FlagType,
        enabled: flag.enabled,
        percentage: flag.percentage || undefined,
        allowedTenants: flag.allowedOrganizations as string[] | undefined,
        allowedUsers: flag.allowedUsers as string[] | undefined,
        description: flag.description || undefined,
      });
    });
    
    lastFetchTime = Date.now();
    logger.info('Feature flags refreshed', { count: flags.length });
  } catch (error) {
    logger.error('Failed to refresh feature flags', { error });
    // Keep using cached values on error
  }
});

/**
 * Update a feature flag in database
 */
async function updateFeatureFlag(
  name: string,
  updates: Partial<FeatureFlag>
): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.name, name))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(featureFlags)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(featureFlags.name, name));
    } else {
      await db.insert(featureFlags).values({
        name,
        type: 'boolean',
        enabled: false,
        ...updates,
      });
    }

    // Invalidate cache
    lastFetchTime = 0;
    await refreshFeatureFlags();
  } catch (error) {
    logger.error('Failed to update feature flag', { name, error });
    throw error;
  }
}

/**
 * Feature flags registry
 * Add new features here as they&apos;re developed
 */
export const features = {
  // Claims Management
  newClaimFlow: new BooleanFlag('new-claim-flow', true),
  aiClaimSuggestions: new PercentageFlag('ai-claim-suggestions', 10),
  advancedClaimFilters: new BooleanFlag('advanced-claim-filters', true),
  
  // ML & AI Features
  mlPredictions: new PercentageFlag('ml-predictions', 10),
  nlpDocumentAnalysis: new PercentageFlag('nlp-document-analysis', 0),
  
  // Notifications
  smsNotifications: new BooleanFlag('sms-notifications', true),
  pushNotifications: new BooleanFlag('push-notifications', false),
  emailDigests: new BooleanFlag('email-digests', true),
  
  // Member Features
  selfServeOnboarding: new BooleanFlag('self-serve-onboarding', false),
  memberPortalV2: new TenantFlag('member-portal-v2', false),
  mobileApp: new BooleanFlag('mobile-app', false),
  
  // Analytics
  realTimeAnalytics: new TenantFlag('realtime-analytics', true),
  advancedReporting: new BooleanFlag('advanced-reporting', true),
  
  // Integrations
  stripePayments: new BooleanFlag('stripe-payments', false),
  externalCalendarSync: new BooleanFlag('external-calendar-sync', true),
  
  // Voting & Elections
  onlineVoting: new BooleanFlag('online-voting', true),
  rankedChoiceVoting: new PercentageFlag('ranked-choice-voting', 0),
  
  // Admin Features
  auditLogExport: new BooleanFlag('audit-log-export', true),
  bulkOperations: new BooleanFlag('bulk-operations', true),
} as const;

/**
 * Helper to check multiple flags at once
 */
export function checkFlags(flagNames: string[]): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  
  for (const name of flagNames) {
    const config = getFeatureConfig(name);
    result[name] = config?.enabled ?? false;
  }
  
  return result;
}

/**
 * Server action to get all flags (for admin UI)
 */
export async function getAllFeatureFlags(): Promise<FeatureFlag[]> {
  await refreshFeatureFlags();
  return Array.from(flagsCache.values());
}

/**
 * Server action to toggle a flag (for admin UI)
 */
export async function toggleFeatureFlag(
  name: string,
  enabled: boolean
): Promise<void> {
  await updateFeatureFlag(name, { enabled });
}

