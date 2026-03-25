/**
 * GET PATCH DELETE /api/v2/governance/board-packets/[id]
 * Single board packet operations backed by PostgreSQL.
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
  { auth: { required: true, minRole: 'officer' } },
  async ({ params }) => {
    const [row] = await db.select().from(boardPackets).where(eq(boardPackets.id, params.id));
    if (!row) throw ApiError.notFound('Board packet not found');
    return row;
  },
);

export const PATCH = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ params, body }) => {
    const parsed = updateBoardPacketSchema.parse(body);
    const [row] = await db.update(boardPackets).set({ ...parsed, updatedAt: new Date() }).where(eq(boardPackets.id, params.id)).returning();
    if (!row) throw ApiError.notFound('Board packet not found');
    return row;
  },
);

export const DELETE = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ params }) => {
    const [row] = await db.update(boardPackets).set({ status: 'archived', updatedAt: new Date() }).where(eq(boardPackets.id, params.id)).returning();
    if (!row) throw ApiError.notFound('Board packet not found');
    return row;
  },
);
