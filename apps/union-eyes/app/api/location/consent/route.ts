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
 * Location Tracking Consent API
 * POST: Request location tracking consent
 * GET: Check consent status
 * DELETE: Revoke consent
 */


const _locationConsentSchema = z.object({
  userId: z.string().uuid('Invalid userId'),
  purpose: z.unknown().optional(),
  purposeDescription: z.string().optional(),
  consentText: z.unknown().optional(),
  allowedDuringStrike: z.unknown().optional(),
  allowedDuringEvents: z.unknown().optional(),
});


export const POST = withApiAuth(async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { userId, purpose, purposeDescription, consentText, allowedDuringStrike, allowedDuringEvents } = body;

    if (!userId || !purpose || !purposeDescription || !consentText) {
      return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Missing required fields: userId, purpose, purposeDescription, consentText'
    );
    }

    // Get IP and User-Agent for audit
    const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    const consent = await GeofencePrivacyService.requestLocationConsent({
      userId,
      purpose,
      purposeDescription,
      consentText,
      allowedDuringStrike,
      allowedDuringEvents,
      ipAddress,
      userAgent,
    });

    return standardSuccessResponse(
      { consent,
        message: "Location tracking consent granted. Data will be retained for 24 hours maximum." }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to request location consent" },
      { status: 500 }
    );
  }
});

export const GET = withApiAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const context = searchParams.get("context") as "strike" | "event" | undefined;

    if (!userId) {
      return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Missing userId parameter'
    );
    }

    const hasConsent = await GeofencePrivacyService.hasValidConsent(userId, context);

    return NextResponse.json({
      userId,
      hasConsent,
      context,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check consent status" },
      { status: 500 }
    );
  }
});

export const DELETE = withApiAuth(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const reason = searchParams.get("reason");

    if (!userId) {
      return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Missing userId parameter'
    );
    }

    await GeofencePrivacyService.revokeLocationConsent(userId, reason || undefined);

    return NextResponse.json({
      success: true,
      message: "Location tracking consent revoked. All location data has been deleted.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to revoke consent" },
      { status: 500 }
    );
  }
});

