/**
 * Billing Cycle Preview API
 * 
 * POST /api/admin/billing-cycles/preview - Preview billing cycle before execution
 * 
 * @module app/api/admin/billing-cycles/preview
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

const previewSchema = z.object({
  organizationId: z.string().uuid(),
  frequency: z.enum(['monthly', 'bi_weekly', 'weekly', 'quarterly', 'annual']),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
});

export const POST = withApiAuth(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return standardErrorResponse(
        ErrorCode.AUTH_REQUIRED,
        'Authentication required'
      );
    }

    const body = await request.json();
    const validation = previewSchema.safeParse(body);

    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }

    const { organizationId, frequency, periodStart, periodEnd } = validation.data;

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

    logger.info('Previewing billing cycle', {
      organizationId,
      frequency,
      periodStart: start,
      periodEnd: end,
      userId: user.id,
    });

    // Generate preview (dry run)
    const result = await BillingCycleService.generateBillingCycle({
      organizationId,
      periodStart: start,
      periodEnd: end,
      frequency,
      dryRun: true, // Always dry run for preview
      executedBy: user.id,
    });

    return standardSuccessResponse({
      preview: true,
      ...result,
      message: `Preview: Would create ${result.transactionsCreated} transactions totaling $${result.totalAmount}`,
    });
  } catch (error) {
    logger.error('Error previewing billing cycle', { error });

    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to preview billing cycle'
    );
  }
});
