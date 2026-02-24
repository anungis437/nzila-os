/**
 * Billing Cycle Service
 * 
 * Phase 2: Dues & Payments - Automated Billing
 * 
 * Handles automated generation of dues transactions for all members
 * in an organization based on billing frequency (monthly, bi-weekly, weekly).
 * 
 * Features:
 * - Bulk transaction generation
 * - Pro-rated dues for mid-cycle joins
 * - Override amount support
 * - COPE/PAC/Strike Fund allocation
 * - Audit trail with execution metadata
 * 
 * @module lib/services/billing-cycle-service
 */

import { organizationMembers } from '@/db/schema-organizations';
import { memberEmployment } from '@/db/schema/domains/member/member-employment';
import { duesTransactions } from '@/db/schema/domains/finance/dues';
import { DuesCalculationEngine } from '@/lib/dues-calculation-engine';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { withRLSContext } from '@/lib/db/with-rls-context';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

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
   * - Their dues assignment rules
   * - Employment data (wages, hours, etc.)
   * - Pro-rated amounts for mid-cycle joins
   */
  static async generateBillingCycle(
    params: BillingCycleParams
  ): Promise<BillingCycleResult> {
    const startTime = Date.now();
    const { organizationId, periodStart, periodEnd, frequency, dryRun = false, executedBy } = params;

    logger.info('Starting billing cycle generation', {
      organizationId,
      periodStart,
      periodEnd,
      frequency,
      dryRun,
    });

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await withRLSContext(async (tx: NodePgDatabase<any>) => {
        // Step 1: Get all active members
        const activeMembers = await this.getActiveMembersForBilling(tx, organizationId, periodStart);

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
              dryRun,
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

        // Step 3: Calculate totals
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
          success: true,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: NodePgDatabase<any>,
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
        // Employment data (left join - may be null)
        employmentId: memberEmployment.id,
        employmentStatus: memberEmployment.employmentStatus,
        hourlyRate: memberEmployment.hourlyRate,
        baseSalary: memberEmployment.baseSalary,
        grossWages: memberEmployment.grossWages,
        regularHoursPerWeek: memberEmployment.regularHoursPerWeek,
      })
      .from(organizationMembers)
      .leftJoin(
        memberEmployment,
        and(
          eq(memberEmployment.memberId, organizationMembers.id),
          eq(memberEmployment.employmentStatus, 'active')
        )
      )
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.status, 'active')
        )
      );

    return members;
  }

  /**
   * Process billing for a single member
   */
  private static async processMemberBilling(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: NodePgDatabase<any>,
    params: {
      organizationId: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      member: any;
      periodStart: Date;
      periodEnd: Date;
      dryRun: boolean;
    }
  ): Promise<MemberBillingResult> {
    const { organizationId, member, periodStart, periodEnd, dryRun } = params;

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

    // Calculate dues using DuesCalculationEngine
    const calculation = await DuesCalculationEngine.calculateMemberDues({
      organizationId,
      memberId: member.id,
      periodStart,
      periodEnd,
      memberData: {
        grossWages: member.grossWages ? parseFloat(member.grossWages) : undefined,
        baseSalary: member.baseSalary ? parseFloat(member.baseSalary) : undefined,
        hourlyRate: member.hourlyRate ? parseFloat(member.hourlyRate) : undefined,
        hoursWorked: member.regularHoursPerWeek ? parseFloat(member.regularHoursPerWeek) * this.getWeeksInPeriod(periodStart, periodEnd) : undefined,
      },
    });

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
          ruleId: calculation.ruleId,
          ruleName: calculation.ruleName,
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
    
    // If joined before or on period start, charge full amount
    if (joinDate <= periodStart) {
      return { amount: fullAmount, isProRated: false };
    }

    // If joined after period end, charge nothing
    if (joinDate > periodEnd) {
      return { amount: 0, isProRated: true };
    }

    // Pro-rate based on days in period
    const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const daysActive = Math.ceil((periodEnd.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
    const proRatedAmount = (fullAmount * daysActive) / totalDays;

    return {
      amount: Math.round(proRatedAmount * 100) / 100,
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
    const duesAmount = totalAmount * 0.85;
    const copeAmount = totalAmount * 0.10;
    const pacAmount = totalAmount * 0.03;
    const strikeFundAmount = totalAmount * 0.02;

    return {
      duesAmount: Math.round(duesAmount * 100) / 100,
      copeAmount: Math.round(copeAmount * 100) / 100,
      pacAmount: Math.round(pacAmount * 100) / 100,
      strikeFundAmount: Math.round(strikeFundAmount * 100) / 100,
    };
  }

  /**
   * Get number of weeks in a billing period
   */
  private static getWeeksInPeriod(periodStart: Date, periodEnd: Date): number {
    const days = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    return Math.ceil(days / 7);
  }

  /**
   * Calculate period dates based on frequency
   */
  static calculatePeriodDates(frequency: BillingFrequency, referenceDate: Date = new Date()): {
    periodStart: Date;
    periodEnd: Date;
  } {
    const start = new Date(referenceDate);
    const end = new Date(referenceDate);

    switch (frequency) {
      case 'monthly':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
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
        end.setDate(start.getDate() + 13);
        end.setHours(23, 59, 59, 999);
        break;

      case 'weekly':
        // Weekly: Monday to Sunday
        const dow = start.getDay();
        const mondayOff = dow === 0 ? -6 : 1 - dow;
        start.setDate(start.getDate() + mondayOff);
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;

      case 'quarterly':
        const quarter = Math.floor(start.getMonth() / 3);
        start.setMonth(quarter * 3);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
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
   * Get next billing date based on frequency
   */
  static getNextBillingDate(frequency: BillingFrequency, lastBillingDate: Date): Date {
    const nextDate = new Date(lastBillingDate);

    switch (frequency) {
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'bi_weekly':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'annual':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }

    return nextDate;
  }
}
