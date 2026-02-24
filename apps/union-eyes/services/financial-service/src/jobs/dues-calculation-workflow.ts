/**
 * Monthly Dues Calculation Workflow
 * Week 11: Workflow Automation
 * 
 * Runs on the 1st of every month at 2:00 AM
 * Automatically generates dues transactions for all active members
 */

import cron from 'node-cron';
import winston from 'winston';
import { db } from '../db';
import { 
  members, 
  duesAssignments, 
  duesRules, 
  duesTransactions 
} from '../db/schema';
import { eq, and, lte, gte, isNull, or, sql } from 'drizzle-orm';
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
 * Calculate dues for all active members based on their assignments
 */
export async function processMonthlyDuesCalculation(params: {
  tenantId: string;
  effectiveDate?: Date;
}): Promise<{
  success: boolean;
  membersProcessed: number;
  transactionsCreated: number;
  errors: Array<{ memberId: string; error: string }>;
}> {
  const { tenantId, effectiveDate = new Date() } = params;
  
  logger.info('Starting monthly dues calculation', { 
    tenantId, 
    effectiveDate: effectiveDate.toISOString() 
  });

  let membersProcessed = 0;
  let transactionsCreated = 0;
  const errors: Array<{ memberId: string; error: string }> = [];

  try {
    // Get all active members with dues assignments
    const activeMembers = await db
      .select({
        memberId: members.id,
        memberName: sql<string>`CONCAT(${members.firstName}, ' ', ${members.lastName})`,
        memberEmail: members.email,
        assignmentId: duesAssignments.id,
        ruleId: duesAssignments.ruleId,
        effectiveDate: duesAssignments.effectiveDate,
        endDate: duesAssignments.endDate,
      })
      .from(members)
      .innerJoin(
        duesAssignments,
        eq(members.id, duesAssignments.memberId)
      )
      .where(
        and(
          eq(members.organizationId, tenantId),
          eq(members.status, 'active'),
          lte(duesAssignments.effectiveDate, effectiveDate.toISOString().split('T')[0]),
          or(
            isNull(duesAssignments.endDate),
            gte(duesAssignments.endDate, effectiveDate.toISOString().split('T')[0])
          )
        )
      );

    logger.info(`Found ${activeMembers.length} active members with dues assignments`);

    // Process each member
    for (const member of activeMembers) {
      try {
        // Get the dues rule details
        const [rule] = await db
          .select()
          .from(duesRules)
          .where(eq(duesRules.id, member.ruleId))
          .limit(1);

        if (!rule) {
          errors.push({
            memberId: member.memberId,
            error: `Dues rule ${member.ruleId} not found`,
          });
          continue;
        }

        // Calculate due date (end of current month)
        const dueDate = new Date(effectiveDate);
        dueDate.setMonth(dueDate.getMonth() + 1, 0); // Last day of month

        // Calculate total amount based on rule
        const baseDues = Number(rule.flatAmount) || 0;
        const totalAmount = baseDues; // Simplified - in production would include COPE, PAC, etc.

        // Check if transaction already exists for this period
        const existingTransaction = await db
          .select()
          .from(duesTransactions)
          .where(
            and(
              eq(duesTransactions.organizationId, tenantId),
              eq(duesTransactions.memberId, member.memberId),
              eq(duesTransactions.periodStart, effectiveDate.toISOString().split('T')[0])
            )
          )
          .limit(1);

        if (existingTransaction.length > 0) {
          logger.info(`Transaction already exists for member ${member.memberId} for period ${effectiveDate.toISOString()}`);
          membersProcessed++;
          continue;
        }

        // Create dues transaction
        const periodEnd = new Date(effectiveDate);
        periodEnd.setMonth(periodEnd.getMonth() + 1, 0);

        await db.insert(duesTransactions).values({
          tenantId,
          memberId: member.memberId,
          assignmentId: member.assignmentId || null,
          periodStart: effectiveDate.toISOString().split('T')[0],
          periodEnd: periodEnd.toISOString().split('T')[0],
          amount: totalAmount.toString(),
          duesAmount: totalAmount.toString(),
          totalAmount: totalAmount.toString(),
          status: 'pending',
          dueDate: dueDate.toISOString().split('T')[0],
          transactionType: 'dues',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        membersProcessed++;
        transactionsCreated++;

        logger.info(`Created dues transaction for member ${member.memberId}`, {
          amount: totalAmount,
          dueDate: dueDate.toISOString(),
        });

      } catch (memberError) {
        logger.error(`Error processing member ${member.memberId}`, { error: memberError });
        errors.push({
          memberId: member.memberId,
          error: String(memberError),
        });
      }
    }

    logger.info('Monthly dues calculation completed', {
      membersProcessed,
      transactionsCreated,
      errorsCount: errors.length,
    });

    return {
      success: true,
      membersProcessed,
      transactionsCreated,
      errors,
    };

  } catch (error) {
    logger.error('Error in monthly dues calculation', { error });
    return {
      success: false,
      membersProcessed,
      transactionsCreated,
      errors: [{ memberId: 'system', error: String(error) }],
    };
  }
}

/**
 * Cron job: Runs on 1st of every month at 2:00 AM
 */
export const monthlyDuesCalculationJob = cron.schedule('0 2 1 * *', async () => {
  try {
    logger.info('Starting scheduled monthly dues calculation...');
    
    // In production, iterate through all tenants
    const tenantId = '11111111-1111-1111-1111-111111111111'; // Test tenant
    
    const result = await processMonthlyDuesCalculation({ tenantId });
    
    logger.info('Scheduled monthly dues calculation completed', {
      membersProcessed: result.membersProcessed,
      transactionsCreated: result.transactionsCreated,
      errors: result.errors.length,
    });
  } catch (error) {
    logger.error('Error in monthly dues calculation job', { error });
  }
}, {
  scheduled: false,
  timezone: 'America/Toronto',
});

/**
 * Start the dues calculation workflow
 */
export function startDuesCalculationWorkflow(): void {
  monthlyDuesCalculationJob.start();
  logger.info('✓ Monthly dues calculation workflow started (1st of month, 2:00 AM)');
}

/**
 * Stop the dues calculation workflow
 */
export function stopDuesCalculationWorkflow(): void {
  monthlyDuesCalculationJob.stop();
  logger.info('Monthly dues calculation workflow stopped');
}

/**
 * Get workflow status
 */
export function getDuesCalculationWorkflowStatus(): {
  name: string;
  schedule: string;
  running: boolean;
  nextRun: Date | null;
} {
  return {
    name: 'Monthly Dues Calculation',
    schedule: '1st of month, 2:00 AM',
    running: true, // node-cron doesn't expose status - assume scheduled
    nextRun: null, // node-cron doesn't expose next run time
  };
}
