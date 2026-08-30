/**
 * Payment Collection Workflow
 * 
 * Automated workflow for processing incoming payments:
 * - Match payments to outstanding dues transactions
 * - Update transaction status to 'paid'
 * - Send payment receipts to members
 * - Update arrears records when overdue payments are settled
 * - Escalate failed payments to arrears management
 * 
 * Schedule: Daily at 4:00 AM (after arrears management completes)
 */

import cron from 'node-cron';
import { db } from '../db';
import { 
  duesTransactions, 
  arrears, 
  members,
  payments,
} from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { queueNotification } from '../services/notification-service';
import { logger } from '@/lib/logger';
import { JobCancellationService } from '../services/job-cancellation-service';
import { v4 as uuidv4 } from 'uuid';

function generateJobIdempotencyKey(jobType: string, date: Date): string {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  return `${jobType}::${dateStr}`;
}

/**
 * Process payment collection for a tenant
 * Matches incoming payments to dues transactions and updates statuses
 */
export async function processPaymentCollection(params: {
  tenantId: string;
  processingDate?: Date;
}): Promise<{
  success: boolean;
  paymentsProcessed: number;
  transactionsUpdated: number;
  receiptsIssued: number;
  arrearsUpdated: number;
  errors: Array<{ paymentId: string; error: string }>;
}> {
  const { tenantId, processingDate = new Date() } = params;
  
  const jobCancellationService = new JobCancellationService();
  const jobRunId = uuidv4();
  const idempotencyKey = generateJobIdempotencyKey('payment-collection-workflow', processingDate);
  
  let executionStateId: string | undefined;

  const errors: Array<{ paymentId: string; error: string }> = [];
  let paymentsProcessed = 0;
  let transactionsUpdated = 0;
  let receiptsIssued = 0;
  let arrearsUpdated = 0;

  try {
    // Start job execution tracking
    const executionState = await jobCancellationService.startJobExecution({
      organizationId: tenantId,
      jobType: 'payment-collection-workflow',
      jobRunId,
      scheduledAt: processingDate,
      metadata: {
        processingDate: processingDate.toISOString(),
      },
    });
    executionStateId = executionState.id;
    
    logger.info('Starting payment collection workflow', { 
      tenantId, 
      processingDate: processingDate.toISOString(),
      jobRunId,
    });

    // Find all unprocessed payments (status='pending' or 'processing')
    // Join with members to get member details for notifications
    const pendingPayments = await db
      .select({
        id: payments.id,
        tenantId: payments.tenantId,
        memberId: payments.memberId,
        relationType: payments.relationType,
        relationId: payments.relationId,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        reconciliationStatus: payments.reconciliationStatus,
        reconciliationDate: payments.reconciliationDate,
        reconciledBy: payments.reconciledBy,
        paymentMethod: payments.paymentMethod,
        processorType: payments.processorType,
        processorPaymentId: payments.processorPaymentId,
        failureReason: payments.failureReason,
        failureCode: payments.failureCode,
        paidDate: payments.paidDate,
        receiptUrl: payments.receiptUrl,
        metadata: payments.metadata,
        createdAt: payments.createdAt,
        updatedAt: payments.updatedAt,
        memberFirstName: members.firstName,
        memberLastName: members.lastName,
        memberEmail: members.email,
        memberUserId: members.userId,
      })
      .from(payments)
      .leftJoin(members, eq(payments.memberId, members.id))
      .where(
        and(
          eq(payments.tenantId, tenantId),
          inArray(payments.status, ['pending', 'processing'])
        )
      )
      .limit(100); // Process in batches

    logger.info(`Found ${pendingPayments.length} pending payments to process`);

    // Process each payment
    for (const payment of pendingPayments) {
      // Check for cancellation request
      if (executionStateId) {
        const isCancelled = await jobCancellationService.isJobCancelled({
          organizationId: tenantId,
          executionStateId,
        });
        if (isCancelled) {
          logger.info('Job cancellation requested, stopping payment collection', { jobRunId });
          break;
        }
      }
      
      try {
        if (!payment.memberId) {
          errors.push({
            paymentId: payment.id,
            error: 'Payment has no memberId',
          });
          continue;
        }
        const memberId = payment.memberId;

        // Find matching dues transactions for this member
        // Priority: overdue > pending, oldest first
        const matchingTransactions = await db
          .select()
          .from(duesTransactions)
          .where(
            and(
              eq(duesTransactions.organizationId, tenantId),
              eq(duesTransactions.memberId, memberId),
              inArray(duesTransactions.status, ['pending', 'overdue'])
            )
          )
          .orderBy(duesTransactions.dueDate);

        if (matchingTransactions.length === 0) {
          // No outstanding transactions for this member
          errors.push({
            paymentId: payment.id,
            error: 'No outstanding dues transactions found for member',
          });
          
          // Mark payment as 'unmatched' for manual review
          await db.update(payments)
            .set({ 
              status: 'failed',
              reconciliationStatus: 'unreconciled',
              failureReason: 'No outstanding dues transactions found for member',
              updatedAt: new Date().toISOString(),
            })
            .where(eq(payments.id, payment.id))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .catch((err: any) => {
              logger.error('Failed to mark payment as unmatched', { error: err, paymentId: payment.id });
            });
          
          continue;
        }

        // Allocate payment amount across transactions (FIFO - oldest first)
        let remainingAmount = parseFloat(payment.amount);
        const updatedTransactionIds: string[] = [];

        for (const transaction of matchingTransactions) {
          if (remainingAmount <= 0) break;

          const transactionAmount = parseFloat(transaction.amount);
          const amountToApply = Math.min(remainingAmount, transactionAmount);

          // Update transaction status
          await db
            .update(duesTransactions)
            .set({
              status: 'paid',
              notes: `Paid ${amountToApply} via ${payment.paymentMethod}`,
            } as Partial<typeof duesTransactions.$inferInsert>)
            .where(eq(duesTransactions.id, transaction.id));

          updatedTransactionIds.push(transaction.id);
          remainingAmount -= amountToApply;
          transactionsUpdated++;

          // If this transaction was in arrears, update arrears record
          if (transaction.status === 'overdue') {
            const arrearsRecord = await db
              .select()
              .from(arrears)
              .where(
                and(
                  eq(arrears.tenantId, tenantId),
                  eq(arrears.memberId, memberId)
                )
              )
              .limit(1);

            if (arrearsRecord.length > 0) {
              // Mark arrears as resolved
              await db
                .update(arrears)
                .set({
                  arrearsStatus: 'resolved',
                  notes: `Paid via ${payment.paymentMethod} - Ref: ${payment.processorPaymentId || payment.id}`,
                } as Partial<typeof arrears.$inferInsert>)
                .where(eq(arrears.id, arrearsRecord[0].id));

              arrearsUpdated++;
            }
          }
        }

        // Update payment status based on remaining amount
        const finalPaymentStatus = remainingAmount > 0 ? 'partial' : 'completed';
        const paymentNotes = remainingAmount > 0 
          ? `Partial payment applied: ${parseFloat(payment.amount) - remainingAmount} allocated, ${remainingAmount} remaining`
          : `Full payment applied to ${updatedTransactionIds.length} transaction(s)`;
        
        await db.update(payments)
          .set({ 
            status: finalPaymentStatus as typeof payments.$inferInsert['status'],
            reconciliationStatus: 'reconciled',
            reconciliationDate: new Date().toISOString(),
            paidDate: new Date().toISOString(),
            failureReason: remainingAmount > 0 ? paymentNotes : null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(payments.id, payment.id))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .catch((err: any) => {
            logger.error('Failed to update payment status', { error: err, paymentId: payment.id });
          });

        paymentsProcessed++;

        // Get member's organizationId for notifications
        const [member] = await db
          .select({ organizationId: members.organizationId })
          .from(members)
          .where(eq(members.id, memberId))
          .limit(1);

        // Send payment receipt notification
        try {
          const paidAt = payment.paidDate ?? payment.createdAt;
          const paymentDate = new Date(String(paidAt));

          // BR-6: never issue a payment receipt under a default-org fallback.
          // A member with no verified organization context fails closed (the
          // surrounding catch logs and the loop continues without a receipt).
          const receiptOrgId = member?.organizationId;
          if (!receiptOrgId) {
            throw new Error(
              `Member ${memberId} has no verified organization context; refusing default-org payment receipt (BR-6).`,
            );
          }

          await sendPaymentReceipt({
            organizationId: receiptOrgId,
            memberId,
            memberName: `${payment.memberFirstName || ''} ${payment.memberLastName || ''}`.trim() || 'Member',
            memberEmail: payment.memberEmail || '',
            memberPhone: '', // Phone not available in members table
            userId: payment.memberUserId || payment.reconciledBy || '',
            amount: parseFloat(payment.amount),
            paymentMethod: payment.paymentMethod || 'unknown',
            referenceNumber: payment.processorPaymentId || payment.id,
            paymentDate,
            transactionsUpdated: updatedTransactionIds.length,
          });
          receiptsIssued++;
        } catch (receiptError) {
          logger.error('Failed to send payment receipt', {
            paymentId: payment.id,
            memberId,
            error: receiptError,
          });
          // Don't fail the entire payment process if receipt fails
        }

      } catch (paymentError) {
        logger.error('Error processing payment', {
          paymentId: payment.id,
          error: paymentError,
        });
        errors.push({
          paymentId: payment.id,
          error: paymentError instanceof Error ? paymentError.message : String(paymentError),
        });

        // Mark payment as 'failed' for retry
        await db.update(payments)
          .set({ 
            status: 'failed',
            reconciliationStatus: 'unreconciled',
            failureReason: paymentError instanceof Error ? paymentError.message : String(paymentError),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(payments.id, payment.id))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .catch((err: any) => {
            logger.error('Failed to mark payment as failed', { error: err, paymentId: payment.id });
          });
      }
    }

    const success = errors.length === 0;
    logger.info('Payment collection workflow completed', {
      success,
      paymentsProcessed,
      transactionsUpdated,
      receiptsIssued,
      arrearsUpdated,
      errors: errors.length,
    });

    // Complete job execution tracking
    if (executionStateId) {
      await jobCancellationService.completeJob({
        organizationId: tenantId,
        executionStateId,
        result: {
          paymentsProcessed,
          transactionsUpdated,
          receiptsIssued,
          arrearsUpdated,
          errorsCount: errors.length,
        },
      });
    }

    return {
      success,
      paymentsProcessed,
      transactionsUpdated,
      receiptsIssued,
      arrearsUpdated,
      errors,
    };

  } catch (error) {
    logger.error('Payment collection workflow failed', { error });
    
    // Record failure in job execution tracking
    if (executionStateId) {
      await jobCancellationService.failJob({
        organizationId: tenantId,
        executionStateId,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
    
    return {
      success: false,
      paymentsProcessed,
      transactionsUpdated,
      receiptsIssued,
      arrearsUpdated,
      errors,
    };
  }
}

/**
 * Send payment receipt to member
 */
async function sendPaymentReceipt(params: {
  organizationId: string;
  memberId: string;
  memberName: string;
  memberEmail: string | null;
  memberPhone: string | null;
  userId: string | null;
  amount: number;
  paymentMethod: string;
  referenceNumber: string | null;
  paymentDate: Date;
  transactionsUpdated: number;
}): Promise<void> {
  const {
    organizationId,
    userId,
    memberName,
    memberEmail,
    memberPhone,
    amount,
    paymentMethod,
    referenceNumber,
    paymentDate,
    transactionsUpdated,
  } = params;

  const _receiptMessage = `
Thank you for your payment!

Payment Receipt
---------------
Member: ${memberName}
Amount: $${amount.toFixed(2)}
Payment Method: ${paymentMethod}
Reference: ${referenceNumber || 'N/A'}
Date: ${paymentDate.toLocaleDateString()}
Transactions Applied: ${transactionsUpdated}

Your dues account has been updated. If you have any questions, please contact your union representative.
  `.trim();

  // Send notification via notification service
  try {
    if (memberEmail) {
      await queueNotification({
        organizationId,
        userId: userId || memberEmail.split('@')[0] || 'unknown',
        type: 'payment_confirmation',
        channels: ['email'],
        priority: 'normal',
        data: {
          email: memberEmail,
          memberName,
          amount,
          paymentMethod,
          referenceNumber,
          paymentDate: paymentDate.toISOString(),
          transactionsUpdated,
        },
      });
      logger.info('Payment receipt email queued', { to: memberEmail });
    }

    if (memberPhone) {
      await queueNotification({
        organizationId,
        userId: userId || memberPhone || 'unknown',
        type: 'payment_confirmation',
        channels: ['sms'],
        priority: 'normal',
        data: {
          phone: memberPhone,
          message: `Payment received: $${amount.toFixed(2)} via ${paymentMethod}. Receipt sent to email.`,
        },
      });
      logger.info('Payment receipt SMS queued', { to: memberPhone });
    }
  } catch (error) {
    logger.error('Failed to queue payment receipt notification', error);
    // Don't fail the entire payment process if notification fails
  }
}

/**
 * Scheduled job: Daily payment collection at 4:00 AM
 */
export const dailyPaymentCollectionJob = cron.schedule(
  '0 4 * * *',
  async () => {
    logger.info('Running daily payment collection job');
    
    try {
      // Note: In multi-organization setup, process payments per organization
      const tenantId = process.env.DEFAULT_TENANT_ID || 'default-tenant';
      
      const result = await processPaymentCollection({ tenantId });
      
      logger.info('Daily payment collection job completed', {
        paymentsProcessed: result.paymentsProcessed,
        transactionsUpdated: result.transactionsUpdated,
        receiptsIssued: result.receiptsIssued,
        arrearsUpdated: result.arrearsUpdated,
        errors: result.errors.length,
      });

      if (result.errors.length > 0) {
        logger.warn('Payment collection had errors', { 
          errorCount: result.errors.length,
          errors: result.errors.slice(0, 5), // Log first 5 errors
        });
      }

    } catch (error) {
      logger.error('Daily payment collection job failed', { error });
    }
  },
  {
    timezone: 'America/Toronto',
  }
);

/**
 * Start the payment collection workflow
 */
export function startPaymentCollectionWorkflow(): void {
  dailyPaymentCollectionJob.start();
  logger.info('✓ Payment collection workflow started (daily, 4:00 AM)');
}

/**
 * Stop the payment collection workflow
 */
export function stopPaymentCollectionWorkflow(): void {
  dailyPaymentCollectionJob.stop();
  logger.info('Payment collection workflow stopped');
}

/**
 * Get workflow status
 */
export function getPaymentCollectionWorkflowStatus(): {
  running: boolean;
  nextExecution: string | null;
} {
  return {
    running: true, // node-cron doesn't expose status - assume scheduled
    nextExecution: null, // node-cron doesn't expose next run time
  };
}
