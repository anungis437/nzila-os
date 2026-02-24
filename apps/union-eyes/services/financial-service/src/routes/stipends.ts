/**
 * Stipend Management Routes
 * Week 6: API endpoints for stipend calculations and disbursements
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as StipendService from '../services/stipend-calculation';

const router = Router();

// Validation schemas
const calculateStipendsSchema = z.object({
  strikeFundId: z.string().uuid(),
  weekStartDate: z.string().datetime(),
  weekEndDate: z.string().datetime(),
  minimumHours: z.number().positive().optional(),
  hourlyRate: z.number().positive().optional(),
});

const createDisbursementSchema = z.object({
  strikeFundId: z.string().uuid(),
  memberId: z.string().uuid(),
  amount: z.number().positive(),
  weekStartDate: z.string().datetime(),
  weekEndDate: z.string().datetime(),
  paymentMethod: z.enum(['direct_deposit', 'check', 'cash', 'paypal']),
  notes: z.string().optional(),
});

const approveDisbursementSchema = z.object({
  disbursementId: z.string().uuid(),
  approvalNotes: z.string().optional(),
});

const markPaidSchema = z.object({
  disbursementId: z.string().uuid(),
  transactionId: z.string().min(1),
});

const batchCreateSchema = z.object({
  strikeFundId: z.string().uuid(),
  weekStartDate: z.string().datetime(),
  weekEndDate: z.string().datetime(),
  minimumHours: z.number().positive().optional(),
  hourlyRate: z.number().positive().optional(),
  paymentMethod: z.enum(['direct_deposit', 'check', 'cash', 'paypal']),
});

/**
 * POST /api/stipends/calculate
 * Calculate weekly stipends for all members
 */
router.post('/calculate', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId } = (req as any).user;
    const validatedData = calculateStipendsSchema.parse(req.body);

    const eligibility = await StipendService.calculateWeeklyStipends({
      organizationId,
      strikeFundId: validatedData.strikeFundId,
      weekStartDate: new Date(validatedData.weekStartDate),
      weekEndDate: new Date(validatedData.weekEndDate),
      minimumHours: validatedData.minimumHours,
      hourlyRate: validatedData.hourlyRate,
    });

    res.json({
      success: true,
      eligibility,
      summary: {
        totalMembers: eligibility.length,
        eligible: eligibility.filter(e => e.eligible).length,
        totalStipendAmount: eligibility
          .filter(e => e.eligible)
          .reduce((sum, e) => sum + e.stipendAmount, 0),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate stipends',
    });
  }
});

/**
 * POST /api/stipends/disbursements
 * Create a disbursement record
 */
router.post('/disbursements', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, id: userId } = (req as any).user;
    const validatedData = createDisbursementSchema.parse(req.body);

    const result = await StipendService.createDisbursement({
      organizationId,
      strikeFundId: validatedData.strikeFundId,
      memberId: validatedData.memberId,
      amount: validatedData.amount,
      weekStartDate: new Date(validatedData.weekStartDate),
      weekEndDate: new Date(validatedData.weekEndDate),
      approvedBy: userId,
      paymentMethod: validatedData.paymentMethod,
      notes: validatedData.notes,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create disbursement',
    });
  }
});

/**
 * POST /api/stipends/disbursements/batch
 * Batch create disbursements for all eligible members
 */
router.post('/disbursements/batch', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, id: userId } = (req as any).user;
    const validatedData = batchCreateSchema.parse(req.body);

    const result = await StipendService.batchCreateDisbursements({
      organizationId,
      strikeFundId: validatedData.strikeFundId,
      weekStartDate: new Date(validatedData.weekStartDate),
      weekEndDate: new Date(validatedData.weekEndDate),
      minimumHours: validatedData.minimumHours,
      hourlyRate: validatedData.hourlyRate,
      approvedBy: userId,
      paymentMethod: validatedData.paymentMethod,
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to batch create disbursements',
    });
  }
});

/**
 * GET /api/stipends/disbursements/pending/:strikeFundId
 * Get pending disbursements for approval
 */
router.get('/disbursements/pending/:strikeFundId', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId } = (req as any).user;
    const { strikeFundId } = req.params;

    const disbursements = await StipendService.getPendingDisbursements(
      organizationId,
      strikeFundId
    );

    res.json({
      success: true,
      disbursements,
      count: disbursements.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get pending disbursements',
    });
  }
});

/**
 * GET /api/stipends/disbursements/member/:memberId
 * Get disbursement history for a member
 */
router.get('/disbursements/member/:memberId', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId } = (req as any).user;
    const { memberId } = req.params;
    const { strikeFundId } = req.query;

    const disbursements = await StipendService.getMemberDisbursements(
      organizationId,
      memberId,
      strikeFundId as string | undefined
    );

    res.json({
      success: true,
      disbursements,
      count: disbursements.length,
      totalAmount: disbursements.reduce((sum, d) => sum + d.amount, 0),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get member disbursements',
    });
  }
});

/**
 * POST /api/stipends/disbursements/:disbursementId/approve
 * Approve a pending disbursement
 */
router.post('/disbursements/:disbursementId/approve', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, id: userId } = (req as any).user;
    const { disbursementId } = req.params;
    const { approvalNotes } = approveDisbursementSchema.parse({ 
      disbursementId, 
      ...req.body 
    });

    const result = await StipendService.approveDisbursement(organizationId, {
      disbursementId,
      approvedBy: userId,
      approvalNotes,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to approve disbursement',
    });
  }
});

/**
 * POST /api/stipends/disbursements/:disbursementId/paid
 * Mark disbursement as paid
 */
router.post('/disbursements/:disbursementId/paid', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, id: userId } = (req as any).user;
    const { disbursementId } = req.params;
    const { transactionId } = markPaidSchema.parse({ disbursementId, ...req.body });

    const result = await StipendService.markDisbursementPaid(
      organizationId,
      disbursementId,
      transactionId,
      userId
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark disbursement as paid',
    });
  }
});

/**
 * GET /api/stipends/summary/:strikeFundId
 * Get disbursement summary for a strike fund
 */
router.get('/summary/:strikeFundId', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId } = (req as any).user;
    const { strikeFundId } = req.params;

    const summary = await StipendService.getStrikeFundDisbursementSummary(
      organizationId,
      strikeFundId
    );

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get disbursement summary',
    });
  }
});

export default router;
