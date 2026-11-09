/**
 * Billing Cycle Service
 * 
 * Phase 2: Dues & Payments - Automated Billing
 * 
 * Handles automated generation of dues transactions for all members
 * in an organization based on billing frequency (monthly, bi-weekly, weekly).
 * 
 * Features:
 * - Bulk transaction generation (one charge per member and period)
 * - Pro-rated dues for mid-cycle joins
 * - The amount is the member's dues assignment (dues_assignments)
 * - COPE/PAC/Strike Fund allocation
 * - Audit trail with execution metadata
 * 
 * @module lib/services/billing-cycle-service
 */

import { organizationMembers } from '@/db/schema-organizations';
import { duesTransactions } from '@/db/schema/domains/finance/dues';
import { DuesCalculationEngine } from '@/lib/dues-calculation-engine';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { toCents } from '@/lib/decimal-safe';
import { requireLiveFinancialMandate } from '@/lib/finance/require-live-financial-mandate';
import { type RLSTx } from '@/lib/db/with-rls-context';

// =============================================================================
// TYPES
// =============================================================================

export type BillingFrequency = 'monthly' | 'bi_weekly' | 'weekly' | 'quarterly' | 'annual';

export interface BillingCycleParams {
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  frequency: BillingFrequency;
  dryRun?: boolean; // Preview mode without creating transactions
  executedBy: string; // User ID triggering the billing cycle
}

export interface BillingCycleResult {
  success: boolean;
  cycleId: string;
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  frequency: BillingFrequency;
  transactionsCreated: number;
  totalAmount: number;
  breakdown: {
    duesAmount: number;
    copeAmount: number;
    pacAmount: number;
    strikeFundAmount: number;
  };
  members: {
    processed: number;
    success: number;
    failed: number;
    skipped: number;
  };
  errors: Array<{
    memberId: string;
    memberName?: string;
    error: string;
  }>;
  executionTimeMs: number;
  executedBy: string;
  executedAt: Date;
}

export interface MemberBillingResult {
  memberId: string;
  memberName: string;
  success: boolean;
  transactionId?: string;
  amount?: number;
  breakdown?: {
    duesAmount: number;
    copeAmount: number;
    pacAmount: number;
    strikeFundAmount: number;
  };
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

// =============================================================================
// BILLING CYCLE SERVICE
// =============================================================================

export class BillingCycleService {
  /**
   * Generate billing cycle for an organization
   * 
   * Creates dues transactions for all active members based on:
   * - Their dues assignment (the amount and frequency the organization recorded for the member)
   * - Pro-rated amounts for mid-cycle joins
   *
   * A member who already has a charge for the same period is skipped, so running a cycle twice never bills it twice.
   */
  static async generateBillingCycle(
    params: BillingCycleParams
  ): Promise<BillingCycleResult> {
    const startTime = Date.now();
    const { organizationId, periodStart, periodEnd, frequency, dryRun = false, executedBy } = params;
    // Direct service and scheduler callers must not bypass the HTTP period validator.
    if (!(periodStart instanceof Date) || !(periodEnd instanceof Date) ||
        !Number.isFinite(periodStart.getTime()) || !Number.isFinite(periodEnd.getTime()) ||
        periodStart.getTime() > periodEnd.getTime()) {
      throw new Error('Invalid billing cycle period');
    }

    logger.info('Starting billing cycle generation', {
      organizationId,
      periodStart,
      periodEnd,
      frequency,
      dryRun,
    });

    try {
       
      return await withRLSContext({ organizationId, userId: executedBy }, async (tx: RLSTx) => {
        // Route-level preflights are not sufficient: scheduler and direct service callers also reach this write.
        // The live ledger-wide execution mandate must be checked on the SAME tenant transaction as all charges.
        await requireLiveFinancialMandate(tx, {
          organizationId,
          userId: executedBy,
          action: 'finance:execute',
          requiresLedger: true,
        });

        // Step 1: Get all active members, and the members already charged for this period
        const activeMembers = await this.getActiveMembersForBilling(tx, organizationId, periodStart);
        const alreadyBilled = await this.getMembersBilledForPeriod(tx, organizationId, periodStart, periodEnd);

        logger.info(`Found ${activeMembers.length} active members for billing`, {
          organizationId,
        });

        // Step 2: Process each member
        const results: MemberBillingResult[] = [];
        const errors: Array<{ memberId: string; memberName?: string; error: string }> = [];

        for (const member of activeMembers) {
          try {
            const result = await this.processMemberBilling(tx, {
              organizationId,
              member,
              periodStart,
              periodEnd,
              frequency,
              dryRun,
              alreadyBilled: alreadyBilled.has(member.id),
            });

            results.push(result);

            if (!result.success && result.error) {
              errors.push({
                memberId: member.id,
                memberName: member.membershipNumber || member.userId,
                error: result.error,
              });
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Error processing member billing', {
              memberId: member.id,
              error: errorMessage,
            });

            errors.push({
              memberId: member.id,
              memberName: member.membershipNumber || member.userId,
              error: errorMessage,
            });

            results.push({
              memberId: member.id,
              memberName: member.membershipNumber || member.userId,
              success: false,
              error: errorMessage,
            });
          }
        }

        // Step 3: A real billing run is all-or-nothing. A partial run must not commit charges for
        // some members while reporting success for the cycle. Throw INSIDE withRLSContext so
        // PostgreSQL rolls back every charge in this transaction. Preview keeps diagnostics.
        const failedResults = results.filter((r) => !r.success);
        if (!dryRun && failedResults.length > 0) {
          throw new Error('Billing cycle aborted: one or more member calculations failed');
        }
        const successResults = results.filter((r) => r.success && !r.skipped);
        const totalAmount = successResults.reduce((sum, r) => sum + (r.amount || 0), 0);
        const breakdown = successResults.reduce(
          (acc, r) => ({
            duesAmount: acc.duesAmount + (r.breakdown?.duesAmount || 0),
            copeAmount: acc.copeAmount + (r.breakdown?.copeAmount || 0),
            pacAmount: acc.pacAmount + (r.breakdown?.pacAmount || 0),
            strikeFundAmount: acc.strikeFundAmount + (r.breakdown?.strikeFundAmount || 0),
          }),
          { duesAmount: 0, copeAmount: 0, pacAmount: 0, strikeFundAmount: 0 }
        );

        const executionTimeMs = Date.now() - startTime;
        const cycleId = `cycle_${organizationId}_${periodStart.toISOString().split('T')[0]}`;

        logger.info('Billing cycle generation completed', {
          organizationId,
          transactionsCreated: successResults.length,
          totalAmount,
          executionTimeMs,
        });

        return {
          success: failedResults.length === 0,
          cycleId,
          organizationId,
          periodStart,
          periodEnd,
          frequency,
          transactionsCreated: successResults.length,
          totalAmount: Math.round(totalAmount * 100) / 100,
          breakdown: {
            duesAmount: Math.round(breakdown.duesAmount * 100) / 100,
            copeAmount: Math.round(breakdown.copeAmount * 100) / 100,
            pacAmount: Math.round(breakdown.pacAmount * 100) / 100,
            strikeFundAmount: Math.round(breakdown.strikeFundAmount * 100) / 100,
          },
          members: {
            processed: results.length,
            success: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            skipped: results.filter((r) => r.skipped).length,
          },
          errors,
          executionTimeMs,
          executedBy,
          executedAt: new Date(),
        };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Billing cycle generation failed', {
        organizationId,
        error: errorMessage,
      });

      throw new Error(`Billing cycle generation failed: ${errorMessage}`);
    }
  }

  /**
   * Get all active members eligible for billing
   */
  private static async getActiveMembersForBilling(
     
    tx: RLSTx,
    organizationId: string,
    _periodStart: Date
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any[]> {
    const members = await tx
      .select({
        id: organizationMembers.id,
        userId: organizationMembers.userId,
        organizationId: organizationMembers.organizationId,
        membershipNumber: organizationMembers.membershipNumber,
        status: organizationMembers.status,
        joinedAt: organizationMembers.joinedAt,
      })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.status, 'active')
        )
      );

    return members;
  }

  /**
   * The members who already have a charge for exactly this period (ids as dues transactions keep them: text).
   */
  private static async getMembersBilledForPeriod(
    tx: RLSTx,
    organizationId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<Set<string>> {
    const rows = await tx
      .select({ memberId: duesTransactions.memberId })
      .from(duesTransactions)
      .where(
        and(
          eq(duesTransactions.organizationId, organizationId),
          eq(duesTransactions.transactionType, 'charge'),
          eq(duesTransactions.periodStart, periodStart.toISOString().split('T')[0]),
          eq(duesTransactions.periodEnd, periodEnd.toISOString().split('T')[0]),
        )
      );
    return new Set(rows.map((row) => row.memberId));
  }

  /**
   * Process billing for a single member
   */
  private static async processMemberBilling(
     
    tx: RLSTx,
    params: {
      organizationId: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      member: any;
      periodStart: Date;
      periodEnd: Date;
      frequency: BillingFrequency;
      dryRun: boolean;
      alreadyBilled: boolean;
    }
  ): Promise<MemberBillingResult> {
    const { organizationId, member, periodStart, periodEnd, frequency, dryRun, alreadyBilled } = params;

    // Skip members with certain statuses
    if (!member.status || member.status !== 'active') {
      return {
        memberId: member.id,
        memberName: member.membershipNumber || member.userId,
        success: true,
        skipped: true,
        skipReason: `Member status is ${member.status}`,
      };
    }

    if (alreadyBilled) {
      return {
        memberId: member.id,
        memberName: member.membershipNumber || member.userId,
        success: true,
        skipped: true,
        skipReason: 'Already billed for this period',
      };
    }

    // Calculate dues from the member's assignment, in this cycle's transaction
    const calculation = await DuesCalculationEngine.calculateMemberDues(
      { organizationId, memberId: member.id, periodStart, periodEnd, frequency },
      tx,
    );

    // No active dues assignment
    if (!calculation) {
      return {
        memberId: member.id,
        memberName: member.membershipNumber || member.userId,
        success: true,
        skipped: true,
        skipReason: 'No active dues assignment',
      };
    }

    // Check if member joined mid-cycle and pro-rate
    const { amount: proRatedAmount, isProRated } = this.calculateProRatedAmount(
      calculation.amount,
      member.joinedAt,
      periodStart,
      periodEnd
    );

    // A member joining after this period is ineligible. Do not persist a zero-value
    // pending charge, including when a dues assignment exists for a later period.
    if (member.joinedAt && new Date(member.joinedAt).getTime() > periodEnd.getTime()) {
      return {
        memberId: member.id,
        memberName: member.membershipNumber || member.userId,
        success: true,
        skipped: true,
        skipReason: 'Member joined after the billing period',
      };
    }

    // A rounded zero-value charge is not a receivable; preserve the skipped
    // result in both previews and execution instead of creating ledger noise.
    if (toCents(proRatedAmount) === 0) {
      return {
        memberId: member.id,
        memberName: member.membershipNumber || member.userId,
        success: true,
        skipped: true,
        skipReason: 'No billable amount for this period',
      };
    }

    // Allocate to COPE/PAC/Strike Fund (simplified - can be made configurable)
    const breakdown = this.allocateDuesBreakdown(proRatedAmount);

    // Dry run: don&apos;t create transaction
    if (dryRun) {
      return {
        memberId: member.id,
        memberName: member.membershipNumber || member.userId,
        success: true,
        amount: proRatedAmount,
        breakdown,
      };
    }

    // Create transaction
    const [transaction] = await tx
      .insert(duesTransactions)
      .values({
        organizationId,
        memberId: member.id,
        assignmentId: calculation.assignmentId,
        transactionType: 'charge',
        amount: proRatedAmount.toString(),
        periodStart: periodStart.toISOString().split('T')[0],
        periodEnd: periodEnd.toISOString().split('T')[0],
        dueDate: calculation.dueDate.toISOString().split('T')[0],
        status: 'pending',
        duesAmount: breakdown.duesAmount.toString(),
        copeAmount: breakdown.copeAmount.toString(),
        pacAmount: breakdown.pacAmount.toString(),
        strikeFundAmount: breakdown.strikeFundAmount.toString(),
        totalAmount: proRatedAmount.toString(),
        metadata: {
          calculationType: calculation.calculationType,
          assignmentId: calculation.assignmentId,
          assignmentFrequency: calculation.frequency,
          isProRated,
          proRatedReason: isProRated ? `Joined ${member.joinedAt}` : undefined,
        },
      })
      .returning();

    return {
      memberId: member.id,
      memberName: member.membershipNumber || member.userId,
      success: true,
      transactionId: transaction.id,
      amount: proRatedAmount,
      breakdown,
    };
  }

  /**
   * Calculate pro-rated amount for members who joined mid-cycle
   */
  private static calculateProRatedAmount(
    fullAmount: number,
    joinedAt: Date | null,
    periodStart: Date,
    periodEnd: Date
  ): { amount: number; isProRated: boolean } {
    if (!joinedAt) {
      return { amount: fullAmount, isProRated: false };
    }

    const joinDate = new Date(joinedAt);
    // Ledger periods are persisted as UTC calendar dates. Use inclusive calendar days,
    // not elapsed milliseconds: a 23:59:59.999 period end and DST changes must not
    // remove the member's last eligible day or change the denominator.
    const utcDay = (date: Date): number =>
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000;
    const startDay = utcDay(periodStart);
    const endDay = utcDay(periodEnd);
    const joinedDay = utcDay(joinDate);
    if (!Number.isFinite(startDay) || !Number.isFinite(endDay) ||
        !Number.isFinite(joinedDay) || endDay < startDay) {
      throw new Error('Invalid dues proration calendar dates');
    }

    if (joinedDay <= startDay) {
      return { amount: fullAmount, isProRated: false };
    }
    if (joinedDay > endDay) {
      return { amount: 0, isProRated: true };
    }

    const totalDays = endDay - startDay + 1;
    const daysActive = endDay - joinedDay + 1;
    return {
      amount: Math.round(toCents(fullAmount) * daysActive / totalDays) / 100,
      isProRated: true,
    };
  }

  /**
   * Allocate dues amount to different funds
   * 
   * Default allocation (can be made configurable per organization):
   * - 85% Regular Dues
   * - 10% COPE
   * - 3% PAC
   * - 2% Strike Fund
   */
  private static allocateDuesBreakdown(totalAmount: number): {
    duesAmount: number;
    copeAmount: number;
    pacAmount: number;
    strikeFundAmount: number;
  } {
    if (!Number.isFinite(totalAmount) || totalAmount < 0) {
      throw new Error('Invalid dues allocation amount');
    }
    // All components must reconcile to the charge to the cent. Independently
    // rounding four floating-point percentages can create or lose money.
    // These existing default percentages are NOT an institutional allocation mandate.
    const totalCents = toCents(totalAmount);
    if (!Number.isSafeInteger(totalCents)) {
      throw new Error('Dues allocation exceeds safe integer cents');
    }
    const copeCents = Math.round(totalCents * 10 / 100);
    const pacCents = Math.round(totalCents * 3 / 100);
    const strikeCents = Math.round(totalCents * 2 / 100);
    const duesCents = totalCents - copeCents - pacCents - strikeCents;
    return {
      duesAmount: duesCents / 100,
      copeAmount: copeCents / 100,
      pacAmount: pacCents / 100,
      strikeFundAmount: strikeCents / 100,
    };
  }

  /**
   * Calculate period dates based on frequency
   */
  static calculatePeriodDates(frequency: BillingFrequency, referenceDate: Date = new Date()): {
    periodStart: Date;
    periodEnd: Date;
  } {
    if (!(referenceDate instanceof Date) || !Number.isFinite(referenceDate.getTime())) {
      throw new Error('Invalid billing reference date');
    }
    const start = new Date(referenceDate);
    const end = new Date(referenceDate);

    switch (frequency) {
      case 'monthly':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        // Reset day first: Jan 31 + one month normalizes into March.
        end.setDate(1);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0); // Last day of current month
        end.setHours(23, 59, 59, 999);
        break;

      case 'bi_weekly':
        // Bi-weekly: every 14 days
        const dayOfWeek = start.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        start.setDate(start.getDate() + mondayOffset);
        start.setHours(0, 0, 0, 0);
        // Anchor the end to the computed Monday, not the original reference month.
        end.setTime(start.getTime());
        end.setDate(end.getDate() + 13);
        end.setHours(23, 59, 59, 999);
        break;

      case 'weekly':
        // Weekly: Monday to Sunday
        const dow = start.getDay();
        const mondayOff = dow === 0 ? -6 : 1 - dow;
        start.setDate(start.getDate() + mondayOff);
        start.setHours(0, 0, 0, 0);
        end.setTime(start.getTime());
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;

      case 'quarterly':
        const quarter = Math.floor(start.getMonth() / 3);
        // Set the day before changing months to avoid overflow (May 31 -> May 1).
        start.setDate(1);
        start.setMonth(quarter * 3);
        start.setHours(0, 0, 0, 0);
        end.setDate(1);
        end.setMonth((quarter + 1) * 3);
        end.setDate(0); // Last day of quarter
        end.setHours(23, 59, 59, 999);
        break;

      case 'annual':
        start.setMonth(0);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(11);
        end.setDate(31);
        end.setHours(23, 59, 59, 999);
        break;

      default:
        throw new Error(`Unsupported billing frequency: ${frequency}`);
    }

    return { periodStart: start, periodEnd: end };
  }

  /**
   * Advance by calendar months without silently skipping a billing month.
   * Clamp month-end anchors (Jan 31 -> Feb 28/29); preserving an original
   * month-end recurrence across multiple executions requires a separate
   * persisted schedule anchor and remains a distinct obligation.
   */
  private static addMonthsClamped(date: Date, months: number): Date {
    const next = new Date(date);
    const day = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + months);
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, lastDay));
    return next;
  }

  /**
   * Get next billing date based on frequency
   */
  static getNextBillingDate(frequency: BillingFrequency, lastBillingDate: Date): Date {
    if (!(lastBillingDate instanceof Date) || !Number.isFinite(lastBillingDate.getTime())) {
      throw new Error('Invalid last billing date');
    }
    const nextDate = new Date(lastBillingDate);
    switch (frequency) {
      case 'monthly':
        return this.addMonthsClamped(nextDate, 1);
      case 'bi_weekly':
        nextDate.setDate(nextDate.getDate() + 14);
        return nextDate;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        return nextDate;
      case 'quarterly':
        return this.addMonthsClamped(nextDate, 3);
      case 'annual':
        return this.addMonthsClamped(nextDate, 12);
      default:
        throw new Error(`Unsupported billing frequency: ${frequency}`);
    }
  }
}
