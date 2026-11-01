/**
 * Append-only audit of pseudonymous public-intake access (platform 0054, cache 0044).
 *
 * Some surfaces are reachable with nothing but a bearer identifier: an unclaimed workbook has no organization, no acting person and no
 * consent, so there is no organization or actor to record an access under, and none is invented here. This is a deliberately scoped
 * platform authority that records WHAT happened to a pseudonymous subject, not who did it and not on behalf of any organization.
 *
 *   - The subject is a keyed HMAC of the bearer identifier. The identifier is a credential and is never written; the key is held by the
 *     application (PUBLIC_INTAKE_AUDIT_KEY). Without a usable key nothing can be recorded, so the surface fails closed: a sensitive read
 *     or a mutation that cannot be recorded does not happen.
 *   - Events of one subject form a hash chain under an advisory lock, so a rewritten earlier event is detectable and two writers cannot
 *     fork the chain (the unique index on the predecessor enforces it again in the database).
 *   - The caller passes its own transaction: a mutation and its record commit or roll back together, and a read is recorded before it is
 *     served. Details are limited to field names and counts; the caller never passes values, names or free text.
 */
import { createHash, createHmac } from 'node:crypto'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { publicIntakeAuditEvents } from '@/db/schema/domains/infrastructure/public-intake-audit'
import type { RLSTx } from '@/lib/db/with-rls-context'

export type PublicIntakeSubjectKind = 'unclaimed_workbook'
export type PublicIntakeOperation = 'read' | 'create' | 'update' | 'delete' | 'denied'

export interface PublicIntakeAuditEntry {
  surface: string
  action: string
  operation: PublicIntakeOperation
  subjectKind: PublicIntakeSubjectKind
  /** The bearer identifier. Used only to derive the keyed reference; never stored. */
  subjectId: string
  outcome?: 'success' | 'failure'
  /** Reference of the child record acted on (a holder id), never the bearer identifier. */
  resourceRef?: string | null
  details?: Record<string, unknown>
}

export class PublicIntakeAuditUnavailableError extends Error {
  constructor() {
    super('Pseudonymous access cannot be recorded: PUBLIC_INTAKE_AUDIT_KEY is not configured.')
    this.name = 'PublicIntakeAuditUnavailableError'
  }
}

const MIN_KEY_LENGTH = 32
const PLACEHOLDERS = new Set(['changeme', 'change-me', 'change_me', 'placeholder', 'your-secret', 'replace-me', 'replace_me', 'todo', 'example'])

function auditKey(): string {
  const value = (process.env.PUBLIC_INTAKE_AUDIT_KEY ?? '').trim()
  if (value.length < MIN_KEY_LENGTH || PLACEHOLDERS.has(value.toLowerCase())) throw new PublicIntakeAuditUnavailableError()
  return value
}

/** Keyed, one-way reference of a bearer identifier: stable for correlation, useless without the key, and never the identifier. */
export function pseudonymousSubjectRef(kind: PublicIntakeSubjectKind, subjectId: string): string {
  return createHmac('sha256', auditKey()).update(`${kind}\u0000${subjectId}`, 'utf8').digest('hex')
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`
}

interface ChainedFields {
  previousHash: string | null
  occurredAt: Date
  subjectKind: string
  subjectRef: string
  surface: string
  action: string
  operation: string
  outcome: string
  resourceRef: string | null
  details: unknown
}

function contentHash(fields: ChainedFields): string {
  return createHash('sha256')
    .update(
      stableJson({
        previous: fields.previousHash ?? '',
        occurredAt: fields.occurredAt.toISOString(),
        subjectKind: fields.subjectKind,
        subjectRef: fields.subjectRef,
        surface: fields.surface,
        action: fields.action,
        operation: fields.operation,
        outcome: fields.outcome,
        resourceRef: fields.resourceRef,
        details: fields.details,
      }),
      'utf8',
    )
    .digest('hex')
}

/** Appends one chained event inside the caller's transaction. Throws when it cannot, so the protected operation does not proceed. */
export async function appendPublicIntakeAudit(tx: RLSTx, entry: PublicIntakeAuditEntry): Promise<{ subjectRef: string; contentHash: string }> {
  const subjectRef = pseudonymousSubjectRef(entry.subjectKind, entry.subjectId)
  const details = JSON.parse(JSON.stringify(entry.details ?? {})) as Record<string, unknown>

  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`public_intake_audit:${subjectRef}`}, 0))`)
  const [latest] = await tx
    .select({ contentHash: publicIntakeAuditEvents.contentHash, occurredAt: publicIntakeAuditEvents.occurredAt })
    .from(publicIntakeAuditEvents)
    .where(eq(publicIntakeAuditEvents.subjectRef, subjectRef))
    .orderBy(desc(publicIntakeAuditEvents.occurredAt), desc(publicIntakeAuditEvents.id))
    .limit(1)

  // Chain order is time order: an event is never stamped at or before its predecessor, so two events written in one millisecond keep their order.
  const now = new Date()
  const occurredAt = latest && now.getTime() <= latest.occurredAt.getTime() ? new Date(latest.occurredAt.getTime() + 1) : now

  const chained: ChainedFields = {
    previousHash: latest?.contentHash ?? null,
    occurredAt,
    subjectKind: entry.subjectKind,
    subjectRef,
    surface: entry.surface.slice(0, 80),
    action: entry.action.slice(0, 100),
    operation: entry.operation,
    outcome: entry.outcome ?? 'success',
    resourceRef: entry.resourceRef ? entry.resourceRef.slice(0, 64) : null,
    details,
  }
  const hash = contentHash(chained)
  await tx.insert(publicIntakeAuditEvents).values({ ...chained, contentHash: hash })
  return { subjectRef, contentHash: hash }
}

export type ChainVerification = { ok: true; events: number; head: string | null } | { ok: false; events: number; brokenAt: number; reason: 'previous_mismatch' | 'content_mismatch' }

/**
 * Recomputes the chain of one subject. It detects a rewritten or reordered event and an event removed from the middle of the chain. It
 * cannot detect removal of the newest events on its own: that needs the head recorded somewhere the writer cannot reach (`head` is
 * returned so a caller can compare it with such a record).
 */
export async function verifyPublicIntakeAuditChain(tx: RLSTx, subjectKind: PublicIntakeSubjectKind, subjectId: string): Promise<ChainVerification> {
  const subjectRef = pseudonymousSubjectRef(subjectKind, subjectId)
  const rows = await tx
    .select()
    .from(publicIntakeAuditEvents)
    .where(eq(publicIntakeAuditEvents.subjectRef, subjectRef))
    .orderBy(asc(publicIntakeAuditEvents.occurredAt), asc(publicIntakeAuditEvents.id))

  let previous: string | null = null
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    if ((row.previousHash ?? null) !== previous) return { ok: false, events: rows.length, brokenAt: index, reason: 'previous_mismatch' }
    const expected = contentHash({
      previousHash: row.previousHash ?? null,
      occurredAt: row.occurredAt,
      subjectKind: row.subjectKind,
      subjectRef: row.subjectRef,
      surface: row.surface,
      action: row.action,
      operation: row.operation,
      outcome: row.outcome,
      resourceRef: row.resourceRef ?? null,
      details: row.details,
    })
    if (expected !== row.contentHash) return { ok: false, events: rows.length, brokenAt: index, reason: 'content_mismatch' }
    previous = row.contentHash
  }
  return { ok: true, events: rows.length, head: previous }
}
