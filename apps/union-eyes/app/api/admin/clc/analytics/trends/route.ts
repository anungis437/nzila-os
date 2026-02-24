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
import { withRoleAuth } from '@/lib/api-auth-guard';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
export const GET = withRoleAuth('admin', async (request, context) => {
    const { userId } = context as { userId: string };

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
        const years = parseInt(searchParams.get('years') || '3');
        
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

        const trends = await analyzeMultiYearTrends({ years: years as 3 | 5 | 10 });

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
            'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
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
});

