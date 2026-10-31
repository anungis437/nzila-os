import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { pensionBenefitClaims } from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { isPensionAdministrator, ownPensionIdentities } from '@/lib/pension/pension-authority';
import { z } from 'zod';

// A member submits a claim for themselves. The state of a claim (approved, denied, paid) is decided by the plan's
// trustees, which is not implemented, so a submission is always filed as pending and cannot carry a decision.
const createBenefitClaimSchema = z.object({
  memberId: z.guid(),
  memberName: z.string().max(255),
  claimType: z.string().max(100),
  amount: z.string(),
  notes: z.string().optional(),
});

export const dynamic = 'force-dynamic';

// A list answers at most this many rows.
const LIST_LIMIT = 200;

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'List benefit claims', description: 'Benefit claims: your own, or the organization\'s for a pension administrator' },
  },
  async ({ request, organizationId, userId, user }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const url = new URL(request.url);
    const memberId = url.searchParams.get('memberId');

    return withRLSContext({ organizationId }, async (tx) => {
      const conditions = [eq(pensionBenefitClaims.organizationId, organizationId)];
      if (isPensionAdministrator(user?.role)) {
        if (memberId) conditions.push(eq(pensionBenefitClaims.memberId, memberId));
      } else {
        const own = await ownPensionIdentities(tx, organizationId, userId);
        if (own.length === 0 || (memberId && !own.includes(memberId))) return [];
        conditions.push(inArray(pensionBenefitClaims.memberId, memberId ? [memberId] : own));
      }
      return tx.select().from(pensionBenefitClaims).where(and(...conditions)).orderBy(desc(pensionBenefitClaims.createdAt)).limit(LIST_LIMIT);
    });
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'Submit benefit claim', description: 'Submit a pension benefit claim for yourself' },
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const parsed = createBenefitClaimSchema.parse(body);

    return withRLSContext({ organizationId }, async (tx) => {
      const own = await ownPensionIdentities(tx, organizationId, userId);
      if (!own.includes(parsed.memberId)) {
        throw ApiError.forbidden('A benefit claim can only be submitted for yourself');
      }
      const [claim] = await tx
        .insert(pensionBenefitClaims)
        .values({ ...parsed, organizationId, status: 'pending', submittedDate: new Date() })
        .returning();
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'pension.benefit_claim.submit',
        resourceType: 'pension_benefit_claims',
        resourceId: claim.id,
        details: { claimType: parsed.claimType },
      });
      return claim;
    });
  },
);
