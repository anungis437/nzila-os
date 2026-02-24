/**
 * Dues Notification Integration
 * Helper functions for sending dues-related notifications
 * 
 * Provides easy-to-use functions for:
 * - Payment confirmation
 * - Payment failure
 * - Payment retry scheduled
 * - Admin intervention alerts
 * 
 * @module lib/services/dues-notifications
 */

import { getNotificationService } from '@/lib/services/notification-service';
import { DuesNotificationTemplates, DuesNotificationData } from '@/lib/notification-templates/dues-notifications';
import { db } from '@/db';
import { organizationMembers, organizations } from '@/db/schema-organizations';
import { duesTransactions } from '@/db/schema/domains/finance/dues';
import { eq, and, inArray, or } from 'drizzle-orm';
import { logger } from '@/lib/logger';

async function getOrganizationNotificationContext(organizationId: string): Promise<{
  organizationName: string;
  adminEmails: string[];
}> {
  const [org] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      email: organizations.email,
    })
    .from(organizations)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(or(eq(organizations.id, organizationId as any), eq(organizations.slug, organizationId)))
    .limit(1);

  const orgIdentifiers = new Set<string>();
  orgIdentifiers.add(organizationId);
  if (org?.id) orgIdentifiers.add(String(org.id));
  if (org?.slug) orgIdentifiers.add(org.slug);

  const adminRoles = ['admin', 'super_admin', 'billing_manager', 'billing_specialist'];
  const adminMembers = await db
    .select({ email: organizationMembers.email })
    .from(organizationMembers)
    .where(
      and(
        inArray(organizationMembers.organizationId, Array.from(orgIdentifiers)),
        inArray(organizationMembers.role, adminRoles)
      )
    );

  const adminEmails = new Set<string>();
  for (const member of adminMembers) {
    if (member.email) adminEmails.add(member.email);
  }
  if (org?.email) adminEmails.add(org.email);

  return {
    organizationName: org?.name || organizationId,
    adminEmails: Array.from(adminEmails),
  };
}

// =============================================================================
// NOTIFICATION HELPERS
// =============================================================================

/**
 * Send payment confirmation notification
 * Called when a payment is successfully processed
 */
export async function sendPaymentConfirmation(
  transactionId: string
): Promise<void> {
  try {
    logger.info('Sending payment confirmation', { transactionId });

    // Get transaction and member details
    const result = await db
      .select({
        transaction: duesTransactions,
        memberName: organizationMembers.name,
        memberEmail: organizationMembers.email,
        memberMetadata: organizationMembers.metadata,
      })
      .from(duesTransactions)
      .innerJoin(
        organizationMembers,
        eq(duesTransactions.memberId, organizationMembers.id)
      )
      .where(eq(duesTransactions.id, transactionId))
      .limit(1);

    if (!result || result.length === 0) {
      logger.warn('Transaction not found for payment confirmation', {
        transactionId,
      });
      return;
    }

    const { transaction, memberName, memberEmail, memberMetadata } = result[0];
    const notificationService = getNotificationService();
    const { organizationName } = await getOrganizationNotificationContext(transaction.organizationId);
    const template = DuesNotificationTemplates.DUES_PAYMENT_CONFIRMATION;

    const data: DuesNotificationData = {
      memberName,
      memberEmail,
      organizationName,
      amount: transaction.totalAmount,
      dueDate: transaction.dueDate,
      periodStart: transaction.periodStart,
      periodEnd: transaction.periodEnd,
      transactionId: transaction.id,
      breakdown: {
        dues: transaction.duesAmount,
        cope: transaction.copeAmount || '0.00',
        pac: transaction.pacAmount || '0.00',
        strikeFund: transaction.strikeFundAmount || '0.00',
      },
      receiptUrl: transaction.receiptUrl || undefined,
    };

    // Send email
    await notificationService.send({
      organizationId: transaction.organizationId,
      recipientId: transaction.memberId,
      recipientEmail: memberEmail,
      type: 'email',
      priority: 'normal',
      subject: template.subject(data),
      title: template.title(data),
      body: template.body(data),
      htmlBody: template.htmlBody(data),
      templateId: template.id,
      metadata: {
        type: 'dues_payment_confirmation',
        transactionId: transaction.id,
      },
    });

    // Send push notification if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata = (memberMetadata as any) || {};
    if (metadata.firebaseToken) {
      await notificationService.send({
        organizationId: transaction.organizationId,
        recipientId: transaction.memberId,
        recipientFirebaseToken: metadata.firebaseToken,
        type: 'push',
        priority: 'normal',
        title: '✅ Payment Confirmed',
        body: `Your dues payment of $${transaction.totalAmount} was received`,
        templateId: template.id,
        metadata: {
          type: 'dues_payment_confirmation',
          transactionId: transaction.id,
        },
      });
    }

    logger.info('Payment confirmation sent', {
      transactionId,
      memberId: transaction.memberId,
    });
  } catch (error) {
    logger.error('Error sending payment confirmation', {
      error,
      transactionId,
    });
    // Don&apos;t throw - notification failure shouldn't block payment processing
  }
}

/**
 * Send payment failure notification
 * Called when a payment fails
 */
export async function sendPaymentFailure(
  transactionId: string,
  errorMessage: string,
  retryScheduled: boolean = false,
  retryDate?: string
): Promise<void> {
  try {
    logger.info('Sending payment failure notification', {
      transactionId,
      retryScheduled,
    });

    // Get transaction and member details
    const result = await db
      .select({
        transaction: duesTransactions,
        memberName: organizationMembers.name,
        memberEmail: organizationMembers.email,
        memberMetadata: organizationMembers.metadata,
      })
      .from(duesTransactions)
      .innerJoin(
        organizationMembers,
        eq(duesTransactions.memberId, organizationMembers.id)
      )
      .where(eq(duesTransactions.id, transactionId))
      .limit(1);

    if (!result || result.length === 0) {
      logger.warn('Transaction not found for payment failure notification', {
        transactionId,
      });
      return;
    }

    const { transaction, memberName, memberEmail, memberMetadata } = result[0];
    const notificationService = getNotificationService();
    const { organizationName } = await getOrganizationNotificationContext(transaction.organizationId);

    // Choose template based on retry status
    const template = retryScheduled
      ? DuesNotificationTemplates.DUES_PAYMENT_RETRY_SCHEDULED
      : DuesNotificationTemplates.DUES_PAYMENT_FAILED;

    const metadata = (transaction.metadata as Record<string, unknown>) || {};
    const attemptNumber = ((metadata.failureCount as number) || 0) + 1;

    const data: DuesNotificationData = {
      memberName,
      memberEmail,
      organizationName,
      amount: transaction.totalAmount,
      dueDate: transaction.dueDate,
      periodStart: transaction.periodStart,
      periodEnd: transaction.periodEnd,
      transactionId: transaction.id,
      failureReason: errorMessage,
      retryDate,
      attemptNumber,
      paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.unioneyes.ca'}/dashboard/dues/pay/${transaction.id}`,
    };

    // Send email
    await notificationService.send({
      organizationId: transaction.organizationId,
      recipientId: transaction.memberId,
      recipientEmail: memberEmail,
      type: 'email',
      priority: 'high',
      subject: template.subject(data),
      title: template.title(data),
      body: template.body(data),
      htmlBody: template.htmlBody(data),
      templateId: template.id,
      metadata: {
        type: retryScheduled ? 'dues_payment_retry_scheduled' : 'dues_payment_failed',
        transactionId: transaction.id,
      },
    });

    // Send push notification
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memberMeta = (memberMetadata as any) || {};
    if (memberMeta.firebaseToken) {
      await notificationService.send({
        organizationId: transaction.organizationId,
        recipientId: transaction.memberId,
        recipientFirebaseToken: memberMeta.firebaseToken,
        type: 'push',
        priority: 'high',
        title: retryScheduled ? 'Payment Retry Scheduled' : '⚠️ Payment Failed',
        body: retryScheduled
          ? `We&apos;ll retry your payment on ${retryDate}`
          : `Your payment of $${transaction.totalAmount} failed`,
        templateId: template.id,
        metadata: {
          type: retryScheduled ? 'dues_payment_retry_scheduled' : 'dues_payment_failed',
          transactionId: transaction.id,
        },
      });
    }

    logger.info('Payment failure notification sent', {
      transactionId,
      memberId: transaction.memberId,
      retryScheduled,
    });
  } catch (error) {
    logger.error('Error sending payment failure notification', {
      error,
      transactionId,
    });
    // Don&apos;t throw
  }
}

/**
 * Send admin intervention notification
 * Called when a member needs admin assistance (max retries reached)
 */
export async function sendAdminIntervention(
  transactionId: string
): Promise<void> {
  try {
    logger.info('Sending admin intervention notification', { transactionId });

    // Get transaction and member details
    const result = await db
      .select({
        transaction: duesTransactions,
        memberName: organizationMembers.name,
        memberEmail: organizationMembers.email,
      })
      .from(duesTransactions)
      .innerJoin(
        organizationMembers,
        eq(duesTransactions.memberId, organizationMembers.id)
      )
      .where(eq(duesTransactions.id, transactionId))
      .limit(1);

    if (!result || result.length === 0) {
      logger.warn('Transaction not found for admin intervention notification', {
        transactionId,
      });
      return;
    }

    const { transaction, memberName, memberEmail } = result[0];
    const notificationService = getNotificationService();
    const template = DuesNotificationTemplates.DUES_ADMIN_INTERVENTION;
    const { organizationName, adminEmails } = await getOrganizationNotificationContext(transaction.organizationId);

    const metadata = (transaction.metadata as Record<string, unknown>) || {};
    const attemptNumber = (metadata.failureCount as number) || 4;

    const data: DuesNotificationData = {
      memberName,
      memberEmail,
      organizationName,
      amount: transaction.totalAmount,
      dueDate: transaction.dueDate,
      periodStart: transaction.periodStart,
      periodEnd: transaction.periodEnd,
      transactionId: transaction.id,
      attemptNumber,
    };

    const recipients = adminEmails.length > 0
      ? adminEmails
      : [process.env.ADMIN_EMAIL || 'admin@unioneyes.ca'];

    await Promise.all(
      recipients.map((adminEmail) =>
        notificationService.send({
          organizationId: transaction.organizationId,
          recipientEmail: adminEmail,
          type: 'email',
          priority: 'urgent',
          subject: template.subject(data),
          title: template.title(data),
          body: template.body(data),
          htmlBody: template.htmlBody(data),
          templateId: template.id,
          metadata: {
            type: 'dues_admin_intervention',
            transactionId: transaction.id,
            memberId: transaction.memberId,
          },
        })
      )
    );

    logger.info('Admin intervention notification sent', {
      transactionId,
      memberId: transaction.memberId,
      attemptNumber,
    });
  } catch (error) {
    logger.error('Error sending admin intervention notification', {
      error,
      transactionId,
    });
    // Don&apos;t throw
  }
}

/**
 * Calculate retry date based on attempt number
 */
export function calculateRetryDate(attemptNumber: number): string {
  const now = new Date();
  let daysToAdd = 0;

  switch (attemptNumber) {
    case 1:
      daysToAdd = 1; // Retry in 1 day
      break;
    case 2:
      daysToAdd = 3; // Retry in 3 days
      break;
    case 3:
      daysToAdd = 7; // Retry in 7 days
      break;
    default:
      daysToAdd = 0; // No more retries
  }

  const retryDate = new Date(now);
  retryDate.setDate(now.getDate() + daysToAdd);

  return retryDate.toISOString().split('T')[0]; // YYYY-MM-DD format
}
