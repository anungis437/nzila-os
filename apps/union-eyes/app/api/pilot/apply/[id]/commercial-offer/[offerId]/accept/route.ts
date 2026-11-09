import { NextResponse, type NextRequest } from 'next/server';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { pilotApplications, pilotCommercialAcceptances, pilotCommercialOffers } from '@/db/schema';
import { getCurrentUser } from '@/lib/api-auth-guard';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { canAdministerOrganization, directRoleIn, resolveOrganizationAccess } from '@/lib/organizations/read-authority';
import { PILOT_COMMERCIAL_NOTICE_VERSION } from '@/lib/pilot/commercial-offers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, context?: { params?: Promise<{ id: string; offerId: string }> | { id: string; offerId: string } }) {
  const actor = await getCurrentUser();
  if (!actor?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const params = context?.params ? await context.params : undefined;
  if (!params?.id || !params.offerId) return NextResponse.json({ error: 'Application and offer ids are required' }, { status: 400 });
  const requestId = request.headers.get('idempotency-key')?.trim();
  const body = await request.json().catch(() => null) as null | Record<string, unknown>;
  const authorityEvidenceRef = typeof body?.authorityEvidenceRef === 'string' ? body.authorityEvidenceRef.trim() : '';
  const noticeVersion = typeof body?.noticeVersion === 'string' ? body.noticeVersion : '';
  const acceptedTermsDigest = typeof body?.termsDigest === 'string' ? body.termsDigest : '';
  if (!requestId || !authorityEvidenceRef || noticeVersion !== PILOT_COMMERCIAL_NOTICE_VERSION || !/^[a-f0-9]{64}$/.test(acceptedTermsDigest)) {
    return NextResponse.json({ error: `Idempotency-Key, authorityEvidenceRef, exact termsDigest and noticeVersion ${PILOT_COMMERCIAL_NOTICE_VERSION} are required` }, { status: 400 });
  }

  const [snapshot] = await withSystemContext((tx) => tx.select({ organizationId: pilotCommercialOffers.organizationId }).from(pilotCommercialOffers).where(and(eq(pilotCommercialOffers.id, params.offerId), eq(pilotCommercialOffers.applicationId, params.id))).limit(1));
  if (!snapshot) return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
  const access = await resolveOrganizationAccess(actor.id);
  if (!canAdministerOrganization(access, snapshot.organizationId)) return NextResponse.json({ error: 'A direct administrator of the verified applicant organization must accept the offer' }, { status: 403 });
  const representativeRole = directRoleIn(access, snapshot.organizationId) as string;

  const result = await withSystemContext(async (tx) => {
    await tx.execute(sql`SELECT id FROM pilot_commercial_offers WHERE id = ${params.offerId}::uuid FOR UPDATE`);
    const [offer] = await tx.select().from(pilotCommercialOffers).where(and(eq(pilotCommercialOffers.id, params.offerId), eq(pilotCommercialOffers.applicationId, params.id))).limit(1);
    if (!offer) throw new Error('NOT_FOUND');
    const [existingRequest] = await tx.select().from(pilotCommercialAcceptances).where(and(eq(pilotCommercialAcceptances.organizationId, offer.organizationId), eq(pilotCommercialAcceptances.requestId, requestId))).limit(1);
    if (existingRequest) {
      if (existingRequest.offerId !== offer.id || existingRequest.acceptedTermsDigest !== acceptedTermsDigest) throw new Error('IDEMPOTENCY_CONFLICT');
      return existingRequest;
    }
    const [application] = await tx.select({ verifiedOrganizationId: pilotApplications.verifiedOrganizationId }).from(pilotApplications).where(eq(pilotApplications.id, params.id)).limit(1);
    if (application?.verifiedOrganizationId !== offer.organizationId || offer.status !== 'offered' || offer.expiresAt <= new Date() || offer.termsDigest !== acceptedTermsDigest || offer.issuedBy === actor.id) throw new Error('OFFER_NOT_ACCEPTABLE');
    const [acceptance] = await tx.insert(pilotCommercialAcceptances).values({ offerId: offer.id, applicationId: params.id, organizationId: offer.organizationId, acceptedBy: actor.id, representativeRole, authorityEvidenceRef, acceptedTermsDigest, noticeVersion, requestId }).returning();
    const [updated] = await tx.update(pilotCommercialOffers).set({ status: 'accepted' }).where(and(eq(pilotCommercialOffers.id, offer.id), eq(pilotCommercialOffers.status, 'offered'))).returning({ id: pilotCommercialOffers.id });
    if (!updated) throw new Error('OFFER_NOT_ACCEPTABLE');
    await persistAtomicAudit(tx, { organizationId: offer.organizationId, userId: actor.id, action: 'pilot.commercial_offer.accepted', resourceType: 'pilot_commercial_offer', resourceId: offer.id, details: { applicationId: params.id, acceptanceId: acceptance.id, termsDigest: acceptedTermsDigest, representativeRole, noticeVersion } });
    return acceptance;
  }).catch((error) => {
    if (error instanceof Error) return { error: error.message } as const;
    throw error;
  });
  if ('error' in result) {
    const status = result.error === 'NOT_FOUND' ? 404 : 409;
    return NextResponse.json({ error: result.error === 'IDEMPOTENCY_CONFLICT' ? 'Idempotency key was already used for different acceptance data' : 'The offer is no longer eligible for acceptance or does not match the verified terms' }, { status });
  }
  return NextResponse.json({ data: result });
}
