import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { icraAssessments, icraMaturityProfiles } from '@/db/schema/icra-schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import {
  extractCapabilityToken,
  checkCapability,
  capabilityDenialStatus,
} from '@/lib/icra/assessment-capability';

interface RouteContext {
  params: Promise<{ assessmentId: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  const { assessmentId } = await params;

  return withSystemContext(async (tx) => {
    const [assessment] = await tx
      .select({
        capabilityTokenHash: icraAssessments.capabilityTokenHash,
        capabilityTokenExpiresAt: icraAssessments.capabilityTokenExpiresAt,
      })
      .from(icraAssessments)
      .where(eq(icraAssessments.id, assessmentId))
      .limit(1);

    const presented = extractCapabilityToken(request, assessmentId);
    const capCheck = checkCapability(presented, assessment);
    if (!capCheck.ok) {
      return NextResponse.json(
        { error: 'Not authorized to view this assessment' },
        { status: capabilityDenialStatus(capCheck.reason) },
      );
    }

    const rows = await tx
      .select()
      .from(icraMaturityProfiles)
      .where(eq(icraMaturityProfiles.assessmentId, assessmentId))
      .orderBy(icraMaturityProfiles.generatedAt)
      .limit(1);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    return NextResponse.json({ profile: rows[0].profilePayload });
  });
}
