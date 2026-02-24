/**
 * GDPR Cookie Consent API
 * POST /api/gdpr/cookie-consent
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from "next/server";
import { withApiAuth, getCurrentUser } from '@/lib/api-auth-guard';
import { CookieConsentManager } from "@/lib/gdpr/consent-manager";

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

const gdprCookieConsentSchema = z.object({
  consentId: z.string().uuid('Invalid consentId'),
  organizationId: z.string().uuid('Invalid organizationId'),
  essential: z.boolean().optional(),
  functional: z.boolean().optional(),
  analytics: z.boolean().optional(),
  marketing: z.boolean().optional(),
  userAgent: z.string().optional(),
});

export const POST = withApiAuth(async (request: NextRequest) => {
  try {
    const user = await getCurrentUser();
    const body = await request.json();
    // Validate request body
    const validation = gdprCookieConsentSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }
    
    const { consentId, organizationId, essential, functional, analytics, marketing, userAgent } = validation.data;

    if (!consentId || !organizationId) {
      return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Missing required fields'
    );
    }

    // Get IP address from request
    const ipAddress = request.headers.get("x-forwarded-for") || 
                      request.headers.get("x-real-ip") || 
                      "unknown";

    const consent = await CookieConsentManager.saveCookieConsent({
      userId: user?.id ?? undefined,
      organizationId,
      consentId,
      essential: essential ?? true,
      functional: functional ?? false,
      analytics: analytics ?? false,
      marketing: marketing ?? false,
      ipAddress,
      userAgent,
    });

    return NextResponse.json(consent);
  } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to save cookie consent',
      error
    );
  }
});

export const GET = async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const consentId = searchParams.get("consentId");

    if (!consentId) {
      return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Consent ID required'
    );
    }

    const consent = await CookieConsentManager.getCookieConsent(consentId);

    if (!consent) {
      return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Consent not found'
    );
    }

    return NextResponse.json(consent);
  } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to retrieve cookie consent',
      error
    );
  }
};

