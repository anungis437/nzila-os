/**
 * GET POST /api/clause-library
 * Direct DB — replaces Django proxy
 *
 * Round 55 (OWNER_PLUS_EXPLICIT_SHARING_AUTHORITY): LIST results are
 * filtered to only clauses the caller's organization is authorized to read
 * (owner, or a sharingLevel that grants it — see lib/clause-library/sharing-authority.ts).
 * CREATE always stamps sourceOrganizationId from the authenticated caller's
 * organization, never from the request body (prevents ownership spoofing).
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sharedClauseLibrary } from '@/db/schema/domains/agreements/shared-library';
import { collectiveAgreements } from '@/db/schema';
import { eq, ilike, inArray, sql, and, or, gte, isNull } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { buildClauseVisibilityCondition, sharingChangeDenial, sourceNamesFor } from '@/lib/clause-library/sharing-authority';
import { parseClauseBody, assertMayPublish } from '@/lib/clause-library/clause-body';
import { assertOriginalClauseOwned } from '@/lib/clause-library/original-clause';
import { clauseSourceProjection } from '@/lib/clause-library/source-projection';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Clause-library'],
      summary: 'List shared clauses with filters and pagination',
    },
  },
  async ({ request, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const search = url.searchParams.get('search') || '';
    const clauseTypes = url.searchParams.get('clauseTypes')?.split(',').filter(Boolean) || [];
    const sectors = url.searchParams.get('sectors')?.split(',').filter(Boolean) || [];
    const provinces = url.searchParams.get('provinces')?.split(',').filter(Boolean) || [];
    const sharingLevels = url.searchParams.get('sharingLevels')?.split(',').filter(Boolean) || [];
    const includeExpired = url.searchParams.get('includeExpired') === 'true';

    // The tenant policy admits the owner, explicit grants and public clauses, and the predicate below states the same rule, so this read runs as the
    // tenant like every other and the item read asks the same question. CREATE is an owner write.
    return await withRLSContext({ organizationId }, async () => {
      const visibilityCondition = await buildClauseVisibilityCondition(organizationId);
      const conditions: ReturnType<typeof eq>[] = [visibilityCondition];

      if (search) {
        conditions.push(
          or(
            ilike(sharedClauseLibrary.clauseTitle, `%${search}%`),
            ilike(sharedClauseLibrary.clauseText, `%${search}%`),
          )!,
        );
      }
      if (clauseTypes.length > 0) {
        conditions.push(inArray(sharedClauseLibrary.clauseType, clauseTypes));
      }
      if (sectors.length > 0) {
        conditions.push(inArray(sharedClauseLibrary.sector, sectors));
      }
      if (provinces.length > 0) {
        conditions.push(inArray(sharedClauseLibrary.province, provinces));
      }
      if (sharingLevels.length > 0) {
        conditions.push(inArray(sharedClauseLibrary.sharingLevel, sharingLevels));
      }
      if (!includeExpired) {
        conditions.push(
          or(
            isNull(sharedClauseLibrary.expiryDate),
            gte(sharedClauseLibrary.expiryDate, sql`CURRENT_DATE`),
          )!,
        );
      }

      const where = and(...conditions);

      const [rows, countResult] = await Promise.all([
        db
          .select({
            id: sharedClauseLibrary.id,
            clauseNumber: sharedClauseLibrary.clauseNumber,
            clauseTitle: sharedClauseLibrary.clauseTitle,
            clauseText: sharedClauseLibrary.clauseText,
            clauseType: sharedClauseLibrary.clauseType,
            sharingLevel: sharedClauseLibrary.sharingLevel,
            isAnonymized: sharedClauseLibrary.isAnonymized,
            sector: sharedClauseLibrary.sector,
            province: sharedClauseLibrary.province,
            effectiveDate: sharedClauseLibrary.effectiveDate,
            expiryDate: sharedClauseLibrary.expiryDate,
            viewCount: sharedClauseLibrary.viewCount,
            sourceOrganizationId: sharedClauseLibrary.sourceOrganizationId,
            createdAt: sharedClauseLibrary.createdAt,
          })
          .from(sharedClauseLibrary)
          .where(where)
          .orderBy(sharedClauseLibrary.createdAt)
          .limit(limit)
          .offset((page - 1) * limit),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(sharedClauseLibrary)
          .where(where),
      ]);

      const total = countResult[0]?.count ?? 0;
      const sourceNames = await sourceNamesFor(rows, organizationId);
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
        viewCount: r.viewCount,
        // A shared anonymized clause must not reveal its source union by
        // returning the organization id/name in the collection response.
        sourceOrganization: clauseSourceProjection({ ...r, organizationName: sourceNames.get(r.sourceOrganizationId) ?? null }, organizationId),
        createdAt: r.createdAt,
      }));

      return {
        clauses,
        total,
        page,
        limit,
        pagination: { totalPages: Math.ceil(total / limit), currentPage: page, total },
      };
    });
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Clause-library'],
      summary: 'Create a new shared clause',
    },
  },
  async ({ request, userId, organizationId, user }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    if (!userId) throw ApiError.badRequest('Authenticated user is required to create a clause.');
    const body = parseClauseBody(await request.json().catch(() => null), 'create');
    assertMayPublish(user?.role, body.sharingLevel);

    const denial = await withRLSContext({ organizationId }, () =>
      sharingChangeDenial(organizationId, {
        sharingLevel: body.sharingLevel,
        sharedWithOrgIds: body.sharedWithOrgIds,
      }),
    );
    if (denial) {
      throw denial.status === 403 ? ApiError.forbidden(denial.message) : ApiError.badRequest(denial.message);
    }

    return await withRLSContext({ organizationId }, async (tx) => {
      if (body.sourceCbaId) {
        const [agreement] = await tx
          .select({ id: collectiveAgreements.id })
          .from(collectiveAgreements)
          .where(and(eq(collectiveAgreements.id, body.sourceCbaId), eq(collectiveAgreements.organizationId, organizationId)))
          .limit(1);
        if (!agreement) throw ApiError.notFound('agreement', body.sourceCbaId);
      }
      await assertOriginalClauseOwned(tx, body.originalClauseId, organizationId);

      const [created] = await tx
        .insert(sharedClauseLibrary)
        .values({
          // sourceOrganizationId is ALWAYS the authenticated caller's own
          // organization — never taken from the request body (round 55
          // fix: the prior code trusted body.sourceOrganizationId, letting
          // any steward create a clause "owned" by an arbitrary org).
          sourceOrganizationId: organizationId,
          sourceCbaId: body.sourceCbaId ?? null,
          originalClauseId: body.originalClauseId ?? null,
          clauseNumber: body.clauseNumber ?? null,
          clauseTitle: body.clauseTitle,
          clauseText: body.clauseText,
          clauseType: body.clauseType,
          isAnonymized: body.isAnonymized ?? false,
          originalEmployerName: body.originalEmployerName ?? null,
          anonymizedEmployerName: body.anonymizedEmployerName ?? null,
          sharingLevel: body.sharingLevel ?? 'private',
          sharedWithOrgIds: body.sharedWithOrgIds ?? null,
          effectiveDate: body.effectiveDate ?? null,
          expiryDate: body.expiryDate ?? null,
          sector: body.sector ?? null,
          province: body.province ?? null,
          createdBy: userId,
        })
        .returning();

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'clause_library.create',
        resourceType: 'shared_clause_library',
        resourceId: created.id,
        details: { clauseType: created.clauseType, sharingLevel: created.sharingLevel, sourceCbaId: created.sourceCbaId ?? null },
      });

      return { success: true, clause: created };
    });
  },
);

