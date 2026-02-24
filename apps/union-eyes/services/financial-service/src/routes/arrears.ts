/**
 * Arrears Management Routes
 * Endpoints for collections, payment plans, and escalation workflow
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  runArrearsDetection,
  detectOverduePayments,
  type ArrearsDetectionConfig,
} from '../services/arrears-detection';

const router = Router();

// Validation schemas
const createArrearsCaseSchema = z.object({
  memberId: z.string().uuid(),
  transactionIds: z.array(z.string().uuid()).min(1),
  totalAmount: z.coerce.number().positive(),
  daysOverdue: z.number().int().positive(),
  notes: z.string().optional(),
});

const paymentPlanSchema = z.object({
  installmentAmount: z.coerce.number().positive(),
  numberOfInstallments: z.number().int().positive(),
  startDate: z.coerce.date(),
  frequency: z.enum(['weekly', 'biweekly', 'monthly']),
  notes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['active', 'payment_plan', 'suspended', 'legal_action', 'resolved', 'written_off']),
  notes: z.string().optional(),
});

const contactLogSchema = z.object({
  contactType: z.enum(['email', 'phone', 'letter', 'in_person']),
  notes: z.string().min(1),
  outcome: z.string().optional(),
});

const arrearsDetectionSchema = z.object({
  gracePeriodDays: z.coerce.number().int().nonnegative().default(30),
  lateFeePercentage: z.coerce.number().min(0).max(100).optional(),
  lateFeeFixedAmount: z.coerce.number().min(0).optional(),
  applyLateFees: z.boolean().default(false),
  createCases: z.boolean().default(true),
  escalationThresholds: z
    .object({
      level1Days: z.number().int().positive().optional(),
      level2Days: z.number().int().positive().optional(),
      level3Days: z.number().int().positive().optional(),
      level4Days: z.number().int().positive().optional(),
    })
    .default({
      level1Days: 30,
      level2Days: 60,
      level3Days: 90,
      level4Days: 120,
    }),
});

/**
 * POST /api/arrears/detect
 * Run automated arrears detection
 */
router.post('/detect', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, userId, role } = (req as any).user;

    if (!['admin', 'financial_admin'].includes(role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
    }

    const validatedData = arrearsDetectionSchema.parse(req.body);

    const config: ArrearsDetectionConfig = {
      organizationId,
      gracePeriodDays: validatedData.gracePeriodDays,
      escalationThresholds: validatedData.escalationThresholds,
    };

    if (validatedData.applyLateFees) {
      config.lateFeePercentage = validatedData.lateFeePercentage || 0;
      config.lateFeeFixedAmount = validatedData.lateFeeFixedAmount || 0;
    }

    let result;
    if (validatedData.createCases) {
      // Run full detection and create cases
      result = await runArrearsDetection(config, userId);
    } else {
      // Just detect without creating cases
      const detected = await detectOverduePayments(config);
      result = {
        detectedCount: detected.length,
        casesCreated: [],
        totalOwing: detected.reduce((sum, a) => sum + a.totalOwing, 0),
        feesApplied: 0,
        detectedArrears: detected,
      };
    }

    res.json({
      success: true,
      data: result,
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
 * GET /api/arrears
 * List all arrears cases with filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId } = (req as any).user;
    const { memberId, status } = req.query;

    const conditions = [eq(schema.arrearsCases.organizationId, organizationId)];

    if (memberId) {
      conditions.push(eq(schema.arrearsCases.memberId, memberId as string));
    }
    if (status) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(eq(schema.arrearsCases.status, status as any));
    }

    const cases = await db
      .select()
      .from(schema.arrearsCases)
      .where(and(...conditions))
      .orderBy(desc(schema.arrearsCases.createdAt))
      .limit(100);

    res.json({
      success: true,
      data: cases,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/arrears/:id
 * Get single arrears case with related transactions
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId } = (req as any).user;
    const { id } = req.params;

    const [arrearsCase] = await db
      .select()
      .from(schema.arrearsCases)
      .where(
        and(
          eq(schema.arrearsCases.id, id),
          eq(schema.arrearsCases.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!arrearsCase) {
      return res.status(404).json({
        success: false,
        error: 'Arrears case not found',
      });
    }

    // Fetch related transactions
    const transactionIds = arrearsCase.transactionIds as string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let transactions: any[] = [];
    
    if (transactionIds && transactionIds.length > 0) {
      transactions = await db
        .select()
        .from(schema.duesTransactions)
        .where(
          and(
            eq(schema.duesTransactions.organizationId, organizationId),
            sql`${schema.duesTransactions.id} = ANY(${transactionIds})`
          )
        );
    }

    res.json({
      success: true,
      data: {
        case: arrearsCase,
        transactions,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/arrears
 * Create a new arrears case
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, userId, role } = (req as any).user;

    if (!['admin', 'financial_admin'].includes(role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
    }

    const validatedData = createArrearsCaseSchema.parse(req.body);

    // Check if active case already exists for member
    const [existingCase] = await db
      .select()
      .from(schema.arrearsCases)
      .where(
        and(
          eq(schema.arrearsCases.organizationId, organizationId),
          eq(schema.arrearsCases.memberId, validatedData.memberId),
          eq(schema.arrearsCases.status, 'active')
        )
      )
      .limit(1);

    if (existingCase) {
      return res.status(409).json({
        success: false,
        error: 'Active arrears case already exists for this member',
      });
    }

    const [arrearsCase] = await db
      .insert(schema.arrearsCases)
      .values({
        organizationId,
        memberId: validatedData.memberId,
        transactionIds: validatedData.transactionIds,
        totalAmount: validatedData.totalAmount.toString(),
        remainingBalance: validatedData.totalAmount.toString(),
        daysOverdue: validatedData.daysOverdue.toString(),
        status: 'active',
        escalationLevel: '1',
        notes: validatedData.notes,
        createdBy: userId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .returning();

    res.status(201).json({
      success: true,
      data: arrearsCase,
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
 * POST /api/arrears/:id/payment-plan
 * Create or update payment plan for arrears case
 */
router.post('/:id/payment-plan', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, _userId, role } = (req as any).user;
    const { id } = req.params;

    if (!['admin', 'financial_admin'].includes(role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
    }

    const validatedData = paymentPlanSchema.parse(req.body);

    // Fetch arrears case
    const [arrearsCase] = await db
      .select()
      .from(schema.arrearsCases)
      .where(
        and(
          eq(schema.arrearsCases.id, id),
          eq(schema.arrearsCases.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!arrearsCase) {
      return res.status(404).json({
        success: false,
        error: 'Arrears case not found',
      });
    }

    // Calculate payment schedule
    const paymentSchedule = [];
    const currentDate = new Date(validatedData.startDate);
    
    for (let i = 0; i < validatedData.numberOfInstallments; i++) {
      paymentSchedule.push({
        installmentNumber: i + 1,
        dueDate: new Date(currentDate),
        amount: validatedData.installmentAmount,
        status: 'pending',
      });

      // Calculate next due date based on frequency
      switch (validatedData.frequency) {
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'biweekly':
          currentDate.setDate(currentDate.getDate() + 14);
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
      }
    }

    const [updatedCase] = await db
      .update(schema.arrearsCases)
      .set({
        status: 'payment_plan',
        paymentPlanActive: true,
        paymentPlanStartDate: validatedData.startDate.toISOString().split('T')[0],
        installmentAmount: validatedData.installmentAmount.toString(),
        numberOfInstallments: validatedData.numberOfInstallments.toString(),
        paymentSchedule,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .where(eq(schema.arrearsCases.id, id))
      .returning();

    res.json({
      success: true,
      data: {
        case: updatedCase,
        paymentSchedule,
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
 * PUT /api/arrears/:id/status
 * Update arrears case status (escalation workflow)
 */
router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, userId, role } = (req as any).user;
    const { id } = req.params;

    if (!['admin', 'financial_admin'].includes(role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
    }

    const validatedData = updateStatusSchema.parse(req.body);

    // Determine escalation level based on status
    const escalationLevels: Record<string, number> = {
      active: 1,
      payment_plan: 2,
      suspended: 3,
      legal_action: 4,
      resolved: 0,
      written_off: 0,
    };

    const [updatedCase] = await db
      .update(schema.arrearsCases)
      .set({
        status: validatedData.status,
        escalationLevel: escalationLevels[validatedData.status].toString(),
        notes: validatedData.notes,
        updatedBy: userId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .where(
        and(
          eq(schema.arrearsCases.id, id),
          eq(schema.arrearsCases.organizationId, organizationId)
        )
      )
      .returning();

    if (!updatedCase) {
      return res.status(404).json({
        success: false,
        error: 'Arrears case not found',
      });
    }

    res.json({
      success: true,
      data: updatedCase,
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
 * POST /api/arrears/:id/contact
 * Log contact attempt with member
 */
router.post('/:id/contact', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, userId } = (req as any).user;
    const { id } = req.params;

    const validatedData = contactLogSchema.parse(req.body);

    // Fetch current case
    const [arrearsCase] = await db
      .select()
      .from(schema.arrearsCases)
      .where(
        and(
          eq(schema.arrearsCases.id, id),
          eq(schema.arrearsCases.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!arrearsCase) {
      return res.status(404).json({
        success: false,
        error: 'Arrears case not found',
      });
    }

    // Add to contact history
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contactHistory = (arrearsCase.contactHistory as any[]) || [];
    contactHistory.push({
      timestamp: new Date(),
      contactType: validatedData.contactType,
      notes: validatedData.notes,
      outcome: validatedData.outcome,
      performedBy: userId,
    });

    const [updatedCase] = await db
      .update(schema.arrearsCases)
      .set({
        contactHistory,
        lastContactDate: new Date(),
        updatedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .where(eq(schema.arrearsCases.id, id))
      .returning();

    res.json({
      success: true,
      data: updatedCase,
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
 * POST /api/arrears/:id/payment
 * Record a payment against arrears case
 */
router.post('/:id/payment', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, _userId } = (req as any).user;
    const { id } = req.params;

    const paymentSchema = z.object({
      amount: z.coerce.number().positive(),
      paymentDate: z.coerce.date().default(() => new Date()),
      paymentMethod: z.string().optional(),
      notes: z.string().optional(),
    });

    const validatedData = paymentSchema.parse(req.body);

    // Fetch current case
    const [arrearsCase] = await db
      .select()
      .from(schema.arrearsCases)
      .where(
        and(
          eq(schema.arrearsCases.id, id),
          eq(schema.arrearsCases.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!arrearsCase) {
      return res.status(404).json({
        success: false,
        error: 'Arrears case not found',
      });
    }

    const currentBalance = Number(arrearsCase.remainingBalance);
    const paymentAmount = validatedData.amount;
    const newBalance = Math.max(0, currentBalance - paymentAmount);

    // Update case with payment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      remainingBalance: newBalance.toString(),
      updatedAt: new Date(),
    };

    // If fully paid, resolve the case
    if (newBalance === 0) {
      updateData.status = 'resolved';
      updateData.resolvedDate = new Date();
    }

    const [updatedCase] = await db
      .update(schema.arrearsCases)
      .set(updateData)
      .where(eq(schema.arrearsCases.id, id))
      .returning();

    res.json({
      success: true,
      data: {
        case: updatedCase,
        payment: {
          amount: paymentAmount,
          previousBalance: currentBalance,
          newBalance,
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

export default router;
