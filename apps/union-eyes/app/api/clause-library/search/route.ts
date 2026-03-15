/**
 * GET /api/clause-library/search
 * Direct DB — replaces Django proxy
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sharedClauseLibrary } from '@/db/schema/domains/agreements/shared-library';
import { organizations } from '@/db/schema-organizations';
import { eq, ilike, or } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Search clauses by text query' },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q') || url.searchParams.get('search') || '';

    if (!q) {
      return { clauses: [] };
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
          sourceOrganizationId: sharedClauseLibrary.sourceOrganizationId,
          organizationName: organizations.name,
        })
        .from(sharedClauseLibrary)
        .leftJoin(organizations, eq(sharedClauseLibrary.sourceOrganizationId, organizations.id))
        .where(or(
          ilike(sharedClauseLibrary.clauseTitle, `%${q}%`),
          ilike(sharedClauseLibrary.clauseText, `%${q}%`),
        ))
        .limit(50);

      const clauses = rows.map((r) => ({
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

      return { clauses };
    });
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Search clauses (POST)' },
  },
  async ({ request }) => {
    const body = await request.json();
    const q = body.query || body.search || '';

    if (!q) {
      return { clauses: [] };
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
          sourceOrganizationId: sharedClauseLibrary.sourceOrganizationId,
          organizationName: organizations.name,
        })
        .from(sharedClauseLibrary)
        .leftJoin(organizations, eq(sharedClauseLibrary.sourceOrganizationId, organizations.id))
        .where(or(
          ilike(sharedClauseLibrary.clauseTitle, `%${q}%`),
          ilike(sharedClauseLibrary.clauseText, `%${q}%`),
        ))
        .limit(50);

      const clauses = rows.map((r) => ({
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

      return { clauses };
    });
  },
);

