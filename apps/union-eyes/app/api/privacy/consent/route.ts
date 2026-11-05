import { z } from 'zod';
import { NextRequest, NextResponse } from "next/server";
import { ProvincialPrivacyService, type Province } from "@/services/provincial-privacy-service";
import { requireApiAuth } from '@/lib/api-auth-guard';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { readBoundedJson, RequestBodyTooLargeError } from '@/lib/api/bounded-json';
import { logger } from '@/lib/logger';
import { EXPLICIT_CONSENT_METHODS, violatesExplicitOptIn } from '@/lib/privacy/explicit-consent';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

const MAX_BODY_BYTES = 16 * 1024;

const provinceSchema = z.enum(['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'], {
  error: 'Invalid province code'
});

const consentSchema = z.object({
  province: provinceSchema,
  consentType: z.string().min(1, 'Consent type is required'),
  consentGiven: z.boolean(),
  consentText: z.string().min(10, 'Consent text must be at least 10 characters'),
  consentLanguage: z.enum(['en', 'fr', 'it', 'pt']).default('en'),
  consentMethod: z.enum(['explicit_checkbox', 'opt_in', 'opt_out', 'implicit']).default('explicit_checkbox'),
});

const revokeSchema = z.object({
  province: provinceSchema,
  consentType: z.string().min(1, 'Consent type is required'),
});

/** A body that is not JSON, or is over the limit, is the caller's error, not a server failure. */
async function readBody(request: NextRequest): Promise<{ body: unknown } | { response: Response }> {
  try {
    return { body: await readBoundedJson(request, MAX_BODY_BYTES) };
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return { response: NextResponse.json({ error: 'Request body too large' }, { status: 413 }) };
    }
    return { response: standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid JSON body') };
  }
}

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

    const parsed = await readBody(request);
    if ('response' in parsed) return parsed.response;
    const body = parsed.body;
    
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

    // A grant in a province that requires explicit opt-in (Quebec Law 25) must come from an explicit method.
    const provinceConfig = await ProvincialPrivacyService.getProvinceConfig(province as Province);
    if (violatesExplicitOptIn(provinceConfig, consentGiven, consentMethod)) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        `${province} requires explicit consent: consentMethod must be one of ${EXPLICIT_CONSENT_METHODS.join(', ')} when consentGiven is true.`
      );
    }

    // X-Forwarded-For, X-Real-IP and User-Agent are whatever the client chose to send. They are not
    // stored as consent evidence (ipAddress/userAgent stay null); the audit row records networkEvidenceVerified=false.
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
          ipAddress: undefined,
          userAgent: undefined,
        },
        tx,
      );
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'privacy.consent.record',
        resourceType: 'provincial_consent',
        resourceId: recorded.id,
        details: { province, consentType, consentGiven, consentMethod, networkEvidenceVerified: false },
      });
      return recorded;
    });

    return NextResponse.json({ 
      success: true, 
      consent,
      message: "Consent recorded successfully" 
    });
  } catch (error: unknown) {
    logger.error('[privacy-consent] POST failed', { error });
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
    const rawProvince = searchParams.get("province");
    const consentType = searchParams.get("consentType");

    if (!rawProvince || !consentType) {
      return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Missing province or consentType'
    );
    }
    const province = provinceSchema.safeParse(rawProvince);
    if (!province.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid province code');
    }

    // The consent rows are the caller's own (row-level security keys them on the user), so the read runs in the caller's tenant transaction.
    const organizationId = await getOrganizationIdForUser(userId);
    const hasConsent = await withRLSContext({ organizationId }, (tx) =>
      ProvincialPrivacyService.hasValidConsent(userId, province.data, consentType, tx),
    );

    return NextResponse.json({ hasConsent });
  } catch (error: unknown) {
    logger.error('[privacy-consent] GET failed', { error });
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

    const parsed = await readBody(request);
    if ('response' in parsed) return parsed.response;
    const validation = revokeSchema.safeParse(parsed.body);
    if (!validation.success) {
      return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Missing required fields',
      validation.error.issues
    );
    }
    const { province, consentType } = validation.data;

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
  } catch (error: unknown) {
    logger.error('[privacy-consent] DELETE failed', { error });
    return NextResponse.json(
      { error: "Failed to revoke consent" },
      { status: 500 }
    );
  }
}

