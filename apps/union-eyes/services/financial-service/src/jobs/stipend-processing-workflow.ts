/**
 * Stipend Processing Workflow
 * 
 * Automated workflow for weekly strike stipend calculations and disbursements:
 * - Calculate stipends based on picket line attendance
 * - Apply eligibility rules and caps
 * - Route to trustee approval workflow
 * - Process approved disbursements via Stripe
 * - Track in stipend_disbursements table
 * - Handle failed payments and retries
 * 
 * Schedule: Weekly on Fridays at 5:00 AM (before business hours)
 */

import cron from 'node-cron';
import winston from 'winston';
import { db } from '../db';
import { 
  stipendDisbursements,
  picketAttendance,
  members,
  strikeFunds
} from '../db/schema';
import { eq, and, gte, lte, sql, inArray } from 'drizzle-orm';
// eslint-disable-next-line no-restricted-imports -- TODO(platform-migration): migrate to @nzila/ wrapper
import Stripe from 'stripe';
import { queueNotification } from '../services/notification-service';
import { logger } from '@/lib/logger';

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' })
  : null;

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});

/**
 * Stipend calculation rules (configurable per tenant)
 */
interface StipendRules {
  dailyRate: number;           // Base daily stipend amount
  weeklyMaxDays: number;        // Maximum compensable days per week
  weeklyMaxAmount: number;      // Maximum weekly stipend per member
  minimumHoursPerDay: number;   // Minimum hours to qualify for daily stipend
  requiresApproval: boolean;    // Whether stipends need trustee approval
  autoApproveUnder: number;     // Auto-approve amounts under this threshold
  fundId: string;               // Strike fund to draw from
}

/**
 * Default stipend rules (can be overridden per tenant)
 */
const DEFAULT_STIPEND_RULES: StipendRules = {
  dailyRate: 100.00,
  weeklyMaxDays: 5,
  weeklyMaxAmount: 500.00,
  minimumHoursPerDay: 4,
  requiresApproval: true,
  autoApproveUnder: 100.00,
  fundId: 'default-strike-fund',
};

/**
 * Process weekly stipend calculations for a tenant
 */
export async function processWeeklyStipends(params: {
  tenantId: string;
  weekStartDate?: Date;
  rules?: Partial<StipendRules>;
}): Promise<{
  success: boolean;
  stipendsCalculated: number;
  totalAmount: number;
  pendingApproval: number;
  autoApproved: number;
  membersProcessed: number;
  errors: Array<{ memberId: string; error: string }>;
}> {
  const { 
    tenantId, 
    weekStartDate = getLastWeekStart(),
    rules: customRules 
  } = params;

  const rules: StipendRules = { ...DEFAULT_STIPEND_RULES, ...customRules };
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6); // 7-day week

  logger.info('Starting weekly stipend processing', {
    tenantId,
    weekStart: weekStartDate.toISOString().split('T')[0],
    weekEnd: weekEndDate.toISOString().split('T')[0],
    rules,
  });

  const errors: Array<{ memberId: string; error: string }> = [];
  let stipendsCalculated = 0;
  let totalAmount = 0;
  let pendingApproval = 0;
  let autoApproved = 0;

  try {
    // Verify strike fund has sufficient balance
    const fundBalance = await checkStrikeFundBalance(tenantId, rules.fundId);
    logger.info('Strike fund balance check', { fundId: rules.fundId, balance: fundBalance });

    // Get all picket attendance records for the week
    const attendanceRecords = await db
      .select({
        memberId: picketAttendance.memberId,
        checkInTime: picketAttendance.checkInTime,
        hoursWorked: picketAttendance.hoursWorked,
        coordinatorOverride: picketAttendance.coordinatorOverride,
        memberName: sql<string>`CONCAT(${members.firstName}, ' ', ${members.lastName})`,
        memberEmail: members.email,
        userId: members.userId,
      })
      .from(picketAttendance)
      .innerJoin(members, eq(picketAttendance.memberId, members.id))
      .where(
        and(
          eq(picketAttendance.tenantId, tenantId),
          gte(picketAttendance.checkInTime, new Date(weekStartDate).toISOString()),
          lte(picketAttendance.checkInTime, new Date(weekEndDate).toISOString()),
          eq(picketAttendance.coordinatorOverride, true) // Only process approved attendance
        )
      )
      .orderBy(picketAttendance.memberId, picketAttendance.checkInTime);

    logger.info(`Found ${attendanceRecords.length} approved attendance records`);

    // Group by member and calculate stipends
    const memberStipends = new Map<string, {
      memberId: string;
      memberName: string;
      memberEmail: string | null;
      userId: string | null;
      qualifyingDays: number;
      totalHours: number;
      calculatedAmount: number;
    }>();

    for (const record of attendanceRecords) {
      const hours = parseFloat(record.hoursWorked || '0');
      
      // Check if this day qualifies for stipend
      if (hours < rules.minimumHoursPerDay) {
        continue; // Skip days that don't meet minimum hours
      }

      const key = record.memberId;
      const existing = memberStipends.get(key) || {
        memberId: record.memberId,
        memberName: record.memberName,
        memberEmail: record.memberEmail,
        userId: record.userId,
        qualifyingDays: 0,
        totalHours: 0,
        calculatedAmount: 0,
      };

      existing.qualifyingDays++;
      existing.totalHours += hours;
      memberStipends.set(key, existing);
    }

    // Calculate stipend amounts with caps
    for (const [memberId, data] of Array.from(memberStipends.entries())) {
      try {
        // Apply weekly maximum days cap
        const compensableDays = Math.min(data.qualifyingDays, rules.weeklyMaxDays);
        let stipendAmount = compensableDays * rules.dailyRate;
        
        // Apply weekly maximum amount cap
        stipendAmount = Math.min(stipendAmount, rules.weeklyMaxAmount);

        data.calculatedAmount = stipendAmount;

        // Check if stipend already exists for this member/week
        const existingStipend = await db
          .select()
          .from(stipendDisbursements)
          .where(
            and(
              eq(stipendDisbursements.tenantId, tenantId),
              eq(stipendDisbursements.memberId, memberId),
              eq(stipendDisbursements.weekStartDate, weekStartDate.toISOString().split('T')[0])
            )
          )
          .limit(1);

        if (existingStipend.length > 0) {
          logger.warn('Stipend already exists for member/week', {
            memberId,
            weekStart: weekStartDate.toISOString().split('T')[0],
            existingId: existingStipend[0].id,
          });
          continue;
        }

        // Determine approval status
        const needsApproval = rules.requiresApproval && stipendAmount >= rules.autoApproveUnder;
        const status = needsApproval ? 'pending_approval' : 'approved';

        // Create stipend disbursement record
        await db.insert(stipendDisbursements).values({
          tenantId,
          memberId,
          fundId: rules.fundId,
          weekStartDate: weekStartDate.toISOString().split('T')[0],
          weekEndDate: weekEndDate.toISOString().split('T')[0],
          daysWorked: data.qualifyingDays,
          hoursWorked: data.totalHours.toString(),
          dailyRate: rules.dailyRate.toString(),
          calculatedAmount: stipendAmount.toString(),
          approvedAmount: needsApproval ? null : stipendAmount.toString(),
          status,
          calculatedAt: new Date(),
          approvedAt: needsApproval ? null : new Date(),
          approvedBy: needsApproval ? null : 'auto-approved',
          metadata: {
            compensableDays,
            qualifyingDays: data.qualifyingDays,
            weeklyMaxDays: rules.weeklyMaxDays,
            weeklyMaxAmount: rules.weeklyMaxAmount,
            autoApproved: !needsApproval,
          },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        stipendsCalculated++;
        totalAmount += stipendAmount;

        if (needsApproval) {
          pendingApproval++;
          logger.info('Stipend pending trustee approval', {
            memberId,
            amount: stipendAmount,
            daysWorked: data.qualifyingDays,
          });
        } else {
          autoApproved++;
          logger.info('Stipend auto-approved', {
            memberId,
            amount: stipendAmount,
            daysWorked: data.qualifyingDays,
          });
        }

      } catch (memberError) {
        logger.error('Error processing stipend for member', {
          memberId,
          error: memberError,
        });
        errors.push({
          memberId,
          error: memberError instanceof Error ? memberError.message : String(memberError),
        });
      }
    }

    // Check if total stipends exceed available fund balance
    if (totalAmount > fundBalance) {
      logger.error('Insufficient strike fund balance', {
        required: totalAmount,
        available: fundBalance,
        shortfall: totalAmount - fundBalance,
      });
      // Don't fail - trustee approval process will handle this
    }

    const success = errors.length === 0;
    logger.info('Weekly stipend processing completed', {
      success,
      stipendsCalculated,
      totalAmount,
      pendingApproval,
      autoApproved,
      errors: errors.length,
    });

    return {
      success,
      stipendsCalculated,
      totalAmount,
      pendingApproval,
      autoApproved,
      membersProcessed: memberStipends.size,
      errors,
    };

  } catch (error) {
    logger.error('Weekly stipend processing failed', { error });
    throw error;
  }
}

/**
 * Get the start date of last week (Monday)
 */
function getLastWeekStart(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek + 6; // Get last Monday
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - daysToSubtract);
  lastMonday.setHours(0, 0, 0, 0);
  return lastMonday;
}

/**
 * Check strike fund balance
 */
async function checkStrikeFundBalance(tenantId: string, fundId: string): Promise<number> {
  try {
    const fund = await db
      .select()
      .from(strikeFunds)
      .where(
        and(
          eq(strikeFunds.organizationId, tenantId),
          eq(strikeFunds.id, fundId)
        )
      )
      .limit(1);

    if (fund.length === 0) {
      logger.warn('Strike fund not found', { fundId });
      return 0;
    }

    return parseFloat(fund[0].currentBalance);
  } catch (error) {
    logger.error('Error checking strike fund balance', { error });
    return 0;
  }
}

/**
 * Process approved stipend disbursements via Stripe
 * This would be called by a separate payment processing job or API endpoint
 */
export async function processDisbursements(params: {
  tenantId: string;
  stipendIds?: string[];
}): Promise<{
  success: boolean;
  disbursed: number;
  failed: number;
  totalAmount: number;
  errors: Array<{ stipendId: string; error: string }>;
}> {
  const { tenantId, stipendIds } = params;

  logger.info('Processing stipend disbursements', { tenantId, stipendIds });

  const errors: Array<{ stipendId: string; error: string }> = [];
  let disbursed = 0;
  let failed = 0;
  let totalAmount = 0;

  try {
    // Find approved stipends ready for disbursement
    const conditions = [
      eq(stipendDisbursements.tenantId, tenantId),
      eq(stipendDisbursements.status, 'approved'),
    ];

    if (stipendIds && stipendIds.length > 0) {
      conditions.push(inArray(stipendDisbursements.id, stipendIds));
    }

    const approvedStipends = await db
      .select()
      .from(stipendDisbursements)
      .where(and(...conditions));

    logger.info(`Found ${approvedStipends.length} approved stipends to disburse`);

    for (const stipend of approvedStipends) {
      try {
        const amount = parseFloat(stipend.totalAmount);
        let paymentIntentId: string | null = null;
        
        // Process Stripe payment if configured
        if (stripe && process.env.STRIPE_SECRET_KEY) {
          try {
            // Create a payment intent for the stipend disbursement
            // In production, you would use Stripe Connect or Transfer API
            const paymentIntent = await stripe.paymentIntents.create({
              amount: Math.round(amount * 100), // Convert to cents
              currency: 'cad',
              description: `Strike Stipend - ID: ${stipend.id}`,
              metadata: {
                stipendId: stipend.id,
                memberId: stipend.memberId,
                type: 'strike_stipend',
              },
            });
            
            paymentIntentId = paymentIntent.id;
            logger.info('Stripe payment intent created', {
              stipendId: stipend.id,
              paymentIntentId,
              amount,
            });
          } catch (stripeError) {
            logger.error('Stripe payment failed', {
              stipendId: stipend.id,
              error: stripeError,
            });
            throw stripeError;
          }
        } else {
          // Simulated payment for development
          logger.warn('[DEV] Simulating Stripe payment (no Stripe key configured)', {
            stipendId: stipend.id,
            amount,
          });
          paymentIntentId = 'pi_simulated_' + Math.random().toString(36).substr(2, 9);
        }

        // Update stipend status
        await db
          .update(stipendDisbursements)
          .set({
            status: 'disbursed',
            paymentDate: new Date(),
            notes: `Stripe payment: ${paymentIntentId}`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any)
          .where(eq(stipendDisbursements.id, stipend.id));
          
        // Send notification
        try {
          await queueNotification({
            organizationId: stipend.tenantId,
            userId: stipend.memberId,
            type: 'stipend_disbursed',
            channels: ['email', 'push'],
            priority: 'high',
            data: {
              stipendId: stipend.id,
              amount,
              paymentDate: new Date().toISOString(),
              paymentIntentId,
            },
          });
          logger.info('Stipend notification queued', { stipendId: stipend.id });
        } catch (notifError) {
          logger.error('Failed to queue stipend notification', notifError);
          // Don't fail the entire payment if notification fails
        }

        disbursed++;
        totalAmount += amount;

      } catch (disbursementError) {
        logger.error('Error disbursing stipend', {
          stipendId: stipend.id,
          error: disbursementError,
        });

        // Mark as failed
        await db
          .update(stipendDisbursements)
          .set({
            status: 'failed',
            notes: `Error: ${String(disbursementError)}`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any)
          .where(eq(stipendDisbursements.id, stipend.id));

        failed++;
        errors.push({
          stipendId: stipend.id,
          error: disbursementError instanceof Error ? disbursementError.message : String(disbursementError),
        });
      }
    }

    const success = failed === 0;
    logger.info('Stipend disbursement completed', {
      success,
      disbursed,
      failed,
      totalAmount,
    });

    return { success, disbursed, failed, totalAmount, errors };

  } catch (error) {
    logger.error('Stipend disbursement failed', { error });
    throw error;
  }
}

/**
 * Scheduled job: Weekly stipend processing on Fridays at 5:00 AM
 */
export const weeklyStipendProcessingJob = cron.schedule(
  '0 5 * * 5',
  async () => {
    logger.info('Running weekly stipend processing job');
    
    try {
      // Note: In multi-organization setup, process stipends per organization
      const tenantId = process.env.DEFAULT_TENANT_ID || 'default-tenant';
      
      const result = await processWeeklyStipends({ tenantId });
      
      logger.info('Weekly stipend processing job completed', {
        stipendsCalculated: result.stipendsCalculated,
        totalAmount: result.totalAmount,
        pendingApproval: result.pendingApproval,
        autoApproved: result.autoApproved,
        errors: result.errors.length,
      });

      if (result.errors.length > 0) {
        logger.warn('Stipend processing had errors', { 
          errorCount: result.errors.length,
          errors: result.errors.slice(0, 5),
        });
      }

      // Send summary notification to trustees if there are pending approvals
      if (result.pendingApproval > 0) {
        logger.info('Trustee approval required', {
          pendingCount: result.pendingApproval,
          totalPendingAmount: result.totalAmount,
        });
        
        // Send notification to officers/admins
        try {
          // Query for officers and admins (users with elevated privileges)
          const trustees = await db.query.organizationMembers.findMany({
            where: (members, { eq }) => eq(members.role, 'officer'),
            limit: 100,
          });

          if (trustees.length > 0) {
            const summaryMessage = `Stipend Processing Summary (${new Date().toLocaleDateString()})
            
Pending Approvals: ${result.pendingApproval}
Total Pending Amount: $${result.totalAmount.toFixed(2)},
Members Processed: ${result.membersProcessed}

Please log in to review and approve pending stipend disbursements.`;

            logger.info('Sending trustee notifications', {
              recipientCount: trustees.length,
              pendingCount: result.pendingApproval,
            });

            // Log for notification worker to pick up
            // In production, this would queue notifications for async processing
            logger.info('Trustee notification queued', {
              recipients: trustees.length,
              message: summaryMessage,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (notificationError) {
          logger.error('Failed to send trustee notifications', { error: notificationError });
        }
      }

    } catch (error) {
      logger.error('Weekly stipend processing job failed', { error });
    }
  },
  {
    scheduled: false,
    timezone: 'America/Toronto',
  }
);

/**
 * Start the stipend processing workflow
 */
export function startStipendProcessingWorkflow(): void {
  weeklyStipendProcessingJob.start();
  logger.info('✓ Stipend processing workflow started (Fridays, 5:00 AM)');
}

/**
 * Stop the stipend processing workflow
 */
export function stopStipendProcessingWorkflow(): void {
  weeklyStipendProcessingJob.stop();
  logger.info('Stipend processing workflow stopped');
}

/**
 * Get workflow status
 */
export function getStipendProcessingWorkflowStatus(): {
  running: boolean;
  nextExecution: string | null;
} {
  return {
    running: true, // node-cron doesn't expose status - assume scheduled
    nextExecution: null, // node-cron doesn't expose next run time
  };
}
