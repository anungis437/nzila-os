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
import { agreementCreateSchema } from '@/lib/agreements/agreement-input';
import { isUniqueViolation } from '@/lib/db/unique-violation';

export const dynamic = 'force-dynamic';

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
    // A non-numeric value is the default: NaN never reaches the query.
    const page = Math.min(10_000, Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1));
    const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50));
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

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      throw ApiError.badRequest('Request body must be valid JSON.');
    }
    const parsed = agreementCreateSchema.safeParse(raw);
    if (!parsed.success) {
      throw ApiError.badRequest('Invalid agreement.', { issues: parsed.error.issues.slice(0, 5).map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`) });
    }
    const body = parsed.data;
    const status = body.status;

    try {
    return await withRLSContext({ organizationId }, async (tx) => {
      const [created] = await tx
        .insert(collectiveAgreements)
        .values({
          organizationId,
          cbaNumber: body.cbaNumber,
          title: body.title,
          jurisdiction: body.jurisdiction,
          language: body.language,
          employerName: body.employerName,
          employerId: body.employerId,
          unionName: body.unionName,
          unionLocal: body.unionLocal,
          unionId: body.unionId,
          effectiveDate: body.effectiveDate,
          expiryDate: body.expiryDate,
          signedDate: body.signedDate,
          ratificationDate: body.ratificationDate,
          industrySector: body.industrySector,
          sector: body.sector,
          employeeCoverage: body.employeeCoverage,
          bargainingUnitDescription: body.bargainingUnitDescription,
          documentUrl: body.documentUrl,
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
    } catch (error) {
      // The agreement number is unique across the platform; a duplicate is a conflict, not a server fault.
      if (isUniqueViolation(error)) throw ApiError.conflict('An agreement with that number already exists.');
      throw error;
    }
  },
);
