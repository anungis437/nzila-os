import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface CollectionMetrics {
  totalDuesCharged: number;
  totalCollected: number;
  collectionRate: number;
  outstandingAmount: number;
  membersPaying: number;
  totalMembers: number;
  paymentRate: number;
  averagePaymentTime: number; // days
}

export interface ArrearsStatistics {
  totalCases: number;
  totalOwed: number;
  casesByStatus: Record<string, number>;
  casesByEscalationLevel: Record<number, number>;
  averageDaysOverdue: number;
  oldestCase: {
    id: string;
    memberId: string;
    daysOverdue: number;
    totalOwed: number;
  } | null;
}

export interface RevenueAnalysis {
  totalRevenue: number;
  revenueByMonth: Array<{
    month: string;
    amount: number;
    transactionCount: number;
  }>;
  revenueByType: Record<string, number>;
  growthRate: number; // percentage
}

export interface MemberPaymentPattern {
  memberId: string;
  totalTransactions: number;
  totalPaid: number;
  averagePaymentAmount: number;
  onTimePayments: number;
  latePayments: number;
  missedPayments: number;
  paymentReliabilityScore: number; // 0-100
  lastPaymentDate: Date | null;
}

/**
 * Calculate collection metrics for a given date range
 */
export async function getCollectionMetrics(
  organizationId: string,
  dateRange: DateRange
): Promise<CollectionMetrics> {
  try {
    const { startDate, endDate } = dateRange;
    logger.info('[getCollectionMetrics] Starting', { organizationId, startDate, endDate });

    // Total dues charged in period
    const chargedResult = await db.execute<{ total: string; count: string }>(sql`
      SELECT 
        COALESCE(SUM(amount), 0) as total,
        COUNT(DISTINCT member_id) as count
      FROM dues_transactions
      WHERE tenant_id = ${organizationId}
        AND transaction_type = 'charge'
        AND due_date >= ${startDate.toISOString()}
        AND due_date <= ${endDate.toISOString()}
    `);

    const totalDuesCharged = Number(chargedResult[0]?.total || 0);
    const totalMembers = Number(chargedResult[0]?.count || 0);

    // Total collected in period (payments)
    const collectedResult = await db.execute<{ total: string; count: string }>(sql`
      SELECT 
        COALESCE(SUM(amount), 0) as total,
        COUNT(DISTINCT member_id) as count
      FROM dues_transactions
      WHERE tenant_id = ${organizationId}
        AND transaction_type = 'payment'
        AND payment_date >= ${startDate.toISOString()}
        AND payment_date <= ${endDate.toISOString()}
    `);

    const totalCollected = Number(collectedResult[0]?.total || 0);
    const membersPaying = Number(collectedResult[0]?.count || 0);

    // Outstanding (pending) transactions
    const outstandingResult = await db.execute<{ total: string }>(sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM dues_transactions
      WHERE tenant_id = ${organizationId}
        AND status = 'pending'
        AND due_date <= ${endDate.toISOString()}
    `);

    const outstandingAmount = Number(outstandingResult[0]?.total || 0);

    // Average payment time (days from due date to payment date)
    const paymentTimeResult = await db.execute<{ avg_days: string }>(sql`
      SELECT AVG(EXTRACT(DAY FROM (payment_date - due_date))) as avg_days
      FROM dues_transactions
      WHERE tenant_id = ${organizationId}
        AND transaction_type = 'charge'
        AND status = 'paid'
        AND payment_date IS NOT NULL
        AND due_date >= ${startDate.toISOString()}
        AND due_date <= ${endDate.toISOString()}
    `);

    const averagePaymentTime = Number(paymentTimeResult[0]?.avg_days || 0);

    const collectionRate = totalDuesCharged > 0 
      ? (totalCollected / totalDuesCharged) * 100 
      : 0;

    const paymentRate = totalMembers > 0 
      ? (membersPaying / totalMembers) * 100 
      : 0;

    return {
      totalDuesCharged,
      totalCollected,
      collectionRate: Math.round(collectionRate * 100) / 100,
      outstandingAmount,
      membersPaying,
      totalMembers,
      paymentRate: Math.round(paymentRate * 100) / 100,
      averagePaymentTime: Math.round(averagePaymentTime * 10) / 10,
    };
  } catch (error) {
    logger.error('[getCollectionMetrics] Error', {
      error,
      stack: error instanceof Error ? error.stack : undefined,
      organizationId,
    });
    throw error;
  }
}

/**
 * Get arrears statistics
 */
export async function getArrearsStatistics(
  organizationId: string
): Promise<ArrearsStatistics> {
  try {
    logger.info('[getArrearsStatistics] Starting', { organizationId });

    // Total cases and amount
    const totalResult = await db.execute<{ count: string; total: string }>(sql`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(CAST(total_owed AS DECIMAL)), 0) as total
      FROM arrears_cases
      WHERE tenant_id = ${organizationId}
        AND status NOT IN ('resolved', 'written_off')
    `);

    const totalCases = Number(totalResult[0]?.count || 0);
    const totalOwed = Number(totalResult[0]?.total || 0);

    // Cases by status
    const statusResult = await db.execute<{ status: string; count: string }>(sql`
      SELECT status, COUNT(*) as count
      FROM arrears_cases
      WHERE tenant_id = ${organizationId}
        AND status NOT IN ('resolved', 'written_off')
      GROUP BY status
    `);

    const casesByStatus: Record<string, number> = {};
    for (const row of statusResult) {
      casesByStatus[row.status] = Number(row.count);
    }

    // Cases by escalation level
    const escalationResult = await db.execute<{ level: string; count: string }>(sql`
      SELECT 
        COALESCE(CAST(escalation_level AS INTEGER), 0) as level,
        COUNT(*) as count
      FROM arrears_cases
      WHERE tenant_id = ${organizationId}
        AND status NOT IN ('resolved', 'written_off')
      GROUP BY escalation_level
    `);

    const casesByEscalationLevel: Record<number, number> = {};
    for (const row of escalationResult) {
      casesByEscalationLevel[Number(row.level)] = Number(row.count);
    }

    // Average days overdue
    const avgDaysResult = await db.execute<{ avg_days: string }>(sql`
      SELECT AVG(CAST(days_overdue AS DECIMAL)) as avg_days
      FROM arrears_cases
      WHERE tenant_id = ${organizationId}
        AND status NOT IN ('resolved', 'written_off')
        AND days_overdue IS NOT NULL
    `);

    const averageDaysOverdue = Number(avgDaysResult[0]?.avg_days || 0);

    // Oldest case
    const oldestResult = await db.execute<{
      id: string;
      member_id: string;
      days_overdue: string;
      total_owed: string;
    }>(sql`
      SELECT id, member_id, days_overdue, total_owed
      FROM arrears_cases
      WHERE tenant_id = ${organizationId}
        AND status NOT IN ('resolved', 'written_off')
        AND days_overdue IS NOT NULL
      ORDER BY CAST(days_overdue AS INTEGER) DESC
      LIMIT 1
    `);

    const oldestCase = oldestResult.length > 0
      ? {
          id: oldestResult[0].id,
          memberId: oldestResult[0].member_id,
          daysOverdue: Number(oldestResult[0].days_overdue),
          totalOwed: Number(oldestResult[0].total_owed),
        }
      : null;

    return {
      totalCases,
      totalOwed: Math.round(totalOwed * 100) / 100,
      casesByStatus,
      casesByEscalationLevel,
      averageDaysOverdue: Math.round(averageDaysOverdue * 10) / 10,
      oldestCase,
    };
  } catch (error) {
    logger.error('[getArrearsStatistics] Error', {
      error,
      stack: error instanceof Error ? error.stack : undefined,
      organizationId,
    });
    throw error;
  }
}

/**
 * Analyze revenue trends over time
 */
export async function getRevenueAnalysis(
  organizationId: string,
  dateRange: DateRange
): Promise<RevenueAnalysis> {
  try {
    const { startDate, endDate } = dateRange;
    logger.info('[getRevenueAnalysis] Starting', { organizationId, startDate, endDate });

    // Total revenue from payments
    const revenueResult = await db.execute<{ total: string }>(sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM dues_transactions
      WHERE tenant_id = ${organizationId}
        AND transaction_type = 'payment'
        AND payment_date >= ${startDate.toISOString()}
        AND payment_date <= ${endDate.toISOString()}
    `);

    const totalRevenue = Number(revenueResult[0]?.total || 0);

    // Revenue by month
    const monthlyResult = await db.execute<{
      month: string;
      amount: string;
      count: string;
    }>(sql`
      SELECT 
        TO_CHAR(payment_date, 'YYYY-MM') as month,
        SUM(amount) as amount,
        COUNT(*) as count
      FROM dues_transactions
      WHERE tenant_id = ${organizationId}
        AND transaction_type = 'payment'
        AND payment_date >= ${startDate.toISOString()}
        AND payment_date <= ${endDate.toISOString()}
      GROUP BY TO_CHAR(payment_date, 'YYYY-MM')
      ORDER BY month ASC
    `);

    const revenueByMonth = monthlyResult.map(row => ({
      month: row.month,
      amount: Number(row.amount),
      transactionCount: Number(row.count),
    }));

    // Revenue by transaction type
    const typeResult = await db.execute<{ type: string; amount: string }>(sql`
      SELECT 
        transaction_type as type,
        SUM(amount) as amount
      FROM dues_transactions
      WHERE tenant_id = ${organizationId}
        AND payment_date >= ${startDate.toISOString()}
        AND payment_date <= ${endDate.toISOString()}
      GROUP BY transaction_type
    `);

    const revenueByType: Record<string, number> = {};
    for (const row of typeResult) {
      revenueByType[row.type] = Number(row.amount);
    }

    // Calculate growth rate (compare first month to last month)
    let growthRate = 0;
    if (revenueByMonth.length >= 2) {
      const firstMonth = revenueByMonth[0].amount;
      const lastMonth = revenueByMonth[revenueByMonth.length - 1].amount;
      if (firstMonth > 0) {
        growthRate = ((lastMonth - firstMonth) / firstMonth) * 100;
      }
    }

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      revenueByMonth,
      revenueByType,
      growthRate: Math.round(growthRate * 100) / 100,
    };
  } catch (error) {
    logger.error('[getRevenueAnalysis] Error', {
      error,
      stack: error instanceof Error ? error.stack : undefined,
      organizationId,
    });
    throw error;
  }
}

/**
 * Analyze payment patterns for members
 */
export async function getMemberPaymentPatterns(
  organizationId: string,
  dateRange: DateRange,
  limit: number = 100
): Promise<MemberPaymentPattern[]> {
  try {
    const { startDate, endDate } = dateRange;
    logger.info('[getMemberPaymentPatterns] Starting', { organizationId, startDate, endDate, limit });

    const patternsResult = await db.execute<{
      member_id: string;
      total_transactions: string;
      total_paid: string;
      avg_payment: string;
      on_time: string;
      late: string;
      missed: string;
      last_payment: Date | null;
    }>(sql`
      SELECT 
        member_id,
        COUNT(*) as total_transactions,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as total_paid,
        COALESCE(AVG(CASE WHEN status = 'paid' THEN amount END), 0) as avg_payment,
        COUNT(CASE WHEN status = 'paid' AND payment_date <= due_date THEN 1 END) as on_time,
        COUNT(CASE WHEN status = 'paid' AND payment_date > due_date THEN 1 END) as late,
        COUNT(CASE WHEN status = 'pending' AND due_date < CURRENT_DATE THEN 1 END) as missed,
        MAX(payment_date) as last_payment
      FROM dues_transactions
      WHERE tenant_id = ${organizationId}
        AND transaction_type = 'charge'
        AND due_date >= ${startDate.toISOString()}
        AND due_date <= ${endDate.toISOString()}
      GROUP BY member_id
      ORDER BY total_paid DESC
      LIMIT ${limit}
    `);

    return patternsResult.map(row => {
      const totalTransactions = Number(row.total_transactions);
      const onTime = Number(row.on_time);
      const late = Number(row.late);
      const missed = Number(row.missed);

      // Calculate reliability score (on-time payments weighted higher)
      const paymentReliabilityScore = totalTransactions > 0
        ? Math.round(((onTime * 1.0 + late * 0.5) / totalTransactions) * 100)
        : 0;

      return {
        memberId: row.member_id,
        totalTransactions,
        totalPaid: Math.round(Number(row.total_paid) * 100) / 100,
        averagePaymentAmount: Math.round(Number(row.avg_payment) * 100) / 100,
        onTimePayments: onTime,
        latePayments: late,
        missedPayments: missed,
        paymentReliabilityScore,
        lastPaymentDate: row.last_payment,
      };
    });
  } catch (error) {
    logger.error('[getMemberPaymentPatterns] Error', {
      error,
      stack: error instanceof Error ? error.stack : undefined,
      organizationId,
    });
    throw error;
  }
}

/**
 * Get top-level financial dashboard summary
 */
export async function getFinancialDashboard(
  organizationId: string,
  dateRange: DateRange
) {
  try {
    logger.info('[getFinancialDashboard] Starting', { organizationId, dateRange });

    const [
      collectionMetrics,
      arrearsStats,
      revenueAnalysis,
      topPayers
    ] = await Promise.all([
      getCollectionMetrics(organizationId, dateRange),
      getArrearsStatistics(organizationId),
      getRevenueAnalysis(organizationId, dateRange),
      getMemberPaymentPatterns(organizationId, dateRange, 10),
    ]);

    return {
      collectionMetrics,
      arrearsStats,
      revenueAnalysis,
      topPayers,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[getFinancialDashboard] Error', {
      error,
      stack: error instanceof Error ? error.stack : undefined,
      organizationId,
    });
    throw error;
  }
}

