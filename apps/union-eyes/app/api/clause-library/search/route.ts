/**
 * GET POST /api/clause-library/search
 * Direct DB — replaces Django proxy
 *
 * Round 55 (OWNER_PLUS_EXPLICIT_SHARING_AUTHORITY): search results are
 * filtered to only clauses the caller's organization is authorized to read
 * — same visibility rule as the list route, see
 * lib/clause-library/sharing-authority.ts.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sharedClauseLibrary } from '@/db/schema/domains/agreements/shared-library';
import { organizations, congressMemberships } from '@/db/schema';
import { eq, ilike, or, and } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { buildClauseVisibilityCondition } from '@/lib/clause-library/sharing-authority';

export const dynamic = 'force-dynamic';

async function searchClauses(q: string, organizationId: string) {
  return withSystemContext(async () => {
    const visibilityCondition = await buildClauseVisibilityCondition(organizationId);

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
        sourceOrganizationId: sharedClauseLibrary.sourceOrganizationId,
        organizationName: organizations.name,
      })
      .from(sharedClauseLibrary)
      .leftJoin(organizations, eq(sharedClauseLibrary.sourceOrganizationId, organizations.id))
      .leftJoin(
        congressMemberships,
        and(
          eq(congressMemberships.organizationId, sharedClauseLibrary.sourceOrganizationId),
          eq(congressMemberships.status, 'active'),
        ),
      )
      .where(and(
        visibilityCondition,
        or(
          ilike(sharedClauseLibrary.clauseTitle, `%${q}%`),
          ilike(sharedClauseLibrary.clauseText, `%${q}%`),
        ),
      ))
      .limit(50);

    return rows.map((r) => ({
      id: r.id,
      clauseNumber: r.clauseNumber,
      clauseTitle: r.clauseTitle,
      clauseText: r.clauseText,
      clauseType: r.clauseType,
      sharingLevel: r.sharingLevel,
      sector: r.sector,
      province: r.province,
      sourceOrganization: { id: r.sourceOrganizationId, organizationName: r.organizationName },
    }));
  });
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Search clauses by text query' },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || url.searchParams.get('search') || '';
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    if (!q) {
      return { clauses: [] };
    }

    return { clauses: await searchClauses(q, organizationId) };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Search clauses (POST)' },
  },
  async ({ request, organizationId }) => {
    const body = await request.json();
    const q = body.query || body.search || '';
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    if (!q) {
      return { clauses: [] };
    }

    return { clauses: await searchClauses(q, organizationId) };
  },
);

