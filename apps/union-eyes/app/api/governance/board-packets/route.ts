/**
 * GET POST /api/governance/board-packets
 * Board packet management — replaces Django proxy.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { boardPackets } from '@/db/schema/board-packet-schema';
import { desc, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    openapi: { tags: ['Governance'], summary: 'List board packets' },
  },
  async ({ request }) => {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    const [totalResult, packets] = await Promise.all([
      db.select({ total: count() }).from(boardPackets),
      db.select().from(boardPackets).orderBy(desc(boardPackets.createdAt)).limit(limit).offset(offset),
    ]);

    return { data: packets, pagination: { page, limit, total: totalResult[0]?.total ?? 0 } };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: { tags: ['Governance'], summary: 'Create board packet' },
  },
  async ({ body }) => {
    const [packet] = await db.insert(boardPackets).values(body).returning();
    return { data: packet };
  },
);

