/**
 * Dues Reminder Scheduler
 * Automated reminders for dues payments
 * 
 * Sends notifications:
 * - 7 days before due date
 * - 1 day before due date
 * - When payment becomes overdue
 * 
 * Runs daily at 09:00 UTC
 * 
 * @module lib/jobs/dues-reminder-scheduler
 */

import { withSystemContext, type RLSTx } from '@/lib/db/with-rls-context';
import { duesTransactions } from '@/db/schema/domains/finance/dues';
import { organizationMembers, organizations } from '@/db/schema-organizations';
import { eq, and, sql, type SQL } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { getNotificationService } from '@/lib/services/notification-service';
import { DuesNotificationTemplates, DuesNotificationData } from '@/lib/notification-templates/dues-notifications';

// =============================================================================
// TYPES
// =============================================================================

export interface ReminderResult {
  totalProcessed: number;
  remindersSent: number;
  remindersFailed: number;
  breakdown: {
    sevenDayReminders: number;
    oneDayReminders: number;
    overdueNotices: number;
  };
  results: Array<{
    transactionId: string;
    memberId: string;
    reminderType: '7day' | '1day' | 'overdue';
    result: 'sent' | 'failed';
    error?: string;
  }>;
}

interface DuesTransactionRow {
  id: string;
  memberId: string;
  organizationId: string;
  totalAmount: string;
  duesAmount: string;
  copeAmount: string | null;
  pacAmount: string | null;
  strikeFundAmount: string | null;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  metadata: any;
}

// =============================================================================
// DUES REMINDER SCHEDULER
// =============================================================================

/** Ids of organization members are uuids; a dues transaction keeps the member id as text. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Platform job: it reads the dues of every organization, so it runs as the system role, which only the platform-gated routes that trigger it
 * may reach. The scans are one system transaction; each reminder (member lookup, notification, mark) is a system transaction of its own,
 * so a statement that fails for one transaction rolls back only that reminder and the reminders after it still run and commit.
 */
export class DuesReminderScheduler {
  /**
   * Run dues reminder job
   * Sends all due reminders (7-day, 1-day, overdue)
   */
  static async runReminderJob(): Promise<ReminderResult> {
    const startTime = Date.now();

    logger.info('Starting dues reminder job');

    const result: ReminderResult = {
      totalProcessed: 0,
      remindersSent: 0,
      remindersFailed: 0,
      breakdown: {
        sevenDayReminders: 0,
        oneDayReminders: 0,
        overdueNotices: 0,
      },
      results: [],
    };

    try {
      // Get transactions needing reminders
      const sevenDayTransactions = await this.getTransactionsForSevenDayReminder();
      const oneDayTransactions = await this.getTransactionsForOneDayReminder();
      const overdueTransactions = await this.getOverdueTransactions();

      logger.info('Transactions needing reminders', {
        sevenDay: sevenDayTransactions.length,
        oneDay: oneDayTransactions.length,
        overdue: overdueTransactions.length,
      });

      // Send 7-day reminders
      for (const txn of sevenDayTransactions) {
        result.totalProcessed++;
        const sent = await this.sendSevenDayReminder(txn);
        if (sent) {
          result.remindersSent++;
          result.breakdown.sevenDayReminders++;
          result.results.push({
            transactionId: txn.id,
            memberId: txn.memberId,
            reminderType: '7day',
            result: 'sent',
          });
        } else {
          result.remindersFailed++;
          result.results.push({
            transactionId: txn.id,
            memberId: txn.memberId,
            reminderType: '7day',
            result: 'failed',
          });
        }
      }

      // Send 1-day reminders
      for (const txn of oneDayTransactions) {
        result.totalProcessed++;
        const sent = await this.sendOneDayReminder(txn);
        if (sent) {
          result.remindersSent++;
          result.breakdown.oneDayReminders++;
          result.results.push({
            transactionId: txn.id,
            memberId: txn.memberId,
            reminderType: '1day',
            result: 'sent',
          });
        } else {
          result.remindersFailed++;
          result.results.push({
            transactionId: txn.id,
            memberId: txn.memberId,
            reminderType: '1day',
            result: 'failed',
          });
        }
      }

      // Send overdue notices
      for (const txn of overdueTransactions) {
        result.totalProcessed++;
        const sent = await this.sendOverdueNotice(txn);
        if (sent) {
          result.remindersSent++;
          result.breakdown.overdueNotices++;
          result.results.push({
            transactionId: txn.id,
            memberId: txn.memberId,
            reminderType: 'overdue',
            result: 'sent',
          });
        } else {
          result.remindersFailed++;
          result.results.push({
            transactionId: txn.id,
            memberId: txn.memberId,
            reminderType: 'overdue',
            result: 'failed',
          });
        }
      }

      const executionTime = Date.now() - startTime;
      logger.info('Dues reminder job completed', {
        ...result,
        executionTimeMs: executionTime,
      });

      return result;
    } catch (error) {
      logger.error('Error running dues reminder job', { error });
      throw error;
    }
  }

  /**
   * Pending dues of every organization that match a due-date window (cross-organization read, system role)
   */
  private static async selectPending(dueDateWindow: SQL): Promise<DuesTransactionRow[]> {
    return withSystemContext((tx) =>
      tx
        .select({
          id: duesTransactions.id,
          memberId: duesTransactions.memberId,
          organizationId: duesTransactions.organizationId,
          totalAmount: duesTransactions.totalAmount,
          duesAmount: duesTransactions.duesAmount,
          copeAmount: duesTransactions.copeAmount,
          pacAmount: duesTransactions.pacAmount,
          strikeFundAmount: duesTransactions.strikeFundAmount,
          dueDate: duesTransactions.dueDate,
          periodStart: duesTransactions.periodStart,
          periodEnd: duesTransactions.periodEnd,
          status: duesTransactions.status,
          metadata: duesTransactions.metadata,
        })
        .from(duesTransactions)
        .where(and(eq(duesTransactions.status, 'pending'), dueDateWindow)),
    );
  }

  /**
   * Get transactions needing 7-day reminder
   */
  private static async getTransactionsForSevenDayReminder(): Promise<DuesTransactionRow[]> {
    try {
      const today = new Date();
      const sevenDaysFromNow = new Date(today);
      sevenDaysFromNow.setDate(today.getDate() + 7);

      // Format dates as YYYY-MM-DD for comparison
      const targetDate = sevenDaysFromNow.toISOString().split('T')[0];

      const transactions = await this.selectPending(sql`${duesTransactions.dueDate}::text = ${targetDate}`);

      // Filter out transactions that already have 7-day reminder sent
      return transactions.filter((txn) => {
        const metadata = (txn.metadata as Record<string, unknown>) || {};
        return !metadata.sevenDayReminderSent;
      });
    } catch (error) {
      logger.error('Error getting transactions for 7-day reminder', { error });
      throw error;
    }
  }

  /**
   * Get transactions needing 1-day reminder
   */
  private static async getTransactionsForOneDayReminder(): Promise<DuesTransactionRow[]> {
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      const targetDate = tomorrow.toISOString().split('T')[0];

      const transactions = await this.selectPending(sql`${duesTransactions.dueDate}::text = ${targetDate}`);

      // Filter out transactions that already have 1-day reminder sent
      return transactions.filter((txn) => {
        const metadata = (txn.metadata as Record<string, unknown>) || {};
        return !metadata.oneDayReminderSent;
      });
    } catch (error) {
      logger.error('Error getting transactions for 1-day reminder', { error });
      throw error;
    }
  }

  /**
   * Get overdue transactions
   */
  private static async getOverdueTransactions(): Promise<DuesTransactionRow[]> {
    try {
      const today = new Date().toISOString().split('T')[0];

      const transactions = await this.selectPending(sql`${duesTransactions.dueDate}::text < ${today}`);

      // Filter: send overdue notice only once per day
      const now = new Date();
      return transactions.filter((txn) => {
        const metadata = (txn.metadata as Record<string, unknown>) || {};
        const lastOverdueNotice = metadata.lastOverdueNotice
          ? new Date(metadata.lastOverdueNotice as string)
          : null;

        if (!lastOverdueNotice) return true; // Never sent

        // Send if last notice was more than 24 hours ago
        const hoursSinceLastNotice =
          (now.getTime() - lastOverdueNotice.getTime()) / (1000 * 60 * 60);
        return hoursSinceLastNotice >= 24;
      });
    } catch (error) {
      logger.error('Error getting overdue transactions', { error });
      throw error;
    }
  }

  /**
   * Send 7-day reminder. The member lookup, the notification and the mark are one system transaction: it commits as a whole or, when anything
   * in it fails, rolls back as a whole.
   */
  private static async sendSevenDayReminder(transaction: DuesTransactionRow): Promise<boolean> {
    try {
      return await withSystemContext(async (tx) => {
        // Get member details
        const member = await this.getMemberDetails(tx, transaction.organizationId, transaction.memberId);
        if (!member) {
          logger.warn('Member not found for 7-day reminder', {
            memberId: transaction.memberId,
          });
          return false;
        }

        const notificationService = getNotificationService();
        const template = DuesNotificationTemplates.DUES_REMINDER_7_DAYS;

        const organizationName = await this.getOrganizationName(tx, transaction.organizationId);
        const data: DuesNotificationData = {
          memberName: member.name,
          memberEmail: member.email,
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
          paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://unioneyes.app'}/dashboard/dues/pay/${transaction.id}`,
        };

        // Send email
        await notificationService.send({
          organizationId: transaction.organizationId,
          recipientId: transaction.memberId,
          recipientEmail: member.email,
          type: 'email',
          priority: 'normal',
          subject: template.subject(data),
          title: template.title(data),
          body: template.body(data),
          htmlBody: template.htmlBody(data),
          templateId: template.id,
          metadata: {
            type: 'dues_reminder_7days',
            transactionId: transaction.id,
          },
        });

        // Mark as sent in metadata
        await tx
          .update(duesTransactions)
          .set({
            metadata: sql`jsonb_set(
              COALESCE(${duesTransactions.metadata}, '{}'::jsonb),
              '{sevenDayReminderSent}',
              'true'::jsonb
            )`,
            updatedAt: new Date(),
          })
          .where(and(eq(duesTransactions.id, transaction.id), eq(duesTransactions.organizationId, transaction.organizationId)));

        logger.info('7-day reminder sent', {
          transactionId: transaction.id,
          memberId: transaction.memberId,
        });

        return true;
      });
    } catch (error) {
      logger.error('Error sending 7-day reminder', {
        error,
        transactionId: transaction.id,
      });
      return false;
    }
  }

  /**
   * Send 1-day reminder (one system transaction, as the 7-day reminder)
   */
  private static async sendOneDayReminder(transaction: DuesTransactionRow): Promise<boolean> {
    try {
      return await withSystemContext(async (tx) => {
        const member = await this.getMemberDetails(tx, transaction.organizationId, transaction.memberId);
        if (!member) {
          logger.warn('Member not found for 1-day reminder', {
            memberId: transaction.memberId,
          });
          return false;
        }

        const notificationService = getNotificationService();
        const template = DuesNotificationTemplates.DUES_REMINDER_1_DAY;

        const organizationName = await this.getOrganizationName(tx, transaction.organizationId);
        const data: DuesNotificationData = {
          memberName: member.name,
          memberEmail: member.email,
          organizationName,
          amount: transaction.totalAmount,
          dueDate: transaction.dueDate,
          periodStart: transaction.periodStart,
          periodEnd: transaction.periodEnd,
          transactionId: transaction.id,
          paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://unioneyes.app'}/dashboard/dues/pay/${transaction.id}`,
        };

        // Send email
        await notificationService.send({
          organizationId: transaction.organizationId,
          recipientId: transaction.memberId,
          recipientEmail: member.email,
          type: 'email',
          priority: 'high',
          subject: template.subject(data),
          title: template.title(data),
          body: template.body(data),
          htmlBody: template.htmlBody(data),
          templateId: template.id,
          metadata: {
            type: 'dues_reminder_1day',
            transactionId: transaction.id,
          },
        });

        // Send push notification if available
        if (member.firebaseToken) {
          await notificationService.send({
            organizationId: transaction.organizationId,
            recipientId: transaction.memberId,
            recipientFirebaseToken: member.firebaseToken,
            type: 'push',
            priority: 'high',
            title: template.title(data),
            body: `Your dues payment of $${transaction.totalAmount} is due tomorrow`,
            templateId: template.id,
            metadata: {
              type: 'dues_reminder_1day',
              transactionId: transaction.id,
            },
          });
        }

        // Mark as sent
        await tx
          .update(duesTransactions)
          .set({
            metadata: sql`jsonb_set(
              COALESCE(${duesTransactions.metadata}, '{}'::jsonb),
              '{oneDayReminderSent}',
              'true'::jsonb
            )`,
            updatedAt: new Date(),
          })
          .where(and(eq(duesTransactions.id, transaction.id), eq(duesTransactions.organizationId, transaction.organizationId)));

        logger.info('1-day reminder sent', {
          transactionId: transaction.id,
          memberId: transaction.memberId,
        });

        return true;
      });
    } catch (error) {
      logger.error('Error sending 1-day reminder', {
        error,
        transactionId: transaction.id,
      });
      return false;
    }
  }

  /**
   * Send overdue notice (one system transaction, as the 7-day reminder)
   */
  private static async sendOverdueNotice(transaction: DuesTransactionRow): Promise<boolean> {
    try {
      return await withSystemContext(async (tx) => {
        const member = await this.getMemberDetails(tx, transaction.organizationId, transaction.memberId);
        if (!member) {
          logger.warn('Member not found for overdue notice', {
            memberId: transaction.memberId,
          });
          return false;
        }

        const notificationService = getNotificationService();
        const template = DuesNotificationTemplates.DUES_OVERDUE;

        const organizationName = await this.getOrganizationName(tx, transaction.organizationId);
        const data: DuesNotificationData = {
          memberName: member.name,
          memberEmail: member.email,
          organizationName,
          amount: transaction.totalAmount,
          dueDate: transaction.dueDate,
          periodStart: transaction.periodStart,
          periodEnd: transaction.periodEnd,
          transactionId: transaction.id,
          paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://unioneyes.app'}/dashboard/dues/pay/${transaction.id}`,
        };

        // Send email
        await notificationService.send({
          organizationId: transaction.organizationId,
          recipientId: transaction.memberId,
          recipientEmail: member.email,
          type: 'email',
          priority: 'urgent',
          subject: template.subject(data),
          title: template.title(data),
          body: template.body(data),
          htmlBody: template.htmlBody(data),
          templateId: template.id,
          metadata: {
            type: 'dues_overdue',
            transactionId: transaction.id,
          },
        });

        // Send push notification
        if (member.firebaseToken) {
          await notificationService.send({
            organizationId: transaction.organizationId,
            recipientId: transaction.memberId,
            recipientFirebaseToken: member.firebaseToken,
            type: 'push',
            priority: 'urgent',
            title: '🔴 Payment Overdue',
            body: `Your dues payment of $${transaction.totalAmount} is overdue`,
            templateId: template.id,
            metadata: {
              type: 'dues_overdue',
              transactionId: transaction.id,
            },
          });
        }

        // Update status to overdue and mark notice sent
        await tx
          .update(duesTransactions)
          .set({
            status: 'overdue',
            metadata: sql`jsonb_set(
              COALESCE(${duesTransactions.metadata}, '{}'::jsonb),
              '{lastOverdueNotice}',
              to_jsonb(now()::text)
            )`,
            updatedAt: new Date(),
          })
          .where(and(eq(duesTransactions.id, transaction.id), eq(duesTransactions.organizationId, transaction.organizationId)));

        logger.info('Overdue notice sent', {
          transactionId: transaction.id,
          memberId: transaction.memberId,
        });

        return true;
      });
    } catch (error) {
      logger.error('Error sending overdue notice', {
        error,
        transactionId: transaction.id,
      });
      return false;
    }
  }

  /**
   * Get member details. A database failure propagates: it must fail the reminder, never read as "member not found".
   */
  private static async getMemberDetails(
    tx: RLSTx,
    organizationId: string,
    memberId: string
  ): Promise<{ name: string; email: string; firebaseToken?: string } | null> {
    // A dues transaction keeps the member id as text; only a uuid can name an organization member
    if (!UUID.test(memberId)) return null;

    // Cross-organization role: the member must belong to the organization of the dues transaction
    const member = await tx
      .select({
        name: organizationMembers.name,
        email: organizationMembers.email,
        metadata: organizationMembers.metadata,
      })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.id, memberId), eq(organizationMembers.organizationId, organizationId)))
      .limit(1);

    if (!member || member.length === 0) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadata = (member[0].metadata as any) || {};
    return {
      name: member[0].name,
      email: member[0].email,
      firebaseToken: metadata.firebaseToken,
    };
  }

  private static async getOrganizationName(tx: RLSTx, organizationId: string): Promise<string> {
    const [org] = await tx
      .select({ name: organizations.name })
      .from(organizations)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .where(eq(organizations.id, organizationId as any))
      .limit(1);

    return org?.name || 'UnionEyes';
  }
}

// =============================================================================
// CRON JOB HANDLER
// =============================================================================

/**
 * Run dues reminder job (daily at 09:00 UTC)
 * 
 * Usage with cron library:
 * ```
 * cron.schedule('0 9 * * *', async () => {
 *   await runDuesReminders();
 * });
 * ```
 */
export async function runDuesReminders(): Promise<ReminderResult> {
  return DuesReminderScheduler.runReminderJob();
}

/**
 * Manual trigger for dues reminders (for testing)
 */
export async function manualTriggerReminders(): Promise<ReminderResult> {
  logger.info('Manual trigger for dues reminders');
  return DuesReminderScheduler.runReminderJob();
}
