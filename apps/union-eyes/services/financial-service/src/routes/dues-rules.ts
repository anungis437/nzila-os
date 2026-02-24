/**
 * Dues Rules Routes
 * Endpoints for managing dues calculation rules
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db, schema } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../../../lib/logger';
import { logger } from '@/lib/logger';

const router = Router();

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

const createDuesRuleSchema = z.object({
  ruleName: z.string().min(1).max(255),
  ruleCode: z.string().min(1).max(50),
  description: z.string().optional(),
  calculationType: z.enum(['percentage', 'flat_rate', 'hourly', 'tiered', 'formula']),
  
  // Calculation parameters
  percentageRate: z.coerce.number().positive().optional(),
  baseField: z.string().optional(),
  flatAmount: z.coerce.number().positive().optional(),
  hourlyRate: z.coerce.number().positive().optional(),
  tierStructure: z.any().optional(), // JSONB field
  customFormula: z.string().max(500).optional(),
  
  billingFrequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annually']),
  dueDayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  hoursPerPeriod: z.coerce.number().positive().optional(),
  
  // Applicability
  applicableCategories: z.any().optional(), // JSONB field
  applicableStatuses: z.any().optional(), // JSONB field
  applicableLocals: z.any().optional(), // JSONB field
  applicableDepartments: z.any().optional(), // JSONB field
  
  // Effective dates
  effectiveDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  
  // Metadata
  isActive: z.boolean().default(true),
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/dues/rules
 * List all dues rules for the tenant
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId } = (req as any).user;
    const { active, _category, _status } = req.query;

    // Build query conditions
    const conditions = [eq(schema.duesRules.organizationId, organizationId)];
    
    if (active !== undefined) {
      conditions.push(eq(schema.duesRules.isActive, active === 'true'));
    }

    const rules = await db
      .select()
      .from(schema.duesRules)
      .where(and(...conditions))
      .orderBy(desc(schema.duesRules.createdAt));

    res.json({
      success: true,
      data: rules,
      total: rules.length,
    });
  } catch (error) {
    logger.error('Error fetching dues rules', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch dues rules' });
  }
});

/**
 * GET /api/dues/rules/:id
 * Get a specific dues rule by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId } = (req as any).user;
    const { id } = req.params;

    const [rule] = await db
      .select()
      .from(schema.duesRules)
      .where(and(
        eq(schema.duesRules.id, id),
        eq(schema.duesRules.organizationId, organizationId)
      ))
      .limit(1);

    if (!rule) {
      return res.status(404).json({ success: false, error: 'Dues rule not found' });
    }

    res.json({ success: true, data: rule });
  } catch (error) {
    logger.error('Error fetching dues rule', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch dues rule' });
  }
});

/**
 * POST /api/dues/rules
 * Create a new dues rule
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, userId, role } = (req as any).user;

    // Check permissions
    if (!['admin', 'financial_admin'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    // Validate input
    const validatedData = createDuesRuleSchema.parse(req.body);

    const [newRule] = await db
      .insert(schema.duesRules)
      .values({
        ...validatedData,
        organizationId: organizationId,
        createdBy: userId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .returning();

    res.status(201).json({ success: true, data: newRule });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    logger.error('Error creating dues rule', { error });
    res.status(500).json({ success: false, error: 'Failed to create dues rule' });
  }
});

/**
 * PUT /api/dues/rules/:id
 * Update an existing dues rule
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, _userId, role } = (req as any).user;
    const { id } = req.params;

    // Check permissions
    if (!['admin', 'financial_admin'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    // Validate input
    const validatedData = createDuesRuleSchema.partial().parse(req.body);

    // Convert numeric fields to strings for database
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { ...validatedData };
    ['percentageRate', 'flatAmount', 'hourlyRate', 'minimumAmount', 'maximumAmount'].forEach(field => {
      if (updateData[field] !== undefined && typeof updateData[field] === 'number') {
        updateData[field] = updateData[field].toString();
      }
    });

    const [updatedRule] = await db
      .update(schema.duesRules)
      .set(updateData)
      .where(and(
        eq(schema.duesRules.id, id),
        eq(schema.duesRules.organizationId, organizationId)
      ))
      .returning();

    if (!updatedRule) {
      return res.status(404).json({ success: false, error: 'Dues rule not found' });
    }

    res.json({ success: true, data: updatedRule });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation error', details: error.errors });
    }
    logger.error('Error updating dues rule', { error });
    res.status(500).json({ success: false, error: 'Failed to update dues rule' });
  }
});

/**
 * DELETE /api/dues/rules/:id
 * Soft delete a dues rule (set isActive = false)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, role } = (req as any).user;
    const { id } = req.params;

    // Check permissions (admin only)
    if (role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const [deletedRule] = await db
      .update(schema.duesRules)
      .set({
        isActive: false,
        updatedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .where(and(
        eq(schema.duesRules.id, id),
        eq(schema.duesRules.organizationId, organizationId)
      ))
      .returning();

    if (!deletedRule) {
      return res.status(404).json({ success: false, error: 'Dues rule not found' });
    }

    res.json({ success: true, message: 'Dues rule deleted successfully' });
  } catch (error) {
    logger.error('Error deleting dues rule', { error });
    res.status(500).json({ success: false, error: 'Failed to delete dues rule' });
  }
});

/**
 * POST /api/dues/rules/:id/duplicate
 * Duplicate an existing dues rule with a new code and name
 */
router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, userId, role } = (req as any).user;
    const { id } = req.params;
    const { newCode, newName } = req.body;

    // Check permissions
    if (!['admin', 'financial_admin'].includes(role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    if (!newCode || !newName) {
      return res.status(400).json({ 
        success: false, 
        error: 'newCode and newName are required' 
      });
    }

    // Fetch original rule
    const [originalRule] = await db
      .select()
      .from(schema.duesRules)
      .where(and(
        eq(schema.duesRules.id, id),
        eq(schema.duesRules.organizationId, organizationId)
      ))
      .limit(1);

    if (!originalRule) {
      return res.status(404).json({ success: false, error: 'Original dues rule not found' });
    }

    // Create duplicate with new code and name
    const { id: _, _createdAt, _updatedAt, _createdBy, ...ruleData } = originalRule;
    
    const [duplicatedRule] = await db
      .insert(schema.duesRules)
      .values({
        ...ruleData,
        ruleCode: newCode,
        ruleName: newName,
        organizationId: organizationId,
        createdBy: userId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .returning();

    res.status(201).json({ success: true, data: duplicatedRule });
  } catch (error) {
    logger.error('Error duplicating dues rule', { error });
    res.status(500).json({ success: false, error: 'Failed to duplicate dues rule' });
  }
});

export default router;
