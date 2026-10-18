import { createHash, randomUUID } from 'node:crypto'
import {
  type AuditEntry,
  type AuditInput,
  type AuditHashVersion,
  auditInputSchema,
  GENESIS_HASH,
} from './schema.js'
import type { AuditStore } from './store.js'

// ─── Hash Computation ───────────────────────────────────────────────────────

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

function ordered(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(ordered)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]))
  }
  return value
}

/** Preserve JSON value semantics (including toJSON/optional fields), without mutating input. */
function canonicalJson(payload: Record<string, unknown>): string {
  // This first pass also rejects cycles/BigInt before recursive ordering.
  const value = JSON.parse(JSON.stringify(payload)) as JsonValue
  return JSON.stringify(ordered(value))
}

export function computeAuditHash(
  prevHash: string,
  payload: Record<string, unknown>,
  version: AuditHashVersion = 2,
): string {
  let data: string
  switch (version) {
    case 1:
      // Historical evidence only. Never use this lossy encoding for new records.
      data = prevHash + JSON.stringify(payload, Object.keys(payload).sort())
      break
    case 2:
      // Domain separation binds the version; removing/changing hashVersion cannot downgrade a v2 hash.
      data = `nzila:audit:sha256:v2\0${prevHash}\0${canonicalJson(payload)}`
      break
    default:
      throw new Error('Unsupported audit hash version')
  }
  return createHash('sha256').update(data).digest('hex')
}

// ─── Audit Engine ───────────────────────────────────────────────────────────

export class AuditEngine {
  private readonly store: AuditStore

  constructor(store: AuditStore) {
    this.store = store
  }

  async record(input: AuditInput): Promise<AuditEntry> {
    const validated = auditInputSchema.parse(input)
    // Capture the JSON value once, before any await or caller mutation. In
    // particular, stateful toJSON methods must not hash one value and store another.
    const payload = auditInputSchema.shape.payload.parse(JSON.parse(JSON.stringify(validated.payload)))

    const lastEntry = await this.store.getLastEntry(validated.orgId)
    if (lastEntry && lastEntry.hashVersion !== undefined && lastEntry.hashVersion !== 1 && lastEntry.hashVersion !== 2) {
      throw new Error('Unsupported audit hash version')
    }
    const prevHash = lastEntry?.hash ?? GENESIS_HASH

    const id = randomUUID()
    const timestamp = new Date().toISOString()

    const hashablePayload: Record<string, unknown> = {
      id,
      timestamp,
      actorId: validated.actorId,
      orgId: validated.orgId,
      action: validated.action,
      resource: validated.resource,
      resourceId: validated.resourceId,
      payload,
    }

    const hash = computeAuditHash(prevHash, hashablePayload)

    const entry: AuditEntry = {
      id,
      timestamp,
      actorId: validated.actorId,
      orgId: validated.orgId,
      action: validated.action,
      resource: validated.resource,
      resourceId: validated.resourceId,
      payload,
      prevHash,
      hash,
      hashVersion: 2,
      traceId: validated.traceId,
      spanId: validated.spanId,
    }

    await this.store.append(entry)
    return entry
  }

  async getEntries(
    orgId: string,
    options?: { limit?: number; offset?: number; fromDate?: string; toDate?: string },
  ): Promise<AuditEntry[]> {
    return this.store.getEntries(orgId, options)
  }

  async getEntry(id: string): Promise<AuditEntry | undefined> {
    return this.store.getEntry(id)
  }

  async getEntryCount(orgId: string): Promise<number> {
    return this.store.getEntryCount(orgId)
  }
}
