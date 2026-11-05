/**
 * Creating and changing board packets: the packet's row, the move the lifecycle allows and its audit record commit on one tenant transaction.
 * The lifecycle itself (what may change, what a finalization stamps) is lib/governance/board-packet-lifecycle.ts.
 */
import { and, eq } from 'drizzle-orm'
import { boardPackets, type BoardPacket } from '@/db/schema/board-packet-schema'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { ApiError } from '@/lib/api/errors'
import { BoardPacketLifecycleError, planBoardPacketUpdate, type BoardPacketUpdateRequest } from './board-packet-lifecycle'
import type { CreateBoardPacketInput } from './board-packet-input'

/** A new packet is a draft prepared by the caller, whatever the request says about who prepared it or what state it is in. */
export async function createBoardPacket(
  tx: RLSTx,
  input: { organizationId: string; userId: string; packet: CreateBoardPacketInput },
): Promise<BoardPacket> {
  const { organizationId, userId, packet } = input
  const [created] = await tx
    .insert(boardPackets)
    .values({ ...packet, organizationId, generatedBy: userId, status: 'draft' })
    .returning()
  await persistAtomicAudit(tx, {
    organizationId,
    userId,
    action: 'governance.board_packet.create',
    resourceType: 'board_packets',
    resourceId: created.id,
    details: { title: packet.title, packetType: packet.packetType, status: 'draft' },
  })
  return created
}

/**
 * Applies one update (edit, finalize, reopen or archive) to a packet of the organization. The packet is read under a row lock, so the move is planned
 * from the state it will be written against; one that is not in its status any more is a conflict, never an overwrite.
 */
export async function applyBoardPacketUpdate(
  tx: RLSTx,
  input: { packetId: string; organizationId: string; userId: string; request: BoardPacketUpdateRequest },
): Promise<BoardPacket> {
  const { packetId, organizationId, userId, request } = input
  const [current] = await tx
    .select()
    .from(boardPackets)
    .where(and(eq(boardPackets.id, packetId), eq(boardPackets.organizationId, organizationId)))
    .for('update')
  if (!current) throw ApiError.notFound('Board packet')

  let plan: ReturnType<typeof planBoardPacketUpdate>
  try {
    plan = planBoardPacketUpdate(current, request, { userId })
  } catch (error) {
    if (error instanceof BoardPacketLifecycleError) {
      throw error.code === 'INVALID_PERIOD' ? ApiError.badRequest(error.message) : ApiError.conflict(error.message, { code: error.code })
    }
    throw error
  }
  if (plan.change === 'none') return current

  const [updated] = await tx
    .update(boardPackets)
    .set(plan.set)
    .where(and(eq(boardPackets.id, packetId), eq(boardPackets.organizationId, organizationId), eq(boardPackets.status, plan.fromStatus)))
    .returning()
  if (!updated) throw ApiError.conflict('The board packet changed and the update was not applied')

  await persistAtomicAudit(tx, {
    organizationId,
    userId,
    action: plan.audit.action,
    resourceType: 'board_packets',
    resourceId: packetId,
    details: plan.audit.details,
  })
  return updated
}
