/**
 * Failed Payment Retry Manual Trigger API
 * 
 * POST /api/admin/payments/retry-failed - Manually trigger failed payment retry job
 * 
 * For testing and manual execution of the failed payment retry scheduler.
 * 
 * @module app/api/admin/payments/retry-failed
 */

import { NextRequest } from 'next/server';
import { manualTriggerRetry } from '@/lib/jobs/failed-payment-retry';
import { withApiAuth, getCurrentUser } from '@/lib/api-auth-guard';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max execution

export const POST = withApiAuth(async (_request: NextRequest) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return standardErrorResponse(
        ErrorCode.AUTH_REQUIRED,
        'Authentication required'
      );
    }

    logger.info('Manually triggering failed payment retry', {
      userId: user.id,
    });

    // Execute failed payment retry job
    const result = await manualTriggerRetry();

    logger.info('Failed payment retry completed', {
      totalProcessed: result.totalProcessed,
      retriesAttempted: result.retriesAttempted,
      retriesSucceeded: result.retriesSucceeded,
      retriesFailed: result.retriesFailed,
      markedForAdmin: result.markedForAdmin,
      userId: user.id,
    });

    return standardSuccessResponse({
      ...result,
      message: `Processed ${result.totalProcessed} transactions. ${result.retriesAttempted} retries attempted, ${result.retriesSucceeded} succeeded, ${result.markedForAdmin} marked for admin intervention.`,
    });
  } catch (error) {
    logger.error('Error triggering failed payment retry', { error });

    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to trigger payment retry'
    );
  }
});
