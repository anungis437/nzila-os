/**
 * GET POST /api/agreements
 * CRUD for collective bargaining agreements (org-scoped)
 */
import { ApiError, withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { collectiveAgreements } from '@/db/schema';
import { eq, ilike, and, or, sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export const dynamic = 'force-dynamic';

const AGREEMENT_STATUSES = ['active', 'expired', 'under_negotiation', 'ratified_pending', 'archived'];

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Agreements'],
      summary: 'List collective agreements for the organization',
    },
  },
  async ({ request, organizationId }) => {
    if (!organizationId) {
      throw ApiError.badRequest('No active organization. Please select an organization and try again.');
    }

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
    const search = url.searchParams.get('search') || '';
    const status = url.searchParams.get('status') || '';
    const type = url.searchParams.get('type') || '';

    return await withRLSContext({ organizationId }, async () => {
      const conditions: ReturnType<typeof eq>[] = [];
      conditions.push(eq(collectiveAgreements.organizationId, organizationId));

      if (search) {
        conditions.push(
          or(
            ilike(collectiveAgreements.title, `%${search}%`),
            ilike(collectiveAgreements.employerName, `%${search}%`),
            ilike(collectiveAgreements.unionName, `%${search}%`),
            ilike(collectiveAgreements.bargainingUnitDescription, `%${search}%`),
          )!,
        );
      }

      if (status) {
        conditions.push(eq(collectiveAgreements.status, status as 'active' | 'expired' | 'under_negotiation' | 'ratified_pending' | 'archived'));
      }

      if (type) {
        conditions.push(ilike(collectiveAgreements.industrySector, `%${type}%`));
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, countResult] = await Promise.all([
        db
          .select()
          .from(collectiveAgreements)
          .where(where)
          .orderBy(collectiveAgreements.effectiveDate)
          .limit(limit)
          .offset((page - 1) * limit),
        db.select({ count: sql<number>`count(*)::int` }).from(collectiveAgreements).where(where),
      ]);

      const total = countResult[0]?.count ?? 0;

      return {
        data: rows,
        pagination: {
          total,
          totalPages: Math.ceil(total / limit),
          currentPage: page,
          limit,
        },
      };
    });
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Agreements'],
      summary: 'Create a new collective agreement',
    },
  },
  async ({ request, userId, organizationId }) => {
    if (!organizationId) {
      throw ApiError.badRequest('No active organization. Please select an organization and try again.');
    }
    if (!userId) {
      throw ApiError.badRequest('Authenticated user is required to create an agreement.');
    }

    const body = await request.json();
    const status = body.status ?? 'active';
    if (!AGREEMENT_STATUSES.includes(status)) {
      throw ApiError.badRequest('Invalid agreement status.');
    }

    return await withRLSContext({ organizationId }, async (tx) => {
      const [created] = await tx
        .insert(collectiveAgreements)
        .values({
          organizationId,
          cbaNumber: body.cbaNumber,
          title: body.title,
          jurisdiction: body.jurisdiction,
          language: body.language ?? 'en',
          employerName: body.employerName,
          employerId: body.employerId ?? null,
          unionName: body.unionName,
          unionLocal: body.unionLocal ?? null,
          unionId: body.unionId ?? null,
          effectiveDate: body.effectiveDate,
          expiryDate: body.expiryDate,
          signedDate: body.signedDate ?? null,
          ratificationDate: body.ratificationDate ?? null,
          industrySector: body.industrySector,
          sector: body.sector ?? null,
          employeeCoverage: body.employeeCoverage ?? null,
          bargainingUnitDescription: body.bargainingUnitDescription ?? null,
          documentUrl: body.documentUrl ?? null,
          status,
          // Publishing an agreement beyond the organization is not decided at creation time.
          isPublic: false,
          createdBy: userId,
          lastModifiedBy: userId,
        })
        .returning();

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'agreement.create',
        resourceType: 'collective_agreements',
        resourceId: created.id,
        details: { cbaNumber: created.cbaNumber, status: created.status },
      });

      return { data: created };
    });
  },
);
