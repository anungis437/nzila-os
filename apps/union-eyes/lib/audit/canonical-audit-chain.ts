import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import { sql } from 'drizzle-orm'
import type { RLSTx } from '@/lib/db/with-rls-context'

export interface CanonicalAuditEntry {
  organizationId: string
  action: string
  resourceType: string
  resourceId?: string | null
  userId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  details: Record<string, unknown>
}

// Python's json.dumps(sort_keys=True, ensure_ascii=True) with default separators.
// backend/core/services.py hashes this exact form and verify_audit_chain recomputes it.
function pythonJson(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('UE_AUDIT_NON_FINITE_NUMBER')
    return JSON.stringify(value)
  }
  if (typeof value === 'string') return pythonString(value)
  if (Array.isArray(value)) return `[${value.map(pythonJson).join(', ')}]`
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => compareCodePoints(left, right))
    return `{${entries.map(([key, item]) => `${pythonString(key)}: ${pythonJson(item)}`).join(', ')}}`
  }
  throw new Error('UE_AUDIT_UNSERIALIZABLE_VALUE')
}

function compareCodePoints(left: string, right: string): number {
  const a = Array.from(left)
  const b = Array.from(right)
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    const difference = a[index].codePointAt(0)! - b[index].codePointAt(0)!
    if (difference) return difference
  }
  return a.length - b.length
}

const SHORT_ESCAPES: Record<string, string> = {
  '"': '\\"',
  '\\': '\\\\',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '\b': '\\b',
  '\f': '\\f',
}

function pythonString(value: string): string {
  let output = '"'
  for (let index = 0; index < value.length; index++) {
    const character = value[index]
    const code = value.charCodeAt(index)
    if (SHORT_ESCAPES[character]) output += SHORT_ESCAPES[character]
    else if (code >= 0x20 && code <= 0x7e) output += character
    else output += `\\u${code.toString(16).padStart(4, '0')}`
  }
  return `${output}"`
}

export function canonicalAuditContentHash(input: {
  action: string
  resourceType: string
  resourceId: string
  userId: string
  correlationId: string
  details: Record<string, unknown>
  previousHash: string | null
}): string {
  const payload = pythonJson({
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId,
    user_id: input.userId,
    correlation_id: input.correlationId,
    details: input.details,
    previous_hash: input.previousHash ?? '',
  })
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}

/**
 * Appends one hash-chained record to the canonical public.audit_logs inside the caller's
 * tenant transaction. The per-organization advisory lock serializes chain heads and
 * created_at is assigned after the lock so chain order equals created_at order.
 */
export async function appendCanonicalAuditLog(tx: RLSTx, entry: CanonicalAuditEntry) {
  const details = JSON.parse(JSON.stringify(entry.details)) as Record<string, unknown>
  const resourceId = entry.resourceId ?? null
  const userId = entry.userId ?? null
  const action = entry.action.slice(0, 100)
  const resourceType = entry.resourceType.slice(0, 255)
  const ipAddress = entry.ipAddress && isIP(entry.ipAddress) ? entry.ipAddress : null

  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${`audit_logs:${entry.organizationId}`}, 0))`,
  )
  const latest = (await tx.execute(
    sql`SELECT content_hash FROM public.audit_logs
        WHERE organization_id = ${entry.organizationId}::uuid
        ORDER BY created_at DESC, id DESC LIMIT 1`,
  )) as unknown as { content_hash: string | null }[]
  const previousHash = latest[0]?.content_hash ?? null
  const contentHash = canonicalAuditContentHash({
    action,
    resourceType,
    resourceId: resourceId === null ? '' : String(resourceId),
    userId: userId === null ? '' : String(userId),
    correlationId: '',
    details,
    previousHash,
  })
  await tx.execute(
    sql`INSERT INTO public.audit_logs
        (created_at, updated_at, organization_id, action, resource_type, resource_id, user_id,
         ip_address, user_agent, details, changes, content_hash, previous_hash)
        VALUES (clock_timestamp(), clock_timestamp(), ${entry.organizationId}::uuid, ${action},
          ${resourceType}, ${resourceId}, ${userId}, ${ipAddress}::inet, ${entry.userAgent ?? null},
          ${JSON.stringify(details)}::jsonb, '{}'::jsonb, ${contentHash}, ${previousHash})`,
  )
  return { contentHash, previousHash }
}
