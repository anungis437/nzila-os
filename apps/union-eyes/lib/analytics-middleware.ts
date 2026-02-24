/**
 * Analytics Middleware
 * 
 * Integrates caching and aggregation services with analytics APIs
 * Provides wrapper functions for common analytics operations
 * 
 * Created: November 15, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { withCache, analyticsCache } from './analytics-cache';
import { aggregationService } from './analytics-aggregation';

/**
 * Enhanced analytics handler with automatic caching
 */
export function withAnalyticsCache<T>(
  endpoint: string,
  handler: (req: NextRequest, organizationId: string, params: unknown) => Promise<T>,
  ttl: number = 5 * 60 * 1000 // 5 minutes default
) {
  return async (req: NextRequest) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const organizationId = (req as any).organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract query parameters
    const searchParams = req.nextUrl.searchParams;
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });

    try {
      // Try cache first
      const data = await withCache(
        organizationId,
        endpoint,
        params,
        () => handler(req, organizationId, params),
        ttl
      );

      return NextResponse.json(data);
    } catch (_error) {
return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Webhook handler to invalidate cache when data changes
 */
export async function handleDataChange(
  organizationId: string,
  changeType: 'claim_created' | 'claim_updated' | 'claim_deleted' | 'member_updated'
): Promise<void> {
  // Invalidate relevant caches based on change type
  switch (changeType) {
    case 'claim_created':
    case 'claim_updated':
    case 'claim_deleted':
      // Invalidate all claims, financial, and operational analytics
      analyticsCache.invalidate(organizationId, 'claims');
      analyticsCache.invalidate(organizationId, 'financial');
      analyticsCache.invalidate(organizationId, 'operational');
      break;
    
    case 'member_updated':
      // Invalidate member analytics
      analyticsCache.invalidate(organizationId, 'members');
      break;
  }
}

/**
 * Get analytics dashboard summary with caching
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAnalyticsDashboard(organizationId: string): Promise<any> {
  return await withCache(
    organizationId,
    'dashboard',
    {},
    async () => {
      return await aggregationService.computeOrganizationMetrics(organizationId);
    },
    2 * 60 * 1000 // 2 minutes TTL for dashboard
  );
}

/**
 * Cache warming utility - pre-populate cache with common queries
 */
export async function warmAnalyticsCache(organizationId: string): Promise<void> {
const _commonTimeRanges = [7, 30, 90];
  
  try {
    // Warm up dashboard cache
    await getAnalyticsDashboard(organizationId);

    // Can add more cache warming for specific endpoints
} catch (_error) {
}
}

/**
 * Get cache statistics for monitoring
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAnalyticsCacheStats(): any {
  return analyticsCache.getStats();
}

/**
 * Manual cache clear (for admin purposes)
 */
export function clearAnalyticsCache(organizationId?: string) {
  if (organizationId) {
    analyticsCache.invalidate(organizationId);
  } else {
    analyticsCache.clear();
  }
}

