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
 * Each helper answers what became of the notice (`DuesNotificationOutcome`). A notice the provider did not accept, or that could not be sent, is a
 * failure the caller can see and record: the helpers never throw (a notice must not block the payment or the job that asked for it) and never report a
 * notice as sent that was refused, suppressed, bounced or of unknown outcome.
 * 
 * @module lib/services/dues-notifications
 */

import { v5 as uuidv5 } from 'uuid';
import { getNotificationService, type NotificationPayload } from '@/lib/services/notification-service';
import { DuesNotificationTemplates, DuesNotificationData } from '@/lib/notification-templates/dues-notifications';
import { db } from '@/db';
import { withSystemContext, type RLSTx } from '@/lib/db/with-rls-context';
import { organizationMembers, organizations } from '@/db/schema-organizations';
import { duesTransactions } from '@/db/schema/domains/finance/dues';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

/** What became of the notices one helper sent. */
export interface DuesNotificationOutcome {
  /** The member-facing (or, for the admin notice, at least one administrator's) email was accepted by the provider. */
  delivered: boolean;
  /** Why each notice that did not go out did not, one entry per notice: the channel and the reason. */
  failures: string[];
}

export interface DuesNotificationOptions {
  /**
   * Names this notice (for example `dues-retry:<transaction>:<failure count>`). Given one, every send carries a stable idempotency key derived from it, so
   * a repeat after the provider accepted the message, or after an attempt whose outcome is unknown, never calls the provider again.
   */
  dedupeKey?: string;
}

// A namespace for the idempotency keys of dues notices; the keys are uuids because the delivery ledger keys its rows by uuid.
const DEDUPE_NAMESPACE = '5d1c1f2e-62a4-4f3b-9c52-2f6f0b9e7a11';

/** The uuid idempotency key of one notice: the same parts always give the same key. */
export function duesNotificationKey(...parts: string[]): string {
  return uuidv5(parts.join('|'), DEDUPE_NAMESPACE);
}

interface Delivery {
  channel: 'email' | 'push';
  ok: boolean;
  detail?: string;
}

/** One send, answered by its delivery status: only an accepted (sent) or delivered message is a success. */
async function deliver(channel: Delivery['channel'], payload: NotificationPayload, dedupeKey?: string): Promise<Delivery> {
  try {
    const response = await getNotificationService().send(
      dedupeKey ? { ...payload, idempotencyKey: dedupeKey } : payload,
      { systemSteps: true },
    );
    if (response?.status === 'sent' || response?.status === 'delivered') return { channel, ok: true };
    const reason = response?.failureReason ? `: ${response.failureReason}` : '';
    return { channel, ok: false, detail: `${response?.status ?? 'no delivery status'}${reason}` };
  } catch (error) {
    return { channel, ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

function outcomeOf(deliveries: Delivery[]): DuesNotificationOutcome {
  return {
    delivered: deliveries.some((delivery) => delivery.channel === 'email' && delivery.ok),
    failures: deliveries.filter((delivery) => !delivery.ok).map((delivery) => `${delivery.channel}: ${delivery.detail}`),
  };
}

const notFound = (reason: string): DuesNotificationOutcome => ({ delivered: false, failures: [reason] });
const failed = (error: unknown): DuesNotificationOutcome => ({
  delivered: false,
  failures: [error instanceof Error ? error.message : String(error)],
});

const keyFor = (options: DuesNotificationOptions | undefined, ...parts: string[]) =>
  options?.dedupeKey ? duesNotificationKey(options.dedupeKey, ...parts) : undefined;

async function getOrganizationNotificationContext(organizationId: string, database: RLSTx = db): Promise<{
  organizationName: string;
  adminEmails: string[];
}> {
  const [org] = await database
    .select({
      name: organizations.name,
      email: organizations.email,
    })
    .from(organizations)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .where(eq(organizations.id, organizationId as any))
    .limit(1);

  // organization_members.organization_id is the organization uuid; the organization slug is not stored there
  const adminRoles = ['admin', 'super_admin', 'billing_manager', 'billing_specialist'];
  const adminMembers = await database
    .select({ email: organizationMembers.email })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
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

/**
 * The dues transaction, the member it belongs to, and the organization's name and administrators, read in one short system transaction.
 * These notices are sent by a payment webhook or a job, which has no tenant session: the system role reads across the organization, and the
 * transaction ends before any notice is sent (each delivery step then runs in its own short system transaction, see NotificationService.send).
 */
async function loadDuesNotificationContext(transactionId: string) {
  return withSystemContext(async (tx) => {
    const [found] = await tx
      .select({
        transaction: duesTransactions,
        memberName: organizationMembers.name,
        memberEmail: organizationMembers.email,
        memberMetadata: organizationMembers.metadata,
      })
      .from(duesTransactions)
      .innerJoin(
        organizationMembers,
        and(
          // dues_transactions.member_id is text; organization_members.id is a uuid
          eq(duesTransactions.memberId, sql`${organizationMembers.id}::text`),
          eq(organizationMembers.organizationId, duesTransactions.organizationId)
        )
      )
      .where(eq(duesTransactions.id, transactionId))
      .limit(1);
    if (!found) return null;
    const organization = await getOrganizationNotificationContext(found.transaction.organizationId, tx);
    return { ...found, ...organization };
  });
}

// =============================================================================
// NOTIFICATION HELPERS
// =============================================================================

/**
 * Send payment confirmation notification
 * Called when a payment is successfully processed
 */
export async function sendPaymentConfirmation(
  transactionId: string,
  options?: DuesNotificationOptions,
): Promise<DuesNotificationOutcome> {
  try {
    logger.info('Sending payment confirmation', { transactionId });

    // Get transaction and member details
    const loaded = await loadDuesNotificationContext(transactionId);

    if (!loaded) {
      logger.warn('Transaction not found for payment confirmation', {
        transactionId,
      });
      return notFound('transaction not found');
    }

    const { transaction, memberName, memberEmail, memberMetadata, organizationName } = loaded;
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

    const deliveries: Delivery[] = [];

    // Send email
    deliveries.push(await deliver('email', {
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
    }, keyFor(options, 'email')));

    // Send push notification if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata = (memberMetadata as any) || {};
    if (metadata.firebaseToken) {
      deliveries.push(await deliver('push', {
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
      }, keyFor(options, 'push')));
    }

    const outcome = outcomeOf(deliveries);
    if (outcome.delivered) {
      logger.info('Payment confirmation sent', { transactionId, memberId: transaction.memberId, failures: outcome.failures });
    } else {
      logger.warn('Payment confirmation was not delivered', { transactionId, memberId: transaction.memberId, failures: outcome.failures });
    }
    return outcome;
  } catch (error) {
    logger.error('Error sending payment confirmation', {
      error,
      transactionId,
    });
    // Don't throw - notification failure shouldn't block payment processing
    return failed(error);
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
  retryDate?: string,
  options?: DuesNotificationOptions,
): Promise<DuesNotificationOutcome> {
  try {
    logger.info('Sending payment failure notification', {
      transactionId,
      retryScheduled,
    });

    // Get transaction and member details
    const loaded = await loadDuesNotificationContext(transactionId);

    if (!loaded) {
      logger.warn('Transaction not found for payment failure notification', {
        transactionId,
      });
      return notFound('transaction not found');
    }

    const { transaction, memberName, memberEmail, memberMetadata, organizationName } = loaded;

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
      paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://unioneyes.app'}/dashboard/dues/pay/${transaction.id}`,
    };

    const deliveries: Delivery[] = [];

    // Send email
    deliveries.push(await deliver('email', {
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
    }, keyFor(options, 'email')));

    // Send push notification
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memberMeta = (memberMetadata as any) || {};
    if (memberMeta.firebaseToken) {
      deliveries.push(await deliver('push', {
        organizationId: transaction.organizationId,
        recipientId: transaction.memberId,
        recipientFirebaseToken: memberMeta.firebaseToken,
        type: 'push',
        priority: 'high',
        title: retryScheduled ? 'Payment Retry Scheduled' : '⚠️ Payment Failed',
        body: retryScheduled
          ? `We'll retry your payment on ${retryDate}`
          : `Your payment of $${transaction.totalAmount} failed`,
        templateId: template.id,
        metadata: {
          type: retryScheduled ? 'dues_payment_retry_scheduled' : 'dues_payment_failed',
          transactionId: transaction.id,
        },
      }, keyFor(options, 'push')));
    }

    const outcome = outcomeOf(deliveries);
    if (outcome.delivered) {
      logger.info('Payment failure notification sent', { transactionId, memberId: transaction.memberId, retryScheduled, failures: outcome.failures });
    } else {
      logger.warn('Payment failure notification was not delivered', { transactionId, memberId: transaction.memberId, retryScheduled, failures: outcome.failures });
    }
    return outcome;
  } catch (error) {
    logger.error('Error sending payment failure notification', {
      error,
      transactionId,
    });
    // Don't throw
    return failed(error);
  }
}

/**
 * Send admin intervention notification
 * Called when a member needs admin assistance (max retries reached)
 */
export async function sendAdminIntervention(
  transactionId: string,
  options?: DuesNotificationOptions,
): Promise<DuesNotificationOutcome> {
  try {
    logger.info('Sending admin intervention notification', { transactionId });

    // Get transaction and member details
    const loaded = await loadDuesNotificationContext(transactionId);

    if (!loaded) {
      logger.warn('Transaction not found for admin intervention notification', {
        transactionId,
      });
      return notFound('transaction not found');
    }

    const { transaction, memberName, memberEmail, organizationName, adminEmails } = loaded;
    const template = DuesNotificationTemplates.DUES_ADMIN_INTERVENTION;

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
      : [process.env.ADMIN_EMAIL || 'admin@unioneyes.app'];

    const deliveries = await Promise.all(
      recipients.map((adminEmail) =>
        deliver('email', {
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
        }, keyFor(options, 'admin', adminEmail))
      )
    );

    const outcome = outcomeOf(deliveries);
    if (outcome.delivered) {
      logger.info('Admin intervention notification sent', {
        transactionId,
        memberId: transaction.memberId,
        attemptNumber,
        failures: outcome.failures,
      });
    } else {
      logger.warn('Admin intervention notification was not delivered', {
        transactionId,
        memberId: transaction.memberId,
        attemptNumber,
        failures: outcome.failures,
      });
    }
    return outcome;
  } catch (error) {
    logger.error('Error sending admin intervention notification', {
      error,
      transactionId,
    });
    // Don't throw
    return failed(error);
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
