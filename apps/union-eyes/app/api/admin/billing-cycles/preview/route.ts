/**
 * Billing Cycle Preview API
 * 
 * POST /api/admin/billing-cycles/preview - Preview billing cycle before execution
 * 
 * @module app/api/admin/billing-cycles/preview
 */

import { NextRequest } from 'next/server';
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

const previewSchema = z.object({
  organizationId: z.guid(),
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

    const canAccess = await hasMinRole('platform_lead');
    if (!canAccess) {
      return standardErrorResponse(
        ErrorCode.FORBIDDEN,
        'Platform lead role required'
      );
    }

    const body = await request.json();
    const validation = previewSchema.safeParse(body);

    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.issues
      );
    }

    const { organizationId, frequency, periodStart, periodEnd } = validation.data;

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
    if (error instanceof BillingPreviewAuthorityError) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, error.message);
    }
    logger.error('Error previewing billing cycle', { error });

    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to preview billing cycle'
    );
  }
});
