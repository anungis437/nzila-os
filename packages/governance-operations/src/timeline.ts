/**
 * @nzila/governance-operations — Timeline primitives
 *
 * Governance-safe timeline shapes for surfaces that show the cadence
 * of governance acts. Refuses to carry payloads or person-resolving
 * content; entries are summaries only.
 *
 * @module @nzila/governance-operations/timeline
 */
import { z } from 'zod'

const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  'userId',
  'user_id',
  'employeeId',
  'employee_id',
  'email',
  'phone',
  'ip',
  'ipAddress',
  'sessionId',
  'session_id',
])

export const timelineEntrySchema = z
  .object({
    id: z.string().min(1),
    occurredAt: z.string().datetime(),
    eventType: z.string().min(1),
    severity: z.enum(['info', 'warning', 'critical']),
    summary: z.string().min(1).max(280),
    doctrineDocument: z.string().optional(),
    contentHash: z.string().optional(),
  })
  .strict()

export type TimelineEntry = z.infer<typeof timelineEntrySchema>

/**
 * Build a timeline entry from a governance event envelope-like object.
 * Refuses to copy any forbidden key from the source payload, even
 * indirectly via the summary.
 */
export function buildTimelineEntry(input: {
  readonly id: string
  readonly occurredAt: string
  readonly eventType: string
  readonly severity: 'info' | 'warning' | 'critical'
  readonly summary: string
  readonly doctrineDocument?: string
  readonly contentHash?: string
  readonly sourcePayload?: Readonly<Record<string, unknown>>
}): TimelineEntry {
  if (input.sourcePayload) {
    for (const k of Object.keys(input.sourcePayload)) {
      if (FORBIDDEN_KEYS.has(k)) {
        throw new Error(
          `forbidden_payload_key: timeline entry refused due to source payload key "${k}"`,
        )
      }
    }
  }
  return timelineEntrySchema.parse({
    id: input.id,
    occurredAt: input.occurredAt,
    eventType: input.eventType,
    severity: input.severity,
    summary: input.summary,
    doctrineDocument: input.doctrineDocument,
    contentHash: input.contentHash,
  })
}

/** Sort entries newest-first. */
export function orderTimeline(
  entries: readonly TimelineEntry[],
): readonly TimelineEntry[] {
  return [...entries].sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
}
