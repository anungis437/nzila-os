import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { organizationMembers } from '@/db/schema-organizations';
import { DuesCalculationEngine } from '@/lib/dues-calculation-engine';
import { logApiAuditEvent } from '@/lib/middleware/api-security';
import { hasRole } from '@/lib/api-auth-guard';
import { withApi } from '@/lib/api/framework';
import { FINANCIAL_MEMBER_DATA_ROLES } from '@/lib/finance/financial-authority';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';
const isoDay = (label: string) => z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, `${label} must be in YYYY-MM-DD format`)
  .refine((value) => {
    const time = Date.parse(`${value}T00:00:00.000Z`);
    return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
  }, `${label} must be a real calendar date`);

// Validation schema for dues calculation. The amount comes from the member's dues assignment on record: nothing the caller sends about the
// member's pay or hours takes part in it (a `memberData` object in the body is not read).
const calculateDuesSchema = z.object({
  memberId: z.guid('Invalid member ID format'),
  periodStart: isoDay('Period start'),
  periodEnd: isoDay('Period end'),
}).refine((value) => value.periodStart <= value.periodEnd, { message: 'Period end must not be before period start', path: ['periodEnd'] });

// The calculation reads the organization's dues assignments: it runs in the caller organization's tenant transaction (`rlsOrgContext`), and the
// ambient handle below is that transaction.
export const POST = withApi(
  {
    entitlement: 'financial_intelligence_suite',
    rlsOrgContext: true,
    openapi: { tags: ['Dues'], summary: 'Calculate the dues of a member for a period' },
  },
  async ({ request, userId, organizationId }) => {
  let rawBody: any;
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
  if (!userId || !organizationId) {
    return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');
  }

  // A member's dues are financial data about that member: the member may calculate their own, and anyone else's
  // needs the financial authority. Stewardship (a rank) is not a financial duty.
  let isFinancialAuthority = false;
  for (const role of FINANCIAL_MEMBER_DATA_ROLES) {
    if (await hasRole(role)) { isFinancialAuthority = true; break; }
  }
  if (!isFinancialAuthority) {
    // The member id names a membership of this organization; it is the caller's own when that membership belongs to the caller's user.
    const [membership] = await db
      .select({ userId: organizationMembers.userId })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.id, body.memberId), eq(organizationMembers.organizationId, organizationId)))
      .limit(1);
    if (membership?.userId !== userId) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Forbidden');
    }
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

  // The organization is the caller's own. A body that names another one is refused, not silently answered for this one:
  // the check reads the body as sent, because the validated copy has already dropped every key the schema does not name.
  const sent = (typeof rawBody === 'object' && rawBody !== null ? rawBody : {}) as Record<string, unknown>;
  const orgId = sent["organizationId"] ?? sent["orgId"] ?? sent["organization_id"] ?? sent["org_id"] ?? sent["unionId"] ?? sent["union_id"] ?? sent["localId"] ?? sent["local_id"];
  if (typeof orgId === 'string' && orgId.length > 0 && orgId !== organizationId) {
    return standardErrorResponse(
      ErrorCode.FORBIDDEN,
      'Forbidden'
    );
  }

try {
      const { memberId, periodStart, periodEnd } = body;

      const calculation = await DuesCalculationEngine.calculateMemberDues(
        {
          organizationId,
          memberId,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
        },
        db,
      );

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
  },
);


