/**
 * CLC Analytics - Annual Compliance Report API
 * 
 * GET /api/admin/clc/analytics/annual-report?year=2026
 */

import { NextResponse } from 'next/server';
import { logApiAuditEvent } from '@/lib/middleware/api-security';
import { generateAnnualComplianceReport } from '@/services/clc/compliance-reports';
import { withApi } from '@/lib/api/framework';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

// The report reads the caller organization's remittances and the organizations beneath it: it runs in that organization's tenant transaction,
// so the ambient handle the compliance service reads through carries the organization row-level security applies to.
export const GET = withApi(
  {
    auth: { minRole: 'admin' },
    rlsOrgContext: true,
    registry: { audience: 'admin', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['Admin', 'CLC'], summary: 'CLC annual compliance report' },
  },
  async ({ request, userId, organizationId }) => {
  if (!userId) return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Authentication required');

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
    const yearInput = searchParams.get('year') ?? String(new Date().getFullYear());
    const year = /^\d{4}$/.test(yearInput) ? Number(yearInput) : NaN;

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

    if (!organizationId) return standardErrorResponse(ErrorCode.FORBIDDEN, 'Organization context required');
    const report = await generateAnnualComplianceReport(year, organizationId);

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
        'Cache-Control': 'private, no-store',
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
  },
);
