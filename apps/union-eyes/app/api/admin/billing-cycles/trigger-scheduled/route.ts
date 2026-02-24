/**
 * Billing SchedulerManual Trigger API
 * 
 * POST /api/admin/billing-cycles/trigger-scheduled - Manually trigger scheduled billing
 * 
 * For testing and manual execution of the automated billing scheduler.
 * 
 * @module app/api/admin/billing-cycles/trigger-scheduled
 */

import { NextRequest } from 'next/server';
import { BillingScheduler } from '@/lib/jobs/billing-scheduler';
import { withApiAuth, getCurrentUser } from '@/lib/api-auth-guard';
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

    // Require admin role (you can adjust this based on your RBAC)
    // if (user.role !== 'admin') {
    //   return standardErrorResponse(
    //     ErrorCode.FORBIDDEN,
    //     'Admin role required to trigger scheduled billing'
    //   );
    // }

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
      error instanceof Error ? error.message : 'Failed to trigger scheduled billing'
    );
  }
});
