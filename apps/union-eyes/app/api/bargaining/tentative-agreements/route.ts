/**
 * CRUD collection route for tentativeAgreements
 *
 * tentativeAgreements has no organization_id column of its own — authority
 * is derived entirely through negotiation_id -> negotiations.organization_id.
 * lib/api/crud-factory.ts's orgScoped flag only filters a table's OWN
 * organizationId column; on a table without one (like this), orgScoped:true
 * silently becomes a no-op, exposing every organization's tentative
 * agreements to any authenticated member. Replaced with an explicit
 * parent-verified implementation.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { tentativeAgreements, negotiations } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Bargaining'],
      summary: 'List tentativeAgreements',
      description: 'Returns a paginated list of tentativeAgreements for the organization.',
    },
  },
  async ({ request, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));

    const whereClause = eq(negotiations.organizationId, organizationId);

    const [rows, totalResult] = await Promise.all([
      db
        .select({ tentativeAgreement: tentativeAgreements })
        .from(tentativeAgreements)
        .innerJoin(negotiations, eq(negotiations.id, tentativeAgreements.negotiationId))
        .where(whereClause)
        .orderBy(desc(tentativeAgreements.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(tentativeAgreements)
        .innerJoin(negotiations, eq(negotiations.id, tentativeAgreements.negotiationId))
        .where(whereClause),
    ]);

    const total = totalResult[0]?.total ?? 0;

    return {
      data: rows.map((r) => r.tentativeAgreement),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Bargaining'],
      summary: 'Create tentativeAgreement',
      description: 'Creates a new tentativeAgreement record.',
    },
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const values =
      body && typeof body === 'object' && !Array.isArray(body)
        ? { ...(body as Record<string, unknown>) }
        : {};

    const negotiationId = values.negotiationId;
    if (typeof negotiationId !== 'string' || !negotiationId) {
      throw ApiError.badRequest('negotiationId is required');
    }

    const [negotiation] = await db
      .select({ id: negotiations.id })
      .from(negotiations)
      .where(and(eq(negotiations.id, negotiationId), eq(negotiations.organizationId, organizationId)));
    if (!negotiation) {
      throw ApiError.badRequest('negotiationId does not belong to this organization');
    }

    if (userId) values.createdBy = userId;

    const [row] = await db.insert(tentativeAgreements).values(values as typeof tentativeAgreements.$inferInsert).returning();
    return { data: row };
  },
);

