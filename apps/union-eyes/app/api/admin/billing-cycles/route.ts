/**
 * Billing Cycles API
 * 
 * POST /api/admin/billing-cycles - Generate billing cycle
 * GET  /api/admin/billing-cycles - List billing history
 * 
 * @module app/api/admin/billing-cycles
 */

import { NextRequest, NextResponse } from 'next/server';
import { BillingCycleService } from '@/lib/services/billing-cycle-service';
import { requireBillingCycleAuthority } from '@/lib/finance/billing-cycle-authority';
import { withApiAuth, getCurrentUser, hasMinRole } from '@/lib/api-auth-guard';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { performAuditedOperation, operationAuditResponse } from '@/lib/audit/operation-audit';

export const runtime = 'nodejs';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const billingCycleSchema = z.object({
  organizationId: z.guid(),
  frequency: z.enum(['monthly', 'bi_weekly', 'weekly', 'quarterly', 'annual']),
  periodStart: z.string().optional(), // ISO date string
  periodEnd: z.string().optional(), // ISO date string
  dryRun: z.boolean().optional().default(false),
});

// =============================================================================
// POST - Generate Billing Cycle
// =============================================================================

export const POST = withApiAuth(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return standardErrorResponse(
        ErrorCode.AUTH_REQUIRED,
        'Authentication required'
      );
    }

    const canAccess = await hasMinRole('platform_lead');
    if (!canAccess) {
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        'Platform lead role required'
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = billingCycleSchema.safeParse(body);

    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.issues
      );
    }

    const { organizationId, frequency, periodStart, periodEnd, dryRun } = validation.data;

    // A platform role is not a financial mandate for the caller-selected union.
    // Authorize the target ledger before a preview, audit intent or charge.
    try {
      await requireBillingCycleAuthority(organizationId, user.id);
    } catch {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Live financial execution mandate required for target organization');
    }

    // Calculate period dates if not provided
    let start: Date;
    let end: Date;

    if (periodStart && periodEnd) {
      start = new Date(periodStart);
      end = new Date(periodEnd);
    } else {
      const dates = BillingCycleService.calculatePeriodDates(frequency);
      start = dates.periodStart;
      end = dates.periodEnd;
    }

    logger.info('Generating billing cycle', {
      organizationId,
      frequency,
      periodStart: start,
      periodEnd: end,
      dryRun,
      userId: user.id,
    });

    const generate = () =>
      BillingCycleService.generateBillingCycle({
        organizationId,
        periodStart: start,
        periodEnd: end,
        frequency,
        dryRun,
        executedBy: user.id,
      });

    // A real cycle creates dues charges for every member of the target organization. The intent is recorded against
    // that organization before anything is created; a preview writes nothing and is not audited.
    const result = dryRun
      ? await generate()
      : await performAuditedOperation(
          {
            organizationId,
            userId: user.id,
            scope: 'system',
            action: 'platform.billing_cycle.generate',
            resourceType: 'billing_cycle',
            details: { frequency, periodStart: start.toISOString(), periodEnd: end.toISOString() },
          },
          generate,
        );

    if (dryRun && !result.success) {
      return NextResponse.json({
        ...result,
        preview: true,
        success: false,
        message: 'Preview incomplete: some members could not be calculated; no charges were created.',
      }, { status: 422 });
    }

    if (dryRun) {
      logger.info('Billing cycle preview completed', {
        organizationId,
        transactionsWouldCreate: result.transactionsCreated,
        totalAmount: result.totalAmount,
      });

      return standardSuccessResponse({
        preview: true,
        ...result,
        message: 'Preview generated successfully. No transactions were created.',
      });
    }

    logger.info('Billing cycle generated successfully', {
      organizationId,
      cycleId: result.cycleId,
      transactionsCreated: result.transactionsCreated,
      totalAmount: result.totalAmount,
    });

    return standardSuccessResponse({
      ...result,
      message: `Billing cycle generated successfully. Created ${result.transactionsCreated} transactions totaling $${result.totalAmount}.`,
    });
  } catch (error) {
    const refused = operationAuditResponse(error);
    if (refused) return NextResponse.json(refused.body, { status: refused.status });
    logger.error('Error generating billing cycle', { error });

    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to generate billing cycle'
    );
  }
});

// =============================================================================
// GET - List Billing History
// =============================================================================

export const GET = withApiAuth(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return standardErrorResponse(
        ErrorCode.AUTH_REQUIRED,
        'Authentication required'
      );
    }

    const canAccess = await hasMinRole('platform_lead');
    if (!canAccess) {
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        'Platform lead role required'
      );
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'organizationId query parameter is required'
      );
    }

    // There is no authoritative billing-cycle history store. An HTTP 200
    // with [] would falsely certify that this organization has no history.
    logger.warn('Billing cycle history unavailable', { organizationId, userId: user.id });
    return NextResponse.json(
      { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Billing-cycle history is not implemented' }, capabilityState: 'NOT_IMPLEMENTED' },
      { status: 501 },
    );
  } catch (error) {
    logger.error('Error retrieving billing cycle history', { error });

    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to retrieve billing cycle history'
    );
  }
});
