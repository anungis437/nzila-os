/**
 * Manual Trigger API for Dues Reminders
 * 
 * POST /api/admin/dues/send-reminders - Manually trigger dues reminder job
 * 
 * For testing and manual execution of the dues reminder scheduler.
 * 
 * @module app/api/admin/dues/send-reminders
 */

import { NextRequest } from 'next/server';
import { manualTriggerReminders } from '@/lib/jobs/dues-reminder-scheduler';
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

    logger.info('Manually triggering dues reminders', {
      userId: user.id,
    });

    // Execute dues reminder job
    const result = await manualTriggerReminders();

    logger.info('Dues reminders completed', {
      totalProcessed: result.totalProcessed,
      remindersSent: result.remindersSent,
      remindersFailed: result.remindersFailed,
      breakdown: result.breakdown,
      userId: user.id,
    });

    return standardSuccessResponse({
      ...result,
      message: `Processed ${result.totalProcessed} transactions. ${result.remindersSent} reminders sent (7-day: ${result.breakdown.sevenDayReminders}, 1-day: ${result.breakdown.oneDayReminders}, overdue: ${result.breakdown.overdueNotices}).`,
    });
  } catch (error) {
    logger.error('Error triggering dues reminders', { error });

    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Failed to trigger dues reminders'
    );
  }
});
