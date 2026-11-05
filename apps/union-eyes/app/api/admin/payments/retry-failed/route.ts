/**
 * Failed Payment Retry Manual Trigger API
 * 
 * POST /api/admin/payments/retry-failed - Manually trigger failed payment retry job
 * 
 * For testing and manual execution of the failed payment retry scheduler.
 * 
 * @module app/api/admin/payments/retry-failed
 */

import { manualTriggerRetry } from '@/lib/jobs/failed-payment-retry';
import { withApi } from '@/lib/api/framework';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { logger } from '@/lib/logger';
import { performAuditedOperation } from '@/lib/audit/operation-audit';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max execution

// The retry job scans the failed dues payments of every organization: a platform operation, gated by platform authority. The job opens its
// own system-role transactions (the scan, then the update and the notification of each transaction), so a failing transaction never aborts
// the others. The wrapper opens no tenant transaction: that would be the wrong role, and the intent record the audit boundary writes first
// must commit on its own.
export const POST = withApi(
  {
    auth: { minRole: 'platform_lead' },
    openapi: { tags: ['Admin', 'Payments'], summary: 'Manually trigger the failed payment retry job' },
  },
  async ({ userId, organizationId }) => {
  try {
    logger.info('Manually triggering failed payment retry', {
      userId,
    });

    // Execute failed payment retry job
    const result = await performAuditedOperation(
      { organizationId, userId, action: 'platform.payments.retry_failed', resourceType: 'platform_job' },
      () => manualTriggerRetry(),
    );

    logger.info('Failed payment retry completed', {
      totalProcessed: result.totalProcessed,
      retriesAttempted: result.retriesAttempted,
      retriesSucceeded: result.retriesSucceeded,
      retriesFailed: result.retriesFailed,
      markedForAdmin: result.markedForAdmin,
      userId,
    });

    return standardSuccessResponse({
      ...result,
      message: `Processed ${result.totalProcessed} transactions. ${result.retriesAttempted} retries attempted, ${result.retriesSucceeded} succeeded, ${result.markedForAdmin} marked for admin intervention.`,
    });
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === 'OPERATION_AUDIT_UNAVAILABLE') {
      return standardErrorResponse(ErrorCode.CONFLICT, error.message);
    }
    logger.error('Error triggering failed payment retry', { error });

    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to trigger payment retry'
    );
  }
  },
);
