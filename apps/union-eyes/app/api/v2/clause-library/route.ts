/**
 * GET POST /api/v2/clause-library
 * Direct DB — replaces Django proxy
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sharedClauseLibrary } from '@/db/schema/domains/agreements/shared-library';
import { organizations } from '@/db/schema-organizations';
import { eq, ilike, inArray, sql, and, or, gte, isNull } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'List shared clauses with filters and pagination' },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const search = url.searchParams.get('search') || '';
    const clauseTypes = url.searchParams.get('clauseTypes')?.split(',').filter(Boolean) || [];
    const sectors = url.searchParams.get('sectors')?.split(',').filter(Boolean) || [];
    const provinces = url.searchParams.get('provinces')?.split(',').filter(Boolean) || [];
    const sharingLevels = url.searchParams.get('sharingLevels')?.split(',').filter(Boolean) || [];
    const includeExpired = url.searchParams.get('includeExpired') === 'true';

    return withSystemContext(async () => {
      const conditions: ReturnType<typeof eq>[] = [];
      if (search) {
        conditions.push(or(ilike(sharedClauseLibrary.clauseTitle, `%${search}%`), ilike(sharedClauseLibrary.clauseText, `%${search}%`))!);
      }
      if (clauseTypes.length > 0) conditions.push(inArray(sharedClauseLibrary.clauseType, clauseTypes));
      if (sectors.length > 0) conditions.push(inArray(sharedClauseLibrary.sector, sectors));
      if (provinces.length > 0) conditions.push(inArray(sharedClauseLibrary.province, provinces));
      if (sharingLevels.length > 0) conditions.push(inArray(sharedClauseLibrary.sharingLevel, sharingLevels));
      if (!includeExpired) {
        conditions.push(or(isNull(sharedClauseLibrary.expiryDate), gte(sharedClauseLibrary.expiryDate, sql`CURRENT_DATE`))!);
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, countResult] = await Promise.all([
        db.select({
          id: sharedClauseLibrary.id, clauseNumber: sharedClauseLibrary.clauseNumber,
          clauseTitle: sharedClauseLibrary.clauseTitle, clauseText: sharedClauseLibrary.clauseText,
          clauseType: sharedClauseLibrary.clauseType, sharingLevel: sharedClauseLibrary.sharingLevel,
          sector: sharedClauseLibrary.sector, province: sharedClauseLibrary.province,
          effectiveDate: sharedClauseLibrary.effectiveDate, expiryDate: sharedClauseLibrary.expiryDate,
          viewCount: sharedClauseLibrary.viewCount, sourceOrganizationId: sharedClauseLibrary.sourceOrganizationId,
          organizationName: organizations.name, createdAt: sharedClauseLibrary.createdAt,
        }).from(sharedClauseLibrary)
          .leftJoin(organizations, eq(sharedClauseLibrary.sourceOrganizationId, organizations.id))
          .where(where).orderBy(sharedClauseLibrary.createdAt).limit(limit).offset((page - 1) * limit),
        db.select({ count: sql<number>`count(*)::int` }).from(sharedClauseLibrary).where(where),
      ]);

      const total = countResult[0]?.count ?? 0;
      const clauses = rows.map((r) => ({
        id: r.id, clauseNumber: r.clauseNumber, clauseTitle: r.clauseTitle, clauseText: r.clauseText,
        clauseType: r.clauseType, sharingLevel: r.sharingLevel, sector: r.sector, province: r.province,
        effectiveDate: r.effectiveDate, expiryDate: r.expiryDate, viewCount: r.viewCount,
        sourceOrganization: { id: r.sourceOrganizationId, organizationName: r.organizationName },
        createdAt: r.createdAt,
      }));

      return { clauses, total, page, limit, pagination: { totalPages: Math.ceil(total / limit), currentPage: page, total } };
    });
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Create a new shared clause' },
  },
  async ({ request, userId }) => {
    const body = await request.json();
    return withSystemContext(async () => {
      const [created] = await db.insert(sharedClauseLibrary).values({
        sourceOrganizationId: body.sourceOrganizationId,
        sourceCbaId: body.sourceCbaId ?? null, originalClauseId: body.originalClauseId ?? null,
        clauseNumber: body.clauseNumber ?? null, clauseTitle: body.clauseTitle,
        clauseText: body.clauseText, clauseType: body.clauseType,
        isAnonymized: body.isAnonymized ?? false, originalEmployerName: body.originalEmployerName ?? null,
        anonymizedEmployerName: body.anonymizedEmployerName ?? null,
        sharingLevel: body.sharingLevel ?? 'private', sharedWithOrgIds: body.sharedWithOrgIds ?? null,
        effectiveDate: body.effectiveDate ?? null, expiryDate: body.expiryDate ?? null,
        sector: body.sector ?? null, province: body.province ?? null,
        createdBy: userId || 'system',
      }).returning();
      return { success: true, clause: created };
    });
  },
);
