/**
 * Strike Fund Operations Routes
 * Endpoints for strike fund management, picket attendance, and stipend calculations
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, userId } = (req as any).user;
    const { fundId } = req.params;
    const validatedData = checkInSchema.parse(req.body);

    // Check if already checked in
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingCheckIn: any = await db.execute(sql`
      SELECT * FROM picket_attendance 
      WHERE member_id = ${userId} 
        AND fund_id = ${fundId} 
        AND check_out_time IS NULL
      LIMIT 1
    `);

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const verification: any = await db.execute(sql`
          SELECT verify_picket_location(
            ST_GeogFromText(${checkInLocation}), 
            ${validatedData.picketLocationId}
          ) as verified
        `);
        
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await db.execute(sql`
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
    `);

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
      error: error.message,
    });
  }
});

/**
 * POST /api/strike-funds/:fundId/check-out
 * Check out from picket line
 */
router.post('/:fundId/check-out', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, userId } = (req as any).user;
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await db.execute(sql`
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
    `);

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
      error: error.message,
    });
  }
});

/**
 * POST /api/strike-funds/:fundId/stipends/calculate
 * Calculate weekly stipends
 */
router.post('/:fundId/stipends/calculate', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, userId, role } = (req as any).user;
    const { fundId } = req.params;

    if (!['admin', 'financial_admin'].includes(role)) {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any = await db.execute(sql`
      SELECT * FROM calculate_weekly_stipend(
        ${fundId}, NULL, ${validatedData.weekStart}, ${validatedData.weekEnd}
      )
    `);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const disbursement: any = await db.execute(sql`
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
      `);
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
      error: error.message,
    });
  }
});

/**
 * GET /api/strike-funds
 * List all strike funds
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId } = (req as any).user;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await db.execute(sql`
      SELECT * FROM strike_funds 
      WHERE tenant_id = ${organizationId}
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/strike-funds
 * Create new strike fund
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, userId, role } = (req as any).user;

    if (!['admin'].includes(role)) {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await db.execute(sql`
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
    `);

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
      error: error.message,
    });
  }
});

export default router;

