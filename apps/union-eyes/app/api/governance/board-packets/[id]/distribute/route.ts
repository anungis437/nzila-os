/**
 * Board Packet Distribution API
 * 
 * Handles distribution of board packets to recipients
 */

import { NextResponse } from 'next/server';
import { withApi, z } from '@/lib/api/framework';
import { boardPacketGenerator } from '@/lib/services/board-packet-generator';

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
    body: distributePacketSchema,
  },
  async ({ body, params }) => {
    const packetId = params.id;
    const { recipients } = body;

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
