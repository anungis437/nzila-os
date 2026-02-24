import { NextResponse } from 'next/server';
/**
 * POST /api/governance/board-packets/[id]/distribute
 * Migrated to withApi() framework
 */
import { boardPacketGenerator } from '@/lib/services/board-packet-generator';

 
 
 
 
 
import { withApi, z } from '@/lib/api/framework';

const distributePacketSchema = z.object({
  recipients: z.array(z.object({
    recipientId: z.string().uuid(),
    recipientName: z.string(),
    recipientEmail: z.string().email(),
    recipientRole: z.string(),
  })),
});

export const POST = withApi(
  {
    auth: { required: false },
    body: distributePacketSchema,
    openapi: {
      tags: ['Governance'],
      summary: 'POST distribute',
    },
  },
  async ({ request: _request, userId: _userId, organizationId: _organizationId, user: _user, body, query: _query, params }) => {

        const packetId = params.id;
        const { recipients } = body;
        // Distribute packet
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
