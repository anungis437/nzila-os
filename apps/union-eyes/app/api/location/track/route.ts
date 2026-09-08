import { z } from 'zod';
import { NextRequest, NextResponse } from "next/server";
import { GeofencePrivacyService } from "@/services/geofence-privacy-service";
import { withApiAuth, getCurrentUser } from "@/lib/api-auth-guard";

import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
/**
 * Location Tracking API
 * POST: Record user location (requires explicit consent)
 *
 * Location tracking is strictly self-service: userId is always the
 * authenticated caller's own id, never a client-supplied body value
 * (PR #752 round 49 — matches the consent route's round-17 fix). Without
 * this, any authenticated caller could submit fabricated GPS coordinates
 * attributed to another consenting member's identity.
 */


const locationTrackSchema = z.object({
  latitude: z.number().min(-90, "Latitude must be -90 to 90").max(90, "Latitude must be -90 to 90"),
  longitude: z.number().min(-180, "Longitude must be -180 to 180").max(180, "Longitude must be -180 to 180"),
  accuracy: z.number().positive().optional(),
  altitude: z.number().optional(),
  purpose: z.enum(["strike", "picket", "meeting", "event", "organizing"]),
  activityType: z.string().max(100).optional(),
  strikeId: z.string().uuid("Invalid strikeId").optional(),
  eventId: z.string().uuid("Invalid eventId").optional(),
});

export const POST = withApiAuth(async (req: NextRequest) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Authentication required');
    }

    const body = await req.json();
    
    // Validate request body
    const validation = locationTrackSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        validation.error.errors[0]?.message || "Validation failed"
      );
    }

    const { latitude, longitude, accuracy, altitude, purpose, activityType, strikeId, eventId } = validation.data;

    // Track location (service will verify consent)
    const location = await GeofencePrivacyService.trackLocation({
      userId: user.id,
      latitude,
      longitude,
      accuracy,
      altitude,
      purpose,
      activityType,
      strikeId,
      eventId,
    });

    return standardSuccessResponse(
      { location,
        message: "Location recorded. Data will be automatically deleted after 24 hours." }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: (error as Error).message || "Failed to track location" },
      { status: 500 }
    );
  }
});

