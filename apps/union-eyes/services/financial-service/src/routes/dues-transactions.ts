/**
 * Dues Transactions Routes
 * Endpoints for calculating and managing dues transactions
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { DuesCalculationEngine } from '@union-claims/financial';
import { db, schema } from '../db';
import { eq, and, desc, between, isNull, inArray } from 'drizzle-orm';

const router = Router();
const calculationEngine = new DuesCalculationEngine();

// Validation schemas
const calculateDuesSchema = z.object({
  memberId: z.string().uuid(),
  billingPeriodStart: z.coerce.date(),
  billingPeriodEnd: z.coerce.date(),
  grossWages: z.coerce.number().optional(),
  baseSalary: z.coerce.number().optional(),
  hourlyRate: z.coerce.number().optional(),
  hoursWorked: z.coerce.number().optional(),
});

const batchCalculateSchema = z.object({
  billingPeriodStart: z.coerce.date(),
  billingPeriodEnd: z.coerce.date(),
  memberIds: z.array(z.string().uuid()).optional(),
  memberData: z.array(z.object({
    memberId: z.string().uuid(),
    grossWages: z.number().optional(),
    baseSalary: z.number().optional(),
    hourlyRate: z.number().optional(),
    hoursWorked: z.number().optional(),
  })).optional(),
  dryRun: z.boolean().default(false),
});

/**
 * POST /api/dues/transactions/calculate
 * Calculate dues for a single member (preview without saving)
 */
router.post('/calculate', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, _userId } = (req as any).user;
    const validatedData = calculateDuesSchema.parse(req.body);

    // Fetch active assignment with joined rule
    const [assignment] = await db
      .select()
      .from(schema.memberDuesAssignments)
      .leftJoin(
        schema.duesRules,
        eq(schema.memberDuesAssignments.ruleId, schema.duesRules.id)
      )
      .where(
        and(
          eq(schema.memberDuesAssignments.memberId, validatedData.memberId),
          eq(schema.memberDuesAssignments.organizationId, organizationId),
          eq(schema.memberDuesAssignments.isActive, true),
          isNull(schema.memberDuesAssignments.endDate)
        )
      )
      .limit(1);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        error: 'No active dues assignment found for member',
      });
    }

    const rule = assignment.dues_rules;
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Dues rule not found',
      });
    }

    // Prepare calculation input
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calculationInput: any = {
      memberId: validatedData.memberId,
      organizationId: organizationId,
      assignmentId: assignment.member_dues_assignments.id,
      rule: {
        id: rule.id,
        organizationId: rule.organizationId,
        ruleName: rule.ruleName,
        ruleCode: rule.ruleCode,
        calculationType: rule.calculationType,
        percentageRate: rule.percentageRate ? Number(rule.percentageRate) : undefined,
        baseField: rule.baseField,
        flatAmount: rule.flatAmount ? Number(rule.flatAmount) : undefined,
        hourlyRate: rule.hourlyRate ? Number(rule.hourlyRate) : undefined,
        hoursPerPeriod: rule.hoursPerPeriod ? Number(rule.hoursPerPeriod) : undefined,
        tierStructure: rule.tierStructure,
        customFormula: rule.customFormula,
        billingFrequency: rule.billingFrequency,
        copeContribution: 0,
        pacContribution: 0,
        initiationFee: 0,
        strikeFundContribution: 0,
        gracePeriodDays: 0,
        lateFeeType: 'none' as const,
        effectiveFrom: new Date(rule.effectiveDate),
        effectiveTo: rule.endDate ? new Date(rule.endDate) : undefined,
        isActive: rule.isActive,
      },
      billingPeriodStart: new Date(validatedData.billingPeriodStart),
      billingPeriodEnd: new Date(validatedData.billingPeriodEnd),
      dueDate: new Date(validatedData.billingPeriodEnd),
      grossWages: validatedData.grossWages,
      baseSalary: validatedData.baseSalary,
      hourlyRate: validatedData.hourlyRate,
      hoursWorked: validatedData.hoursWorked,
    };

    // Calculate dues
    const result = await calculationEngine.calculateMemberDues(calculationInput);

    res.json({
      success: true,
      data: {
        calculation: result,
        assignment: assignment.member_dues_assignments,
        rule: {
          id: rule.id,
          name: rule.ruleName,
          code: rule.ruleCode,
          calculationType: rule.calculationType,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/dues/transactions/batch
 * Batch calculate and create transactions for multiple members
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, userId, role } = (req as any).user;

    if (!['admin', 'financial_admin'].includes(role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions for batch operations',
      });
    }

    const validatedData = batchCalculateSchema.parse(req.body);

    // Build query for active assignments
    const conditions = [
      eq(schema.memberDuesAssignments.organizationId, organizationId),
      eq(schema.memberDuesAssignments.isActive, true),
      isNull(schema.memberDuesAssignments.endDate),
    ];

    if (validatedData.memberIds && validatedData.memberIds.length > 0) {
      conditions.push(inArray(schema.memberDuesAssignments.memberId, validatedData.memberIds));
    }

    // Fetch all active assignments with rules
    const assignments = await db
      .select()
      .from(schema.memberDuesAssignments)
      .leftJoin(
        schema.duesRules,
        eq(schema.memberDuesAssignments.ruleId, schema.duesRules.id)
      )
      .where(and(...conditions));

    if (assignments.length === 0) {
      return res.json({
        success: true,
        data: {
          summary: {
            totalProcessed: 0,
            successCount: 0,
            errorCount: 0,
            totalRevenue: 0,
          },
          transactions: [],
          errors: [],
        },
      });
    }

    // Prepare calculation inputs
    const calculationInputs = assignments
      .filter((a) => a.dues_rules !== null)
      .map((assignment) => {
        const rule = assignment.dues_rules!;
        const memberAssignment = assignment.member_dues_assignments;
        const memberInfo = validatedData.memberData?.find(
          (m) => m.memberId === memberAssignment.memberId
        );
        return {
          memberId: memberAssignment.memberId,
          organizationId: organizationId,
          assignmentId: memberAssignment.id,
          rule: {
            id: rule.id,
            organizationId: rule.organizationId,
            ruleName: rule.ruleName,
            ruleCode: rule.ruleCode,
            calculationType: rule.calculationType,
            percentageRate: rule.percentageRate ? Number(rule.percentageRate) : undefined,
            baseField: rule.baseField,
            flatAmount: rule.flatAmount ? Number(rule.flatAmount) : undefined,
            hourlyRate: rule.hourlyRate ? Number(rule.hourlyRate) : undefined,
            hoursPerPeriod: rule.hoursPerPeriod ? Number(rule.hoursPerPeriod) : undefined,
            tierStructure: rule.tierStructure,
            customFormula: rule.customFormula,
            billingFrequency: rule.billingFrequency,
            copeContribution: 0,
            pacContribution: 0,
            initiationFee: 0,
            strikeFundContribution: 0,
            gracePeriodDays: 0,
            lateFeeType: 'none' as const,
            effectiveFrom: new Date(rule.effectiveDate),
            effectiveTo: rule.endDate ? new Date(rule.endDate) : undefined,
            isActive: rule.isActive,
          },
          billingPeriodStart: new Date(validatedData.billingPeriodStart),
          billingPeriodEnd: new Date(validatedData.billingPeriodEnd),
          dueDate: new Date(validatedData.billingPeriodEnd),
          grossWages: memberInfo?.grossWages,
          baseSalary: memberInfo?.baseSalary,
          hourlyRate: memberInfo?.hourlyRate,
          hoursWorked: memberInfo?.hoursWorked,
        };
      });

    // Run batch calculation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const batchResult = calculationEngine.batchCalculateDuesSimple(calculationInputs as any);

    // If dry run, return results without saving
    if (validatedData.dryRun) {
      return res.json({
        success: true,
        data: {
          totalProcessed: batchResult.totalProcessed,
          successful: batchResult.successful,
          failed: batchResult.failed,
          summary: batchResult.summary,
          dryRun: true,
          message: 'Dry run - no transactions created',
        },
      });
    }

    // Create transaction records
    const transactionsToInsert = batchResult.results
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((r: any) => !r.errors || r.errors.length === 0) // Check for no errors instead of success property
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((result: any) => {
        const assignment = assignments.find(
          (a) => a.member_dues_assignments.memberId === result.memberId
        )!;

        const dueDate = new Date(validatedData.billingPeriodEnd);
        dueDate.setDate(dueDate.getDate() + 7); // Due 7 days after period end

        return {
          organizationId: organizationId,
          memberId: result.memberId,
          assignmentId: assignment.member_dues_assignments.id,
          transactionType: 'dues' as const,
          periodStart: validatedData.billingPeriodStart,
          periodEnd: validatedData.billingPeriodEnd,
          dueDate: dueDate.toISOString().split('T')[0],
          amount: result.totalAmount.toString(),
          status: 'pending' as const,
          createdBy: userId,
        };
      });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let createdTransactions: any[] = [];
    if (transactionsToInsert.length > 0) {
      createdTransactions = await db
        .insert(schema.duesTransactions)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .values(transactionsToInsert as any)
        .returning();
    }

    res.json({
      success: true,
      data: {
        summary: batchResult.summary,
        transactionsCreated: createdTransactions.length,
        transactions: createdTransactions,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        errors: batchResult.results.filter((r: any) => r.errors && r.errors.length > 0),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/dues/transactions
 * List transactions with filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId } = (req as any).user;
    const { memberId, status, startDate, endDate } = req.query;

    const conditions = [eq(schema.duesTransactions.organizationId, organizationId)];

    if (memberId) {
      conditions.push(eq(schema.duesTransactions.memberId, memberId as string));
    }
    if (status) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(eq(schema.duesTransactions.status, status as any));
    }
    if (startDate && endDate) {
      conditions.push(
        between(
          schema.duesTransactions.periodStart,
          startDate as string,
          endDate as string
        )
      );
    }

    const transactions = await db
      .select()
      .from(schema.duesTransactions)
      .where(and(...conditions))
      .orderBy(desc(schema.duesTransactions.createdAt))
      .limit(100);

    res.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/dues/transactions/:id
 * Get single transaction
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId } = (req as any).user;
    const { id } = req.params;

    const [transaction] = await db
      .select()
      .from(schema.duesTransactions)
      .where(
        and(
          eq(schema.duesTransactions.id, id),
          eq(schema.duesTransactions.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
      });
    }

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
