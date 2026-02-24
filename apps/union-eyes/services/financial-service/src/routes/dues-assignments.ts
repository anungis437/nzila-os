/**
 * Dues Assignments Routes
 * Endpoints for assigning dues rules to members
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { logger } from '../../../lib/logger';
import { logger } from '@/lib/logger';

const router = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createAssignmentSchema = z.object({
  memberId: z.string().uuid(),
  ruleId: z.string().uuid(),
  effectiveDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  overrideAmount: z.coerce.number().positive().optional(),
  overrideReason: z.string().max(500).optional(),
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/dues/assignments
 * List all dues assignments
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId } = (req as any).user;
    const { memberId, active } = req.query;

    const conditions = [eq(schema.memberDuesAssignments.organizationId, organizationId)];
    
    if (memberId) {
      conditions.push(eq(schema.memberDuesAssignments.memberId, memberId as string));
    }

    if (active === 'true') {
      conditions.push(eq(schema.memberDuesAssignments.isActive, true));
      conditions.push(isNull(schema.memberDuesAssignments.endDate));
    }

    const assignments = await db
      .select({
        assignment: schema.memberDuesAssignments,
        rule: schema.duesRules,
      })
      .from(schema.memberDuesAssignments)
      .leftJoin(
        schema.duesRules,
        eq(schema.memberDuesAssignments.ruleId, schema.duesRules.id)
      )
      .where(and(...conditions))
      .orderBy(desc(schema.memberDuesAssignments.createdAt));

    res.json({
      success: true,
      data: assignments,
      total: assignments.length,
    });
  } catch (error) {
    logger.error('Error fetching dues assignments', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch dues assignments' });
  }
});

/**
 * GET /api/dues/assignments/:id
 * Get a specific dues assignment by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId } = (req as any).user;
    const { id } = req.params;

    const [assignment] = await db
      .select({
        assignment: schema.memberDuesAssignments,
        rule: schema.duesRules,
      })
      .from(schema.memberDuesAssignments)
      .leftJoin(
        schema.duesRules,
        eq(schema.memberDuesAssignments.ruleId, schema.duesRules.id)
      )
      .where(and(
        eq(schema.memberDuesAssignments.id, id),
        eq(schema.memberDuesAssignments.organizationId, organizationId)
      ))
      .limit(1);

    if (!assignment) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    res.json({ success: true, data: assignment });
  } catch (error) {
    logger.error('Error fetching dues assignment', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch dues assignment' });
  }
});

/**
 * POST /api/dues/assignments
 * Create a new dues assignment
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, _userId, role } = (req as any).user;

    // Check permissions
    if (!['admin', 'financial_admin'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    // Validate input
    const validatedData = createAssignmentSchema.parse(req.body);

    // Verify the dues rule exists and belongs to the tenant
    const [rule] = await db
      .select()
      .from(schema.duesRules)
      .where(and(
        eq(schema.duesRules.id, validatedData.ruleId),
        eq(schema.duesRules.organizationId, organizationId)
      ))
      .limit(1);

    if (!rule) {
      return res.status(404).json({ success: false, error: 'Dues rule not found' });
    }

    // Create assignment
    const [newAssignment] = await db
      .insert(schema.memberDuesAssignments)
      .values({
        ...validatedData,
        organizationId: organizationId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .returning();

    res.status(201).json({ success: true, data: newAssignment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    logger.error('Error creating dues assignment', { error });
    res.status(500).json({ success: false, error: 'Failed to create dues assignment' });
  }
});

/**
 * PUT /api/dues/assignments/:id
 * Update an existing dues assignment
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, role } = (req as any).user;
    const { id } = req.params;

    // Check permissions
    if (!['admin', 'financial_admin'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    // Validate input
    const validatedData = createAssignmentSchema.partial().parse(req.body);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { ...validatedData };
    // Convert Date objects to strings
    if (updateData.effectiveDate instanceof Date) {
      updateData.effectiveDate = updateData.effectiveDate.toISOString().split('T')[0];
    }
    if (updateData.endDate instanceof Date) {
      updateData.endDate = updateData.endDate.toISOString().split('T')[0];
    }
    if (updateData.overrideAmount !== undefined) {
      updateData.overrideAmount = updateData.overrideAmount.toString();
    }

    const [updatedAssignment] = await db
      .update(schema.memberDuesAssignments)
      .set(updateData)
      .where(and(
        eq(schema.memberDuesAssignments.id, id),
        eq(schema.memberDuesAssignments.organizationId, organizationId)
      ))
      .returning();

    if (!updatedAssignment) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    res.json({ success: true, data: updatedAssignment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    logger.error('Error updating dues assignment', { error });
    res.status(500).json({ success: false, error: 'Failed to update dues assignment' });
  }
});

/**
 * DELETE /api/dues/assignments/:id
 * End a dues assignment (set effectiveTo to current date)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, role } = (req as any).user;
    const { id } = req.params;

    // Check permissions
    if (!['admin', 'financial_admin'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const [deletedAssignment] = await db
      .update(schema.memberDuesAssignments)
      .set({
        isActive: false,
        endDate: new Date().toISOString().split('T')[0],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .where(and(
        eq(schema.memberDuesAssignments.id, id),
        eq(schema.memberDuesAssignments.organizationId, organizationId)
      ))
      .returning();

    if (!deletedAssignment) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    res.json({ success: true, message: 'Assignment ended successfully' });
  } catch (error) {
    logger.error('Error deleting dues assignment', { error });
    res.status(500).json({ success: false, error: 'Failed to delete dues assignment' });
  }
});

export default router;
