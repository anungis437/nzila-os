/**
 * What a client may say about a board packet.
 *
 * A packet is prepared by an officer, certified when it is finalized and then sent. The server records everything about that: who prepared it, its status,
 * when it was certified and by whom, its content hash, its PDF and its recipients (lib/governance/board-packet-lifecycle.ts and the distribution service).
 * None of that is accepted here, and a request that names any of it is refused rather than silently ignored.
 *
 * The four required sections each carry the `summary` the PDF prints; they may carry further detail, which the PDF prints as well.
 */
import { z } from 'zod'

export const BOARD_PACKET_TYPES = ['monthly', 'quarterly', 'annual', 'special'] as const

const MAX_SUMMARY_LENGTH = 2000

/** jsonb cannot hold U+0000: a client that sends it has made a request error, which must not surface as a failed insert. */
const NUL = String.fromCharCode(0)
function hasNul(value: unknown): boolean {
  if (typeof value === 'string') return value.includes(NUL)
  if (Array.isArray(value)) return value.some(hasNul)
  if (value !== null && typeof value === 'object') return Object.entries(value).some(([key, member]) => key.includes(NUL) || hasNul(member))
  return false
}
const withoutNul = (value: unknown) => !hasNul(value)
const NUL_MESSAGE = 'must not contain the NUL character'

const isoDate = z.iso.date()
const text = (max: number) => z.string().trim().min(1).max(max).refine(withoutNul, NUL_MESSAGE)
const httpUrl = z.url().max(2000).refine((value) => /^https?:\/\//i.test(value), 'must be an http(s) URL')

const section = z
  .looseObject({ summary: text(MAX_SUMMARY_LENGTH) })
  .refine(withoutNul, NUL_MESSAGE)

const actionItem = z.strictObject({
  item: text(1000),
  owner: text(255).optional(),
  deadline: isoDate.optional(),
  status: text(50).optional(),
})

const attachment = z.strictObject({
  name: text(255),
  type: text(100).optional(),
  url: httpUrl,
})

const contentShape = {
  title: text(255),
  description: z.string().max(5000).refine(withoutNul, NUL_MESSAGE).optional(),
  packetType: z.enum(BOARD_PACKET_TYPES),
  periodStart: isoDate,
  periodEnd: isoDate,
  fiscalYear: z.number().int().min(1900).max(2100),
  fiscalQuarter: z.number().int().min(1).max(4).optional(),
  financialSummary: section,
  membershipStats: section,
  caseSummary: section,
  motionsAndVotes: section.optional(),
  auditExceptions: section.optional(),
  complianceStatus: section,
  actionItems: z.array(actionItem).max(200).optional(),
  recipientRoles: z.array(text(100)).max(50),
  attachments: z.array(attachment).max(50).optional(),
}

const periodEndsAfterStart = (value: { periodStart?: string; periodEnd?: string }) =>
  value.periodStart === undefined || value.periodEnd === undefined || value.periodEnd >= value.periodStart
const PERIOD_ISSUE = { message: 'periodEnd must not be before periodStart', path: ['periodEnd'] }

/** A new packet is always a draft prepared by the caller. */
export const createBoardPacketSchema = z.strictObject(contentShape).refine(periodEndsAfterStart, PERIOD_ISSUE)

/**
 * A change to a packet: edits to a draft's content, or one move of its status (finalize, reopen, archive).
 * `distributed` is reached only through POST .../distribute, which records the recipients.
 */
export const updateBoardPacketSchema = z
  .strictObject({ ...contentShape, status: z.enum(['draft', 'finalized', 'archived']) })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update')
  .refine(periodEndsAfterStart, PERIOD_ISSUE)

export type CreateBoardPacketInput = z.infer<typeof createBoardPacketSchema>
export type UpdateBoardPacketInput = z.infer<typeof updateBoardPacketSchema>

const packetId = z.guid()
/** The id in a route path; one that is not a uuid names no packet. */
export function parseBoardPacketId(raw: unknown): string | null {
  const parsed = packetId.safeParse(raw)
  return parsed.success ? parsed.data : null
}
