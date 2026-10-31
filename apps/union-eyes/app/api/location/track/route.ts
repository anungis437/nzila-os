import { z } from 'zod';
import { NextRequest, NextResponse } from "next/server";
import { GeofencePrivacyService } from "@/services/geofence-privacy-service";
import { withApiAuth, getCurrentUser } from "@/lib/api-auth-guard";
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { logger } from '@/lib/logger';

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
  strikeId: z.guid("Invalid strikeId").optional(),
  eventId: z.guid("Invalid eventId").optional(),
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
        validation.error.issues[0]?.message || "Validation failed"
      );
    }

    const { latitude, longitude, accuracy, altitude, purpose, activityType, strikeId, eventId } = validation.data;

    // Track location (the service verifies consent). The point and its audit record commit together; the audit names
    // the purpose and the strike or event, never the coordinates.
    const organizationId = await getOrganizationIdForUser(user.id);
    const location = await withRLSContext({ organizationId }, async (tx) => {
      const recorded = await GeofencePrivacyService.trackLocation({
        userId: user.id,
        latitude,
        longitude,
        accuracy,
        altitude,
        purpose,
        activityType,
        strikeId,
        eventId,
      }, tx);
      await persistAtomicAudit(tx, {
        organizationId,
        userId: user.id,
        action: 'location.track.record',
        resourceType: 'location_tracking',
        resourceId: recorded.id,
        details: { purpose, strikeId: strikeId ?? null, eventId: eventId ?? null },
      });
      return recorded;
    });

    return standardSuccessResponse(
      { location,
        message: "Location recorded. Data will be automatically deleted after 24 hours." }
    );
  } catch (error: unknown) {
    // A refusal for want of consent or because tracking is off is the answer to the request, not a server fault.
    const message = error instanceof Error ? error.message : '';
    if (message.includes('requires explicit opt-in consent')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.includes('globally disabled')) {
      return NextResponse.json({ error: message }, { status: 503 });
    }
    logger.error('location track failed', { error: message });
    return NextResponse.json({ error: "Failed to track location" }, { status: 500 });
  }
});

