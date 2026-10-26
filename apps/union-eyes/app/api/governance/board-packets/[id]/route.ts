/**
 * GET PATCH DELETE /api/governance/board-packets/[id]
 * Single board packet operations — replaces Django proxy.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { db } from '@/db/db';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { boardPackets } from '@/db/schema/board-packet-schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const updateBoardPacketSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  // 'distributed' is reached only through POST .../distribute, which records the recipients.
  status: z.enum(['draft', 'finalized', 'archived']).optional(),
  financialSummary: z.record(z.string(), z.unknown()).optional(),
  membershipStats: z.record(z.string(), z.unknown()).optional(),
  caseSummary: z.record(z.string(), z.unknown()).optional(),
  motionsAndVotes: z.record(z.string(), z.unknown()).optional(),
  auditExceptions: z.record(z.string(), z.unknown()).optional(),
  complianceStatus: z.record(z.string(), z.unknown()).optional(),
  actionItems: z.record(z.string(), z.unknown()).optional(),
  recipientRoles: z.array(z.string().max(100)).optional(),
  distributionList: z.record(z.string(), z.unknown()).optional(),
  pdfUrl: z.string().url().max(2000).optional(),
  attachments: z.record(z.string(), z.unknown()).optional(),
});

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'governance_suite',
    openapi: { tags: ['Governance'], summary: 'Get board packet by ID' },
  },
  async ({ request, organizationId }) => {
    const id = request.url.split('/board-packets/')[1]?.split('?')[0]?.split('/')[0];
    if (!id) throw ApiError.badRequest('Missing packet ID');
    const [packet] = await db
      .select()
      .from(boardPackets)
      .where(and(eq(boardPackets.id, id), eq(boardPackets.organizationId, organizationId!)));
    if (!packet) throw ApiError.notFound('Board packet not found');
    return packet;
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
    openapi: { tags: ['Governance'], summary: 'Update board packet' },
  },
  async ({ request, body, organizationId, userId }) => {
    const id = request.url.split('/board-packets/')[1]?.split('?')[0]?.split('/')[0];
    if (!id) throw ApiError.badRequest('Missing packet ID');
    const parsed = updateBoardPacketSchema.parse(body);
    const packet = await withRLSContext(async (tx) => {
      const [row] = await tx
        .update(boardPackets)
        .set({ ...parsed, updatedAt: new Date() })
        .where(and(eq(boardPackets.id, id), eq(boardPackets.organizationId, organizationId!)))
        .returning();
      if (!row) return null;
      await persistAtomicAudit(tx, {
        organizationId: organizationId!,
        userId: userId!,
        action: 'board_packet.update',
        resourceType: 'board_packets',
        resourceId: id,
        details: { fields: Object.keys(parsed), status: parsed.status },
      });
      return row;
    });
    if (!packet) throw ApiError.notFound('Board packet not found');
    return packet;
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
    openapi: { tags: ['Governance'], summary: 'Delete board packet' },
  },
  async ({ request, organizationId, userId }) => {
    const id = request.url.split('/board-packets/')[1]?.split('?')[0]?.split('/')[0];
    if (!id) throw ApiError.badRequest('Missing packet ID');
    const packet = await withRLSContext(async (tx) => {
      const [row] = await tx
        .update(boardPackets)
        .set({ status: 'archived', updatedAt: new Date() })
        .where(and(eq(boardPackets.id, id), eq(boardPackets.organizationId, organizationId!)))
        .returning();
      if (!row) return null;
      await persistAtomicAudit(tx, {
        organizationId: organizationId!,
        userId: userId!,
        action: 'board_packet.archive',
        resourceType: 'board_packets',
        resourceId: id,
        details: { status: 'archived' },
      });
      return row;
    });
    if (!packet) throw ApiError.notFound('Board packet not found');
    return packet;
  },
);

