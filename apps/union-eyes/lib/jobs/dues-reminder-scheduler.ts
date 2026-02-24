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

import { db } from '@/db';
import { duesTransactions } from '@/db/schema/domains/finance/dues';
import { organizationMembers, organizations } from '@/db/schema-organizations';
import { eq, and, sql } from 'drizzle-orm';
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
  metadata: unknown;
}

// =============================================================================
// DUES REMINDER SCHEDULER
// =============================================================================

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
   * Get transactions needing 7-day reminder
   */
  private static async getTransactionsForSevenDayReminder(): Promise<DuesTransactionRow[]> {
    try {
      const today = new Date();
      const sevenDaysFromNow = new Date(today);
      sevenDaysFromNow.setDate(today.getDate() + 7);

      // Format dates as YYYY-MM-DD for comparison
      const targetDate = sevenDaysFromNow.toISOString().split('T')[0];

      const transactions = await db
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
        .where(
          and(
            eq(duesTransactions.status, 'pending'),
            sql`${duesTransactions.dueDate}::text = ${targetDate}`
          )
        );

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

      const transactions = await db
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
        .where(
          and(
            eq(duesTransactions.status, 'pending'),
            sql`${duesTransactions.dueDate}::text = ${targetDate}`
          )
        );

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

      const transactions = await db
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
        .where(
          and(
            eq(duesTransactions.status, 'pending'),
            sql`${duesTransactions.dueDate}::text < ${today}`
          )
        );

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
   * Send 7-day reminder
   */
  private static async sendSevenDayReminder(transaction: DuesTransactionRow): Promise<boolean> {
    try {
      // Get member details
      const member = await this.getMemberDetails(transaction.memberId);
      if (!member) {
        logger.warn('Member not found for 7-day reminder', {
          memberId: transaction.memberId,
        });
        return false;
      }

      const notificationService = getNotificationService();
      const template = DuesNotificationTemplates.DUES_REMINDER_7_DAYS;

      const organizationName = await this.getOrganizationName(transaction.organizationId);
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
        paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.unioneyes.ca'}/dashboard/dues/pay/${transaction.id}`,
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
      await db
        .update(duesTransactions)
        .set({
          metadata: sql`jsonb_set(
            COALESCE(${duesTransactions.metadata}, '{}'::jsonb),
            '{sevenDayReminderSent}',
            'true'::jsonb
          )`,
          updatedAt: new Date(),
        })
        .where(eq(duesTransactions.id, transaction.id));

      logger.info('7-day reminder sent', {
        transactionId: transaction.id,
        memberId: transaction.memberId,
      });

      return true;
    } catch (error) {
      logger.error('Error sending 7-day reminder', {
        error,
        transactionId: transaction.id,
      });
      return false;
    }
  }

  /**
   * Send 1-day reminder
   */
  private static async sendOneDayReminder(transaction: DuesTransactionRow): Promise<boolean> {
    try {
      const member = await this.getMemberDetails(transaction.memberId);
      if (!member) {
        logger.warn('Member not found for 1-day reminder', {
          memberId: transaction.memberId,
        });
        return false;
      }

      const notificationService = getNotificationService();
      const template = DuesNotificationTemplates.DUES_REMINDER_1_DAY;

      const organizationName = await this.getOrganizationName(transaction.organizationId);
      const data: DuesNotificationData = {
        memberName: member.name,
        memberEmail: member.email,
        organizationName,
        amount: transaction.totalAmount,
        dueDate: transaction.dueDate,
        periodStart: transaction.periodStart,
        periodEnd: transaction.periodEnd,
        transactionId: transaction.id,
        paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.unioneyes.ca'}/dashboard/dues/pay/${transaction.id}`,
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
      await db
        .update(duesTransactions)
        .set({
          metadata: sql`jsonb_set(
            COALESCE(${duesTransactions.metadata}, '{}'::jsonb),
            '{oneDayReminderSent}',
            'true'::jsonb
          )`,
          updatedAt: new Date(),
        })
        .where(eq(duesTransactions.id, transaction.id));

      logger.info('1-day reminder sent', {
        transactionId: transaction.id,
        memberId: transaction.memberId,
      });

      return true;
    } catch (error) {
      logger.error('Error sending 1-day reminder', {
        error,
        transactionId: transaction.id,
      });
      return false;
    }
  }

  /**
   * Send overdue notice
   */
  private static async sendOverdueNotice(transaction: DuesTransactionRow): Promise<boolean> {
    try {
      const member = await this.getMemberDetails(transaction.memberId);
      if (!member) {
        logger.warn('Member not found for overdue notice', {
          memberId: transaction.memberId,
        });
        return false;
      }

      const notificationService = getNotificationService();
      const template = DuesNotificationTemplates.DUES_OVERDUE;

      const organizationName = await this.getOrganizationName(transaction.organizationId);
      const data: DuesNotificationData = {
        memberName: member.name,
        memberEmail: member.email,
        organizationName,
        amount: transaction.totalAmount,
        dueDate: transaction.dueDate,
        periodStart: transaction.periodStart,
        periodEnd: transaction.periodEnd,
        transactionId: transaction.id,
        paymentUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.unioneyes.ca'}/dashboard/dues/pay/${transaction.id}`,
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
      await db
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
        .where(eq(duesTransactions.id, transaction.id));

      logger.info('Overdue notice sent', {
        transactionId: transaction.id,
        memberId: transaction.memberId,
      });

      return true;
    } catch (error) {
      logger.error('Error sending overdue notice', {
        error,
        transactionId: transaction.id,
      });
      return false;
    }
  }

  /**
   * Get member details
   */
  private static async getMemberDetails(
    memberId: string
  ): Promise<{ name: string; email: string; firebaseToken?: string } | null> {
    try {
      const member = await db
        .select({
          name: organizationMembers.name,
          email: organizationMembers.email,
          metadata: organizationMembers.metadata,
        })
        .from(organizationMembers)
        .where(eq(organizationMembers.id, memberId))
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
    } catch (error) {
      logger.error('Error getting member details', { error, memberId });
      return null;
    }
  }

  private static async getOrganizationName(organizationId: string): Promise<string> {
    try {
      const [org] = await db
        .select({ name: organizations.name })
        .from(organizations)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .where(eq(organizations.id, organizationId as any))
        .limit(1);

      return org?.name || 'UnionEyes';
    } catch (error) {
      logger.error('Error getting organization name', { error, organizationId });
      return 'UnionEyes';
    }
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
