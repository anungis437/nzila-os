/**
 * Manual Trigger API for Dues Reminders
 * 
 * POST /api/admin/dues/send-reminders - Manually trigger dues reminder job
 * 
 * For testing and manual execution of the dues reminder scheduler.
 * 
 * @module app/api/admin/dues/send-reminders
 */

import { manualTriggerReminders } from '@/lib/jobs/dues-reminder-scheduler';
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

// The reminder job scans the pending dues of every organization: a platform operation, gated by platform authority. The job opens its own
// system-role transactions (the scan, then one per reminder, so a failing reminder never aborts the others and each one commits on its own).
// The wrapper opens no tenant transaction: that would be the wrong role, and the intent record the audit boundary writes first must commit
// on its own.
export const POST = withApi(
  {
    auth: { minRole: 'platform_lead' },
    openapi: { tags: ['Admin', 'Dues'], summary: 'Manually trigger the dues reminder job' },
  },
  async ({ userId, organizationId }) => {
  try {
    logger.info('Manually triggering dues reminders', {
      userId,
    });

    // Execute dues reminder job
    const result = await performAuditedOperation(
      { organizationId, userId, action: 'platform.dues.send_reminders', resourceType: 'platform_job' },
      () => manualTriggerReminders(),
    );

    logger.info('Dues reminders completed', {
      totalProcessed: result.totalProcessed,
      remindersSent: result.remindersSent,
      remindersFailed: result.remindersFailed,
      breakdown: result.breakdown,
      userId,
    });

    return standardSuccessResponse({
      ...result,
      message: `Processed ${result.totalProcessed} transactions. ${result.remindersSent} reminders sent (7-day: ${result.breakdown.sevenDayReminders}, 1-day: ${result.breakdown.oneDayReminders}, overdue: ${result.breakdown.overdueNotices}).`,
    });
  } catch (error) {
    if (error instanceof Error && (error as { code?: string }).code === 'OPERATION_AUDIT_UNAVAILABLE') {
      return standardErrorResponse(ErrorCode.CONFLICT, error.message);
    }
    logger.error('Error triggering dues reminders', { error });

    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to trigger dues reminders'
    );
  }
  },
);
