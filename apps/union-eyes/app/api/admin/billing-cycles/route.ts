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
import { withApiAuth, getCurrentUser, hasMinRole } from '@/lib/api-auth-guard';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { requireAuthorizedBillingPreview, BillingPreviewAuthorityError } from '@/lib/finance/billing-cycle-preview-authority';

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

    // Non-preview cycles must use the kernel financial workflow: a title and an
    // audit intent do not confer authority to create dues charges.
    if (!dryRun) {
      return NextResponse.json({
        error: 'Billing cycle execution requires the canonical financial mandate and charge lifecycle',
        code: 'BILLING_CYCLE_EXECUTION_UNQUALIFIED',
      }, { status: 501 });
    }
    // A dry run still reveals the target union's workforce and dues forecast.
    await requireAuthorizedBillingPreview(user.id, organizationId);

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

    const result = await generate();

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
    if (error instanceof BillingPreviewAuthorityError) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, error.message);
    }
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
