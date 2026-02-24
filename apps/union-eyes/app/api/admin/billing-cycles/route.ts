/**
 * Billing Cycles API
 * 
 * POST /api/admin/billing-cycles - Generate billing cycle
 * GET  /api/admin/billing-cycles - List billing history
 * 
 * @module app/api/admin/billing-cycles
 */

import { NextRequest } from 'next/server';
import { BillingCycleService } from '@/lib/services/billing-cycle-service';
import { withApiAuth, getCurrentUser } from '@/lib/api-auth-guard';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { z } from 'zod';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const billingCycleSchema = z.object({
  organizationId: z.string().uuid(),
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

    // Parse and validate request body
    const body = await request.json();
    const validation = billingCycleSchema.safeParse(body);

    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }

    const { organizationId, frequency, periodStart, periodEnd, dryRun } = validation.data;

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

    // Generate billing cycle
    const result = await BillingCycleService.generateBillingCycle({
      organizationId,
      periodStart: start,
      periodEnd: end,
      frequency,
      dryRun,
      executedBy: user.id,
    });

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
    logger.error('Error generating billing cycle', { error });

    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to generate billing cycle'
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

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'organizationId query parameter is required'
      );
    }

    // TODO: Implement billing cycle history retrieval
    // This would query a billing_cycle_history table (to be created)
    // For now, return placeholder

    logger.info('Retrieving billing cycle history', {
      organizationId,
      userId: user.id,
    });

    return standardSuccessResponse({
      cycles: [],
      total: 0,
      message: 'Billing cycle history retrieval not yet implemented. Coming in Phase 2 Week 2.',
    });
  } catch (error) {
    logger.error('Error retrieving billing cycle history', { error });

    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to retrieve billing cycle history'
    );
  }
});
