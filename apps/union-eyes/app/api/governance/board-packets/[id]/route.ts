/**
 * GET PATCH DELETE /api/governance/board-packets/[id]
 * Single board packet operations — replaces Django proxy.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { boardPackets } from '@/db/schema/board-packet-schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    openapi: { tags: ['Governance'], summary: 'Get board packet by ID' },
  },
  async ({ request }) => {
    const id = request.url.split('/board-packets/')[1]?.split('?')[0]?.split('/')[0];
    if (!id) throw ApiError.badRequest('Missing packet ID');
    const [packet] = await db.select().from(boardPackets).where(eq(boardPackets.id, id));
    if (!packet) throw ApiError.notFound('Board packet not found');
    return { data: packet };
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: { tags: ['Governance'], summary: 'Update board packet' },
  },
  async ({ request, body }) => {
    const id = request.url.split('/board-packets/')[1]?.split('?')[0]?.split('/')[0];
    if (!id) throw ApiError.badRequest('Missing packet ID');
    const [packet] = await db.update(boardPackets).set({ ...(body as Record<string, unknown>), updatedAt: new Date() }).where(eq(boardPackets.id, id)).returning();
    if (!packet) throw ApiError.notFound('Board packet not found');
    return { data: packet };
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: { tags: ['Governance'], summary: 'Delete board packet' },
  },
  async ({ request }) => {
    const id = request.url.split('/board-packets/')[1]?.split('?')[0]?.split('/')[0];
    if (!id) throw ApiError.badRequest('Missing packet ID');
    const [packet] = await db.update(boardPackets).set({ status: 'archived', updatedAt: new Date() }).where(eq(boardPackets.id, id)).returning();
    if (!packet) throw ApiError.notFound('Board packet not found');
    return { data: packet };
  },
);

