/**
 * Arrears Detection Service
 * Automated system to detect overdue payments and create arrears cases
 */

import { db, schema } from '../db';
import { eq, and, sql } from 'drizzle-orm';

export interface ArrearsDetectionConfig {
  organizationId: string;
  gracePeriodDays?: number;
  lateFeePercentage?: number;
  lateFeeFixedAmount?: number;
  escalationThresholds?: {
    level1Days?: number; // Initial contact
    level2Days?: number; // Payment plan offer
    level3Days?: number; // Suspension warning
    level4Days?: number; // Legal action
  };
}

export interface DetectedArrears {
  memberId: string;
  transactionIds: string[];
  totalOwing: number;
  oldestDebtDate: Date;
  daysOverdue: number;
  transactionCount: number;
  suggestedEscalation: string;
}

/**
 * Detect all overdue transactions and group by member
 */
export async function detectOverduePayments(
  config: ArrearsDetectionConfig
): Promise<DetectedArrears[]> {
  const { organizationId, gracePeriodDays = 30 } = config;

  // Calculate cutoff date (today - grace period)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - gracePeriodDays);

  // Query all overdue transactions using raw SQL to match actual database schema
  const overdueTransactions = await db.execute<{
    id: string;
    member_id: string;
    due_date: Date;
    amount: string;
  }>(sql`
    SELECT id, member_id, due_date, amount
    FROM dues_transactions
    WHERE organization_id = ${organizationId}
      AND due_date < ${cutoffDate.toISOString()}
      AND status = 'pending'
    ORDER BY due_date ASC
  `);

  // Group by member
  const memberArrears = new Map<string, DetectedArrears>();

  for (const transaction of overdueTransactions) {
    const memberId = transaction.member_id;
    const existing = memberArrears.get(memberId);

    const dueDate = new Date(transaction.due_date);
    const daysOverdue = Math.floor(
      (Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const amount = Number(transaction.amount || 0);

    if (existing) {
      existing.transactionIds.push(transaction.id);
      existing.totalOwing += amount;
      existing.transactionCount++;
      if (dueDate < existing.oldestDebtDate) {
        existing.oldestDebtDate = dueDate;
        existing.daysOverdue = daysOverdue;
      }
    } else {
      memberArrears.set(memberId, {
        memberId,
        transactionIds: [transaction.id],
        totalOwing: amount,
        oldestDebtDate: dueDate,
        daysOverdue,
        transactionCount: 1,
        suggestedEscalation: determineSuggestedEscalation(
          daysOverdue,
          config.escalationThresholds
        ),
      });
    }
  }

  return Array.from(memberArrears.values());
}

/**
 * Calculate late fees for overdue transactions
 */
export async function calculateLateFees(
  transactionId: string,
  config: ArrearsDetectionConfig
): Promise<number> {
  const { lateFeePercentage = 0, lateFeeFixedAmount = 0 } = config;

  const result = await db.execute<{
    amount: string;
  }>(sql`
    SELECT amount
    FROM dues_transactions
    WHERE id = ${transactionId}
    LIMIT 1
  `);

  if (!result || result.length === 0) {
    return 0;
  }

  const baseAmount = Number(result[0].amount || 0);
  const percentageFee = (baseAmount * lateFeePercentage) / 100;
  const totalLateFee = percentageFee + lateFeeFixedAmount;

  return Math.round(totalLateFee * 100) / 100;
}

/**
 * Create arrears cases for detected overdue payments
 */
export async function createArrearsCases(
  detectedArrears: DetectedArrears[],
  organizationId: string,
  _createdBy: string
): Promise<string[]> {
  const createdCaseIds: string[] = [];

  for (const arrears of detectedArrears) {
    // Check if active case already exists
    const [existingCase] = await db
      .select()
      .from(schema.arrearsCases)
      .where(
        and(
          eq(schema.arrearsCases.organizationId, organizationId),
          eq(schema.arrearsCases.memberId, arrears.memberId),
          eq(schema.arrearsCases.status, 'open')
        )
      )
      .limit(1);

    if (existingCase) {
      // Update existing case with new transactions
      await db
        .update(schema.arrearsCases)
        .set({
          totalOwed: arrears.totalOwing.toString(),
          remainingBalance: arrears.totalOwing.toString(),
          oldestDebtDate: arrears.oldestDebtDate.toISOString().split('T')[0],
          daysOverdue: arrears.daysOverdue.toString(),
          transactionIds: arrears.transactionIds,
          escalationLevel: Math.floor(arrears.daysOverdue / 30).toString(),
          updatedAt: new Date(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .where(eq(schema.arrearsCases.id, existingCase.id));

      createdCaseIds.push(existingCase.id);
    } else {
      // Generate unique case number
      const caseNumber = `ARR-${Date.now()}-${arrears.memberId.substring(0, 8)}`;

      // Create new arrears case
      const [newCase] = await db
        .insert(schema.arrearsCases)
        .values({
          organizationId,
          memberId: arrears.memberId,
          caseNumber,
          totalOwed: arrears.totalOwing.toString(),
          remainingBalance: arrears.totalOwing.toString(),
          oldestDebtDate: arrears.oldestDebtDate.toISOString().split('T')[0],
          daysOverdue: arrears.daysOverdue.toString(),
          transactionIds: arrears.transactionIds,
          escalationLevel: Math.floor(arrears.daysOverdue / 30).toString(),
          status: 'open',
          notes: `Auto-generated case: ${arrears.transactionCount} overdue transaction(s), ${arrears.daysOverdue} days overdue`,
          createdAt: new Date(),
          updatedAt: new Date(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .returning();

      createdCaseIds.push(newCase.id);
    }
  }

  return createdCaseIds;
}

/**
 * Apply late fees to overdue transactions
 */
export async function applyLateFees(
  transactionIds: string[],
  config: ArrearsDetectionConfig
): Promise<number> {
  let totalFeesApplied = 0;

  for (const transactionId of transactionIds) {
    const lateFee = await calculateLateFees(transactionId, config);

    if (lateFee > 0) {
      const [transaction] = await db
        .select({
          totalAmount: schema.duesTransactions.totalAmount,
        })
        .from(schema.duesTransactions)
        .where(eq(schema.duesTransactions.id, transactionId))
        .limit(1);

      if (transaction) {
        const baseAmount = Number(transaction.totalAmount);
        const newTotal = baseAmount + lateFee;

        await db
          .update(schema.duesTransactions)
          .set({
            lateFeeAmount: lateFee.toString(),
            totalAmount: newTotal.toString(),
            updatedAt: new Date(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any)
          .where(eq(schema.duesTransactions.id, transactionId));

        totalFeesApplied += lateFee;
      }
    }
  }

  return totalFeesApplied;
}

/**
 * Determine suggested escalation level based on days overdue
 */
function determineSuggestedEscalation(
  daysOverdue: number,
  thresholds?: {
    level1Days?: number;
    level2Days?: number;
    level3Days?: number;
    level4Days?: number;
  }
): string {
  const defaultThresholds = {
    level1Days: 30,
    level2Days: 60,
    level3Days: 90,
    level4Days: 120,
  };

  const t = thresholds || defaultThresholds;

  if (daysOverdue >= t.level4Days) {
    return 'legal_action';
  } else if (daysOverdue >= t.level3Days) {
    return 'suspended';
  } else if (daysOverdue >= t.level2Days) {
    return 'payment_plan';
  } else if (daysOverdue >= t.level1Days) {
    return 'active';
  }

  return 'active';
}

/**
 * Run full arrears detection workflow
 */
export async function runArrearsDetection(
  config: ArrearsDetectionConfig,
  createdBy: string
): Promise<{
  detectedCount: number;
  casesCreated: string[];
  totalOwing: number;
  feesApplied: number;
}> {
  // Step 1: Detect all overdue payments
  const detectedArrears = await detectOverduePayments(config);

  if (detectedArrears.length === 0) {
    return {
      detectedCount: 0,
      casesCreated: [],
      totalOwing: 0,
      feesApplied: 0,
    };
  }

  // Step 2: Calculate total owing
  const totalOwing = detectedArrears.reduce((sum, a) => sum + a.totalOwing, 0);

  // Step 3: Apply late fees if configured
  let feesApplied = 0;
  if (config.lateFeePercentage || config.lateFeeFixedAmount) {
    const allTransactionIds = detectedArrears.flatMap((a) => a.transactionIds);
    feesApplied = await applyLateFees(allTransactionIds, config);
  }

  // Step 4: Create or update arrears cases
  const casesCreated = await createArrearsCases(
    detectedArrears,
    config.organizationId,
    createdBy
  );

  return {
    detectedCount: detectedArrears.length,
    casesCreated,
    totalOwing,
    feesApplied,
  };
}
