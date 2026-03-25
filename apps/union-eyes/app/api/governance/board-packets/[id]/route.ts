/**
 * GET PATCH DELETE /api/governance/board-packets/[id]
 * Single board packet operations — replaces Django proxy.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { boardPackets } from '@/db/schema/board-packet-schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const updateBoardPacketSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(['draft', 'finalized', 'distributed', 'archived']).optional(),
  financialSummary: z.record(z.unknown()).optional(),
  membershipStats: z.record(z.unknown()).optional(),
  caseSummary: z.record(z.unknown()).optional(),
  motionsAndVotes: z.record(z.unknown()).optional(),
  auditExceptions: z.record(z.unknown()).optional(),
  complianceStatus: z.record(z.unknown()).optional(),
  actionItems: z.record(z.unknown()).optional(),
  recipientRoles: z.array(z.string().max(100)).optional(),
  distributionList: z.record(z.unknown()).optional(),
  pdfUrl: z.string().url().max(2000).optional(),
  attachments: z.record(z.unknown()).optional(),
});

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
    return packet;
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
    const parsed = updateBoardPacketSchema.parse(body);
    const [packet] = await db.update(boardPackets).set({ ...parsed, updatedAt: new Date() }).where(eq(boardPackets.id, id)).returning();
    if (!packet) throw ApiError.notFound('Board packet not found');
    return packet;
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
    return packet;
  },
);

