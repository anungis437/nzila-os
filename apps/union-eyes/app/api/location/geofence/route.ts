import { z } from 'zod';
import { NextRequest, NextResponse } from "next/server";
import { GeofencePrivacyService } from "@/services/geofence-privacy-service";
import { withApiAuth } from '@/lib/api-auth-guard';

import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
/**
 * Geofence Management API
 * POST: Create geofence
 * GET: Check if location is within geofence
 */


const _locationGeofenceSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  geofenceType: z.unknown().optional(),
  centerLatitude: z.string().min(1, 'centerLatitude is required'),
  centerLongitude: z.string().min(1, 'centerLongitude is required'),
  radiusMeters: z.unknown().optional(),
  strikeId: z.string().uuid('Invalid strikeId'),
  unionLocalId: z.string().uuid('Invalid unionLocalId'),
});


export const POST = withApiAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { name, description, geofenceType, centerLatitude, centerLongitude, radiusMeters, strikeId, unionLocalId } = body;

    if (!name || !geofenceType || centerLatitude === undefined || centerLongitude === undefined || !radiusMeters) {
      return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Missing required fields: name, geofenceType, centerLatitude, centerLongitude, radiusMeters'
    );
    }

    // Validate coordinates
    if (centerLatitude < -90 || centerLatitude > 90) {
      return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid centerLatitude (must be -90 to 90)'
    );
    }

    if (centerLongitude < -180 || centerLongitude > 180) {
      return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid centerLongitude (must be -180 to 180)'
    );
    }

    if (radiusMeters <= 0) {
      return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid radiusMeters (must be > 0)'
    );
    }

    const geofence = await GeofencePrivacyService.createGeofence({
      name,
      description,
      geofenceType,
      centerLatitude,
      centerLongitude,
      radiusMeters,
      strikeId,
      unionLocalId,
    });

    return standardSuccessResponse(
      { geofence,
        message: "Geofence created successfully" }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create geofence" },
      { status: 500 }
    );
  }
});

export const GET = withApiAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const geofenceId = searchParams.get("geofenceId");
    const latitude = searchParams.get("latitude");
    const longitude = searchParams.get("longitude");

    if (!userId || !geofenceId || !latitude || !longitude) {
      return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Missing required parameters: userId, geofenceId, latitude, longitude'
    );
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid latitude or longitude'
    );
    }

    const result = await GeofencePrivacyService.checkGeofenceEntry(userId, lat, lon, geofenceId);

    return NextResponse.json({
      userId,
      geofenceId,
      inside: result.inside,
      distance: result.distance,
      message: result.inside ? "User is inside geofence" : "User is outside geofence",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check geofence" },
      { status: 500 }
    );
  }
});

