import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/api-auth-guard';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { pilotApplications, pilotEvidenceAssessments } from '@/db/schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { authorizePilotAccess, getPilotEffectiveOrganizationId, hasPilotPlatformAuthority } from '@/lib/pilot/pilot-ownership';
import { loadCurrentPilotEvidence, type PilotEvidenceDimension } from '@/lib/pilot/evidence-assessments';

export const dynamic = 'force-dynamic';
const DIMENSIONS = new Set<PilotEvidenceDimension>(['adoption', 'activity', 'champion', 'risk', 'readiness', 'fit', 'revenue', 'strategic_value']);
const routeId = async (context?: { params?: Promise<{ id: string }> | { id: string } }) => (context?.params ? await context.params : undefined)?.id;

export async function GET(_request: NextRequest, context?: { params?: Promise<{ id: string }> | { id: string } }) {
  const actor = await getCurrentUser();
  const id = await routeId(context);
  if (!actor?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!id) return NextResponse.json({ error: 'Pilot application id is required' }, { status: 400 });
  const [application] = await withSystemContext((tx) => tx.select({ verifiedOrganizationId: pilotApplications.verifiedOrganizationId }).from(pilotApplications).where(eq(pilotApplications.id, id)).limit(1));
  if (!application) return NextResponse.json({ error: 'Pilot application not found' }, { status: 404 });
  const authority = await authorizePilotAccess(getPilotEffectiveOrganizationId(application));
  if (!authority.ok) return NextResponse.json({ error: 'Forbidden' }, { status: authority.status });
  const rows = await withSystemContext((tx) => loadCurrentPilotEvidence(tx, id));
  return NextResponse.json({ data: [...rows.values()] });
}

export async function POST(request: NextRequest, context?: { params?: Promise<{ id: string }> | { id: string } }) {
  if (!(await hasPilotPlatformAuthority())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const actor = await getCurrentUser();
  const id = await routeId(context);
  if (!actor?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!id) return NextResponse.json({ error: 'Pilot application id is required' }, { status: 400 });
  const body = await request.json().catch(() => null) as null | Record<string, unknown>;
  const dimension = body?.dimension as PilotEvidenceDimension;
  const score = Number(body?.score);
  const evidenceType = typeof body?.evidenceType === 'string' ? body.evidenceType.trim() : '';
  const evidenceRef = typeof body?.evidenceRef === 'string' ? body.evidenceRef.trim() : '';
  const observedBy = typeof body?.observedBy === 'string' ? body.observedBy.trim() : '';
  const methodologyVersion = typeof body?.methodologyVersion === 'string' ? body.methodologyVersion.trim() : '';
  const observedAt = typeof body?.observedAt === 'string' ? new Date(body.observedAt) : new Date(Number.NaN);
  const expiresAt = typeof body?.expiresAt === 'string' ? new Date(body.expiresAt) : null;
  if (!DIMENSIONS.has(dimension) || !Number.isInteger(score) || score < 0 || score > 100 || !evidenceType || !evidenceRef || !observedBy || observedBy === actor.id || !methodologyVersion || !Number.isFinite(observedAt.getTime()) || observedAt > new Date() || (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()))) {
    return NextResponse.json({ error: 'A valid dimension, 0-100 score, independent observer, evidence, methodology and observation time are required' }, { status: 400 });
  }
  const evidenceDigest = createHash('sha256').update(`${evidenceType}\0${evidenceRef}`).digest('hex');
  const assessment = await withSystemContext(async (tx) => {
    const [application] = await tx.select({ organizationId: pilotApplications.verifiedOrganizationId }).from(pilotApplications).where(eq(pilotApplications.id, id)).limit(1);
    if (!application?.organizationId) throw new Error('PILOT_NOT_VERIFIED');
    const now = new Date();
    await tx.update(pilotEvidenceAssessments).set({ supersededAt: now }).where(and(eq(pilotEvidenceAssessments.applicationId, id), eq(pilotEvidenceAssessments.dimension, dimension), isNull(pilotEvidenceAssessments.supersededAt)));
    const [created] = await tx.insert(pilotEvidenceAssessments).values({ applicationId: id, organizationId: application.organizationId, dimension, score, evidenceType, evidenceRef, evidenceDigest, methodologyVersion, observedAt, observedBy, reviewedBy: actor.id, expiresAt }).returning();
    await persistAtomicAudit(tx, { organizationId: application.organizationId, userId: actor.id, action: 'pilot.evidence_assessment.reviewed', resourceType: 'pilot_evidence_assessment', resourceId: created.id, details: { applicationId: id, dimension, score, evidenceDigest, methodologyVersion, observedBy } });
    return created;
  }).catch((error) => {
    if (error instanceof Error && error.message === 'PILOT_NOT_VERIFIED') return null;
    throw error;
  });
  if (!assessment) return NextResponse.json({ error: 'The application must have a verified organization before evidence can be reviewed' }, { status: 409 });
  return NextResponse.json({ data: assessment }, { status: 201 });
}
