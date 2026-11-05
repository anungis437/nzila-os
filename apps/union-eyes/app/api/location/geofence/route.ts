import { z } from 'zod';
import { NextRequest, NextResponse } from "next/server";
import { GeofencePrivacyService } from "@/services/geofence-privacy-service";
import { withApiAuth, getCurrentUser, hasMinRole } from '@/lib/api-auth-guard';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

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


// A geofence is a place a member's position is compared with, so every field is bounded: a radius of a planet would make every
// position inside it, and a type outside the known vocabulary means nothing to the privacy rules that read it.
const MAX_RADIUS_METERS = 10_000;
const locationGeofenceSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(200),
  description: z.string().max(1000).optional(),
  geofenceType: z.enum(['strike_line', 'union_hall', 'safety_zone']),
  centerLatitude: z.number().min(-90, 'centerLatitude must be -90 to 90').max(90, 'centerLatitude must be -90 to 90'),
  centerLongitude: z.number().min(-180, 'centerLongitude must be -180 to 180').max(180, 'centerLongitude must be -180 to 180'),
  radiusMeters: z.number().positive('radiusMeters must be > 0').max(MAX_RADIUS_METERS, `radiusMeters must be at most ${MAX_RADIUS_METERS}`),
  strikeId: z.unknown().optional(),
});


export const POST = withApiAuth(async (req: NextRequest) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Authentication required');
    }
    // Defining a geofence is organizing work, not a member's own data: members may not create them.
    if (!(await hasMinRole('steward'))) {
      return NextResponse.json({ error: 'Creating a geofence requires steward authority' }, { status: 403 });
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Request body must be valid JSON');
    }
    const parsed = locationGeofenceSchema.safeParse(raw);
    if (!parsed.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, parsed.error.issues[0]?.message ?? 'Invalid geofence');
    }
    const { name, description, geofenceType, centerLatitude, centerLongitude, radiusMeters, strikeId } = parsed.data;
    // There is no strike register to prove a strike belongs to the organization, so a strike is not linked by a body-supplied id.
    if (strikeId !== undefined && strikeId !== null) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'strikeId is not accepted: no strike register exists to verify it');
    }

    const trustedUnionLocalId = await getOrganizationIdForUser(user.id);

    const geofence = await withRLSContext({ organizationId: trustedUnionLocalId }, async (tx) => {
      const created = await GeofencePrivacyService.createGeofence(
        {
          name,
          description,
          geofenceType,
          centerLatitude,
          centerLongitude,
          radiusMeters,
        },
        trustedUnionLocalId,
        tx,
      );
      await persistAtomicAudit(tx, {
        organizationId: trustedUnionLocalId,
        userId: user.id,
        action: 'location.geofence.create',
        resourceType: 'geofences',
        resourceId: created.id,
        details: { name, geofenceType, radiusMeters },
      });
      return created;
    });

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
    // This GET can persist a consented entry event. Keep the tenant-scoped
    // read, event write and privacy audit in one transaction; a failed audit
    // must roll back the event rather than returning false success.
    const result = await withRLSContext({ organizationId: trustedUnionLocalId }, async (tx) => {
      const outcome = await GeofencePrivacyService.checkGeofenceEntry(user.id, lat, lon, geofenceId, trustedUnionLocalId, tx);
      if (outcome.recorded) {
        await persistAtomicAudit(tx, {
          organizationId: trustedUnionLocalId,
          userId: user.id,
          action: 'location.geofence.entry',
          resourceType: 'geofences',
          resourceId: geofenceId,
          details: { eventType: 'entry' }, // Never include GPS coordinates.
        });
      }
      return outcome;
    });

    return NextResponse.json({
      userId: user.id,
      geofenceId,
      inside: result.inside,
      distance: result.distance,
      recorded: result.recorded,
      message: result.inside ? "User is inside geofence" : "User is outside geofence",
    });
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to check geofence" },
      { status: 500 }
    );
  }
});

