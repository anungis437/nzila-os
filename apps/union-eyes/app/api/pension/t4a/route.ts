import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { pensionT4aRecords } from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { isPensionAdministrator, ownPensionIdentities, PENSION_ADMIN_ROLES } from '@/lib/pension/pension-authority';
import { z } from 'zod';

// Filing or amending a tax record with the tax authority is a separate act that is not implemented; a generated
// record is a draft or a generated slip, never marked as filed.
const createT4aSchema = z.object({
  memberId: z.string().uuid(),
  memberName: z.string().max(255),
  taxYear: z.number().int().min(1900).max(2100),
  pensionIncome: z.string(),
  status: z.enum(['draft', 'generated']).optional(),
  generatedDate: z.coerce.date().optional(),
});

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'List T4A records', description: 'T4A records: your own, or the organization\'s for a pension administrator' },
  },
  async ({ request, organizationId, userId, user }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const url = new URL(request.url);
    const memberId = url.searchParams.get('memberId');

    return withRLSContext({ organizationId }, async (tx) => {
      const conditions = [eq(pensionT4aRecords.organizationId, organizationId)];
      if (isPensionAdministrator(user?.role)) {
        if (memberId) conditions.push(eq(pensionT4aRecords.memberId, memberId));
      } else {
        const own = await ownPensionIdentities(tx, organizationId, userId);
        if (own.length === 0 || (memberId && !own.includes(memberId))) return [];
        conditions.push(inArray(pensionT4aRecords.memberId, memberId ? [memberId] : own));
      }
      return tx.select().from(pensionT4aRecords).where(and(...conditions)).orderBy(desc(pensionT4aRecords.createdAt));
    });
  },
);

export const POST = withApi(
  {
    auth: { required: true, roles: PENSION_ADMIN_ROLES },
    openapi: { tags: ['Pension'], summary: 'Generate T4A record', description: 'Generate a T4A tax record (pension administration)' },
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const parsed = createT4aSchema.parse(body);
    return withRLSContext({ organizationId }, async (tx) => {
      const [record] = await tx
        .insert(pensionT4aRecords)
        .values({ ...parsed, organizationId })
        .returning();
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'pension.t4a.generate',
        resourceType: 'pension_t4a_records',
        resourceId: record.id,
        details: { memberId: parsed.memberId, taxYear: parsed.taxYear },
      });
      return record;
    });
  },
);
