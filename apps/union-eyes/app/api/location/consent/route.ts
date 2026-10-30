import { z } from 'zod';
import { NextRequest, NextResponse } from "next/server";
import { GeofencePrivacyService, LocationConsentConflictError, LocationConsentNotFoundError } from "@/services/geofence-privacy-service";
import { withApiAuth, getCurrentUser } from '@/lib/api-auth-guard';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
/**
 * Location Tracking Consent API
 * POST: Request location tracking consent
 * GET: Check consent status
 * DELETE: Revoke consent
 *
 * Consent is strictly self-service: userId is always the authenticated
 * caller's own id, never a client-supplied body/query value (PR #752 round 17).
 */


const _locationConsentSchema = z.object({
  purpose: z.unknown().optional(),
  purposeDescription: z.string().optional(),
  consentText: z.unknown().optional(),
  allowedDuringStrike: z.unknown().optional(),
  allowedDuringEvents: z.unknown().optional(),
});


export const POST = withApiAuth(async (req: NextRequest) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Authentication required');
    }
    const userId = user.id;
    const organizationId = await getOrganizationIdForUser(userId);

    const body = await req.json();
    const { purpose, purposeDescription, consentText, allowedDuringStrike, allowedDuringEvents } = body;

    if (!purpose || !purposeDescription || !consentText) {
      return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Missing required fields: purpose, purposeDescription, consentText'
    );
    }

    // Get IP and User-Agent for audit
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const consent = await withRLSContext({ organizationId }, async (tx) => {
      const granted = await GeofencePrivacyService.requestLocationConsent(
        {
          userId,
          purpose,
          purposeDescription,
          consentText,
          allowedDuringStrike,
          allowedDuringEvents,
          ipAddress,
          userAgent,
        },
        tx,
      );
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'location.consent.grant',
        resourceType: 'member_location_consent',
        resourceId: granted.id,
        details: { purpose, allowedDuringStrike: !!allowedDuringStrike, allowedDuringEvents: !!allowedDuringEvents },
      });
      return granted;
    });

    return standardSuccessResponse(
      { consent,
        message: "Location tracking consent granted. Data will be retained for 24 hours maximum." }
    );
  } catch (error) {
    if (error instanceof LocationConsentConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: "Failed to request location consent" },
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
    const userId = user.id;

    const { searchParams } = new URL(req.url);
    const context = searchParams.get("context") as "strike" | "event" | undefined;

    const hasConsent = await GeofencePrivacyService.hasValidConsent(userId, context);

    return NextResponse.json({
      userId,
      hasConsent,
      context,
    });
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to check consent status" },
      { status: 500 }
    );
  }
});

export const DELETE = withApiAuth(async (req: NextRequest) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Authentication required');
    }
    const userId = user.id;
    const organizationId = await getOrganizationIdForUser(userId);

    const { searchParams } = new URL(req.url);
    const reason = searchParams.get("reason");

    const erasedOnly = await withRLSContext({ organizationId }, async (tx) => {
      try {
        const revoked = await GeofencePrivacyService.revokeLocationConsent(userId, reason || undefined, tx);
        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: 'location.consent.revoke',
          resourceType: 'member_location_consent',
          resourceId: revoked.consentId,
          details: { reason: reason || 'User request' },
        });
        return false;
      } catch (error) {
        if (!(error instanceof LocationConsentNotFoundError)) throw error;
        // No active consent to revoke does not mean no data: the member can still have location records (consent expired or already
        // withdrawn, a retention sweep that did not finish). Erasure does not depend on consent, so whatever remains is removed.
        const erased = await GeofencePrivacyService.eraseLocationData(userId, tx);
        if (erased.total === 0) throw error; // nothing recorded and nothing held: the request has nothing to act on, and no log row is kept
        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: 'location.data.erase',
          resourceType: 'member_location_data',
          details: { reason: reason || 'User request', trackingRecordsDeleted: erased.trackingRecordsDeleted, eventRecordsDeleted: erased.eventRecordsDeleted },
        });
        return true;
      }
    });

    return NextResponse.json({
      success: true,
      message: erasedOnly
        ? "No active location consent was found. The location data that remained has been deleted."
        : "Location tracking consent revoked. All location data has been deleted.",
    });
  } catch (error) {
    if (error instanceof LocationConsentNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to revoke consent" },
      { status: 500 }
    );
  }
});

