import { NextResponse, type NextRequest } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { pilotApplications, pilotCommercialOffers } from '@/db/schema';
import { getCurrentUser } from '@/lib/api-auth-guard';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { commercialTermsDigest } from '@/lib/pilot/commercial-offers';
import { authorizePilotAccess, getPilotEffectiveOrganizationId, hasPilotPlatformAuthority } from '@/lib/pilot/pilot-ownership';

export const dynamic = 'force-dynamic';

const CommercialOfferBodySchema = z.object({
  amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  currency: z.string().regex(/^[A-Z]{3}$/).default('CAD'),
  pricingBasis: z.string().trim().min(1).max(500),
  memberCountBasis: z.number().int().min(1).max(10_000_000),
  memberCountEvidenceRef: z.string().trim().min(1).max(500),
  terms: z.record(z.string(), z.unknown()).refine((value) => JSON.stringify(value).length <= 20_000, 'Terms are too large'),
  expiresAt: z.coerce.date().refine((value) => value.getTime() > Date.now(), 'Expiry must be in the future'),
}).strict();

const routeId = async (context?: { params?: Promise<{ id: string }> | { id: string } }) => (context?.params ? await context.params : undefined)?.id;

export async function GET(_request: NextRequest, context?: { params?: Promise<{ id: string }> | { id: string } }) {
  const id = await routeId(context);
  const actor = await getCurrentUser();
  if (!actor?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!id) return NextResponse.json({ error: 'Pilot application id is required' }, { status: 400 });

  const [application] = await withSystemContext((tx) => tx.select({ verifiedOrganizationId: pilotApplications.verifiedOrganizationId }).from(pilotApplications).where(eq(pilotApplications.id, id)).limit(1));
  if (!application) return NextResponse.json({ error: 'Pilot application not found' }, { status: 404 });
  const authority = await authorizePilotAccess(getPilotEffectiveOrganizationId(application));
  if (!authority.ok) return NextResponse.json({ error: 'Forbidden' }, { status: authority.status });

  const offers = await withSystemContext((tx) => tx.select().from(pilotCommercialOffers).where(eq(pilotCommercialOffers.applicationId, id)).orderBy(desc(pilotCommercialOffers.version)));
  return NextResponse.json({ data: offers });
}

export async function POST(request: NextRequest, context?: { params?: Promise<{ id: string }> | { id: string } }) {
  if (!(await hasPilotPlatformAuthority())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const actor = await getCurrentUser();
  const id = await routeId(context);
  if (!actor?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!id) return NextResponse.json({ error: 'Pilot application id is required' }, { status: 400 });

  const parsedBody = CommercialOfferBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: 'Valid amount, pricingBasis, evidenced memberCountBasis, terms and future expiresAt are required' }, { status: 400 });
  }
  const { amount, currency, pricingBasis, memberCountBasis, memberCountEvidenceRef, terms, expiresAt } = parsedBody.data;

  const offer = await withSystemContext(async (tx) => {
    await tx.execute(sql`SELECT id FROM pilot_applications WHERE id = ${id}::uuid FOR UPDATE`);
    const [application] = await tx.select({ organizationId: pilotApplications.verifiedOrganizationId }).from(pilotApplications).where(eq(pilotApplications.id, id)).limit(1);
    if (!application?.organizationId) throw new Error('PILOT_NOT_VERIFIED');
    const [latest] = await tx.select({ version: pilotCommercialOffers.version }).from(pilotCommercialOffers).where(eq(pilotCommercialOffers.applicationId, id)).orderBy(desc(pilotCommercialOffers.version)).limit(1);
    const version = (latest?.version ?? 0) + 1;
    const digest = commercialTermsDigest({ applicationId: id, organizationId: application.organizationId, version, currency, amount, pricingBasis, memberCountBasis, memberCountEvidenceRef, terms, expiresAt });
    const [created] = await tx.insert(pilotCommercialOffers).values({ applicationId: id, organizationId: application.organizationId, version, currency, amount, pricingBasis, memberCountBasis, memberCountEvidenceRef, terms, termsDigest: digest, status: 'offered', issuedBy: actor.id, expiresAt }).returning();
    const previous = await tx.update(pilotCommercialOffers).set({ status: 'superseded', supersededById: created.id }).where(and(eq(pilotCommercialOffers.applicationId, id), eq(pilotCommercialOffers.status, 'offered'), sql`${pilotCommercialOffers.id} <> ${created.id}`)).returning({ id: pilotCommercialOffers.id });
    await persistAtomicAudit(tx, { organizationId: application.organizationId, userId: actor.id, action: 'pilot.commercial_offer.issued', resourceType: 'pilot_commercial_offer', resourceId: created.id, details: { applicationId: id, version, termsDigest: digest, supersededOfferIds: previous.map((row) => row.id) } });
    return created;
  }).catch((error) => {
    if (error instanceof Error && error.message === 'PILOT_NOT_VERIFIED') return null;
    throw error;
  });
  if (!offer) return NextResponse.json({ error: 'The application must have a verified organization before an offer can be issued' }, { status: 409 });
  return NextResponse.json({ data: offer }, { status: 201 });
}
