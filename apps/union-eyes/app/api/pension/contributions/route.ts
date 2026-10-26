import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { pensionContributions } from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { isPensionAdministrator, ownPensionIdentities, PENSION_ADMIN_ROLES } from '@/lib/pension/pension-authority';
import { z } from 'zod';

const createContributionSchema = z.object({
  memberId: z.guid(),
  memberName: z.string().max(255),
  period: z.string().max(20),
  amount: z.string(),
  paymentStatus: z.enum(['pending', 'received', 'overdue', 'partial']).optional(),
  paymentDate: z.coerce.date().optional(),
});

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'List contributions', description: 'Contributions: your own, or the organization\'s for a pension administrator' },
  },
  async ({ request, organizationId, userId, user }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const url = new URL(request.url);
    const memberId = url.searchParams.get('memberId');

    return withRLSContext({ organizationId }, async (tx) => {
      const conditions = [eq(pensionContributions.organizationId, organizationId)];
      if (isPensionAdministrator(user?.role)) {
        if (memberId) conditions.push(eq(pensionContributions.memberId, memberId));
      } else {
        const own = await ownPensionIdentities(tx, organizationId, userId);
        if (own.length === 0 || (memberId && !own.includes(memberId))) return [];
        conditions.push(inArray(pensionContributions.memberId, memberId ? [memberId] : own));
      }
      return tx.select().from(pensionContributions).where(and(...conditions)).orderBy(desc(pensionContributions.createdAt));
    });
  },
);

export const POST = withApi(
  {
    auth: { required: true, roles: PENSION_ADMIN_ROLES },
    openapi: { tags: ['Pension'], summary: 'Record contribution', description: 'Record a pension contribution (pension administration)' },
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const parsed = createContributionSchema.parse(body);
    return withRLSContext({ organizationId }, async (tx) => {
      const [contribution] = await tx
        .insert(pensionContributions)
        .values({ ...parsed, organizationId })
        .returning();
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'pension.contribution.record',
        resourceType: 'pension_contributions',
        resourceId: contribution.id,
        details: { memberId: parsed.memberId, period: parsed.period, amount: parsed.amount },
      });
      return contribution;
    });
  },
);
