import { z } from 'zod';
import { NextRequest, NextResponse } from "next/server";
import { GeofencePrivacyService, LocationConsentConflictError, LocationConsentNotFoundError } from "@/services/geofence-privacy-service";
import { withApiAuth, getCurrentUser } from '@/lib/api-auth-guard';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { getLocationConsentNotice } from '@/lib/location/consent-notice';

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


// Consent text, purpose and version are NEVER client-controlled. The member must
// affirm the exact currently configured notice before a consent record is written.
const locationConsentSchema = z.object({
  noticeVersion: z.string().min(1).max(10),
  acknowledged: z.literal(true),
  allowedDuringStrike: z.boolean().default(false),
  allowedDuringEvents: z.boolean().default(false),
}).strict();


export const POST = withApiAuth(async (req: NextRequest) => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Authentication required');
    }
    const userId = user.id;
    const organizationId = await getOrganizationIdForUser(userId);

    const notice = getLocationConsentNotice();
    if (!notice) {
      return NextResponse.json(
        { error: 'Location consent is unavailable until the institutional notice is configured' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const parsed = locationConsentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'The current noticeVersion, acknowledged: true and boolean context permissions are required; client-authored notice text is not accepted',
      );
    }
    if (parsed.data.noticeVersion !== notice.version) {
      return NextResponse.json(
        { error: 'Consent notice has changed; review and acknowledge the current version' },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const { allowedDuringStrike, allowedDuringEvents } = parsed.data;
    if (!allowedDuringStrike && !allowedDuringEvents) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Select at least one permitted tracking context');
    }
    const { purpose, purposeDescription, consentText } = notice;

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
          noticeVersion: notice.version,
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
        details: { purpose, noticeVersion: notice.version, allowedDuringStrike, allowedDuringEvents },
      });
      return granted;
    });

    return standardSuccessResponse(
      {
        consent: {
          id: consent.id,
          consentStatus: consent.consentStatus,
          consentVersion: consent.consentVersion,
          allowedDuringStrike: consent.allowedDuringStrike,
          allowedDuringEvents: consent.allowedDuringEvents,
          expiresAt: consent.expiresAt,
        },
        message: "Location tracking consent granted. Data will be retained for 24 hours maximum.",
      }
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
    // The context is one of two known values; anything else is refused instead of being reflected back.
    const rawContext = searchParams.get("context");
    if (rawContext !== null && rawContext !== "strike" && rawContext !== "event") {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'context must be "strike" or "event"');
    }
    const context = (rawContext ?? undefined) as "strike" | "event" | undefined;

    const organizationId = await getOrganizationIdForUser(userId);
    const hasConsent = await withRLSContext({ organizationId }, (tx) =>
      GeofencePrivacyService.hasValidConsent(userId, context, tx),
    );

    const notice = getLocationConsentNotice();
    return NextResponse.json({
      userId,
      hasConsent,
      context,
      notice: notice ? {
        version: notice.version,
        purpose: notice.purpose,
        purposeDescription: notice.purposeDescription,
        consentText: notice.consentText,
      } : null,
      consentGrantAvailable: notice !== null,
    }, { headers: { 'Cache-Control': 'no-store' } });
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

