/**
 * Billing SchedulerManual Trigger API
 * 
 * POST /api/admin/billing-cycles/trigger-scheduled - Manually trigger scheduled billing
 * 
 * For testing and manual execution of the automated billing scheduler.
 *
 * TRUTHFUL STATUS (PR #752 round 5): this is currently the ONLY live
 * caller of BillingScheduler — there is no cron/timer trigger wired
 * anywhere (vercel.json's "crons" list does not include a billing path).
 * "Automated billing scheduler" describes what lib/jobs/billing-scheduler.ts
 * is DESIGNED to do once invoked; it does not mean billing runs on a
 * schedule today. Automated/headless invocation is also blocked by
 * BillingCycleService.generateBillingCycle()'s unconditional auth()
 * requirement (see billing-scheduler.ts's documented KNOWN LIMITATION) —
 * it would throw "Unauthorized" without a real session. Until a genuine
 * headless entrypoint and a real scheduled trigger both exist, treat
 * automated recurring billing as LATENT / NOT_OPERATIONAL, not a live
 * capability.
 * 
 * @module app/api/admin/billing-cycles/trigger-scheduled
 */

import { NextRequest } from 'next/server';
import { BillingScheduler } from '@/lib/jobs/billing-scheduler';
import { withApiAuth, getCurrentUser, hasMinRole } from '@/lib/api-auth-guard';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { z } from 'zod';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max execution

const triggerSchema = z.object({
  frequency: z.enum(['monthly', 'bi_weekly', 'weekly', 'quarterly', 'annual']),
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
    const validation = triggerSchema.safeParse(body);

    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }

    const { frequency } = validation.data;

    logger.info('Manually triggering scheduled billing', {
      frequency,
      userId: user.id,
    });

    // Execute scheduled billing
    const result = await BillingScheduler.manualTrigger(frequency);

    logger.info('Scheduled billing completed', {
      frequency,
      totalOrganizations: result.totalOrganizations,
      successful: result.successful,
      failed: result.failed,
      userId: user.id,
    });

    return standardSuccessResponse({
      ...result,
      message: `Scheduled billing executed for ${result.totalOrganizations} organizations. ${result.successful} successful, ${result.failed} failed.`,
    });
  } catch (error) {
    logger.error('Error triggering scheduled billing', { error });

    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to trigger scheduled billing'
    );
  }
});
