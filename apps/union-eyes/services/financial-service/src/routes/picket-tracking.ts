/**
 * Picket Tracking Routes
 * Endpoints for NFC/QR code check-ins, GPS verification, and attendance management
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import * as PicketService from '../services/picket-tracking';

const router = Router();

// Validation schemas
const checkInSchema = z.object({
  strikeFundId: z.string().uuid(),
  memberId: z.string().uuid(),
  method: z.enum(['nfc', 'qr_code', 'gps', 'manual']),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  nfcTagUid: z.string().optional(),
  qrCodeData: z.string().optional(),
  deviceId: z.string().optional(),
  coordinatorOverride: z.boolean().optional(),
  overrideReason: z.string().optional(),
  verifiedBy: z.string().optional(),
  picketLocation: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radius: z.number().positive().optional(),
  }).optional(),
});

const checkOutSchema = z.object({
  attendanceId: z.string().uuid(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

const coordinatorOverrideSchema = z.object({
  strikeFundId: z.string().uuid(),
  memberId: z.string().uuid(),
  hours: z.number().positive().max(24),
  reason: z.string().min(10),
  verifiedBy: z.string().min(1),
});

/**
 * POST /api/picket/check-in
 * Check in a member to picket line
 */
router.post('/check-in', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, _role } = (req as any).user;

    const validatedData = checkInSchema.parse(req.body);

    const result = await PicketService.checkIn(
      {
        organizationId,
        strikeFundId: validatedData.strikeFundId,
        memberId: validatedData.memberId,
        method: validatedData.method,
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
        nfcTagUid: validatedData.nfcTagUid,
        qrCodeData: validatedData.qrCodeData,
        deviceId: validatedData.deviceId,
        coordinatorOverride: validatedData.coordinatorOverride,
        overrideReason: validatedData.overrideReason,
        verifiedBy: validatedData.verifiedBy,
      },
      validatedData.picketLocation as PicketService.PicketLocation | undefined
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        distance: result.distance,
      });
    }

    res.json({
      success: true,
      data: {
        attendanceId: result.attendanceId,
        distance: result.distance,
        message: 'Checked in successfully',
      },
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check in',
    });
  }
});

/**
 * POST /api/picket/check-out
 * Check out a member from picket line
 */
router.post('/check-out', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId } = (req as any).user;

    const validatedData = checkOutSchema.parse(req.body);

    const result = await PicketService.checkOut({
      organizationId,
      attendanceId: validatedData.attendanceId,
      latitude: validatedData.latitude,
      longitude: validatedData.longitude,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      data: {
        hoursWorked: result.hoursWorked,
        message: 'Checked out successfully',
      },
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check out',
    });
  }
});

/**
 * GET /api/picket/active
 * Get all active check-ins (not checked out)
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId } = (req as any).user;
    const { strikeFundId } = req.query;

    if (!strikeFundId || typeof strikeFundId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'strikeFundId is required',
      });
    }

    const records = await PicketService.getActiveCheckIns(organizationId, strikeFundId);

    res.json({
      success: true,
      data: records,
      count: records.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch active check-ins',
    });
  }
});

/**
 * GET /api/picket/history
 * Get attendance history for a date range
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId } = (req as any).user;
    const { strikeFundId, startDate, endDate, memberId } = req.query;

    if (!strikeFundId || typeof strikeFundId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'strikeFundId is required',
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required',
      });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format',
      });
    }

    const records = await PicketService.getAttendanceHistory(
      organizationId,
      strikeFundId,
      start,
      end,
      memberId as string | undefined
    );

    res.json({
      success: true,
      data: records,
      count: records.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch attendance history',
    });
  }
});

/**
 * GET /api/picket/summary
 * Get attendance summary for members
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId } = (req as any).user;
    const { strikeFundId, startDate, endDate, memberId } = req.query;

    if (!strikeFundId || typeof strikeFundId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'strikeFundId is required',
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required',
      });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date format',
      });
    }

    const summary = await PicketService.getAttendanceSummary(
      organizationId,
      strikeFundId,
      start,
      end,
      memberId as string | undefined
    );

    res.json({
      success: true,
      data: summary,
      count: summary.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch attendance summary',
    });
  }
});

/**
 * POST /api/picket/generate-qr
 * Generate QR code data for member check-in
 */
router.post('/generate-qr', async (req: Request, res: Response) => {
  try {
    const { strikeFundId, memberId } = req.body;

    if (!strikeFundId || !memberId) {
      return res.status(400).json({
        success: false,
        error: 'strikeFundId and memberId are required',
      });
    }

    const qrData = PicketService.generateQRCodeData(strikeFundId, memberId);

    res.json({
      success: true,
      data: {
        qrData,
        expiresIn: '5 minutes',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate QR code',
    });
  }
});

/**
 * POST /api/picket/validate-qr
 * Validate QR code data
 */
router.post('/validate-qr', async (req: Request, res: Response) => {
  try {
    const { qrData } = req.body;

    if (!qrData) {
      return res.status(400).json({
        success: false,
        error: 'qrData is required',
      });
    }

    const validation = PicketService.validateQRCodeData(qrData);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    res.json({
      success: true,
      data: {
        fundId: validation.fundId,
        memberId: validation.memberId,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to validate QR code',
    });
  }
});

/**
 * POST /api/picket/coordinator-override
 * Manual check-in/out by coordinator with specified hours
 */
router.post('/coordinator-override', async (req: Request, res: Response) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { organizationId, role } = (req as any).user;

    // Only coordinators and admins can use this endpoint
    if (!['admin', 'coordinator', 'financial_admin'].includes(role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions. Coordinator role required.',
      });
    }

    const validatedData = coordinatorOverrideSchema.parse(req.body);

    const result = await PicketService.coordinatorOverride(
      organizationId,
      validatedData.strikeFundId,
      validatedData.memberId,
      validatedData.verifiedBy,
      validatedData.reason,
      validatedData.hours
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      data: {
        attendanceId: result.attendanceId,
        message: 'Manual attendance record created successfully',
      },
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create manual attendance',
    });
  }
});

/**
 * POST /api/picket/calculate-distance
 * Calculate distance between two GPS coordinates
 */
router.post('/calculate-distance', async (req: Request, res: Response) => {
  try {
    const { lat1, lon1, lat2, lon2 } = req.body;

    if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
      return res.status(400).json({
        success: false,
        error: 'lat1, lon1, lat2, and lon2 are required',
      });
    }

    const distance = PicketService.calculateDistance(
      Number(lat1),
      Number(lon1),
      Number(lat2),
      Number(lon2)
    );

    res.json({
      success: true,
      data: {
        distanceMeters: Math.round(distance),
        distanceFeet: Math.round(distance * 3.28084),
        distanceMiles: (distance / 1609.34).toFixed(2),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate distance',
    });
  }
});

export default router;
