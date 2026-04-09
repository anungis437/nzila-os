/**
 * CLC Analytics - Annual Compliance Report API
 * 
 * GET /api/admin/clc/analytics/annual-report?year=2026
 */

import { NextResponse } from 'next/server';
import { logApiAuditEvent } from '@/lib/middleware/api-security';
import { generateAnnualComplianceReport } from '@/services/clc/compliance-reports';
import { withRoleAuth } from '@/lib/api-auth-guard';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

export const GET = withRoleAuth('admin', async (request, context) => {
  const { userId } = context as { userId: string };

  try {
    const rateLimitResult = await checkRateLimit(userId, RATE_LIMITS.CLC_OPERATIONS);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Too many CLC requests.',
          resetIn: rateLimitResult.resetIn,
        },
        {
          status: 429,
          headers: createRateLimitHeaders(rateLimitResult),
        }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    if (isNaN(year) || year < 2000 || year > 2100) {
      logApiAuditEvent({
        timestamp: new Date().toISOString(),
        userId,
        endpoint: '/api/admin/clc/analytics/annual-report',
        method: 'GET',
        eventType: 'validation_failed',
        severity: 'low',
        details: { reason: 'Invalid year parameter', year },
      });
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid year parameter. Must be between 2000 and 2100'
      );
    }

    const report = await generateAnnualComplianceReport(year);

    logApiAuditEvent({
      timestamp: new Date().toISOString(),
      userId,
      endpoint: '/api/admin/clc/analytics/annual-report',
      method: 'GET',
      eventType: 'success',
      severity: 'low',
      details: { dataType: 'ANNUAL_REPORT', year },
    });

    return NextResponse.json(report, {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    logApiAuditEvent({
      timestamp: new Date().toISOString(),
      userId,
      endpoint: '/api/admin/clc/analytics/annual-report',
      method: 'GET',
      eventType: 'unauthorized_access',
      severity: 'high',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to fetch annual compliance report',
      error
    );
  }
});
