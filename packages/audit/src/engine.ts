import { createHash, randomUUID } from 'node:crypto'
import {
  type AuditEntry,
  type AuditInput,
  auditInputSchema,
  GENESIS_HASH,
} from './schema.js'
import type { AuditStore } from './store.js'

// ─── Hash Computation ───────────────────────────────────────────────────────

export function computeAuditHash(prevHash: string, payload: Record<string, unknown>): string {
  const data = prevHash + JSON.stringify(payload, Object.keys(payload).sort())
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

    const lastEntry = await this.store.getLastEntry(validated.orgId)
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
      payload: validated.payload,
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
      payload: validated.payload,
      prevHash,
      hash,
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
