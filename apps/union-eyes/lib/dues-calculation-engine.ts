/**
 * Dues calculation.
 *
 * A member's dues come from their dues assignment (`dues_assignments`): the organization's record of the amount the member pays every billing
 * frequency, from an effective date until an end date. The engine reads that record and nothing else; it approves and pays nothing.
 *
 * It used to evaluate rule types (percentage, hourly, tiered, formula) from financial-service's `dues_rules` and `member_dues_assignments`.
 * Neither table is part of the canonical schema, and both are revoked from the application roles, so every calculation failed on a real database.
 *
 * Every read goes through the executor the caller gives it: the transaction of the organization the dues belong to.
 */
import { duesAssignments } from '@/db/schema/domains/finance/dues-assignments';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { toCents } from '@/lib/decimal-safe';
import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';

export type DuesBillingFrequency = 'monthly' | 'bi_weekly' | 'weekly' | 'quarterly' | 'annual';

export interface DuesCalculationParams {
  organizationId: string;
  memberId: string;
  periodStart: Date;
  periodEnd: Date;
  /** The billing cycle's frequency. An assignment on another frequency is not due in this cycle; without one, any frequency is calculated. */
  frequency?: DuesBillingFrequency;
}

export interface DuesCalculationResult {
  amount: number;
  calculationType: 'assignment';
  assignmentId: string;
  frequency: string;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  breakdown: {
    baseAmount: number;
    flatAmount: number;
  };
}

/** Days after the end of the period that the dues fall due. */
const DAYS_TO_DUE = 15;

const FREQUENCY_ALIASES: Record<string, DuesBillingFrequency> = {
  weekly: 'weekly',
  biweekly: 'bi_weekly',
  bi_weekly: 'bi_weekly',
  monthly: 'monthly',
  quarterly: 'quarterly',
  annual: 'annual',
  annually: 'annual',
  yearly: 'annual',
};

/** The billing frequency an assignment's free-text frequency names, or undefined when it names none. */
export function assignmentFrequency(value: string): DuesBillingFrequency | undefined {
  return FREQUENCY_ALIASES[value.trim().toLowerCase().replace(/[\s-]+/g, '_')];
}

export class DuesCalculationEngine {
  /**
   * The dues of a member for a period: the amount of the member's assignment that is active at the start of the period (not ended before it),
   * or null when the member has none, or none on the cycle's frequency, or one that charges nothing. When several are active, the most
   * recently effective one applies.
   */
  static async calculateMemberDues(
    params: DuesCalculationParams,
    executor: RLSTx,
  ): Promise<DuesCalculationResult | null> {
    const { organizationId, memberId, periodStart, periodEnd, frequency } = params;
    if (periodStart.getTime() > periodEnd.getTime()) throw new Error('Invalid dues calculation period');

    const candidates = await executor
      .select({
        id: duesAssignments.id,
        amount: duesAssignments.amount,
        frequency: duesAssignments.frequency,
      })
      .from(duesAssignments)
      .where(
        and(
          eq(duesAssignments.organizationId, organizationId),
          eq(duesAssignments.memberId, memberId),
          eq(duesAssignments.status, 'active'),
          lte(duesAssignments.effectiveDate, periodStart),
          or(isNull(duesAssignments.endDate), gte(duesAssignments.endDate, periodStart)),
        ),
      )
      .orderBy(desc(duesAssignments.effectiveDate), desc(duesAssignments.createdAt))
      .limit(10);

    const assignment = candidates.find((candidate) => !frequency || assignmentFrequency(candidate.frequency) === frequency);
    if (!assignment) return null;

    const amount = toCents(assignment.amount) / 100;
    if (!(amount > 0)) return null;

    return {
      amount,
      calculationType: 'assignment',
      assignmentId: assignment.id,
      frequency: assignment.frequency,
      periodStart,
      periodEnd,
      dueDate: this.calculateDueDate(periodEnd),
      breakdown: { baseAmount: amount, flatAmount: amount },
    };
  }

  private static calculateDueDate(periodEnd: Date): Date {
    const dueDate = new Date(periodEnd);
    dueDate.setUTCDate(dueDate.getUTCDate() + DAYS_TO_DUE);
    return dueDate;
  }
}
