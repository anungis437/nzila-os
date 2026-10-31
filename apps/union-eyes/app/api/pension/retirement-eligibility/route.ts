/**
 * GET /api/pension/retirement-eligibility — pension members of the caller's organization whose years of service meet a
 * threshold.
 *
 * The list names every enrolled member with their plan, years of service and vesting, so it is a pension
 * administrator's record, not a member's: it was open at the member floor and returned whole rows. It now needs an
 * officer, returns an allow-listed projection, validates and bounds its inputs, runs in the tenant context, and records
 * who read it in the same transaction.
 *
 * It applies no eligibility rule: no plan in the source defines one. The caller must name the years-of-service threshold (the earlier
 * silent default of 25 is removed) and the answer says it is a years-of-service filter, not a determination of eligibility.
 */
import { and, desc, eq, gte } from 'drizzle-orm';
import { pensionMembers } from '@/db/schema';
import { withApi, ApiError, z } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export const dynamic = 'force-dynamic';

const MAX_ROWS = 500;

const querySchema = z.object({
  threshold: z.coerce.number().min(1).max(60),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    openapi: { tags: ['Pension'], summary: 'List pension members at or above a years-of-service threshold', description: 'A years-of-service filter the caller parameterizes; it does not determine retirement eligibility' },
  },
  async ({ request, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const raw = new URL(request.url).searchParams.get('threshold');
    const parsed = querySchema.safeParse({ threshold: raw ?? undefined });
    if (!parsed.success) throw ApiError.badRequest('threshold (years of service) is required and must be a number between 1 and 60');
    const { threshold } = parsed.data;

    return withRLSContext({ organizationId, userId }, async (tx) => {
      const rows = await tx
        .select({
          id: pensionMembers.id,
          name: pensionMembers.name,
          planName: pensionMembers.planName,
          membershipStatus: pensionMembers.membershipStatus,
          yearsOfService: pensionMembers.yearsOfService,
          vestingStatus: pensionMembers.vestingStatus,
          enrollmentDate: pensionMembers.enrollmentDate,
        })
        .from(pensionMembers)
        .where(and(eq(pensionMembers.organizationId, organizationId), gte(pensionMembers.yearsOfService, String(threshold))))
        .orderBy(desc(pensionMembers.yearsOfService), desc(pensionMembers.id))
        .limit(MAX_ROWS);

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'pension.retirement_eligibility.read',
        resourceType: 'pension_members',
        resourceId: organizationId,
        details: { threshold, rows: rows.length },
      });
      return { data: rows, threshold, limit: MAX_ROWS, basis: 'YEARS_OF_SERVICE_FILTER_NOT_AN_ELIGIBILITY_DETERMINATION' as const };
    });
  },
);
