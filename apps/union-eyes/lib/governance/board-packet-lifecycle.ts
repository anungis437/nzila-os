/**
 * Board packet lifecycle: the states a packet moves through, and what each move records.
 *
 *   draft ──finalize──▶ finalized ──distribute──▶ distributed
 *     ▲                     │                          │
 *     └──────reopen─────────┘                          │
 *   draft / finalized / distributed ──archive──▶ archived
 *
 * A draft is edited freely. Finalizing certifies it: the packet's content is hashed (SHA-256 over a canonical form), and the finalization time, the person
 * who finalized it and the hash are recorded. A finalized packet's content is locked; it can be reopened as a draft (which clears the certification) until
 * it has been distributed. A distributed packet is the record of what was sent, so it can only be archived, and an archived packet is closed. Distribution
 * (lib/services/board-packet-generator.ts) refuses a finalized packet whose content no longer matches its hash.
 *
 * `planBoardPacketUpdate` is pure: it says what an update is allowed to write and what to audit, or why it is refused. The caller applies the plan only if the
 * packet is still in `fromStatus`, so a concurrent change is a conflict instead of an overwrite.
 */
import { createHash } from 'node:crypto'
import type { BoardPacket, NewBoardPacket } from '@/db/schema/board-packet-schema'

export type BoardPacketStatus = 'draft' | 'finalized' | 'distributed' | 'archived'
const STATUSES: readonly string[] = ['draft', 'finalized', 'distributed', 'archived']

/** What a certification covers. The rest of the row (status, stamps, recipients, PDF, timestamps) is bookkeeping about the content, not content. */
export const BOARD_PACKET_CONTENT_FIELDS = [
  'title',
  'description',
  'packetType',
  'periodStart',
  'periodEnd',
  'fiscalYear',
  'fiscalQuarter',
  'financialSummary',
  'membershipStats',
  'caseSummary',
  'motionsAndVotes',
  'auditExceptions',
  'complianceStatus',
  'actionItems',
  'recipientRoles',
  'attachments',
] as const

export type BoardPacketContentField = (typeof BOARD_PACKET_CONTENT_FIELDS)[number]
export type BoardPacketContent = Pick<BoardPacket, BoardPacketContentField>
export type BoardPacketUpdateRequest = Partial<BoardPacketContent> & { status?: 'draft' | 'finalized' | 'archived' }

export type BoardPacketLifecycleErrorCode = 'LOCKED' | 'ILLEGAL_TRANSITION' | 'INVALID_PERIOD'

export class BoardPacketLifecycleError extends Error {
  constructor(
    readonly code: BoardPacketLifecycleErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'BoardPacketLifecycleError'
  }
}

export type BoardPacketUpdatePlan =
  | { change: 'none' }
  | {
      change: 'update'
      /** The write must find the packet still in this status. */
      fromStatus: BoardPacketStatus
      set: Partial<NewBoardPacket>
      audit: { action: string; details: Record<string, unknown> }
    }

/** JSON with sorted object keys, so the same content always serializes to the same text. */
function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'object') {
    const withToJson = value as { toJSON?: () => unknown }
    if (typeof withToJson.toJSON === 'function') return canonicalJson(withToJson.toJSON())
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
    const members = Object.entries(value as Record<string, unknown>)
      .filter(([, member]) => member !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, member]) => `${JSON.stringify(key)}:${canonicalJson(member)}`)
    return `{${members.join(',')}}`
  }
  return JSON.stringify(value)
}

/** The content fields of a packet, an unset field being null whether it came from the row or from a request. */
export function boardPacketContent(source: Partial<BoardPacketContent>): BoardPacketContent {
  return Object.fromEntries(BOARD_PACKET_CONTENT_FIELDS.map((field) => [field, source[field] ?? null])) as BoardPacketContent
}

export function boardPacketContentHash(source: Partial<BoardPacketContent>): string {
  return createHash('sha256').update(canonicalJson(boardPacketContent(source))).digest('hex')
}

/** True when the packet carries a certification and its content still matches it. */
export function boardPacketCertificationIntact(packet: Pick<BoardPacket, 'contentHash'> & Partial<BoardPacketContent>): boolean {
  return typeof packet.contentHash === 'string' && packet.contentHash === boardPacketContentHash(packet)
}

const refusal = (code: BoardPacketLifecycleErrorCode, message: string) => new BoardPacketLifecycleError(code, message)

export function planBoardPacketUpdate(
  current: BoardPacket,
  request: BoardPacketUpdateRequest,
  actor: { userId: string; now?: Date },
): BoardPacketUpdatePlan {
  if (!STATUSES.includes(current.status)) {
    throw refusal('ILLEGAL_TRANSITION', `The board packet is in an unknown status "${current.status}"`)
  }
  const from = current.status as BoardPacketStatus
  const now = actor.now ?? new Date()

  const edits = Object.fromEntries(
    BOARD_PACKET_CONTENT_FIELDS.filter((field) => request[field] !== undefined).map((field) => [field, request[field]]),
  ) as Partial<BoardPacketContent>
  const editedFields = Object.keys(edits)
  const target = request.status ?? from

  const statusOnly = (move: string) => {
    if (editedFields.length > 0) throw refusal('ILLEGAL_TRANSITION', `A board packet's content cannot be edited in the request that ${move} it`)
  }
  const update = (set: Partial<NewBoardPacket>, action: string, details: Record<string, unknown>): BoardPacketUpdatePlan => ({
    change: 'update',
    fromStatus: from,
    set: { ...set, updatedAt: now },
    audit: { action, details },
  })
  const archive = () => {
    statusOnly('archives')
    return update({ status: 'archived' }, 'board_packet.archive', { status: 'archived' })
  }

  switch (from) {
    case 'draft': {
      if (target === 'draft') {
        if (editedFields.length === 0) return { change: 'none' }
        const merged = { ...boardPacketContent(current), ...edits }
        if (merged.periodEnd < merged.periodStart) throw refusal('INVALID_PERIOD', 'periodEnd must not be before periodStart')
        return update(edits as Partial<NewBoardPacket>, 'board_packet.update', { fields: editedFields })
      }
      if (target === 'finalized') {
        const merged = { ...boardPacketContent(current), ...edits }
        if (merged.periodEnd < merged.periodStart) throw refusal('INVALID_PERIOD', 'periodEnd must not be before periodStart')
        const contentHash = boardPacketContentHash(merged)
        return update(
          { ...(edits as Partial<NewBoardPacket>), status: 'finalized', finalizedAt: now, contentHash, signedBy: actor.userId, signedAt: now },
          'board_packet.finalize',
          { fields: editedFields, status: 'finalized', contentHash },
        )
      }
      if (target === 'archived') return archive()
      break
    }
    case 'finalized': {
      if (target === 'finalized') {
        if (editedFields.length === 0) return { change: 'none' }
        throw refusal('LOCKED', 'A finalized board packet cannot be edited: reopen it as a draft first')
      }
      if (target === 'draft') {
        statusOnly('reopens')
        return update(
          { status: 'draft', finalizedAt: null, contentHash: null, signedBy: null, signedAt: null },
          'board_packet.reopen',
          { status: 'draft', previousContentHash: current.contentHash },
        )
      }
      if (target === 'archived') return archive()
      break
    }
    case 'distributed': {
      if (target === 'archived') return archive()
      throw refusal('LOCKED', 'A distributed board packet is the record of what was sent and can only be archived')
    }
    case 'archived': {
      if (target === 'archived' && editedFields.length === 0) return { change: 'none' }
      throw refusal('LOCKED', 'An archived board packet is closed')
    }
  }
  throw refusal('ILLEGAL_TRANSITION', `A ${from} board packet cannot become ${target}`)
}
