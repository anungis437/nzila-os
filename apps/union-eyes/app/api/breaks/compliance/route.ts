/**
 * Break Compliance Summary
 *
 * GET /api/breaks/compliance — aggregated break compliance stats for the org
 *
 * Returns counts of denied, missed, and shortened breaks grouped by member,
 * useful for stewards and officers reviewing employer compliance.
 */
import { withApi } from '@/lib/api/with-api';
import { db } from '@/db/db';
import { memberBreaks } from '@/db/schema';
import { sql, eq } from 'drizzle-orm';
import { ApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Breaks'],
      summary: 'Break compliance summary',
      description: 'Aggregated break compliance statistics — denied, missed, and shortened breaks per member.',
    },
  },
  async ({ organizationId }) => {
    if (!organizationId) {
      throw ApiError.badRequest('No active organization');
    }

    const rows = await db
      .select({
        memberId: memberBreaks.memberId,
        total: sql<number>`count(*)::int`,
        denied: sql<number>`count(*) filter (where ${memberBreaks.status} = 'denied')::int`,
        missed: sql<number>`count(*) filter (where ${memberBreaks.status} = 'missed')::int`,
        shortened: sql<number>`count(*) filter (where ${memberBreaks.status} = 'shortened')::int`,
        taken: sql<number>`count(*) filter (where ${memberBreaks.status} = 'taken')::int`,
        flagged: sql<number>`count(*) filter (where ${memberBreaks.complianceFlag} = true)::int`,
      })
      .from(memberBreaks)
      .where(eq(memberBreaks.organizationId, organizationId))
      .groupBy(memberBreaks.memberId);

    return { data: rows };
  },
);
