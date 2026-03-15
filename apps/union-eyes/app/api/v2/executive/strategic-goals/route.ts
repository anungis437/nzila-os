/**
 * GET POST /api/v2/executive/strategic-goals
 * Strategic goals CRUD for executive planning board.
 * Backed by strategicGoals table (Drizzle ORM).
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { strategicGoals } from '@/db/schema';
import { eq, desc, count } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'vice_president' },
    openapi: {
      tags: ['Executive'],
      summary: 'List strategic goals',
      description: 'Returns strategic goals for the organization.',
    },
  },
  async ({ request, organizationId }) => {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    const [totalResult, goals] = await Promise.all([
      db.select({ total: count() }).from(strategicGoals)
        .where(eq(strategicGoals.organizationId, organizationId!)),
      db.select()
        .from(strategicGoals)
        .where(eq(strategicGoals.organizationId, organizationId!))
        .orderBy(desc(strategicGoals.createdAt))
        .limit(limit)
        .offset(offset),
    ]);

    const total = totalResult[0]?.total ?? 0;

    return {
      goals,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },
);

const createGoalSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  category: z.enum(['membership', 'financial', 'advocacy', 'operations', 'education', 'organizing']),
  progress: z.number().int().min(0).max(100).optional(),
  dueDate: z.string().optional(),
  owner: z.string().max(255).optional(),
  status: z.enum(['on-track', 'at-risk', 'delayed', 'completed', 'cancelled']).optional(),
});

export const POST = withApi(
  {
    auth: { required: true, minRole: 'vice_president' },
    body: createGoalSchema,
    openapi: {
      tags: ['Executive'],
      summary: 'Create strategic goal',
      description: 'Creates a new strategic goal for the organization.',
    },
  },
  async ({ body, organizationId }) => {
    const [goal] = await db
      .insert(strategicGoals)
      .values({
        organizationId: organizationId!,
        title: body.title,
        description: body.description ?? null,
        category: body.category,
        progress: body.progress ?? 0,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        owner: body.owner ?? null,
        status: body.status ?? 'on-track',
      })
      .returning();

    return { goal };
  },
);
