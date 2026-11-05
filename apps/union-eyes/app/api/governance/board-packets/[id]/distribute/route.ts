/**
 * Board Packet Distribution API
 *
 * Distributes a finalized board packet to members of the organization. Each recipient's name and address come from their membership record.
 */

import { NextResponse } from 'next/server';
import { withApi, z, ApiError } from '@/lib/api/framework';
import { boardPacketGenerator } from '@/lib/services/board-packet-generator';
import { parseBoardPacketId } from '@/lib/governance/board-packet-input';

const distributePacketSchema = z.strictObject({
  recipients: z
    .array(
      z.strictObject({
        recipientId: z.guid(),
        recipientRole: z.string().trim().min(1).max(50),
      }),
    )
    .min(1)
    .max(100)
    .refine((recipients) => new Set(recipients.map((recipient) => recipient.recipientId)).size === recipients.length, 'A recipient can be named only once'),
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
    const packetId = parseBoardPacketId(params.id);
    if (!packetId) throw ApiError.notFound('Board packet');
    const { recipients } = body;

    // The service reads the packet by id and organization, so a packet of another organization is not found.
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
