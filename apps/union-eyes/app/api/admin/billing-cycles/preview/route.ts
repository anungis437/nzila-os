/**
 * Billing Cycle Preview API
 * 
 * POST /api/admin/billing-cycles/preview - Preview billing cycle before execution
 * 
 * @module app/api/admin/billing-cycles/preview
 */

import { NextResponse } from 'next/server';
import { BillingCycleService } from '@/lib/services/billing-cycle-service';
import { resolveBillingPeriod } from '@/lib/finance/billing-period-input';
import { requireBillingCycleAuthority } from '@/lib/finance/billing-cycle-authority';
import { withApi } from '@/lib/api/framework';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { z } from 'zod';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

const previewSchema = z.object({
  organizationId: z.guid(),
  frequency: z.enum(['monthly', 'bi_weekly', 'weekly', 'quarterly', 'annual']),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
});

// A platform lead previews the cycle of the organization the request names, not of the one they are acting in: the mandate check and the
// service open that organization's own transaction, so the wrapper opens none. A platform lead need not belong to an organization.
export const POST = withApi(
  {
    auth: { minRole: 'platform_lead' },
    requireOrg: false,
    openapi: { tags: ['Admin', 'Billing'], summary: 'Preview a billing cycle before execution' },
  },
  async ({ request, user }) => {
  try {
    if (!user) {
      return standardErrorResponse(
        ErrorCode.AUTH_REQUIRED,
        'Authentication required'
      );
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid JSON');
    }
    const validation = previewSchema.safeParse(body);

    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.issues
      );
    }

    const { organizationId, frequency, periodStart, periodEnd } = validation.data;

    try {
      await requireBillingCycleAuthority(organizationId, user.id);
    } catch (error) {
      // Fail closed. A mandate that is absent and a lookup that failed both refuse the preview; the log tells them apart.
      logger.warn('Billing cycle preview refused: the live financial mandate could not be confirmed', { organizationId, userId: user.id, error });
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Live financial execution mandate required for target organization');
    }

    const period = resolveBillingPeriod(
      { periodStart, periodEnd },
      () => BillingCycleService.calculatePeriodDates(frequency),
    );
    if (!period) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid billing period: supply both valid ISO boundaries in chronological order',
      );
    }
    const { periodStart: start, periodEnd: end } = period;

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

    if (!result.success) {
      return NextResponse.json({
        ...result,
        preview: true,
        success: false,
        message: 'Preview incomplete: some members could not be calculated; no charges were created.',
      }, { status: 422 });
    }

    return standardSuccessResponse({
      preview: true,
      ...result,
      message: `Preview: Would create ${result.transactionsCreated} transactions totaling $${result.totalAmount}`,
    });
  } catch (error) {
    logger.error('Error previewing billing cycle', { error });

    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to preview billing cycle'
    );
  }
  },
);
