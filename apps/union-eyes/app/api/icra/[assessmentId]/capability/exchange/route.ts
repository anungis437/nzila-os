/**
 * ARTIFACT TYPE: API Route
 * DOCTRINE_VERSION: 1.0.0
 *
 * POST /api/icra/[assessmentId]/capability/exchange
 *
 * Converts a browser-visible bearer capability (delivered via a URL
 * fragment, e.g. from the email-results recovery link, which is never sent
 * to the server on its own) into the existing HttpOnly capability cookie
 * representation, so subsequent server-rendered requests can read it.
 *
 * This endpoint does NOT rotate the capability — it only verifies the
 * presented token and, if valid, re-sets the same value as the HttpOnly
 * cookie. assessmentId alone is never sufficient; the token must match.
 *
 * Rate limited per (IP, assessmentId): the bearer token is cryptographically
 * strong so brute-force compromise is not realistic, but an unauthenticated
 * caller could otherwise generate unbounded DB traffic against a single
 * assessment. This is resource-abuse protection, not authorization.
 */
import { NextResponse } from 'next/server';
import { isAssessmentId } from '@/lib/icra/assessment-id'
import { clientAddress } from '@/lib/public-intake/guard';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { icraAssessments } from '@/db/schema/icra-schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { checkRateLimit } from '@/lib/rate-limiter';
import {
  checkCapability,
  capabilityDenialStatus,
  setCapabilityCookie,
} from '@/lib/icra/assessment-capability';
import { isAssessmentClaimed } from '@/lib/icra/assessment-access';

const bodySchema = z.object({
  capability: z.string().min(16).max(256),
});

interface RouteContext {
  params: Promise<{ assessmentId: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  const { assessmentId } = await params;
  if (!isAssessmentId(assessmentId)) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })

  const rl = await checkRateLimit(`icra-capability-exchange:${clientAddress(request)}:${assessmentId}`, {
    limit: 20,
    window: 60 * 60,
    identifier: 'icra-capability-exchange',
    failOpen: process.env.NODE_ENV !== 'production',
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: rl.error ? 'Temporarily unavailable.' : 'Too many requests. Please try again later.' },
      { status: rl.error ? 503 : 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid capability payload.' }, { status: 400 });
  }
  const { capability } = parsed.data;

  return withSystemContext(async (tx) => {
    const [assessment] = await tx
      .select({
        capabilityTokenHash: icraAssessments.capabilityTokenHash,
        capabilityTokenExpiresAt: icraAssessments.capabilityTokenExpiresAt,
        claimedAt: icraAssessments.claimedAt,
        claimedOrgId: icraAssessments.claimedOrgId,
        claimedByUserId: icraAssessments.claimedByUserId,
      })
      .from(icraAssessments)
      .where(eq(icraAssessments.id, assessmentId))
      .limit(1);

    // A claimed assessment has withdrawn its bearer capability: there is nothing to exchange, and no cookie is issued for it.
    if (assessment && isAssessmentClaimed(assessment)) {
      return NextResponse.json(
        { error: 'This assessment has been claimed. Sign in with the owning organization to open it.' },
        { status: capabilityDenialStatus('claimed') },
      );
    }

    const check = checkCapability(capability, assessment);
    if (!check.ok) {
      return NextResponse.json(
        { error: 'Invalid or expired capability.' },
        { status: capabilityDenialStatus(check.reason) },
      );
    }

    const response = NextResponse.json({ ok: true });
    setCapabilityCookie(response, assessmentId, capability);
    return response;
  });
}
