import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api-auth-guard';
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses';

/**
 * Privacy breach intake / assessment status — LEGAL REVIEW REQUIRED
 *
 * This route previously computed a definitive notification decision, reporting
 * deadline and regulator list from hardcoded affected-person thresholds
 * (10 / 25) and province-based hour windows (24h / 72h). Those values are not
 * derived from a verified legal source: whether a breach must be reported
 * depends on the governing regime (PIPEDA, Québec Law 25, another provincial
 * statute), the processing activity and a harm-risk assessment — not on a head
 * count — and no universal clock exists.
 *
 * It now never asserts a legal conclusion. It acknowledges the facts supplied,
 * states that no determination was made, and requires a human-reviewed
 * legal/compliance disposition. Nothing is persisted and no notification is
 * dispatched. Capability: UE-PRIVACY-BREACH-ASSESSMENT (NOT_IMPLEMENTED for
 * determinations; limited to this fail-closed acknowledgement).
 */

const emergencyPipedaSchema = z.object({
  memberId: z.string().uuid('Invalid memberId'),
  breachDate: z.string().datetime().optional(),
  affectedDataTypes: z.array(z.string()).optional(),
  // Informational only. A count never decides reportability.
  estimatedAffectedCount: z.number().int().nonnegative().optional(),
  province: z.string().optional(),
});

const REVIEW_REQUIRED_MESSAGE =
  'No legal determination has been made. Whether notification or reporting is required, to whom and by when ' +
  'must be decided by an accountable human reviewer after establishing the governing privacy regime, the ' +
  'processing activity and the real risk of significant harm. No notification has been sent.';

function reviewRequiredResponse(extra: Record<string, unknown> = {}) {
  return {
    disposition: 'LEGAL_REVIEW_REQUIRED' as const,
    legalDetermination: 'NOT_MADE' as const,
    requiresBreachReport: null,
    notificationRequired: null,
    reportDeadline: null,
    reportingChannels: [] as string[],
    notificationDispatched: false,
    assessmentRecorded: false,
    message: REVIEW_REQUIRED_MESSAGE,
    ...extra,
  };
}

/**
 * POST /api/emergency/pipeda
 * Acknowledge reported breach facts; never decide notification duties.
 */
export const POST = withApiAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const validation = emergencyPipedaSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }

    const { breachDate, affectedDataTypes, estimatedAffectedCount, province } = validation.data;

    return NextResponse.json(
      reviewRequiredResponse({
        reportedFacts: {
          breachDate: breachDate ?? null,
          affectedDataTypes: affectedDataTypes ?? [],
          estimatedAffectedCount: estimatedAffectedCount ?? null,
          jurisdictionAsserted: province ?? null,
          jurisdictionVerified: false,
        },
      })
    );
  } catch {
    return NextResponse.json(
      reviewRequiredResponse({ message: 'The request could not be processed. No legal determination has been made.' }),
      { status: 400 }
    );
  }
});

/**
 * GET /api/emergency/pipeda?breachId=xxx
 * Status of a breach assessment. No assessment store exists, so the only
 * truthful status is that review is required.
 */
export const GET = withApiAuth(async (request: NextRequest) => {
  const breachId = request.nextUrl.searchParams.get('breachId');
  if (!breachId) {
    return NextResponse.json(
      reviewRequiredResponse({ message: 'breachId is required. No legal determination has been made.' }),
      { status: 400 }
    );
  }

  return NextResponse.json(reviewRequiredResponse({ breachId }));
});
