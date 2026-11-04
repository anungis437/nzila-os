/**
 * GET PATCH DELETE /api/governance/board-packets/[id]
 *
 * One board packet of the organization. A PATCH either edits a draft's content or moves its status once (finalize, reopen, archive); a finalized packet's
 * content is locked and a distributed one can only be archived (lib/governance/board-packet-lifecycle.ts). DELETE archives: a packet is never removed.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { boardPackets } from '@/db/schema/board-packet-schema';
import { and, eq } from 'drizzle-orm';
import { parseBoardPacketId, updateBoardPacketSchema } from '@/lib/governance/board-packet-input';
import { applyBoardPacketUpdate } from '@/lib/governance/board-packet-service';

export const dynamic = 'force-dynamic';

/** A path id that is not a uuid names no packet. */
function packetIdOf(params: Record<string, string> | undefined): string {
  const id = parseBoardPacketId(params?.id);
  if (!id) throw ApiError.notFound('Board packet');
  return id;
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    entitlement: 'governance_suite',
    openapi: { tags: ['Governance'], summary: 'Get board packet by ID' },
  },
  async ({ params, organizationId }) => {
    const id = packetIdOf(params);
    const [packet] = await withRLSContext({ organizationId: organizationId! }, (tx) =>
      tx
        .select()
        .from(boardPackets)
        .where(and(eq(boardPackets.id, id), eq(boardPackets.organizationId, organizationId!)))
        .limit(1),
    );
    if (!packet) throw ApiError.notFound('Board packet');
    return packet;
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
    openapi: { tags: ['Governance'], summary: 'Update board packet' },
  },
  async ({ params, body, organizationId, userId }) => {
    const packetId = packetIdOf(params);
    const request = updateBoardPacketSchema.parse(body);
    return withRLSContext({ organizationId: organizationId! }, (tx) =>
      applyBoardPacketUpdate(tx, { packetId, organizationId: organizationId!, userId: userId!, request }),
    );
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    entitlement: 'governance_suite',
    openapi: { tags: ['Governance'], summary: 'Archive board packet' },
  },
  async ({ params, organizationId, userId }) => {
    const packetId = packetIdOf(params);
    return withRLSContext({ organizationId: organizationId! }, (tx) =>
      applyBoardPacketUpdate(tx, { packetId, organizationId: organizationId!, userId: userId!, request: { status: 'archived' } }),
    );
  },
);
