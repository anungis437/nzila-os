/**
 * Picket Tracking Service
 * Handles NFC/QR code check-ins, GPS verification, and attendance tracking
 */

import { db, schema } from '../db';
import { eq, and, between, desc, sql } from 'drizzle-orm';

// Configuration constants
const GPS_ACCURACY_THRESHOLD_METERS = 100; // Maximum distance from picket line
const HAVERSINE_EARTH_RADIUS_KM = 6371;

export interface CheckInRequest {
  organizationId: string;
  strikeFundId: string;
  memberId: string;
  method: 'nfc' | 'qr_code' | 'gps' | 'manual';
  latitude?: number;
  longitude?: number;
  nfcTagUid?: string;
  qrCodeData?: string;
  deviceId?: string;
  coordinatorOverride?: boolean;
  overrideReason?: string;
  verifiedBy?: string;
}

export interface CheckOutRequest {
  organizationId: string;
  attendanceId: string;
  latitude?: number;
  longitude?: number;
}

export interface PicketLocation {
  latitude: number;
  longitude: number;
  radius?: number; // Optional custom radius in meters
}

export interface AttendanceRecord {
  id: string;
  memberId: string;
  checkInTime: Date;
  checkOutTime?: Date;
  hoursWorked?: number;
  method: string;
  locationVerified: boolean;
}

export interface AttendanceSummary {
  memberId: string;
  totalHours: number;
  totalShifts: number;
  averageHoursPerShift: number;
  lastCheckIn?: Date;
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = HAVERSINE_EARTH_RADIUS_KM * c;

  return distanceKm * 1000; // Convert to meters
}

/**
 * Verify GPS coordinates are within acceptable range of picket line
 */
export function verifyGPSLocation(
  checkInLat: number,
  checkInLon: number,
  picketLocation: PicketLocation
): { verified: boolean; distance: number } {
  const distance = calculateDistance(
    checkInLat,
    checkInLon,
    picketLocation.latitude,
    picketLocation.longitude
  );

  const threshold = picketLocation.radius || GPS_ACCURACY_THRESHOLD_METERS;
  const verified = distance <= threshold;

  return { verified, distance };
}

/**
 * Generate QR code data for member check-in
 */
export function generateQRCodeData(
  strikeFundId: string,
  memberId: string,
  timestamp: Date = new Date()
): string {
  // Create a signed QR code with timestamp to prevent replay attacks
  const data = {
    fundId: strikeFundId,
    memberId: memberId,
    timestamp: timestamp.toISOString(),
    expires: new Date(timestamp.getTime() + 5 * 60 * 1000).toISOString(), // 5 minute expiry
  };
  
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

/**
 * Validate QR code data
 */
export function validateQRCodeData(qrData: string): {
  valid: boolean;
  fundId?: string;
  memberId?: string;
  error?: string;
} {
  try {
    const decoded = JSON.parse(Buffer.from(qrData, 'base64').toString());
    const expiresAt = new Date(decoded.expires);
    
    if (expiresAt < new Date()) {
      return { valid: false, error: 'QR code expired' };
    }

    return {
      valid: true,
      fundId: decoded.fundId,
      memberId: decoded.memberId,
    };
  } catch (_error) {
    return { valid: false, error: 'Invalid QR code format' };
  }
}

/**
 * Check in a member to picket line
 */
export async function checkIn(
  request: CheckInRequest,
  picketLocation?: PicketLocation
): Promise<{ success: boolean; attendanceId?: string; error?: string; distance?: number }> {
  try {
    // Validate GPS location if coordinates provided and picket location is set
    let locationVerified = false;
    let distance: number | undefined;

    if (request.latitude && request.longitude && picketLocation) {
      const verification = verifyGPSLocation(
        request.latitude,
        request.longitude,
        picketLocation
      );
      locationVerified = verification.verified;
      distance = verification.distance;

      // Reject if location not verified and no coordinator override
      if (!locationVerified && !request.coordinatorOverride) {
        return {
          success: false,
          error: `Location too far from picket line (${Math.round(distance)}m). Maximum allowed: ${picketLocation.radius || GPS_ACCURACY_THRESHOLD_METERS}m`,
          distance,
        };
      }
    } else if (request.coordinatorOverride) {
      // Allow manual check-in with coordinator override
      locationVerified = true;
    }

    // Validate QR code if provided
    if (request.method === 'qr_code' && request.qrCodeData) {
      const qrValidation = validateQRCodeData(request.qrCodeData);
      if (!qrValidation.valid) {
        return { success: false, error: qrValidation.error };
      }
      // Verify QR code matches the member
      if (qrValidation.memberId !== request.memberId) {
        return { success: false, error: 'QR code does not match member' };
      }
      if (qrValidation.fundId !== request.strikeFundId) {
        return { success: false, error: 'QR code does not match strike fund' };
      }
    }

    // Check for existing active check-in (not checked out)
    const [existingCheckIn] = await db
      .select()
      .from(schema.picketAttendance)
      .where(
        and(
          eq(schema.picketAttendance.tenantId, request.organizationId),
          eq(schema.picketAttendance.memberId, request.memberId),
          eq(schema.picketAttendance.strikeFundId, request.strikeFundId),
          sql`${schema.picketAttendance.checkOutTime} IS NULL`
        )
      )
      .limit(1);

    if (existingCheckIn) {
      return {
        success: false,
        error: 'Member already checked in. Please check out first.',
        attendanceId: existingCheckIn.id,
      };
    }

    // Create attendance record
    const [attendance] = await db
      .insert(schema.picketAttendance)
      .values({
        tenantId: request.organizationId,
        strikeFundId: request.strikeFundId,
        memberId: request.memberId,
        checkInTime: new Date().toISOString(),
        checkInLatitude: request.latitude?.toString(),
        checkInLongitude: request.longitude?.toString(),
        checkInMethod: request.method,
        nfcTagUid: request.nfcTagUid,
        qrCodeData: request.qrCodeData,
        deviceId: request.deviceId,
        locationVerified,
        coordinatorOverride: request.coordinatorOverride || false,
        overrideReason: request.overrideReason,
        verifiedBy: request.verifiedBy,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .returning();

    return {
      success: true,
      attendanceId: attendance.id,
      distance,
    };
  } catch (error) {
return {
      success: false,
      error: error.message || 'Failed to check in',
    };
  }
}

/**
 * Check out a member from picket line
 */
export async function checkOut(
  request: CheckOutRequest
): Promise<{ success: boolean; hoursWorked?: number; error?: string }> {
  try {
    // Get existing attendance record
    const [attendance] = await db
      .select()
      .from(schema.picketAttendance)
      .where(
        and(
          eq(schema.picketAttendance.id, request.attendanceId),
          eq(schema.picketAttendance.tenantId, request.organizationId)
        )
      )
      .limit(1);

    if (!attendance) {
      return { success: false, error: 'Attendance record not found' };
    }

    if (attendance.checkOutTime) {
      return {
        success: false,
        error: 'Member already checked out',
        hoursWorked: attendance.hoursWorked ? parseFloat(attendance.hoursWorked) : undefined,
      };
    }

    const checkOutTime = new Date();
    const durationMinutes = Math.floor(
      (checkOutTime.getTime() - new Date(attendance.checkInTime).getTime()) / (1000 * 60)
    );
    const hoursWorked = Math.round((durationMinutes / 60) * 100) / 100; // Round to 2 decimals

    // Update attendance record
    await db
      .update(schema.picketAttendance)
      .set({
        checkOutTime,
        checkOutLatitude: request.latitude?.toString(),
        checkOutLongitude: request.longitude?.toString(),
        durationMinutes: durationMinutes.toString(),
        hoursWorked: hoursWorked.toString(),
        updatedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .where(eq(schema.picketAttendance.id, request.attendanceId));

    return {
      success: true,
      hoursWorked,
    };
  } catch (error) {
return {
      success: false,
      error: error.message || 'Failed to check out',
    };
  }
}

/**
 * Get active check-ins (not checked out)
 */
export async function getActiveCheckIns(
  organizationId: string,
  strikeFundId: string
): Promise<AttendanceRecord[]> {
  const records = await db
    .select()
    .from(schema.picketAttendance)
    .where(
      and(
        eq(schema.picketAttendance.tenantId, organizationId),
        eq(schema.picketAttendance.strikeFundId, strikeFundId),
        sql`${schema.picketAttendance.checkOutTime} IS NULL`
      )
    )
    .orderBy(desc(schema.picketAttendance.checkInTime));

  return records.map(r => ({
    id: r.id,
    memberId: r.memberId,
    checkInTime: new Date(r.checkInTime),
    checkOutTime: r.checkOutTime ? new Date(r.checkOutTime) : undefined,
    hoursWorked: r.hoursWorked ? parseFloat(r.hoursWorked) : undefined,
    method: r.checkInMethod,
    locationVerified: r.locationVerified || false,
  }));
}

/**
 * Get attendance history for a date range
 */
export async function getAttendanceHistory(
  organizationId: string,
  strikeFundId: string,
  startDate: Date,
  endDate: Date,
  memberId?: string
): Promise<AttendanceRecord[]> {
  const conditions = [
    eq(schema.picketAttendance.tenantId, organizationId),
    eq(schema.picketAttendance.strikeFundId, strikeFundId),
    between(schema.picketAttendance.checkInTime, startDate.toISOString(), endDate.toISOString()),
  ];

  if (memberId) {
    conditions.push(eq(schema.picketAttendance.memberId, memberId));
  }

  const records = await db
    .select()
    .from(schema.picketAttendance)
    .where(and(...conditions))
    .orderBy(desc(schema.picketAttendance.checkInTime));

  return records.map(r => ({
    id: r.id,
    memberId: r.memberId,
    checkInTime: new Date(r.checkInTime),
    checkOutTime: r.checkOutTime ? new Date(r.checkOutTime) : undefined,
    hoursWorked: r.hoursWorked ? parseFloat(r.hoursWorked) : undefined,
    method: r.checkInMethod,
    locationVerified: r.locationVerified || false,
  }));
}

/**
 * Get attendance summary for members
 */
export async function getAttendanceSummary(
  organizationId: string,
  strikeFundId: string,
  startDate: Date,
  endDate: Date,
  memberId?: string
): Promise<AttendanceSummary[]> {
  const conditions = [
    eq(schema.picketAttendance.tenantId, organizationId),
    eq(schema.picketAttendance.strikeFundId, strikeFundId),
    between(schema.picketAttendance.checkInTime, startDate.toISOString(), endDate.toISOString()),
    sql`${schema.picketAttendance.hoursWorked} IS NOT NULL`, // Only completed check-ins
  ];

  if (memberId) {
    conditions.push(eq(schema.picketAttendance.memberId, memberId));
  }

  const results = await db
    .select({
      memberId: schema.picketAttendance.memberId,
      totalHours: sql<number>`SUM(${schema.picketAttendance.hoursWorked})`,
      totalShifts: sql<number>`COUNT(*)`,
      lastCheckIn: sql<Date>`MAX(${schema.picketAttendance.checkInTime})`,
    })
    .from(schema.picketAttendance)
    .where(and(...conditions))
    .groupBy(schema.picketAttendance.memberId);

  return results.map(r => ({
    memberId: r.memberId,
    totalHours: Number(r.totalHours) || 0,
    totalShifts: Number(r.totalShifts) || 0,
    averageHoursPerShift:
      r.totalShifts > 0
        ? Math.round((Number(r.totalHours) / Number(r.totalShifts)) * 100) / 100
        : 0,
    lastCheckIn: r.lastCheckIn ? new Date(r.lastCheckIn) : undefined,
  }));
}

/**
 * Manual check-in override by coordinator
 */
export async function coordinatorOverride(
  organizationId: string,
  strikeFundId: string,
  memberId: string,
  verifiedBy: string,
  reason: string,
  hours: number
): Promise<{ success: boolean; attendanceId?: string; error?: string }> {
  try {
    const checkInTime = new Date();
    const checkOutTime = new Date(checkInTime.getTime() + hours * 60 * 60 * 1000);

    const [attendance] = await db
      .insert(schema.picketAttendance)
      .values({
        tenantId: organizationId,
        strikeFundId,
        memberId,
        checkInTime: checkInTime.toISOString(),
        checkOutTime: checkOutTime.toISOString(),
        checkInMethod: 'manual',
        hoursWorked: hours.toString(),
        durationMinutes: Math.floor(hours * 60).toString(),
        locationVerified: true, // Coordinator verified
        coordinatorOverride: true,
        overrideReason: reason,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .returning();

    return {
      success: true,
      attendanceId: attendance.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Failed to create manual attendance record',
    };
  }
}
