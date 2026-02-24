/**
 * Failed Payment Retry Job
 * Automatically retries failed dues payments
 * 
 * Retry Strategy:
 * - Attempt 1: Immediately (webhook failure)
 * - Attempt 2: Day 1 after failure
 * - Attempt 3: Day 3 after failure  
 * - Attempt 4: Day 7 after failure
 * - After 4 failures: Mark as requiring admin intervention
 * 
 * @module lib/jobs/failed-payment-retry
 */

import { db } from '@/db';
import { duesTransactions } from '@/db/schema/domains/finance/dues';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { sendPaymentFailure, sendAdminIntervention, calculateRetryDate } from '@/lib/services/dues-notifications';

// =============================================================================
// TYPES
// =============================================================================

export interface RetryResult {
  totalProcessed: number;
  retriesAttempted: number;
  retriesSucceeded: number;
  retriesFailed: number;
  markedForAdmin: number;
  results: Array<{
    transactionId: string;
    memberId: string;
    attemptNumber: number;
    result: 'retried' | 'max_attempts' | 'error';
    error?: string;
  }>;
}

interface RetryTransactionRow {
  id: string;
  memberId: string;
  organizationId: string;
  totalAmount: string;
  dueDate: string;
  status: string;
  metadata: unknown;
  createdAt: Date | null;
}

// =============================================================================
// FAILED PAYMENT RETRY SERVICE
// =============================================================================

export class FailedPaymentRetryService {
  /**
   * Run failed payment retry job
   * Processes all pending transactions that need retry
   */
  static async runRetryJob(): Promise<RetryResult> {
    const startTime = Date.now();

    logger.info('Starting failed payment retry job');

    const result: RetryResult = {
      totalProcessed: 0,
      retriesAttempted: 0,
      retriesSucceeded: 0,
      retriesFailed: 0,
      markedForAdmin: 0,
      results: [],
    };

    try {
      // Get all pending/overdue transactions that need retry
      const transactions = await this.getTransactionsNeedingRetry();

      logger.info(`Found ${transactions.length} transactions needing retry`);

      result.totalProcessed = transactions.length;

      // Process each transaction
      for (const txn of transactions) {
        try {
          const metadata = (txn.metadata as Record<string, unknown>) || {};
          const failureCount = (metadata.failureCount as number) || 0;
          const lastFailureDate = metadata.lastFailure
            ? new Date((metadata.lastFailure as { date: string }).date)
            : null;

          // Determine if retry is needed based on failure count and time elapsed
          const shouldRetry = this.shouldRetryPayment(
            failureCount,
            lastFailureDate
          );

          if (!shouldRetry.retry) {
            if (shouldRetry.maxAttemptsReached) {
              // Mark for admin intervention
              await this.markForAdminIntervention(txn.id, failureCount);
              result.markedForAdmin++;
              result.results.push({
                transactionId: txn.id,
                memberId: txn.memberId,
                attemptNumber: failureCount,
                result: 'max_attempts',
              });
            }
            continue;
          }

          // Attempt retry
          logger.info('Attempting payment retry', {
            transactionId: txn.id,
            attemptNumber: failureCount + 1,
          });

          result.retriesAttempted++;

          // Calculate next retry date
          const nextRetryDate = calculateRetryDate(failureCount + 1);

          // Send retry notification to member
          await sendPaymentFailure(
            txn.id,
            'Payment will be retried automatically',
            true,
            nextRetryDate
          );

          result.retriesSucceeded++;
          result.results.push({
            transactionId: txn.id,
            memberId: txn.memberId,
            attemptNumber: failureCount + 1,
            result: 'retried',
          });
        } catch (error) {
          logger.error('Error processing transaction retry', {
            error,
            transactionId: txn.id,
          });
          result.retriesFailed++;
          result.results.push({
            transactionId: txn.id,
            memberId: txn.memberId,
            attemptNumber: 0,
            result: 'error',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const executionTime = Date.now() - startTime;
      logger.info('Failed payment retry job completed', {
        ...result,
        executionTimeMs: executionTime,
      });

      return result;
    } catch (error) {
      logger.error('Error running failed payment retry job', { error });
      throw error;
    }
  }

  /**
   * Get transactions that need retry
   */
  private static async getTransactionsNeedingRetry(): Promise<RetryTransactionRow[]> {
    try {
      // Get pending transactions with failures
      const transactions = await db
        .select({
          id: duesTransactions.id,
          memberId: duesTransactions.memberId,
          organizationId: duesTransactions.organizationId,
          totalAmount: duesTransactions.totalAmount,
          dueDate: duesTransactions.dueDate,
          status: duesTransactions.status,
          metadata: duesTransactions.metadata,
          createdAt: duesTransactions.createdAt,
        })
        .from(duesTransactions)
        .where(
          and(
            eq(duesTransactions.status, 'pending'),
            // Only transactions with payment attempts
            sql`${duesTransactions.metadata}->>'failureCount' IS NOT NULL`
          )
        );

      // Filter for transactions that need retry based on time elapsed
      const now = new Date();
      return transactions.filter((txn) => {
        const metadata = (txn.metadata as Record<string, unknown>) || {};
        const failureCount = (metadata.failureCount as number) || 0;
        const lastFailureDate = metadata.lastFailure
          ? new Date((metadata.lastFailure as { date: string }).date)
          : null;

        if (failureCount >= 4) {
          // Max attempts reached
          return true; // Include for marking as admin intervention needed
        }

        if (!lastFailureDate) {
          return false;
        }

        const daysSinceFailure = this.getDaysBetween(lastFailureDate, now);

        // Retry schedule:
        // After 1st failure: retry after 1 day
        // After 2nd failure: retry after 3 days
        // After 3rd failure: retry after 7 days
        if (failureCount === 1 && daysSinceFailure >= 1) return true;
        if (failureCount === 2 && daysSinceFailure >= 3) return true;
        if (failureCount === 3 && daysSinceFailure >= 7) return true;

        return false;
      });
    } catch (error) {
      logger.error('Error getting transactions needing retry', { error });
      throw error;
    }
  }

  /**
   * Determine if payment should be retried
   */
  private static shouldRetryPayment(
    failureCount: number,
    lastFailureDate: Date | null
  ): { retry: boolean; maxAttemptsReached: boolean } {
    // Max 4 attempts total
    if (failureCount >= 4) {
      return { retry: false, maxAttemptsReached: true };
    }

    if (!lastFailureDate) {
      return { retry: false, maxAttemptsReached: false };
    }

    const daysSinceFailure = this.getDaysBetween(lastFailureDate, new Date());

    // Retry schedule
    if (failureCount === 1 && daysSinceFailure >= 1) {
      return { retry: true, maxAttemptsReached: false };
    }
    if (failureCount === 2 && daysSinceFailure >= 3) {
      return { retry: true, maxAttemptsReached: false };
    }
    if (failureCount === 3 && daysSinceFailure >= 7) {
      return { retry: true, maxAttemptsReached: false };
    }

    return { retry: false, maxAttemptsReached: false };
  }

  /**
   * Mark transaction as needing admin intervention
   */
  private static async markForAdminIntervention(
    transactionId: string,
    failureCount: number
  ): Promise<void> {
    try {
      logger.info('Marking transaction for admin intervention', {
        transactionId,
        failureCount,
      });

      await db
        .update(duesTransactions)
        .set({
          status: 'overdue',
          metadata: sql`jsonb_set(
            COALESCE(${duesTransactions.metadata}, '{}'::jsonb),
            '{requiresAdminIntervention}',
            'true'::jsonb
          )`,
          notes: sql`COALESCE(${duesTransactions.notes}, '') || E'\n' || ${`[${new Date().toISOString()}] Max payment retry attempts (${failureCount}) reached. Requires admin intervention.`}`,
          updatedAt: new Date(),
        })
        .where(eq(duesTransactions.id, transactionId));

      // Send admin intervention notification
      await sendAdminIntervention(transactionId);

      logger.info('Transaction marked for admin intervention', {
        transactionId,
      });
    } catch (error) {
      logger.error('Error marking transaction for admin intervention', {
        error,
        transactionId,
      });
      throw error;
    }
  }

  /**
   * Schedule retry notification to member
   * (Deprecated - now handled by sendPaymentFailure)
   */
  private static async scheduleRetryNotification(
    transactionId: string,
    memberId: string,
    attemptNumber: number
  ): Promise<void> {
    // This method is no longer needed as notification is sent in the main loop
    logger.info('Retry notification handled by sendPaymentFailure', {
      transactionId,
      memberId,
      attemptNumber,
    });
  }

  /**
   * Get days between two dates
   */
  private static getDaysBetween(date1: Date, date2: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((date2.getTime() - date1.getTime()) / msPerDay);
  }
}

// =============================================================================
// CRON JOB HANDLER
// =============================================================================

/**
 * Run failed payment retry job (daily at 09:00 UTC)
 * 
 * Usage with cron library:
 * ```
 * cron.schedule('0 9 * * *', async () => {
 *   await runFailedPaymentRetry();
 * });
 * ```
 */
export async function runFailedPaymentRetry(): Promise<RetryResult> {
  return FailedPaymentRetryService.runRetryJob();
}

/**
 * Manual trigger for failed payment retry (for testing)
 */
export async function manualTriggerRetry(): Promise<RetryResult> {
  logger.info('Manual trigger for failed payment retry');
  return FailedPaymentRetryService.runRetryJob();
}
