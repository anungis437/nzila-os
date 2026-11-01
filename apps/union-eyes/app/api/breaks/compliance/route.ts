/**
 * Organization-level break compliance summary.
 * Individual break self-reports are private to their submitting members.
 * Steward access to this endpoint does not imply access to a member's records.
 * Counts are self-reported, not employer-verified compliance findings.
 */
import { withApi } from '@/lib/api/with-api';
import { memberBreaks } from '@/db/schema';
import { sql, eq } from 'drizzle-orm';
import { ApiError } from '@/lib/api/errors';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export const dynamic = 'force-dynamic';
const MIN_COHORT_SIZE = 5;

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Breaks'],
      summary: 'Privacy-protected organization break self-report totals',
      description: 'Organization totals only, suppressed for cohorts below five reporting members. No individual member records are returned.',
    },
  },
  async ({ organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Active organization and actor required');

    return withRLSContext({ organizationId, userId }, async (tx) => {
      const rows = await tx
        .select({
          reportingMembers: sql<number>`count(distinct ${memberBreaks.memberId})::int`,
          total: sql<number>`count(*)::int`,
          denied: sql<number>`count(*) filter (where ${memberBreaks.status} = 'denied')::int`,
          missed: sql<number>`count(*) filter (where ${memberBreaks.status} = 'missed')::int`,
          shortened: sql<number>`count(*) filter (where ${memberBreaks.status} = 'shortened')::int`,
          taken: sql<number>`count(*) filter (where ${memberBreaks.status} = 'taken')::int`,
          flagged: sql<number>`count(*) filter (where ${memberBreaks.complianceFlag} = true)::int`,
        })
        .from(memberBreaks)
        .where(eq(memberBreaks.organizationId, organizationId));

      const row = rows[0];
      const reportingMembers = Number(row?.reportingMembers ?? 0);
      const suppressed = reportingMembers > 0 && reportingMembers < MIN_COHORT_SIZE;
      const data = !row || reportingMembers === 0 || suppressed ? [] : [{
        scope: 'organization' as const,
        reportingMembers,
        total: Number(row.total ?? 0),
        denied: Number(row.denied ?? 0),
        missed: Number(row.missed ?? 0),
        shortened: Number(row.shortened ?? 0),
        taken: Number(row.taken ?? 0),
        flagged: Number(row.flagged ?? 0),
      }];

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'member.break.compliance.aggregate.read',
        resourceType: 'member_breaks',
        details: { suppressed, aggregateOnly: true, minimumCohortSize: MIN_COHORT_SIZE },
      });

      return {
        data,
        scope: 'organization',
        suppressed,
        minimumCohortSize: MIN_COHORT_SIZE,
        basis: 'member_self_reports_not_employer_verified',
      };
    });
  },
);
