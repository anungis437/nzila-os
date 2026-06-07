/**
 * Strike Fund Operations Routes
 * Endpoints for strike fund management, picket attendance, and stipend calculations
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

type AuthUser = {
  organizationId: string;
  userId: string;
  role?: string;
};

type ExecuteResult<T extends Record<string, unknown> = Record<string, unknown>> = {
  rows: T[];
  length: number;
  [index: number]: T;
};

function getAuthUser(req: Request): AuthUser {
  return (req as any as { user: AuthUser }).user;
}

/** Validates a route :param is a UUID before it reaches any query. */
const uuidParam = z.string().uuid();

// Validation schemas
const checkInSchema = z.object({
  picketLocationId: z.string().uuid(),
  checkInMethod: z.enum(['nfc', 'qr_code', 'gps', 'manual']),
  deviceId: z.string().optional(),
  nfcTagUid: z.string().optional(),
  qrCodeData: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  coordinatorOverride: z.boolean().default(false),
  notes: z.string().optional(),
});

/**
 * POST /api/strike-funds/:fundId/check-in
 * Check in to picket line (NFC/QR/GPS/Manual)
 */
router.post('/:fundId/check-in', async (req: Request, res: Response) => {
  try {
    const { organizationId, userId } = getAuthUser(req);
    const fundId = uuidParam.parse(req.params.fundId);
    const validatedData = checkInSchema.parse(req.body);

    // Check if already checked in
    const existingCheckIn = await db.execute(sql`
      SELECT * FROM picket_attendance 
      WHERE member_id = ${userId} 
        AND fund_id = ${fundId} 
        AND check_out_time IS NULL
      LIMIT 1
    `) as any as ExecuteResult;

    if (existingCheckIn.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Already checked in. Please check out first.',
      });
    }

    // Prepare location (WKT format for PostGIS)
    let locationVerified = false;
    let checkInLocation = null;

    if (validatedData.latitude && validatedData.longitude) {
      checkInLocation = `POINT(${validatedData.longitude} ${validatedData.latitude})`;
      
      if (validatedData.checkInMethod === 'gps') {
        const verification = await db.execute(sql`
          SELECT verify_picket_location(
            ST_GeogFromText(${checkInLocation}), 
            ${validatedData.picketLocationId}
          ) as verified
        `) as any as ExecuteResult<{ verified?: boolean }>;
        
        locationVerified = verification.rows[0]?.verified || false;

        if (!locationVerified && !validatedData.coordinatorOverride) {
          return res.status(400).json({
            success: false,
            error: 'Location verification failed. Not within 100m of picket line.',
          });
        }
      }
    }

    // Insert attendance record
    const result = await db.execute(sql`
      INSERT INTO picket_attendance (
        tenant_id, fund_id, member_id, picket_location_id,
        check_in_time, check_in_method, check_in_location,
        device_id, nfc_tag_uid, qr_code_data,
        location_verified, coordinator_override, notes, created_by
      ) VALUES (
        ${organizationId}, ${fundId}, ${userId}, ${validatedData.picketLocationId},
        NOW(), ${validatedData.checkInMethod}, 
        ${checkInLocation ? sql`ST_GeogFromText(${checkInLocation})` : null},
        ${validatedData.deviceId}, ${validatedData.nfcTagUid}, ${validatedData.qrCodeData},
        ${locationVerified || validatedData.coordinatorOverride}, 
        ${validatedData.coordinatorOverride}, ${validatedData.notes}, ${userId}
      )
      RETURNING *
    `) as any as ExecuteResult;

    res.status(201).json({
      success: true,
      data: {
        attendance: result[0],
        locationVerified,
        message: 'Successfully checked in to picket line',
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
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/strike-funds/:fundId/check-out
 * Check out from picket line
 */
router.post('/:fundId/check-out', async (req: Request, res: Response) => {
  try {
    const { organizationId, userId } = getAuthUser(req);
    const { _fundId } = req.params;

    const checkOutSchema = z.object({
      attendanceId: z.string().uuid(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    });

    const validatedData = checkOutSchema.parse(req.body);

    let checkOutLocation = null;
    if (validatedData.latitude && validatedData.longitude) {
      checkOutLocation = `POINT(${validatedData.longitude} ${validatedData.latitude})`;
    }

    const result = await db.execute(sql`
      UPDATE picket_attendance
      SET 
        check_out_time = NOW(),
        check_out_location = ${checkOutLocation ? sql`ST_GeogFromText(${checkOutLocation})` : null},
        duration_minutes = EXTRACT(EPOCH FROM (NOW() - check_in_time)) / 60,
        hours_worked = ROUND(CAST(EXTRACT(EPOCH FROM (NOW() - check_in_time)) / 3600 AS NUMERIC), 2),
        updated_at = NOW()
      WHERE id = ${validatedData.attendanceId}
        AND member_id = ${userId}
        AND tenant_id = ${organizationId}
        AND check_out_time IS NULL
      RETURNING *
    `) as any as ExecuteResult;

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active check-in found',
      });
    }

    res.json({
      success: true,
      data: result[0],
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
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/strike-funds/:fundId/stipends/calculate
 * Calculate weekly stipends
 */
router.post('/:fundId/stipends/calculate', async (req: Request, res: Response) => {
  try {
    const { organizationId, userId, role } = getAuthUser(req);
    const fundId = uuidParam.parse(req.params.fundId);
    const effectiveRole = role ?? '';

    if (!['admin', 'financial_admin'].includes(effectiveRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
    }

    const calculateSchema = z.object({
      weekStart: z.coerce.date(),
      weekEnd: z.coerce.date(),
      dryRun: z.boolean().default(false),
    });

    const validatedData = calculateSchema.parse(req.body);

    // Use database function
    const results = await db.execute(sql`
      SELECT * FROM calculate_weekly_stipend(
        ${fundId}, NULL, ${validatedData.weekStart}, ${validatedData.weekEnd}
      )
    `) as any as ExecuteResult<{ member_id: string; hours_worked: number; stipend_amount: number }>;

    if (validatedData.dryRun) {
      return res.json({
        success: true,
        data: {
          dryRun: true,
          results: results.rows,
        },
      });
    }

    // Create disbursement records
    const disbursements = [];
    for (const row of results.rows) {
      const disbursement = await db.execute(sql`
        INSERT INTO stipend_disbursements (
          tenant_id, fund_id, member_id, week_start, week_end,
          hours_worked, total_amount, status, created_by
        ) VALUES (
          ${organizationId}, ${fundId}, ${row.member_id}, 
          ${validatedData.weekStart}, ${validatedData.weekEnd},
          ${row.hours_worked}, ${row.stipend_amount}, 
          'pending', ${userId}
        )
        RETURNING *
      `) as any as ExecuteResult;
      disbursements.push(disbursement.rows[0]);
    }

    res.json({
      success: true,
      data: {
        totalDisbursements: disbursements.length,
        disbursements,
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
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/strike-funds
 * List all strike funds
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { organizationId } = getAuthUser(req);
    
    const result = await db.execute(sql`
      SELECT * FROM strike_funds 
      WHERE tenant_id = ${organizationId}
      ORDER BY created_at DESC
    `) as any as ExecuteResult;

    res.json({
      success: true,
      data: result,
    });
  } catch (_error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/strike-funds
 * Create new strike fund
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { organizationId, userId, role } = getAuthUser(req);
    const effectiveRole = role ?? '';

    if (!['admin'].includes(effectiveRole)) {
      return res.status(403).json({
        success: false,
        error: 'Only admins can create strike funds',
      });
    }

    const createSchema = z.object({
      name: z.string().min(1).max(100),
      description: z.string().optional(),
      targetAmount: z.coerce.number().positive(),
      weeklyStipendAmount: z.coerce.number().positive(),
      startDate: z.coerce.date(),
    });

    const validatedData = createSchema.parse(req.body);

    const result = await db.execute(sql`
      INSERT INTO strike_funds (
        tenant_id, name, description, target_amount,
        current_balance, weekly_stipend_amount, start_date,
        status, created_by
      ) VALUES (
        ${organizationId}, ${validatedData.name}, ${validatedData.description},
        ${validatedData.targetAmount.toString()}, '0',
        ${validatedData.weeklyStipendAmount.toString()}, ${validatedData.startDate},
        'active', ${userId}
      )
      RETURNING *
    `) as any as ExecuteResult;

    res.status(201).json({
      success: true,
      data: result[0],
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
      error: 'Internal server error',
    });
  }
});

export default router;

