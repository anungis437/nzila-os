/**
 * GDPR Cookie Consent API
 * POST /api/gdpr/cookie-consent — public (cookie consent must work without auth)
 * GET  /api/gdpr/cookie-consent — public
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from '@/lib/api-auth-guard';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { CookieConsentManager, CookieConsentOwnershipError } from "@/lib/gdpr/consent-manager";
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

    // Anonymous visitors have no organization binding, so the write and its audit run on the system connection; the
    // organization the banner names must exist, and a record held by a signed-in member cannot be changed by others.
    const result = await withSystemContext(async (tx) => {
      const [organization] = await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1);
      if (!organization) return { error: 'organization' as const };

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
      }, tx);
      await persistAtomicAudit(tx, {
        organizationId,
        userId: userId ?? 'system:cookie-consent',
        action: 'gdpr.cookie_consent.save',
        resourceType: 'cookie_consents',
        resourceId: consent.id,
        details: {
          functional: consent.functional,
          analytics: consent.analytics,
          marketing: consent.marketing,
          authenticated: !!userId,
        },
      });
      return { consent };
    });
    if ('error' in result) return NextResponse.json({ error: 'Invalid request data' }, { status: 400 });

    return NextResponse.json(result.consent);
  } catch (error) {
    if (error instanceof CookieConsentOwnershipError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
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

