/**
 * Stipend Calculation Service
 * Week 6: Automated stipend calculations based on picket attendance
 * 
 * Features:
 * - Eligibility verification (minimum hours threshold)
 * - Weekly stipend calculation
 * - Approval workflow (pending → approved → paid)
 * - Payment tracking and reconciliation
 */

import { db, schema } from '../db';
import { eq, and, between, desc, sql } from 'drizzle-orm';
import { logger } from '../../../lib/logger';
import { logger } from '@/lib/logger';

// Configuration constants
const DEFAULT_MINIMUM_HOURS_PER_WEEK = 20; // Minimum hours to qualify for stipend
const DEFAULT_HOURLY_STIPEND_RATE = 15; // $ per hour

export interface StipendCalculationRequest {
  organizationId: string;
  strikeFundId: string;
  weekStartDate: Date;
  weekEndDate: Date;
  minimumHours?: number;
  hourlyRate?: number;
}

export interface StipendEligibility {
  memberId: string;
  totalHours: number;
  eligible: boolean;
  stipendAmount: number;
  reason?: string;
}

export interface DisbursementRequest {
  organizationId: string;
  strikeFundId: string;
  memberId: string;
  amount: number;
  weekStartDate: Date;
  weekEndDate: Date;
  approvedBy: string;
  paymentMethod: 'direct_deposit' | 'check' | 'cash' | 'paypal';
  notes?: string;
}

export interface DisbursementApproval {
  disbursementId: string;
  approvedBy: string;
  approvalNotes?: string;
}

/**
 * Calculate stipends for all eligible members for a given week
 */
export async function calculateWeeklyStipends(
  request: StipendCalculationRequest
): Promise<StipendEligibility[]> {
  try {
    const { organizationId, strikeFundId, weekStartDate, weekEndDate } = request;
    const minimumHours = request.minimumHours || DEFAULT_MINIMUM_HOURS_PER_WEEK;
    const hourlyRate = request.hourlyRate || DEFAULT_HOURLY_STIPEND_RATE;

    // Get strike fund configuration
    const [strikeFund] = await db
      .select()
      .from(schema.strikeFunds)
      .where(
        and(
          eq(schema.strikeFunds.id, strikeFundId),
          eq(schema.strikeFunds.tenantId, organizationId)
        )
      )
      .limit(1);

    if (!strikeFund) {
      throw new Error('Strike fund not found');
    }

    // Use fund-specific configuration if available
    const fundMinHours = strikeFund.minimumAttendanceHours 
      ? parseFloat(strikeFund.minimumAttendanceHours) 
      : minimumHours;
    const fundHourlyRate = strikeFund.weeklyStipendAmount 
      ? parseFloat(strikeFund.weeklyStipendAmount) / fundMinHours 
      : hourlyRate;

    // Aggregate attendance hours by member for the week
    const attendanceRecords = await db
      .select({
        memberId: schema.picketAttendance.memberId,
        totalHours: sql<string>`CAST(SUM(CAST(${schema.picketAttendance.hoursWorked} AS DECIMAL)) AS TEXT)`,
      })
      .from(schema.picketAttendance)
      .where(
        and(
          eq(schema.picketAttendance.tenantId, organizationId),
          eq(schema.picketAttendance.strikeFundId, strikeFundId),
          between(schema.picketAttendance.checkInTime, weekStartDate.toISOString(), weekEndDate.toISOString()),
          sql`${schema.picketAttendance.checkOutTime} IS NOT NULL` // Only count completed shifts
        )
      )
      .groupBy(schema.picketAttendance.memberId);

    // Calculate eligibility for each member
    const eligibilityResults: StipendEligibility[] = attendanceRecords.map(record => {
      const hours = parseFloat(record.totalHours || '0');
      const eligible = hours >= fundMinHours;
      const stipendAmount = eligible ? Math.round(hours * fundHourlyRate * 100) / 100 : 0;

      return {
        memberId: record.memberId,
        totalHours: hours,
        eligible,
        stipendAmount,
        reason: eligible 
          ? `Worked ${hours} hours (minimum: ${fundMinHours})`
          : `Insufficient hours: ${hours} (minimum: ${fundMinHours})`,
      };
    });

    return eligibilityResults;
  } catch (error) {
    logger.error('Stipend calculation error', { error, organizationId: request.organizationId, strikeFundId: request.strikeFundId });
    throw new Error(`Failed to calculate stipends: ${error.message}`);
  }
}

/**
 * Create a pending disbursement record
 */
export async function createDisbursement(
  request: DisbursementRequest
): Promise<{ success: boolean; disbursementId?: string; error?: string }> {
  try {
    const [disbursement] = await db
      .insert(schema.stipendDisbursements)
      .values({
        tenantId: request.organizationId,
        strikeFundId: request.strikeFundId,
        memberId: request.memberId,
        amount: request.amount.toString(),
        weekStartDate: request.weekStartDate,
        weekEndDate: request.weekEndDate,
        status: 'pending',
        paymentMethod: request.paymentMethod,
        approvedBy: request.approvedBy,
        notes: request.notes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .returning();

    return {
      success: true,
      disbursementId: disbursement.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to create disbursement',
    };
  }
}

/**
 * Approve a pending disbursement
 */
export async function approveDisbursement(
  organizationId: string,
  approval: DisbursementApproval
): Promise<{ success: boolean; error?: string }> {
  try {
    const [existing] = await db
      .select()
      .from(schema.stipendDisbursements)
      .where(
        and(
          eq(schema.stipendDisbursements.id, approval.disbursementId),
          eq(schema.stipendDisbursements.tenantId, organizationId)
        )
      )
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Disbursement not found' };
    }

    if (existing.status !== 'pending') {
      return { success: false, error: `Disbursement is already ${existing.status}` };
    }

    await db
      .update(schema.stipendDisbursements)
      .set({
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: approval.approvedBy,
        notes: approval.approvalNotes,
        updatedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .where(eq(schema.stipendDisbursements.id, approval.disbursementId));

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to approve disbursement',
    };
  }
}

/**
 * Mark a disbursement as paid
 */
export async function markDisbursementPaid(
  organizationId: string,
  disbursementId: string,
  transactionId: string,
  paidBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const [existing] = await db
      .select()
      .from(schema.stipendDisbursements)
      .where(
        and(
          eq(schema.stipendDisbursements.id, disbursementId),
          eq(schema.stipendDisbursements.tenantId, organizationId)
        )
      )
      .limit(1);

    if (!existing) {
      return { success: false, error: 'Disbursement not found' };
    }

    if (existing.status !== 'approved') {
      return { success: false, error: `Disbursement must be approved first (current status: ${existing.status})` };
    }

    await db
      .update(schema.stipendDisbursements)
      .set({
        status: 'paid',
        paymentDate: new Date(),
        notes: `Transaction ID: ${transactionId}, Processed by: ${paidBy}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .where(eq(schema.stipendDisbursements.id, disbursementId));

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to mark disbursement as paid',
    };
  }
}

/**
 * Get disbursement history for a member
 */
export async function getMemberDisbursements(
  organizationId: string,
  memberId: string,
  strikeFundId?: string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  try {
    const conditions = [
      eq(schema.stipendDisbursements.tenantId, organizationId),
      eq(schema.stipendDisbursements.memberId, memberId),
    ];

    if (strikeFundId) {
      conditions.push(eq(schema.stipendDisbursements.strikeFundId, strikeFundId));
    }

    const disbursements = await db
      .select()
      .from(schema.stipendDisbursements)
      .where(and(...conditions))
      .orderBy(desc(schema.stipendDisbursements.weekStartDate));

    return disbursements.map(d => ({
      ...d,
      amount: parseFloat(d.totalAmount),
    }));
  } catch (error) {
    logger.error('Get disbursements error', { error, organizationId, memberId, strikeFundId });
    return [];
  }
}

/**
 * Get pending disbursements for approval
 */
export async function getPendingDisbursements(
  organizationId: string,
  strikeFundId: string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  try {
    const disbursements = await db
      .select()
      .from(schema.stipendDisbursements)
      .where(
        and(
          eq(schema.stipendDisbursements.tenantId, organizationId),
          eq(schema.stipendDisbursements.strikeFundId, strikeFundId),
          eq(schema.stipendDisbursements.status, 'pending')
        )
      )
      .orderBy(schema.stipendDisbursements.weekStartDate);

    return disbursements.map(d => ({
      ...d,
      amount: parseFloat(d.totalAmount),
    }));
  } catch (error) {
    logger.error('Get pending disbursements error', { error, organizationId, strikeFundId });
    return [];
  }
}

/**
 * Get total disbursed amount for a strike fund
 */
export async function getStrikeFundDisbursementSummary(
  organizationId: string,
  strikeFundId: string
): Promise<{
  totalPending: number;
  totalApproved: number;
  totalPaid: number;
  memberCount: number;
}> {
  try {
    const result = await db
      .select({
        status: schema.stipendDisbursements.status,
        totalAmount: sql<string>`CAST(SUM(CAST(${schema.stipendDisbursements.totalAmount} AS DECIMAL)) AS TEXT)`,
        memberCount: sql<number>`COUNT(DISTINCT ${schema.stipendDisbursements.memberId})`,
      })
      .from(schema.stipendDisbursements)
      .where(
        and(
          eq(schema.stipendDisbursements.tenantId, organizationId),
          eq(schema.stipendDisbursements.strikeFundId, strikeFundId)
        )
      )
      .groupBy(schema.stipendDisbursements.status);

    const summary = {
      totalPending: 0,
      totalApproved: 0,
      totalPaid: 0,
      memberCount: 0,
    };

    result.forEach(row => {
      const amount = parseFloat(row.totalAmount || '0');
      if (row.status === 'pending') summary.totalPending = amount;
      if (row.status === 'approved') summary.totalApproved = amount;
      if (row.status === 'paid') summary.totalPaid = amount;
      summary.memberCount = Math.max(summary.memberCount, row.memberCount);
    });

    return summary;
  } catch (error) {
    logger.error('Get disbursement summary error', { error, organizationId, strikeFundId });
    return {
      totalPending: 0,
      totalApproved: 0,
      totalPaid: 0,
      memberCount: 0,
    };
  }
}

/**
 * Batch create disbursements for all eligible members
 */
export async function batchCreateDisbursements(
  request: StipendCalculationRequest & { approvedBy: string; paymentMethod: string }
): Promise<{ 
  success: boolean; 
  created: number; 
  skipped: number; 
  disbursementIds: string[];
  errors: string[];
}> {
  try {
    const eligibility = await calculateWeeklyStipends(request);
    const eligible = eligibility.filter(e => e.eligible);

    const disbursementIds: string[] = [];
    const errors: string[] = [];

    for (const member of eligible) {
      const result = await createDisbursement({
        organizationId: request.organizationId,
        strikeFundId: request.strikeFundId,
        memberId: member.memberId,
        amount: member.stipendAmount,
        weekStartDate: request.weekStartDate,
        weekEndDate: request.weekEndDate,
        approvedBy: request.approvedBy,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        paymentMethod: request.paymentMethod as any,
        notes: `Week ${request.weekStartDate.toISOString().split('T')[0]} - ${member.totalHours} hours worked`,
      });

      if (result.success && result.disbursementId) {
        disbursementIds.push(result.disbursementId);
      } else {
        errors.push(`${member.memberId}: ${result.error}`);
      }
    }

    return {
      success: true,
      created: disbursementIds.length,
      skipped: eligibility.length - eligible.length,
      disbursementIds,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      created: 0,
      skipped: 0,
      disbursementIds: [],
      errors: [error.message],
    };
  }
}
