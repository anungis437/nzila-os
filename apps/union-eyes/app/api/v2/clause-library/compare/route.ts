/**
 * GET POST /api/v2/clause-library/compare
 * Direct DB — replaces Django proxy
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sharedClauseLibrary, clauseLibraryTags } from '@/db/schema/domains/agreements/shared-library';
import { organizations } from '@/db/schema-organizations';
import { eq, inArray, sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Comparison info' },
  },
  async () => {
    return { message: 'Use POST with clauseIds to compare clauses' };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Compare multiple clauses' },
  },
  async ({ request }) => {
    const body = await request.json();
    const clauseIds: string[] = body.clauseIds || [];
    if (clauseIds.length < 2 || clauseIds.length > 10) {
      throw ApiError.badRequest('Provide 2-10 clauseIds');
    }

    return withSystemContext(async () => {
      const clauses = await db.select({
        id: sharedClauseLibrary.id, clauseNumber: sharedClauseLibrary.clauseNumber,
        clauseTitle: sharedClauseLibrary.clauseTitle, clauseText: sharedClauseLibrary.clauseText,
        clauseType: sharedClauseLibrary.clauseType, sector: sharedClauseLibrary.sector,
        province: sharedClauseLibrary.province, sourceOrganizationId: sharedClauseLibrary.sourceOrganizationId,
        organizationName: organizations.name,
      }).from(sharedClauseLibrary)
        .leftJoin(organizations, eq(sharedClauseLibrary.sourceOrganizationId, organizations.id))
        .where(inArray(sharedClauseLibrary.id, clauseIds));

      const tags = await db.select().from(clauseLibraryTags).where(inArray(clauseLibraryTags.clauseId, clauseIds));
      const tagMap = new Map<string, string[]>();
      for (const t of tags) {
        if (!tagMap.has(t.clauseId)) tagMap.set(t.clauseId, []);
        tagMap.get(t.clauseId)!.push(t.tagName);
      }

      await db.update(sharedClauseLibrary).set({ comparisonCount: sql`${sharedClauseLibrary.comparisonCount} + 1` }).where(inArray(sharedClauseLibrary.id, clauseIds));

      const result = clauses.map((c) => ({
        ...c, sourceOrganization: { id: c.sourceOrganizationId, organizationName: c.organizationName },
        tags: tagMap.get(c.id) || [],
      }));

      return {
        clauses: result,
        analysis: {
          totalClauses: result.length,
          averageTextLength: Math.round(result.reduce((s, c) => s + (c.clauseText?.length || 0), 0) / result.length),
          uniqueTypes: [...new Set(result.map((c) => c.clauseType))],
          uniqueSectors: [...new Set(result.map((c) => c.sector).filter(Boolean))],
        },
      };
    });
  },
);
