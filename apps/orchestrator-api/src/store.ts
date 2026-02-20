import { eq, desc } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import type { CommandRecord, CommandStatus } from './contract.js'
import { getDb } from './db.js'

/**
 * Drizzle-backed command store.
 *
 * Falls back to in-memory if DATABASE_URL is not set (local dev without Postgres).
 */

// ── Hash helper (mirrors audit_events pattern) ──
let lastHash: string | null = null

function computeHash(payload: Record<string, unknown>): string {
  const input = JSON.stringify({ ...payload, previous_hash: lastHash })
  const hash = createHash('sha256').update(input).digest('hex')
  lastHash = hash
  return hash
}

// ── In-memory fallback ──
const memStore = new Map<string, CommandRecord>()

function useDb(): boolean {
  return !!process.env.DATABASE_URL
}

export async function createCommand(
  record: Omit<CommandRecord, 'created_at' | 'updated_at'>,
): Promise<CommandRecord> {
  const now = new Date().toISOString()
  const full: CommandRecord = { ...record, created_at: now, updated_at: now }

  if (useDb()) {
    const { db, schema } = getDb()
    const hash = computeHash({ event: 'created', correlation_id: record.correlation_id })

    await db.insert(schema.automationCommands).values({
      id: record.id,
      correlationId: record.correlation_id,
      playbook: record.playbook,
      status: record.status,
      dryRun: record.dry_run,
      requestedBy: record.requested_by,
      args: record.args,
      runId: record.run_id,
      runUrl: record.run_url,
    })

    // Append audit event
    await db.insert(schema.automationEvents).values({
      commandId: record.id,
      correlationId: record.correlation_id,
      event: 'created',
      actor: record.requested_by,
      payload: { playbook: record.playbook, dry_run: record.dry_run },
      hash,
      previousHash: lastHash,
    })
  } else {
    memStore.set(record.correlation_id, full)
  }

  return full
}

export async function getCommand(correlationId: string): Promise<CommandRecord | undefined> {
  if (useDb()) {
    const { db, schema } = getDb()
    const rows = await db
      .select()
      .from(schema.automationCommands)
      .where(eq(schema.automationCommands.correlationId, correlationId))
      .limit(1)
    if (rows.length === 0) return undefined
    return dbRowToRecord(rows[0])
  }
  return memStore.get(correlationId)
}

export async function updateCommandStatus(
  correlationId: string,
  status: CommandStatus,
  extra?: { run_id?: string; run_url?: string; error_message?: string },
): Promise<CommandRecord | undefined> {
  if (useDb()) {
    const { db, schema } = getDb()
    const hash = computeHash({ event: status, correlation_id: correlationId })

    const updated = await db
      .update(schema.automationCommands)
      .set({
        status,
        runId: extra?.run_id,
        runUrl: extra?.run_url,
        errorMessage: extra?.error_message,
        updatedAt: new Date(),
      })
      .where(eq(schema.automationCommands.correlationId, correlationId))
      .returning()
    if (updated.length === 0) return undefined

    // Append audit event
    await db.insert(schema.automationEvents).values({
      commandId: updated[0].id,
      correlationId,
      event: status,
      actor: 'system',
      payload: extra ?? {},
      hash,
      previousHash: lastHash,
    })

    return dbRowToRecord(updated[0])
  }

  const existing = memStore.get(correlationId)
  if (!existing) return undefined
  const updatedMem: CommandRecord = {
    ...existing,
    status,
    run_id: extra?.run_id ?? existing.run_id,
    run_url: extra?.run_url ?? existing.run_url,
    updated_at: new Date().toISOString(),
  }
  memStore.set(correlationId, updatedMem)
  return updatedMem
}

export async function listCommands(): Promise<CommandRecord[]> {
  if (useDb()) {
    const { db, schema } = getDb()
    const rows = await db
      .select()
      .from(schema.automationCommands)
      .orderBy(desc(schema.automationCommands.createdAt))
      .limit(100)
    return rows.map(dbRowToRecord)
  }
  return [...memStore.values()].sort(
    (a, b) => b.created_at.localeCompare(a.created_at),
  )
}

// ── Row → CommandRecord mapper ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbRowToRecord(row: any): CommandRecord {
  return {
    id: row.id,
    correlation_id: row.correlationId,
    playbook: row.playbook,
    status: row.status,
    dry_run: row.dryRun,
    requested_by: row.requestedBy,
    args: row.args as Record<string, unknown>,
    run_id: row.runId,
    run_url: row.runUrl,
    created_at: row.createdAt?.toISOString?.() ?? row.createdAt,
    updated_at: row.updatedAt?.toISOString?.() ?? row.updatedAt,
  }
}
