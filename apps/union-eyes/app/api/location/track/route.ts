import { z } from 'zod';
import { NextRequest, NextResponse } from "next/server";
import { GeofencePrivacyService } from "@/services/geofence-privacy-service";
import { withApiAuth } from "@/lib/api-auth-guard";

import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
/**
 * Location Tracking API
 * POST: Record user location (requires explicit consent)
 */


const locationTrackSchema = z.object({
  userId: z.string().uuid("Invalid userId"),
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
    const body = await req.json();
    
    // Validate request body
    const validation = locationTrackSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        validation.error.errors[0]?.message || "Validation failed"
      );
    }

    const { userId, latitude, longitude, accuracy, altitude, purpose, activityType, strikeId, eventId } = validation.data;

    // Track location (service will verify consent)
    const location = await GeofencePrivacyService.trackLocation({
      userId,
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

