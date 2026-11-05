/**
 * CRUD collection route for case studies
 * GET is public (marketing pages), POST requires admin auth.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { withApi } from '@/lib/api/with-api';
import { db } from '@/db/db';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { caseStudies } from '@/db/schema';
import { eq, and, lte, desc, count } from 'drizzle-orm';
import { ApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

const handlers = crudRoutes({
  table: caseStudies,
  pk: 'id',
  tags: ["Marketing"],
  orgScoped: false,
  readRole: 'member',
  // Organization administrators do not have platform-wide publishing authority.
  writeRole: 'content_manager',
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
    if (status && status !== 'published') {
      throw ApiError.badRequest('Public case studies expose published content only');
    }
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));
    const offset = (page - 1) * limit;

    // case_studies has NO status column. Publication is governed by visibility and publishedAt.
    // The predicate is mandatory for BOTH the rows and the total count, and scheduled or
    // never-published drafts must not become public even through ?status=... .
    const publicOnly = and(
      eq(caseStudies.visibility, 'public'),
      lte(caseStudies.publishedAt, new Date()),
    );

    // Public marketing content has no actor: it is global reference data read through the
    // SYSTEM role (SELECT only), never the ordinary tenant runtime connection.
    const [rows, totalResult] = await withSystemContext(() => {
      const baseQuery = db.select().from(caseStudies);
      const countQuery = db.select({ total: count() }).from(caseStudies);
      return Promise.all([
        baseQuery.where(publicOnly)
          .orderBy(desc(caseStudies.createdAt))
          .limit(limit)
          .offset(offset),
        countQuery.where(publicOnly),
      ]);
    });

    const total = totalResult[0]?.total ?? 0;

    return {
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },
);

export const POST = handlers.POST;
