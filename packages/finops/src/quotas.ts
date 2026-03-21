/**
 * Org Resource Quotas
 *
 * Enforcement layer for per-org resource limits.
 * Works with @nzila/platform-cost for usage data.
 *
 * Invariant: Every org has quota limits. Exceeding a quota
 * results in denial (hard) or warning (soft) depending on policy.
 */

import { z } from 'zod';

// ── Types ─────────────────────────────────────────────────────────────────────

export const QuotaPolicySchema = z.object({
  orgId: z.string().min(1),
  resource: z.enum([
    'ai_requests',
    'storage_gb',
    'compute_hours',
    'api_calls',
    'egress_gb',
    'db_connections',
    'concurrent_users',
    'integration_calls',
  ]),
  limit: z.number().positive(),
  period: z.enum(['hourly', 'daily', 'monthly']),
  enforcement: z.enum(['hard', 'soft']),
  /** Percentage of limit at which to start warning */
  warningThreshold: z.number().min(0).max(100).default(80),
});

export type QuotaPolicy = z.infer<typeof QuotaPolicySchema>;

export interface QuotaUsage {
  orgId: string;
  resource: string;
  current: number;
  limit: number;
  period: string;
  utilizationPercent: number;
  status: 'ok' | 'warning' | 'exceeded';
}

export interface QuotaEnforcementResult {
  allowed: boolean;
  reason?: string;
  usage: QuotaUsage;
  recommendation?: string;
}

// ── Default Policies ──────────────────────────────────────────────────────────

export const DEFAULT_QUOTA_POLICIES: Omit<QuotaPolicy, 'orgId'>[] = [
  {
    resource: 'ai_requests',
    limit: 10_000,
    period: 'daily',
    enforcement: 'hard',
    warningThreshold: 80,
  },
  {
    resource: 'storage_gb',
    limit: 50,
    period: 'monthly',
    enforcement: 'soft',
    warningThreshold: 85,
  },
  {
    resource: 'compute_hours',
    limit: 100,
    period: 'daily',
    enforcement: 'hard',
    warningThreshold: 75,
  },
  {
    resource: 'api_calls',
    limit: 100_000,
    period: 'daily',
    enforcement: 'soft',
    warningThreshold: 90,
  },
  {
    resource: 'egress_gb',
    limit: 100,
    period: 'monthly',
    enforcement: 'hard',
    warningThreshold: 80,
  },
  {
    resource: 'db_connections',
    limit: 50,
    period: 'hourly',
    enforcement: 'hard',
    warningThreshold: 70,
  },
  {
    resource: 'integration_calls',
    limit: 50_000,
    period: 'daily',
    enforcement: 'soft',
    warningThreshold: 85,
  },
];

// ── Enforcement ───────────────────────────────────────────────────────────────

/**
 * Enforce a quota check for a given org + resource.
 *
 * @param policy The quota policy to enforce
 * @param currentUsage Current usage count for the resource in the period
 * @returns Enforcement result with allow/deny decision
 */
export function enforceQuota(
  policy: QuotaPolicy,
  currentUsage: number,
): QuotaEnforcementResult {
  const utilizationPercent = (currentUsage / policy.limit) * 100;

  const status: QuotaUsage['status'] =
    currentUsage >= policy.limit
      ? 'exceeded'
      : utilizationPercent >= policy.warningThreshold
        ? 'warning'
        : 'ok';

  const usage: QuotaUsage = {
    orgId: policy.orgId,
    resource: policy.resource,
    current: currentUsage,
    limit: policy.limit,
    period: policy.period,
    utilizationPercent: Math.round(utilizationPercent * 100) / 100,
    status,
  };

  if (status === 'exceeded') {
    if (policy.enforcement === 'hard') {
      return {
        allowed: false,
        reason: `Quota exceeded: ${policy.resource} usage ${currentUsage}/${policy.limit} (${policy.period}). Hard limit enforced.`,
        usage,
        recommendation: `Upgrade your plan or wait for the next ${policy.period} period to reset.`,
      };
    }

    // Soft enforcement — allow but warn
    return {
      allowed: true,
      reason: `Quota exceeded: ${policy.resource} usage ${currentUsage}/${policy.limit} (${policy.period}). Soft limit — request allowed with warning.`,
      usage,
      recommendation: `Consider upgrading your plan to avoid service degradation.`,
    };
  }

  if (status === 'warning') {
    return {
      allowed: true,
      reason: `Approaching quota: ${policy.resource} at ${usage.utilizationPercent}% of ${policy.limit} (${policy.period}).`,
      usage,
      recommendation: `Monitor usage closely. Consider reducing consumption or upgrading.`,
    };
  }

  return { allowed: true, usage };
}

// ── Usage Retrieval ───────────────────────────────────────────────────────────

/**
 * Get quota usage for all resources for an org.
 *
 * @param orgId Organization identifier
 * @param policies Active quota policies for the org
 * @param usageData Map of resource → current usage
 * @returns Array of quota usage records
 */
export function getQuotaUsage(
  orgId: string,
  policies: QuotaPolicy[],
  usageData: Map<string, number>,
): QuotaUsage[] {
  return policies
    .filter((p) => p.orgId === orgId)
    .map((policy) => {
      const current = usageData.get(policy.resource) ?? 0;
      const utilizationPercent = (current / policy.limit) * 100;

      return {
        orgId,
        resource: policy.resource,
        current,
        limit: policy.limit,
        period: policy.period,
        utilizationPercent: Math.round(utilizationPercent * 100) / 100,
        status:
          current >= policy.limit
            ? ('exceeded' as const)
            : utilizationPercent >= policy.warningThreshold
              ? ('warning' as const)
              : ('ok' as const),
      };
    });
}
