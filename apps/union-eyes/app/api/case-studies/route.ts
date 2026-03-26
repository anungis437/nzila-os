/**
 * CRUD collection route for case studies
 * GET is public (marketing pages), POST requires admin auth.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { withApi } from '@/lib/api/with-api';
import { db } from '@/db/db';
import { caseStudies } from '@/db/schema';
import { eq, desc, count, type SQL } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const handlers = crudRoutes({
  table: caseStudies,
  pk: 'id',
  tags: ["Marketing"],
  orgScoped: false,
  readRole: 'member',
  writeRole: 'admin',
});

/** Public GET — no auth required (used on marketing pages) */
export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Marketing'],
      summary: 'List case studies',
      description: 'Returns published case studies. Public endpoint.',
    },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (status) {
      const statusCol = (caseStudies as Record<string, unknown>)['status'];
      if (statusCol) conditions.push(eq(statusCol as never, status as never));
    }

    const whereClause = conditions.length > 0 ? conditions[0] : undefined;

    const baseQuery = db.select().from(caseStudies);
    const countQuery = db.select({ total: count() }).from(caseStudies);

    const [rows, totalResult] = await Promise.all([
      (whereClause ? baseQuery.where(whereClause) : baseQuery)
        .orderBy(desc((caseStudies as Record<string, unknown>)['createdAt'] as never))
        .limit(limit)
        .offset(offset),
      whereClause ? countQuery.where(whereClause) : countQuery,
    ]);

    const total = totalResult[0]?.total ?? 0;

    return {
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },
);

export const POST = handlers.POST;
