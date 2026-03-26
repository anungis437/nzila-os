/**
 * GDPR Cookie Consent API
 * POST /api/gdpr/cookie-consent — public (cookie consent must work without auth)
 * GET  /api/gdpr/cookie-consent — public
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from '@/lib/api-auth-guard';
import { CookieConsentManager } from "@/lib/gdpr/consent-manager";
import { logger } from '@/lib/logger';

const gdprCookieConsentSchema = z.object({
  consentId: z.string().uuid('Invalid consentId'),
  organizationId: z.string().uuid('Invalid organizationId'),
  essential: z.boolean().optional(),
  functional: z.boolean().optional(),
  analytics: z.boolean().optional(),
  marketing: z.boolean().optional(),
  userAgent: z.string().optional(),
});

export const POST = async (request: NextRequest) => {
  try {
    let userId: string | undefined;
    try { const user = await getCurrentUser(); userId = user?.id ?? undefined; } catch { /* unauthenticated */ }

    const body = await request.json();
    const validation = gdprCookieConsentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });
    }
    
    const { consentId, organizationId, essential, functional, analytics, marketing, userAgent } = validation.data;

    const ipAddress = request.headers.get("x-forwarded-for") || 
                      request.headers.get("x-real-ip") || 
                      "unknown";

    const consent = await CookieConsentManager.saveCookieConsent({
      userId,
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
    logger.error('[cookie-consent] POST error', { error });
    return NextResponse.json({ error: 'Failed to save cookie consent' }, { status: 500 });
  }
};

export const GET = async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const consentId = searchParams.get("consentId");

    if (!consentId) {
      // No consent ID — return empty (cookie banner initial check)
      return NextResponse.json({ consent: null });
    }

    const consent = await CookieConsentManager.getCookieConsent(consentId);

    if (!consent) {
      return NextResponse.json({ consent: null });
    }

    return NextResponse.json(consent);
  } catch (error) {
    // Gracefully handle missing table / DB errors — don't block the page
    logger.error('[cookie-consent] GET error', { error });
    return NextResponse.json({ consent: null });
  }
};

