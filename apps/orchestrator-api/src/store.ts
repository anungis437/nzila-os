import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import type { CommandRecord, CommandStatus } from './contract.js'
import { getDb } from './db.js'
import { nowISO } from '@nzila/platform-utils/time'

/**
 * Drizzle-backed command store with optimistic concurrency and lease-based
 * execution coordination.
 */

let lastHash: string | null = null

function computeHash(payload: Record<string, unknown>): string {
  const input = JSON.stringify({ ...payload, previous_hash: lastHash })
  const hash = createHash('sha256').update(input).digest('hex')
  lastHash = hash
  return hash
}

function createDevFallbackStore() {
  return {
    byCorrelation: new Map<string, CommandRecord>(),
    byId: new Map<string, CommandRecord>(),
    byOrgIdempotency: new Map<string, string>(),
  }
}

const memStore = createDevFallbackStore()

function memIdempotencyKey(orgId: string, idempotencyKey: string): string {
  return `${orgId}::${idempotencyKey}`
}

function useDb(): boolean {
  return process.env.NODE_ENV !== 'development'
    ? true
    : !!process.env.DATABASE_URL
}

function canUseMemoryStore(): boolean {
  return process.env.NODE_ENV === 'development' && !process.env.DATABASE_URL
}

function dateToIso(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return String(value)
}

function addMsIso(ms: number): string {
  return new Date(Date.now() + ms).toISOString()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbRowToRecord(row: any): CommandRecord {
  return {
    id: row.id,
    org_id: row.orgId,
    correlation_id: row.correlationId,
    idempotency_key: row.idempotencyKey,
    playbook: row.playbook,
    status: row.status,
    version: row.version,
    attempt_count: row.attemptCount,
    dry_run: row.dryRun,
    requested_by: row.requestedBy,
    args: row.args as Record<string, unknown>,
    run_id: row.runId,
    run_url: row.runUrl,
    error_message: row.errorMessage,
    execution_owner: row.executionOwner,
    lease_expires_at: dateToIso(row.leaseExpiresAt),
    last_heartbeat_at: dateToIso(row.lastHeartbeatAt),
    started_at: dateToIso(row.startedAt),
    completed_at: dateToIso(row.completedAt),
    created_at: dateToIso(row.createdAt) ?? nowISO(),
    updated_at: dateToIso(row.updatedAt) ?? nowISO(),
  }
}

function saveMem(record: CommandRecord): void {
  memStore.byCorrelation.set(record.correlation_id, record)
  memStore.byId.set(record.id, record)
  memStore.byOrgIdempotency.set(memIdempotencyKey(record.org_id, record.idempotency_key), record.id)
}

function getMemByCorrelation(correlationId: string): CommandRecord | undefined {
  return memStore.byCorrelation.get(correlationId)
}

function getMemById(id: string): CommandRecord | undefined {
  return memStore.byId.get(id)
}

export async function createCommand(
  record: Omit<CommandRecord, 'created_at' | 'updated_at'>,
): Promise<CommandRecord> {
  const now = nowISO()
  const full: CommandRecord = {
    ...record,
    version: record.version ?? 1,
    attempt_count: record.attempt_count ?? 0,
    created_at: now,
    updated_at: now,
  }

  if (useDb()) {
    const { db, schema } = getDb()
    const hash = computeHash({
      event: 'created',
      correlation_id: record.correlation_id,
      org_id: record.org_id,
      idempotency_key: record.idempotency_key,
    })

    try {
      await db.insert(schema.automationCommands).values({
        id: full.id,
        orgId: full.org_id,
        correlationId: full.correlation_id,
        idempotencyKey: full.idempotency_key,
        playbook: full.playbook,
        status: full.status,
        version: full.version,
        attemptCount: full.attempt_count,
        dryRun: full.dry_run,
        requestedBy: full.requested_by,
        args: full.args,
        runId: full.run_id,
        runUrl: full.run_url,
        errorMessage: full.error_message,
        executionOwner: full.execution_owner,
        leaseExpiresAt: full.lease_expires_at ? new Date(full.lease_expires_at) : null,
        lastHeartbeatAt: full.last_heartbeat_at ? new Date(full.last_heartbeat_at) : null,
        startedAt: full.started_at ? new Date(full.started_at) : null,
        completedAt: full.completed_at ? new Date(full.completed_at) : null,
      })
    } catch (error) {
      const maybeCode = (error as { code?: string }).code
      if (maybeCode === '23505') {
        const existing = await getCommandByOrgAndIdempotency(full.org_id, full.idempotency_key)
        if (existing) return existing
      }
      throw error
    }

    await db.insert(schema.automationEvents).values({
      commandId: full.id,
      orgId: full.org_id,
      correlationId: full.correlation_id,
      event: 'created',
      actor: full.requested_by,
      payload: {
        playbook: full.playbook,
        dry_run: full.dry_run,
        idempotency_key: full.idempotency_key,
      },
      hash,
      previousHash: lastHash,
    })

    return full
  }

  if (!canUseMemoryStore()) {
    throw new Error('In-memory orchestrator store is allowed only in development without DATABASE_URL')
  }

  const existingId = memStore.byOrgIdempotency.get(memIdempotencyKey(full.org_id, full.idempotency_key))
  if (existingId) {
    const existing = getMemById(existingId)
    if (existing) return existing
  }

  saveMem(full)
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
  if (!canUseMemoryStore()) {
    throw new Error('In-memory orchestrator store is allowed only in development without DATABASE_URL')
  }
  return getMemByCorrelation(correlationId)
}

export async function getCommandById(id: string): Promise<CommandRecord | undefined> {
  if (useDb()) {
    const { db, schema } = getDb()
    const rows = await db
      .select()
      .from(schema.automationCommands)
      .where(eq(schema.automationCommands.id, id))
      .limit(1)
    if (rows.length === 0) return undefined
    return dbRowToRecord(rows[0])
  }
  if (!canUseMemoryStore()) {
    throw new Error('In-memory orchestrator store is allowed only in development without DATABASE_URL')
  }
  return getMemById(id)
}

export async function getCommandByOrgAndIdempotency(
  orgId: string,
  idempotencyKey: string,
): Promise<CommandRecord | undefined> {
  if (useDb()) {
    const { db, schema } = getDb()
    const rows = await db
      .select()
      .from(schema.automationCommands)
      .where(
        and(
          eq(schema.automationCommands.orgId, orgId),
          eq(schema.automationCommands.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1)
    if (rows.length === 0) return undefined
    return dbRowToRecord(rows[0])
  }

  if (!canUseMemoryStore()) {
    throw new Error('In-memory orchestrator store is allowed only in development without DATABASE_URL')
  }

  const id = memStore.byOrgIdempotency.get(memIdempotencyKey(orgId, idempotencyKey))
  if (!id) return undefined
  return getMemById(id)
}

export async function listCommands(
  limit = 100,
  filter?: {
    orgId?: string
    statuses?: CommandStatus[]
    onlyLeaseExpired?: boolean
  },
): Promise<CommandRecord[]> {
  if (useDb()) {
    const { db, schema } = getDb()
    const predicates = []
    if (filter?.orgId) predicates.push(eq(schema.automationCommands.orgId, filter.orgId))
    if (filter?.statuses?.length) predicates.push(inArray(schema.automationCommands.status, filter.statuses))
    if (filter?.onlyLeaseExpired) {
      predicates.push(lt(schema.automationCommands.leaseExpiresAt, new Date()))
    }

    const rows = await db
      .select()
      .from(schema.automationCommands)
      .where(predicates.length ? and(...predicates) : undefined)
      .orderBy(desc(schema.automationCommands.createdAt))
      .limit(limit)

    return rows.map(dbRowToRecord)
  }

  let rows = [...memStore.byId.values()]
  if (filter?.orgId) rows = rows.filter((r) => r.org_id === filter.orgId)
  if (filter?.statuses?.length) rows = rows.filter((r) => filter.statuses?.includes(r.status))
  if (filter?.onlyLeaseExpired) {
    const now = Date.now()
    rows = rows.filter((r) => !!r.lease_expires_at && new Date(r.lease_expires_at).getTime() < now)
  }

  rows.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return rows.slice(0, limit)
}

export async function updateCommandById(params: {
  id: string
  status?: CommandStatus
  expectedVersion: number
  actor: string
  run_id?: string | null
  run_url?: string | null
  error_message?: string | null
  args?: Record<string, unknown>
  attempt_count?: number
  execution_owner?: string | null
  lease_expires_at?: string | null
  last_heartbeat_at?: string | null
  started_at?: string | null
  completed_at?: string | null
  eventType?: string
}): Promise<{ record?: CommandRecord; conflict: boolean }> {
  const eventType = params.eventType ?? params.status ?? 'updated'

  if (useDb()) {
    const { db, schema } = getDb()
    const existingRows = await db
      .select()
      .from(schema.automationCommands)
      .where(eq(schema.automationCommands.id, params.id))
      .limit(1)
    if (existingRows.length === 0) return { conflict: true }

    const existing = existingRows[0]
    const hash = computeHash({ event: eventType, command_id: params.id, expected_version: params.expectedVersion })

    const nextRows = await db
      .update(schema.automationCommands)
      .set({
        status: params.status ?? existing.status,
        version: sql`${schema.automationCommands.version} + 1`,
        runId: params.run_id === undefined ? existing.runId : params.run_id,
        runUrl: params.run_url === undefined ? existing.runUrl : params.run_url,
        errorMessage: params.error_message === undefined ? existing.errorMessage : params.error_message,
        args: params.args === undefined ? (existing.args as Record<string, unknown>) : params.args,
        attemptCount: params.attempt_count === undefined ? existing.attemptCount : params.attempt_count,
        executionOwner: params.execution_owner === undefined ? existing.executionOwner : params.execution_owner,
        leaseExpiresAt: params.lease_expires_at === undefined
          ? existing.leaseExpiresAt
          : (params.lease_expires_at ? new Date(params.lease_expires_at) : null),
        lastHeartbeatAt: params.last_heartbeat_at === undefined
          ? existing.lastHeartbeatAt
          : (params.last_heartbeat_at ? new Date(params.last_heartbeat_at) : null),
        startedAt: params.started_at === undefined
          ? existing.startedAt
          : (params.started_at ? new Date(params.started_at) : null),
        completedAt: params.completed_at === undefined
          ? existing.completedAt
          : (params.completed_at ? new Date(params.completed_at) : null),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.automationCommands.id, params.id),
          eq(schema.automationCommands.version, params.expectedVersion),
        ),
      )
      .returning()

    if (nextRows.length === 0) {
      return { conflict: true }
    }

    const next = dbRowToRecord(nextRows[0])

    await db.insert(schema.automationEvents).values({
      commandId: next.id,
      orgId: next.org_id,
      correlationId: next.correlation_id,
      event: eventType,
      actor: params.actor,
      payload: {
        status: next.status,
        version: next.version,
        attempt_count: next.attempt_count,
      },
      hash,
      previousHash: lastHash,
    })

    return { record: next, conflict: false }
  }

  const existing = getMemById(params.id)
  if (!existing) return { conflict: true }
  if (existing.version !== params.expectedVersion) return { conflict: true }

  const next: CommandRecord = {
    ...existing,
    status: params.status ?? existing.status,
    version: existing.version + 1,
    run_id: params.run_id === undefined ? existing.run_id : params.run_id,
    run_url: params.run_url === undefined ? existing.run_url : params.run_url,
    error_message: params.error_message === undefined ? existing.error_message : params.error_message,
    args: params.args === undefined ? existing.args : params.args,
    attempt_count: params.attempt_count === undefined ? existing.attempt_count : params.attempt_count,
    execution_owner: params.execution_owner === undefined ? existing.execution_owner : params.execution_owner,
    lease_expires_at: params.lease_expires_at === undefined ? existing.lease_expires_at : params.lease_expires_at,
    last_heartbeat_at: params.last_heartbeat_at === undefined ? existing.last_heartbeat_at : params.last_heartbeat_at,
    started_at: params.started_at === undefined ? existing.started_at : params.started_at,
    completed_at: params.completed_at === undefined ? existing.completed_at : params.completed_at,
    updated_at: nowISO(),
  }

  saveMem(next)
  return { record: next, conflict: false }
}

export async function updateCommandStatus(
  correlationId: string,
  status: CommandStatus,
  extra?: {
    run_id?: string
    run_url?: string
    error_message?: string
    args?: Record<string, unknown>
  },
): Promise<CommandRecord | undefined> {
  const existing = await getCommand(correlationId)
  if (!existing) return undefined
  const updated = await updateCommandById({
    id: existing.id,
    status,
    expectedVersion: existing.version,
    actor: 'system',
    run_id: extra?.run_id,
    run_url: extra?.run_url,
    error_message: extra?.error_message,
    args: extra?.args,
    eventType: status,
  })
  return updated.record
}

export async function claimExecutionLease(params: {
  id: string
  expectedVersion: number
  owner: string
  leaseMs: number
}): Promise<{ record?: CommandRecord; conflict: boolean }> {
  return updateCommandById({
    id: params.id,
    status: 'running',
    expectedVersion: params.expectedVersion,
    actor: params.owner,
    execution_owner: params.owner,
    lease_expires_at: addMsIso(params.leaseMs),
    last_heartbeat_at: nowISO(),
    started_at: nowISO(),
    eventType: 'lease.claimed',
  })
}

export async function renewExecutionLease(params: {
  id: string
  expectedVersion: number
  owner: string
  leaseMs: number
}): Promise<{ record?: CommandRecord; conflict: boolean }> {
  return updateCommandById({
    id: params.id,
    expectedVersion: params.expectedVersion,
    actor: params.owner,
    execution_owner: params.owner,
    lease_expires_at: addMsIso(params.leaseMs),
    last_heartbeat_at: nowISO(),
    eventType: 'lease.renewed',
  })
}

export async function releaseExecutionLease(params: {
  id: string
  expectedVersion: number
  actor: string
  status: CommandStatus
  error_message?: string | null
  args?: Record<string, unknown>
  attempt_count?: number
  completed?: boolean
}): Promise<{ record?: CommandRecord; conflict: boolean }> {
  return updateCommandById({
    id: params.id,
    status: params.status,
    expectedVersion: params.expectedVersion,
    actor: params.actor,
    execution_owner: null,
    lease_expires_at: null,
    last_heartbeat_at: nowISO(),
    error_message: params.error_message,
    args: params.args,
    attempt_count: params.attempt_count,
    completed_at: params.completed ? nowISO() : null,
    eventType: params.status,
  })
}

export async function recoverExpiredLeases(
  limit = 50,
): Promise<CommandRecord[]> {
  const candidates = await listCommands(limit, {
    statuses: ['running'],
    onlyLeaseExpired: true,
  })

  const recovered: CommandRecord[] = []
  for (const run of candidates) {
    const updated = await updateCommandById({
      id: run.id,
      status: 'dispatched',
      expectedVersion: run.version,
      actor: 'system.recovery',
      execution_owner: null,
      lease_expires_at: null,
      last_heartbeat_at: nowISO(),
      eventType: 'lease.recovered',
    })
    if (updated.record) {
      recovered.push(updated.record)
    }
  }

  return recovered
}
