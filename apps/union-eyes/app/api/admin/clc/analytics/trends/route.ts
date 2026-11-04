/**
 * CLC Analytics - Multi-Year Trends API
 * 
 * GET /api/admin/clc/analytics/trends
 * 
 * Returns trend analysis data for specified time period
 */

import { NextResponse } from 'next/server';
import { logApiAuditEvent } from '@/lib/middleware/api-security';
import { analyzeMultiYearTrends } from '@/services/clc/compliance-reports';
import { withApi } from '@/lib/api/framework';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
// The trends read the caller organization's per-capita remittances: the handler runs in that organization's tenant transaction.
export const GET = withApi(
  {
    auth: { minRole: 'admin' },
    rlsOrgContext: true,
    registry: { audience: 'admin', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['Admin', 'CLC'], summary: 'CLC multi-year remittance trends (3, 5 or 10 years)' },
  },
  async ({ request, userId, organizationId }) => {
    if (!userId) return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Authentication required');
    if (!organizationId) return standardErrorResponse(ErrorCode.FORBIDDEN, 'Organization context required');

  try {
        // Rate limiting: 50 CLC operations per hour per user
        const rateLimitResult = await checkRateLimit(userId, RATE_LIMITS.CLC_OPERATIONS);
        if (!rateLimitResult.allowed) {
          return NextResponse.json(
            { 
              error: 'Rate limit exceeded. Too many CLC requests.',
              resetIn: rateLimitResult.resetIn 
            },
            { 
              status: 429,
              headers: createRateLimitHeaders(rateLimitResult),
            }
          );
        }

        const searchParams = request.nextUrl.searchParams;
        const yearsInput = searchParams.get('years') ?? '3';
        const years = /^(3|5|10)$/.test(yearsInput) ? Number(yearsInput) : NaN;
        
        if (![3, 5, 10].includes(years)) {
          logApiAuditEvent({
            timestamp: new Date().toISOString(), userId,
            endpoint: '/api/admin/clc/analytics/trends',
            method: 'GET',
            eventType: 'validation_failed',
            severity: 'low',
            details: { reason: 'Invalid years parameter', years },
          });
          return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid years parameter. Must be 3, 5, or 10'
    );
        }

        const trends = await analyzeMultiYearTrends({ years: years as 3 | 5 | 10, organizationId });

        logApiAuditEvent({
          timestamp: new Date().toISOString(), userId,
          endpoint: '/api/admin/clc/analytics/trends',
          method: 'GET',
          eventType: 'success',
          severity: 'low',
          details: { dataType: 'ANALYTICS', years },
        });

        return NextResponse.json(trends, {
          headers: {
            'Cache-Control': 'private, no-store' // Cache for 1 hour
          }
        });

      } catch (error) {
        logApiAuditEvent({
          timestamp: new Date().toISOString(), userId,
          endpoint: '/api/admin/clc/analytics/trends',
          method: 'GET',
          eventType: 'unauthorized_access',
          severity: 'high',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
        });
        return standardErrorResponse(
          ErrorCode.INTERNAL_ERROR,
          'Failed to fetch trend data',
          error
        );
      }
  },
);

