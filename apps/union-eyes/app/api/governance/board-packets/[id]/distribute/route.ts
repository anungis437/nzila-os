/**
 * Board Packet Distribution API
 * 
 * Handles distribution of board packets to recipients
 */

import { NextResponse } from 'next/server';
import { withApi, z, ApiError } from '@/lib/api/framework';
import { boardPacketGenerator } from '@/lib/services/board-packet-generator';
import { db } from '@/db/db';
import { boardPackets } from '@/db/schema/board-packet-schema';
import { and, eq } from 'drizzle-orm';

const distributePacketSchema = z.object({
  recipients: z.array(z.object({
    recipientId: z.guid(),
    recipientName: z.string(),
    recipientEmail: z.string().email(),
    recipientRole: z.string(),
  })),
});

/**
 * POST /api/governance/board-packets/[id]/distribute
 * Distribute board packet to recipients
 */
export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
    body: distributePacketSchema,
  },
  async ({ body, params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const packetId = params.id;
    const { recipients } = body;

    // The service reads the packet by id and organization; a packet of another organization is not found.
    const [packet] = await db
      .select({ id: boardPackets.id })
      .from(boardPackets)
      .where(and(eq(boardPackets.id, packetId), eq(boardPackets.organizationId, organizationId)));
    if (!packet) throw ApiError.notFound('Board packet not found');

    const { distributions, delivered, failed } = await boardPacketGenerator.distributePacket(
      packetId,
      recipients,
      { organizationId, userId }
    );

    return NextResponse.json({
      message: failed === 0
        ? 'Board packet distributed successfully'
        : 'Board packet distribution recorded; delivery failed for some recipients',
      distributions,
      stats: {
        totalRecipients: recipients.length,
        sent: delivered,
        failed,
      },
    });
  },
);
