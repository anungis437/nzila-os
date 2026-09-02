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
    recipientId: z.string().uuid(),
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
  async ({ body, params, organizationId }) => {
    const packetId = params.id;
    const { recipients } = body;

    // distributePacket() itself only filters by packetId — verify the
    // packet belongs to the caller's own organization before invoking it,
    // otherwise any org admin could distribute another org's board packet.
    const [packet] = await db
      .select({ id: boardPackets.id })
      .from(boardPackets)
      .where(and(eq(boardPackets.id, packetId), eq(boardPackets.organizationId, organizationId!)));
    if (!packet) throw ApiError.notFound('Board packet not found');

    const distributions = await boardPacketGenerator.distributePacket(
      packetId,
      recipients
    );

    return NextResponse.json({
      message: 'Board packet distributed successfully',
      distributions,
      stats: {
        totalRecipients: recipients.length,
        sent: distributions.length,
      },
    });
  },
);
