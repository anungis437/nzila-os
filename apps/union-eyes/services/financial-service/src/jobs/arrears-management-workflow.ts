/**
 * Arrears Management Workflow
 * Week 11: Workflow Automation
 * 
 * Runs weekly on Sundays at 3:00 AM
 * Scans for overdue payments and sends stage-based notifications
 */

import cron from 'node-cron';
import winston from 'winston';
import { db } from '../db';
import { 
  duesTransactions,
  arrears,
  members
} from '../db/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import { queueNotification } from '../services/notification-service';
import { logger } from '@/lib/logger';

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

/**
 * Scan for overdue dues and create/update arrears records
 */
export async function processArrearsManagement(params: {
  tenantId: string;
  scanDate?: Date;
}): Promise<{
  success: boolean;
  overdueTransactions: number;
  arrearsCreated: number;
  notificationsSent: number;
  errors: Array<{ transactionId: string; error: string }>;
}> {
  const { tenantId, scanDate = new Date() } = params;
  
  logger.info('Starting arrears management scan', { 
    tenantId, 
    scanDate: scanDate.toISOString() 
  });

  let overdueTransactions = 0;
  let arrearsCreated = 0;
  let notificationsSent = 0;
  const errors: Array<{ transactionId: string; error: string }> = [];

  try {
    // Find all overdue transactions (due date passed, status not 'paid')
    const overdueRecords = await db
      .select({
        transactionId: duesTransactions.id,
        memberId: duesTransactions.memberId,
        amount: duesTransactions.amount,
        dueDate: duesTransactions.dueDate,
        periodStart: duesTransactions.periodStart,
        periodEnd: duesTransactions.periodEnd,
        memberName: sql<string>`CONCAT(${members.firstName}, ' ', ${members.lastName})`,
        memberEmail: members.email,
      })
      .from(duesTransactions)
      .innerJoin(members, eq(duesTransactions.memberId, members.id))
      .where(
        and(
          eq(duesTransactions.organizationId, tenantId),
          lt(duesTransactions.dueDate, scanDate.toISOString().split('T')[0]),
          eq(duesTransactions.status, 'pending')
        )
      );

    logger.info(`Found ${overdueRecords.length} overdue transactions`);
    overdueTransactions = overdueRecords.length;

    for (const record of overdueRecords) {
      try {
        // Check if arrears record already exists
        const existingArrears = await db
          .select()
          .from(arrears)
          .where(
            and(
              eq(arrears.tenantId, tenantId),
              eq(arrears.memberId, record.memberId),
              eq(arrears.arrearsStatus, 'active')
            )
          )
          .limit(1);

        const daysOverdue = Math.floor(
          (scanDate.getTime() - new Date(record.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Determine notification stage based on days overdue
        let notificationStage: 'reminder' | 'warning' | 'final_notice' | 'suspension' = 'reminder';
        if (daysOverdue > 60) {
          notificationStage = 'suspension';
        } else if (daysOverdue > 45) {
          notificationStage = 'final_notice';
        } else if (daysOverdue > 30) {
          notificationStage = 'warning';
        }

        if (existingArrears.length === 0) {
          // Create new arrears record
          await db.insert(arrears).values({
            tenantId,
            memberId: record.memberId,
            totalOwed: record.amount,
            oldestDebtDate: record.dueDate,
            arrearsStatus: 'active',
            notes: `1 overdue transaction(s), ${daysOverdue} days overdue. Last notification: ${scanDate.toISOString()}`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);

          arrearsCreated++;
          logger.info(`Created arrears record for member ${record.memberId}`);
        } else {
          // Update existing arrears record
          const currentTotal = Number(existingArrears[0].totalOwed) + Number(record.amount);

          await db
            .update(arrears)
            .set({
              totalOwed: currentTotal.toString(),
              notes: `Multiple overdue transactions, ${daysOverdue} days overdue. Last notification: ${scanDate.toISOString()}`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)
            .where(eq(arrears.id, existingArrears[0].id));

          logger.info(`Updated arrears record for member ${record.memberId}`);
        }

        // Send notification based on stage
        await queueNotification({
          organizationId: tenantId,
          userId: record.memberId,
          type: 'payment_reminder',
          channels: notificationStage === 'suspension' ? ['email', 'sms'] : ['email'],
          priority: notificationStage === 'suspension' ? 'urgent' : 'normal',
          data: {
            memberName: record.memberName,
            amountOwed: record.amount,
            dueDate: record.dueDate,
            daysOverdue: daysOverdue.toString(),
            notificationStage,
            message: getNotificationMessage(notificationStage, daysOverdue, Number(record.amount)),
            paymentUrl: `${process.env.APP_URL}/payments/dues`,
          },
        });

        notificationsSent++;

        // Update transaction status
        await db
          .update(duesTransactions)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .set({ status: 'overdue', updatedAt: scanDate } as any)
          .where(eq(duesTransactions.id, record.transactionId));

      } catch (recordError) {
        logger.error(`Error processing overdue transaction ${record.transactionId}`, { error: recordError });
        errors.push({
          transactionId: record.transactionId,
          error: String(recordError),
        });
      }
    }

    logger.info('Arrears management scan completed', {
      overdueTransactions,
      arrearsCreated,
      notificationsSent,
      errorsCount: errors.length,
    });

    return {
      success: true,
      overdueTransactions,
      arrearsCreated,
      notificationsSent,
      errors,
    };

  } catch (error) {
    logger.error('Error in arrears management', { error });
    return {
      success: false,
      overdueTransactions,
      arrearsCreated,
      notificationsSent,
      errors: [{ transactionId: 'system', error: String(error) }],
    };
  }
}

/**
 * Generate stage-appropriate notification message
 */
function getNotificationMessage(stage: string, daysOverdue: number, amount: number): string {
  switch (stage) {
    case 'reminder':
      return `Friendly reminder: Your union dues payment of $${amount.toFixed(2)} is ${daysOverdue} days overdue. Please submit payment at your earliest convenience.`;
    case 'warning':
      return `IMPORTANT: Your union dues payment of $${amount.toFixed(2)} is now ${daysOverdue} days overdue. Immediate payment is required to avoid further action.`;
    case 'final_notice':
      return `FINAL NOTICE: Your union dues payment of $${amount.toFixed(2)} is ${daysOverdue} days overdue. Payment must be received within 15 days to avoid suspension of union benefits.`;
    case 'suspension':
      return `SUSPENSION NOTICE: Due to non-payment of $${amount.toFixed(2)} (${daysOverdue} days overdue), your union benefits have been suspended. Contact the union office immediately to arrange payment and reinstatement.`;
    default:
      return `Your union dues payment of $${amount.toFixed(2)} is overdue. Please submit payment as soon as possible.`;
  }
}

/**
 * Cron job: Runs weekly on Sundays at 3:00 AM
 */
export const weeklyArrearsManagementJob = cron.schedule('0 3 * * 0', async () => {
  try {
    logger.info('Starting scheduled arrears management scan...');
    
    // In production, iterate through all tenants
    const tenantId = '11111111-1111-1111-1111-111111111111'; // Test tenant
    
    const result = await processArrearsManagement({ tenantId });
    
    logger.info('Scheduled arrears management completed', {
      overdueTransactions: result.overdueTransactions,
      arrearsCreated: result.arrearsCreated,
      notificationsSent: result.notificationsSent,
      errors: result.errors.length,
    });
  } catch (error) {
    logger.error('Error in arrears management job', { error });
  }
}, {
  scheduled: false,
  timezone: 'America/Toronto',
});

/**
 * Start the arrears management workflow
 */
export function startArrearsManagementWorkflow(): void {
  weeklyArrearsManagementJob.start();
  logger.info('✓ Arrears management workflow started (Sundays, 3:00 AM)');
}

/**
 * Stop the arrears management workflow
 */
export function stopArrearsManagementWorkflow(): void {
  weeklyArrearsManagementJob.stop();
  logger.info('Arrears management workflow stopped');
}

/**
 * Get workflow status
 */
export function getArrearsManagementWorkflowStatus(): {
  name: string;
  schedule: string;
  running: boolean;
} {
  return {
    name: 'Arrears Management',
    schedule: 'Sundays, 3:00 AM',
    running: true, // node-cron doesn't expose status - assume scheduled
  };
}
