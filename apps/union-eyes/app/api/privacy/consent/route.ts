import { z } from 'zod';
import { NextRequest, NextResponse } from "next/server";
import { ProvincialPrivacyService, type Province } from "@/services/provincial-privacy-service";
import { requireApiAuth } from '@/lib/api-auth-guard';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

const consentSchema = z.object({
  province: z.enum(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'], {
    error: 'Invalid province code'
  }),
  consentType: z.string().min(1, 'Consent type is required'),
  consentGiven: z.boolean(),
  consentText: z.string().min(10, 'Consent text must be at least 10 characters'),
  consentLanguage: z.enum(['en', 'fr', 'it', 'pt']).default('en'),
  consentMethod: z.enum(['explicit_checkbox', 'opt_in', 'opt_out', 'implicit']).default('explicit_checkbox'),
});
/**
 * POST /api/privacy/consent
 * Record user consent for provincial privacy compliance
 * 
 * GUARDED: requireApiAuth
 */
export async function POST(request: NextRequest) {
  try {
    // Authentication guard
    const { userId } = await requireApiAuth();
    if (!userId) {
      return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');
    }

    const body = await request.json();
    
    // Validate request body
    const validation = consentSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid consent data',
        validation.error.issues
      );
    }

    const { province, consentType, consentGiven, consentText, consentLanguage, consentMethod } = validation.data;

    if (province === 'QC' && consentLanguage !== 'fr') {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Quebec consent records must be submitted in French (consentLanguage=fr).'
      );
    }

    // Get user IP and user agent for audit trail
    const ipAddress = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    const organizationId = await getOrganizationIdForUser(userId);
    const consent = await withRLSContext({ organizationId }, async (tx) => {
      const recorded = await ProvincialPrivacyService.recordConsent(
        {
          userId,
          province: province as Province,
          consentType,
          consentGiven,
          consentMethod,
          consentText,
          consentLanguage,
          ipAddress,
          userAgent,
        },
        tx,
      );
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'privacy.consent.record',
        resourceType: 'provincial_consent',
        resourceId: recorded.id,
        details: { province, consentType, consentGiven, consentMethod },
      });
      return recorded;
    });

    return NextResponse.json({ 
      success: true, 
      consent,
      message: "Consent recorded successfully" 
    });
  } catch (_error: any) {
return NextResponse.json(
      { error: "Failed to record consent" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/privacy/consent?province=QC&consentType=marketing
 * Check if user has valid consent
 * 
 * GUARDED: requireApiAuth
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication guard
    const { userId } = await requireApiAuth();
    if (!userId) {
      return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');
    }

    const { searchParams } = new URL(request.url);
    const province = searchParams.get("province") as Province;
    const consentType = searchParams.get("consentType");

    if (!province || !consentType) {
      return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Missing province or consentType'
    );
    }

    const hasConsent = await ProvincialPrivacyService.hasValidConsent(
      userId,
      province,
      consentType
    );

    return NextResponse.json({ hasConsent });
  } catch (_error: any) {
return NextResponse.json(
      { error: "Failed to check consent" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/privacy/consent
 * Revoke user consent (right to withdraw consent)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await requireApiAuth();
    if (!userId) {
      return standardErrorResponse(
      ErrorCode.AUTH_REQUIRED,
      'Unauthorized'
    );
    }

    const body = await request.json();
    const { province, consentType } = body;

    if (!province || !consentType) {
      return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Missing required fields'
    );
    }

    const organizationId = await getOrganizationIdForUser(userId);
    const revoked = await withRLSContext({ organizationId }, async (tx) => {
      const rows = await ProvincialPrivacyService.revokeConsent(userId, province as Province, consentType, tx);
      if (rows.length === 0) return null;
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'privacy.consent.revoke',
        resourceType: 'provincial_consent',
        resourceId: rows[0].id,
        details: { province, consentType, revokedCount: rows.length },
      });
      return rows;
    });
    if (!revoked) {
      return NextResponse.json({ error: "No active consent to revoke" }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      message: "Consent revoked successfully" 
    });
  } catch (_error: any) {
return NextResponse.json(
      { error: "Failed to revoke consent" },
      { status: 500 }
    );
  }
}

