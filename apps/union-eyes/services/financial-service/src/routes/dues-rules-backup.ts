/**
 * Dues Rules Routes
 * Endpoints for managing dues calculation rules
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db/index';
import { duesRules } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';

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
  percentageRate: z.number().positive().optional(),
  baseField: z.string().optional(),
  flatAmount: z.number().positive().optional(),
  hourlyRate: z.number().positive().optional(),
  hoursPerPeriod: z.number().int().positive().optional(),
  tierStructure: z.array(z.object({
    min: z.number(),
    max: z.number().nullable(),
    rate: z.number().positive(),
  })).optional(),
  customFormula: z.string().max(500).optional(),
  
  billingFrequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly', 'annually']),
  
  // Additional fees
  copeContribution: z.number().default(0),
  pacContribution: z.number().default(0),
  initiationFee: z.number().default(0),
  strikeFundContribution: z.number().default(0),
  
  // Late fees
  gracePeriodDays: z.number().int().default(30),
  lateFeeType: z.enum(['percentage', 'flat_amount', 'none']).default('none'),
  lateFeeAmount: z.number().optional(),
  lateFeePercentage: z.number().optional(),
  
  // Applicability
  memberCategory: z.string().optional(),
  employmentStatus: z.string().optional(),
  localNumber: z.string().optional(),
  department: z.string().optional(),
  
  effectiveFrom: z.string().transform(str => new Date(str)),
  effectiveTo: z.string().transform(str => new Date(str)).optional(),
});

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/dues/rules
 * List all dues rules for tenant
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId } = (req as any).user;
    const { active } = req.query;
    
    // Build where conditions
    const conditions = [eq(duesRules.organizationId, organizationId)];
    
    if (active === 'true') {
      conditions.push(eq(duesRules.isActive, true));
    }
    
    const rules = await db
      .select()
      .from(duesRules)
      .where(and(...conditions))
      .orderBy(desc(duesRules.createdAt));
    
    res.json({
      success: true,
      data: rules,
      total: rules.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/dues/rules/:id
 * Get specific dues rule
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId } = (req as any).user;
    const { id } = req.params;
    
    const rules = await db
      .select()
      .from(duesRules)
      .where(and(eq(duesRules.id, id), eq(duesRules.organizationId, organizationId)))
      .limit(1);
    
    const rule = rules[0];
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        error: 'Dues rule not found',
      });
    }
    
    res.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/dues/rules
 * Create new dues rule
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, role } = (req as any).user;
    
    // Check permissions
    if (!['admin', 'financial_admin'].includes(role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions to create dues rules',
      });
    }
    
    // Validate input
    const validatedData = createDuesRuleSchema.parse(req.body);
    
    // Map validation schema to database schema
    const dbData = {
      organizationId: organizationId,
      ruleName: validatedData.ruleName,
      ruleCode: validatedData.ruleCode,
      description: validatedData.description,
      calculationType: validatedData.calculationType,
      percentageRate: validatedData.percentageRate?.toString(),
      baseField: validatedData.baseField,
      flatAmount: validatedData.flatAmount?.toString(),
      hourlyRate: validatedData.hourlyRate?.toString(),
      hoursPerPeriod: validatedData.hoursPerPeriod,
      tierStructure: validatedData.tierStructure,
      customFormula: validatedData.customFormula,
      billingFrequency: validatedData.billingFrequency,
      effectiveDate: validatedData.effectiveFrom.toISOString().split('T')[0],
      endDate: validatedData.effectiveTo?.toISOString().split('T')[0],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createdBy: (req as any).user.id,
    };
    
    const newRule = await db.insert(duesRules).values(dbData).returning();
    
    res.status(201).json({
      success: true,
      data: newRule[0],
      message: 'Dues rule created successfully',
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
 * PUT /api/dues/rules/:id
 * Update existing dues rule
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, role } = (req as any).user;
    const { id } = req.params;
    
    // Check permissions
    if (!['admin', 'financial_admin'].includes(role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions to update dues rules',
      });
    }
    
    // Validate input
    const validatedData = createDuesRuleSchema.partial().parse(req.body);
    
    // Map validation schema to database schema for update
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbData: any = {};
    if (validatedData.ruleName) dbData.ruleName = validatedData.ruleName;
    if (validatedData.ruleCode) dbData.ruleCode = validatedData.ruleCode;
    if (validatedData.description !== undefined) dbData.description = validatedData.description;
    if (validatedData.calculationType) dbData.calculationType = validatedData.calculationType;
    if (validatedData.percentageRate !== undefined) dbData.percentageRate = validatedData.percentageRate?.toString();
    if (validatedData.baseField !== undefined) dbData.baseField = validatedData.baseField;
    if (validatedData.flatAmount !== undefined) dbData.flatAmount = validatedData.flatAmount?.toString();
    if (validatedData.hourlyRate !== undefined) dbData.hourlyRate = validatedData.hourlyRate?.toString();
    if (validatedData.hoursPerPeriod !== undefined) dbData.hoursPerPeriod = validatedData.hoursPerPeriod;
    if (validatedData.tierStructure !== undefined) dbData.tierStructure = validatedData.tierStructure;
    if (validatedData.customFormula !== undefined) dbData.customFormula = validatedData.customFormula;
    if (validatedData.billingFrequency) dbData.billingFrequency = validatedData.billingFrequency;
    if (validatedData.effectiveFrom) dbData.effectiveDate = validatedData.effectiveFrom.toISOString().split('T')[0];
    if (validatedData.effectiveTo) dbData.endDate = validatedData.effectiveTo.toISOString().split('T')[0];
    
    dbData.updatedAt = new Date().toISOString();
    
    const updatedRule = await db
      .update(duesRules)
      .set(dbData)
      .where(and(eq(duesRules.id, id), eq(duesRules.organizationId, organizationId)))
      .returning();
    
    if (updatedRule.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dues rule not found',
      });
    }
    
    res.json({
      success: true,
      data: updatedRule[0],
      message: 'Dues rule updated successfully',
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
 * DELETE /api/dues/rules/:id
 * Soft delete dues rule (set isActive = false)
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, role } = (req as any).user;
    const { id } = req.params;
    
    // Check permissions - only admin can delete
    if (role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can delete dues rules',
      });
    }
    
    const result = await db
      .update(duesRules)
      .set({ 
        isActive: false,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(duesRules.id, id), eq(duesRules.organizationId, organizationId)))
      .returning();
    
    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dues rule not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Dues rule deactivated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/dues/rules/:id/duplicate
 * Duplicate an existing dues rule
 */
router.post('/:id/duplicate', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, role } = (req as any).user;
    const { id } = req.params;
    const { newRuleCode, newRuleName } = req.body;
    
    // Check permissions
    if (!['admin', 'financial_admin'].includes(role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
    }
    
    // Fetch existing rule
    const existingRules = await db
      .select()
      .from(duesRules)
      .where(and(eq(duesRules.id, id), eq(duesRules.organizationId, organizationId)))
      .limit(1);
    
    const existingRule = existingRules[0];
    
    if (!existingRule) {
      return res.status(404).json({
        success: false,
        error: 'Dues rule not found',
      });
    }
    
    // Create new rule with modified code/name
    const duplicatedRule = await db.insert(duesRules).values({
      organizationId,
      ruleName: newRuleName || `${existingRule.ruleName} (Copy)`,
      ruleCode: newRuleCode || `${existingRule.ruleCode}_COPY`,
      description: existingRule.description,
      calculationType: existingRule.calculationType,
      percentageRate: existingRule.percentageRate,
      baseField: existingRule.baseField,
      flatAmount: existingRule.flatAmount,
      hourlyRate: existingRule.hourlyRate,
      hoursPerPeriod: existingRule.hoursPerPeriod,
      tierStructure: existingRule.tierStructure,
      customFormula: existingRule.customFormula,
      billingFrequency: existingRule.billingFrequency,
      effectiveDate: existingRule.effectiveDate,
      endDate: existingRule.endDate,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createdBy: (req as any).user.id,
    }).returning();
    
    res.status(201).json({
      success: true,
      data: duplicatedRule[0],
      message: 'Dues rule duplicated successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
