import { z } from 'zod';
import { NextRequest, NextResponse } from "next/server";
import { GeofencePrivacyService } from "@/services/geofence-privacy-service";
import { withApiAuth, getCurrentUser } from '@/lib/api-auth-guard';
import { getOrganizationIdForUser } from '@/lib/organization-utils';

import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
/**
 * Geofence Management API
 * POST: Create geofence
 * GET: Check if location is within geofence
 *
 * round 52: geofences has no organizationId column, but unionLocalId is the
 * real tenant boundary (a "union local" is this domain's organization) — it
 * is always resolved server-side from the authenticated caller, never
 * trusted from the request body/query (previously any authenticated user
 * could create/probe geofences under an arbitrary unionLocalId). Similarly,
 * the entry-check userId is always the caller's own id, never a client-
 * supplied query param (matches the round-49 fix already applied to
 * app/api/location/track).
 */


const _locationGeofenceSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  geofenceType: z.unknown().optional(),
  centerLatitude: z.string().min(1, 'centerLatitude is required'),
  centerLongitude: z.string().min(1, 'centerLongitude is required'),
  radiusMeters: z.unknown().optional(),
  strikeId: z.string().uuid('Invalid strikeId'),
});


export const POST = withApiAuth(async (req: NextRequest) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Authentication required');
    }

    const body = await req.json();
    const { name, description, geofenceType, centerLatitude, centerLongitude, radiusMeters, strikeId } = body;

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

    const trustedUnionLocalId = await getOrganizationIdForUser(user.id);

    const geofence = await GeofencePrivacyService.createGeofence(
      {
        name,
        description,
        geofenceType,
        centerLatitude,
        centerLongitude,
        radiusMeters,
        strikeId,
      },
      trustedUnionLocalId,
    );

    return standardSuccessResponse(
      { geofence,
        message: "Geofence created successfully" }
    );
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to create geofence" },
      { status: 500 }
    );
  }
});

export const GET = withApiAuth(async (req: NextRequest) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Authentication required');
    }

    const { searchParams } = new URL(req.url);
    const geofenceId = searchParams.get("geofenceId");
    const latitude = searchParams.get("latitude");
    const longitude = searchParams.get("longitude");

    if (!geofenceId || !latitude || !longitude) {
      return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Missing required parameters: geofenceId, latitude, longitude'
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

    const trustedUnionLocalId = await getOrganizationIdForUser(user.id);
    const result = await GeofencePrivacyService.checkGeofenceEntry(user.id, lat, lon, geofenceId, trustedUnionLocalId);

    return NextResponse.json({
      userId: user.id,
      geofenceId,
      inside: result.inside,
      distance: result.distance,
      message: result.inside ? "User is inside geofence" : "User is outside geofence",
    });
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to check geofence" },
      { status: 500 }
    );
  }
});

