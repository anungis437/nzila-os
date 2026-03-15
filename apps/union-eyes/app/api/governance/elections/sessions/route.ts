/**
 * GET POST /api/governance/elections/sessions
 * Voting sessions management — replaces Django proxy.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { votingSessions } from '@/db/schema';
import { desc, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    openapi: { tags: ['Governance'], summary: 'List voting sessions' },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    const [totalResult, sessions] = await Promise.all([
      db.select({ total: count() }).from(votingSessions),
      db.select().from(votingSessions).orderBy(desc(votingSessions.createdAt)).limit(limit).offset(offset),
    ]);

    return { data: sessions, pagination: { page, limit, total: totalResult[0]?.total ?? 0 } };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: { tags: ['Governance'], summary: 'Create voting session' },
  },
  async ({ body, userId }) => {
    const [session] = await db.insert(votingSessions).values({ ...body, createdBy: userId! }).returning();
    return { data: session };
  },
);

