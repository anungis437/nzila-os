import { withApi, ApiError } from '@/lib/api/framework';
import { listPage } from '@/lib/api/list-page';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { pensionContributions, pensionMembers } from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { isPensionAdministrator, ownPensionIdentities, PENSION_ADMIN_ROLES } from '@/lib/pension/pension-authority';
import { z } from 'zod';

const createContributionSchema = z.object({
  memberId: z.guid(),
  // The member's name is read from the pension member row, not taken from the request; it is accepted and ignored for compatibility.
  memberName: z.string().max(255).optional(),
  period: z.string().trim().min(1).max(20),
  amount: z.string().regex(/^(?!0+(\.0+)?$)\d{1,10}(\.\d{1,2})?$/, 'amount must be a positive amount with at most two decimals'),
  paymentStatus: z.enum(['pending', 'received', 'overdue', 'partial']).optional(),
  paymentDate: z.coerce.date().optional(),
});

export const dynamic = 'force-dynamic';

// A list answers at most this many rows per page; offset pages through the rest.
const LIST_LIMIT = 200;

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'List contributions', description: 'Contributions: your own, or the organization\'s for a pension administrator' },
  },
  async ({ request, organizationId, userId, user }) => {
    const page = listPage(request, LIST_LIMIT);
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
      return tx.select().from(pensionContributions).where(and(...conditions)).orderBy(desc(pensionContributions.createdAt)).limit(page.limit).offset(page.offset);
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
      // The member must be a pension member of this organization; a contribution cannot be recorded against an id that names no one
      // here, or under a name the caller typed.
      const [member] = await tx
        .select({ id: pensionMembers.id, name: pensionMembers.name })
        .from(pensionMembers)
        .where(and(eq(pensionMembers.id, parsed.memberId), eq(pensionMembers.organizationId, organizationId)))
        .limit(1);
      if (!member) throw ApiError.notFound('Pension member');
      const [contribution] = await tx
        .insert(pensionContributions)
        .values({ ...parsed, memberName: member.name, organizationId })
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
