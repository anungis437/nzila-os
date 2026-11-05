import { NextResponse } from 'next/server';
import { isAssessmentId } from '@/lib/icra/assessment-id'
import { eq } from 'drizzle-orm';
import { icraAssessments, icraMaturityProfiles } from '@/db/schema/icra-schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { guardPublicIntake } from '@/lib/public-intake/guard';
import {
  capabilityDenialStatus,
} from '@/lib/icra/assessment-capability';
import { authorizeAssessmentAccess } from '@/lib/icra/assessment-access';

interface RouteContext {
  params: Promise<{ assessmentId: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  // A capability read is bounded like the writes: a caller cannot probe assessment ids or render reports without limit.
  const intake = await guardPublicIntake(request, { bucket: 'capability', readBody: false })
  if (!intake.ok) return intake.response
  const { assessmentId } = await params;
  if (!isAssessmentId(assessmentId)) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })

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

    const capCheck = await authorizeAssessmentAccess(request, assessmentId, assessment);
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
