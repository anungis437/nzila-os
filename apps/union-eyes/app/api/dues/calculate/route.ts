import { NextResponse } from 'next/server';
import { z } from 'zod';
import { DuesCalculationEngine } from '@/lib/dues-calculation-engine';
import { logApiAuditEvent } from '@/lib/middleware/api-security';
import { withRoleAuth, type BaseAuthContext } from '@/lib/api-auth-guard';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
// Validation schema for dues calculation
const calculateDuesSchema = z.object({
  memberId: z.string().uuid('Invalid member ID format'),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Period start must be in YYYY-MM-DD format'),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Period end must be in YYYY-MM-DD format'),
  memberData: z.record(z.any()).optional(),
});

export const POST = withRoleAuth('steward', async (request, context: BaseAuthContext) => {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch (error) {
    return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid JSON in request body',
      error
    );
  }

  const parsed = calculateDuesSchema.safeParse(rawBody);
  if (!parsed.success) {
    return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid request body',
      parsed.error
    );
  }

  const body = parsed.data;
  const { userId, organizationId } = context;
  if (!userId || !organizationId) {
    return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');
  }

  // Rate limiting: 100 financial read operations per hour per user
  const rateLimitResult = await checkRateLimit(userId, RATE_LIMITS.FINANCIAL_READ);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { 
        error: 'Rate limit exceeded. Too many financial read requests.',
        resetIn: rateLimitResult.resetIn 
      },
      { 
        status: 429,
        headers: createRateLimitHeaders(rateLimitResult),
      }
    );
  }

  const orgId = (body as Record<string, unknown>)["organizationId"] ?? (body as Record<string, unknown>)["orgId"] ?? (body as Record<string, unknown>)["organization_id"] ?? (body as Record<string, unknown>)["org_id"] ?? (body as Record<string, unknown>)["unionId"] ?? (body as Record<string, unknown>)["union_id"] ?? (body as Record<string, unknown>)["localId"] ?? (body as Record<string, unknown>)["local_id"];
  if (typeof orgId === 'string' && orgId.length > 0 && orgId !== context.organizationId) {
    return standardErrorResponse(
      ErrorCode.FORBIDDEN,
      'Forbidden'
    );
  }

try {
      const { memberId, periodStart, periodEnd, memberData } = body;

      const calculation = await DuesCalculationEngine.calculateMemberDues({
        organizationId,
        memberId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        memberData,
      });

      if (!calculation) {
        logApiAuditEvent({
          timestamp: new Date().toISOString(), userId,
          endpoint: '/api/dues/calculate',
          method: 'POST',
          eventType: 'validation_failed',
          severity: 'medium',
          details: { reason: 'Unable to calculate dues', memberId },
        });
        return NextResponse.json(
          { error: 'Unable to calculate dues for this member' },
          { status: 404 }
        );
      }

      logApiAuditEvent({
        timestamp: new Date().toISOString(), userId,
        endpoint: '/api/dues/calculate',
        method: 'POST',
        eventType: 'success',
        severity: 'high',
        details: {
          dataType: 'FINANCIAL',
          memberId,
          periodStart,
          periodEnd,
          calculatedAmount: calculation.amount,
        },
      });

      return NextResponse.json({
        success: true,
        calculation,
      });
    } catch (error) {
      logApiAuditEvent({
        timestamp: new Date().toISOString(), userId,
        endpoint: '/api/dues/calculate',
        method: 'POST',
        eventType: 'validation_failed',
        severity: 'high',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
      return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to calculate dues',
      error
    );
    }
});

