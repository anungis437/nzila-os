/**
 * POST /api/clause-library/compare
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
    openapi: { tags: ['Clause-library'], summary: 'Compare endpoint (GET stub)' },
  },
  async () => {
    return { message: 'Use POST with clauseIds array to compare clauses' };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Compare multiple clauses' },
  },
  async ({ request }) => {
    const body = await request.json();
    const { clauseIds } = body;

    if (!clauseIds || !Array.isArray(clauseIds) || clauseIds.length < 2) {
      throw ApiError.badRequest('At least 2 clause IDs are required');
    }

    if (clauseIds.length > 10) {
      throw ApiError.badRequest('Maximum 10 clauses can be compared at once');
    }

    return withSystemContext(async () => {
      const rows = await db
        .select({
          id: sharedClauseLibrary.id,
          clauseNumber: sharedClauseLibrary.clauseNumber,
          clauseTitle: sharedClauseLibrary.clauseTitle,
          clauseText: sharedClauseLibrary.clauseText,
          clauseType: sharedClauseLibrary.clauseType,
          sharingLevel: sharedClauseLibrary.sharingLevel,
          sector: sharedClauseLibrary.sector,
          province: sharedClauseLibrary.province,
          effectiveDate: sharedClauseLibrary.effectiveDate,
          expiryDate: sharedClauseLibrary.expiryDate,
          sourceOrganizationId: sharedClauseLibrary.sourceOrganizationId,
          organizationName: organizations.name,
        })
        .from(sharedClauseLibrary)
        .leftJoin(organizations, eq(sharedClauseLibrary.sourceOrganizationId, organizations.id))
        .where(inArray(sharedClauseLibrary.id, clauseIds));

      // Fetch tags for all clauses
      const allTags = await db
        .select()
        .from(clauseLibraryTags)
        .where(inArray(clauseLibraryTags.clauseId, clauseIds));

      const clauses = rows.map((r) => ({
        id: r.id,
        clauseNumber: r.clauseNumber,
        clauseTitle: r.clauseTitle,
        clauseText: r.clauseText,
        clauseType: r.clauseType,
        sharingLevel: r.sharingLevel,
        sector: r.sector,
        province: r.province,
        effectiveDate: r.effectiveDate,
        expiryDate: r.expiryDate,
        sourceOrganization: { id: r.sourceOrganizationId, organizationName: r.organizationName },
        tags: allTags.filter((t) => t.clauseId === r.id).map((t) => ({ tagName: t.tagName })),
      }));

      // Increment comparison count
      await db
        .update(sharedClauseLibrary)
        .set({ comparisonCount: sql`${sharedClauseLibrary.comparisonCount} + 1` })
        .where(inArray(sharedClauseLibrary.id, clauseIds));

      // Basic analysis
      const types = new Set(clauses.map((c) => c.clauseType));
      const sectorSet = new Set(clauses.map((c) => c.sector).filter(Boolean));
      const totalTextLength = clauses.reduce((sum, c) => sum + (c.clauseText?.length || 0), 0);

      return {
        clauses,
        analysis: {
          statistics: {
            totalClauses: clauses.length,
            averageTextLength: clauses.length > 0 ? Math.round(totalTextLength / clauses.length) : 0,
            uniqueTypes: types.size,
            uniqueSectors: sectorSet.size,
          },
          commonKeywords: [],
        },
      };
    });
  },
);

