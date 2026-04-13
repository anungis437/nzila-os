/**
 * @nzila/platform-integrations — Sync Engine
 *
 * Orchestrates bidirectional sync with source-of-truth policy evaluation,
 * field ownership enforcement, and conflict detection.
 */
import type {
  SourceOfTruthPolicy,
  FieldOwnershipRule,
  SyncSession,
  SyncConflict,
  SyncCursor,
  SyncStatus,
} from '@nzila/platform-integrations-types'
import type { IntegrationAuditHooks } from './audit-hooks'

// ─── Stores ──────────────────────────────────────────────────────────────────

export interface SyncSessionStore {
  create(session: Omit<SyncSession, 'id'>): Promise<SyncSession>
  update(id: string, patch: Partial<Pick<SyncSession, 'status' | 'recordsSynced' | 'recordsFailed' | 'recordsSkipped' | 'conflicts' | 'finishedAt'>>): Promise<void>
  getById(id: string): Promise<SyncSession | null>
  listByConnection(connectionId: string): Promise<SyncSession[]>
}

export interface SyncCursorStore {
  get(connectionId: string, entityType: string, direction: 'inbound' | 'outbound'): Promise<SyncCursor | null>
  upsert(cursor: SyncCursor): Promise<void>
}

export interface SyncPolicyStore {
  getByConnectionAndEntity(connectionId: string, entityType: string): Promise<SourceOfTruthPolicy | null>
}

// ─── Record Delta ────────────────────────────────────────────────────────────

export interface SyncRecordDelta {
  /** External entity ID */
  readonly externalId: string
  /** Internal entity ID (null for new entities) */
  readonly internalId: string | null
  /** Fields and their proposed new values */
  readonly fields: Record<string, unknown>
  /** Timestamp of the change in the source system */
  readonly sourceTimestamp: string
}

// ─── Sync Result ─────────────────────────────────────────────────────────────

export interface SyncResult {
  readonly sessionId: string
  readonly status: SyncStatus
  readonly applied: number
  readonly skipped: number
  readonly failed: number
  readonly conflicts: readonly SyncConflict[]
}

// ─── Sync Engine ─────────────────────────────────────────────────────────────

export class SyncEngine {
  private readonly sessionStore: SyncSessionStore
  private readonly cursorStore: SyncCursorStore
  private readonly policyStore: SyncPolicyStore
  private readonly auditHooks: IntegrationAuditHooks

  constructor(
    sessionStore: SyncSessionStore,
    cursorStore: SyncCursorStore,
    policyStore: SyncPolicyStore,
    auditHooks: IntegrationAuditHooks,
  ) {
    this.sessionStore = sessionStore
    this.cursorStore = cursorStore
    this.policyStore = policyStore
    this.auditHooks = auditHooks
  }

  /**
   * Execute inbound sync — apply external changes to internal state.
   * Each delta is evaluated against the source-of-truth policy.
   */
  async syncInbound(
    orgId: string,
    connectionId: string,
    entityType: string,
    deltas: readonly SyncRecordDelta[],
    actorId: string,
    traceId: string,
  ): Promise<SyncResult> {
    const policy = await this.policyStore.getByConnectionAndEntity(connectionId, entityType)

    const session = await this.sessionStore.create({
      orgId,
      connectionId,
      direction: 'inbound',
      entityType,
      status: 'syncing',
      recordsSynced: 0,
      recordsFailed: 0,
      recordsSkipped: 0,
      conflicts: [],
      startedAt: new Date().toISOString(),
      finishedAt: null,
      traceId,
    })

    let applied = 0
    let skipped = 0
    let failed = 0
    const conflicts: SyncConflict[] = []

    for (const delta of deltas) {
      try {
        const fieldConflicts = this.evaluateFieldOwnership(delta, policy, 'inbound')

        if (fieldConflicts.length > 0) {
          conflicts.push(...fieldConflicts)
          skipped++
          continue
        }

        applied++
      } catch {
        failed++
      }
    }

    const finalStatus: SyncStatus = conflicts.length > 0
      ? 'conflict'
      : failed > 0
        ? (applied > 0 ? 'partial' : 'failed')
        : 'completed'

    await this.sessionStore.update(session.id, {
      status: finalStatus,
      recordsSynced: applied,
      recordsFailed: failed,
      recordsSkipped: skipped,
      conflicts,
      finishedAt: new Date().toISOString(),
    })

    // Update cursor
    if (deltas.length > 0) {
      const lastDelta = deltas[deltas.length - 1]!
      await this.cursorStore.upsert({
        connectionId,
        entityType,
        direction: 'inbound',
        lastSyncedAt: new Date().toISOString(),
        lastSyncedId: lastDelta.externalId,
        watermark: lastDelta.sourceTimestamp,
      })
    }

    await this.auditHooks.recordIntegrationAction({
      orgId,
      actorId,
      action: 'sync.inbound.completed',
      resource: 'sync_session',
      resourceId: session.id,
      payload: { applied, skipped, failed, conflictCount: conflicts.length },
    })

    return { sessionId: session.id, status: finalStatus, applied, skipped, failed, conflicts }
  }

  /**
   * Evaluate source-of-truth policy for each field in a delta.
   * Returns conflicts for fields where ownership rules prevent the write.
   */
  evaluateFieldOwnership(
    delta: SyncRecordDelta,
    policy: SourceOfTruthPolicy | null,
    direction: 'inbound' | 'outbound',
  ): SyncConflict[] {
    if (!policy) return [] // No policy = allow all

    const sourceOwner = direction === 'inbound' ? 'external' : 'internal'
    const conflicts: SyncConflict[] = []

    switch (policy.mode) {
      case 'internal':
        if (direction === 'inbound') {
          // External system cannot write when internal is source of truth
          for (const [field, value] of Object.entries(delta.fields)) {
            conflicts.push({
              entityId: delta.externalId,
              field,
              internalValue: null,
              externalValue: value,
              resolution: 'internal_wins',
              resolvedAt: new Date().toISOString(),
              resolvedBy: 'system',
            })
          }
        }
        break

      case 'external':
        if (direction === 'outbound') {
          for (const [field, value] of Object.entries(delta.fields)) {
            conflicts.push({
              entityId: delta.externalId ?? (delta.internalId || 'unknown'),
              field,
              internalValue: value,
              externalValue: null,
              resolution: 'external_wins',
              resolvedAt: new Date().toISOString(),
              resolvedBy: 'system',
            })
          }
        }
        break

      case 'field_level':
        for (const [field, value] of Object.entries(delta.fields)) {
          const rule = this.findFieldRule(field, policy.fieldOwnership)
          if (!rule) continue // No rule = allow

          if (rule.owner !== sourceOwner && rule.writePolicy === 'error') {
            conflicts.push({
              entityId: delta.externalId,
              field,
              internalValue: direction === 'inbound' ? null : value,
              externalValue: direction === 'inbound' ? value : null,
              resolution: 'manual_review',
              resolvedAt: null,
              resolvedBy: null,
            })
          } else if (rule.owner !== sourceOwner && rule.writePolicy === 'ignore') {
            conflicts.push({
              entityId: delta.externalId,
              field,
              internalValue: direction === 'inbound' ? null : value,
              externalValue: direction === 'inbound' ? value : null,
              resolution: direction === 'inbound' ? 'internal_wins' : 'external_wins',
              resolvedAt: new Date().toISOString(),
              resolvedBy: 'system',
            })
          }
        }
        break

      case 'append_only':
        // Both systems can append, conflicts only on overwrites (not tracked here)
        break
    }

    return conflicts
  }

  /**
   * Find the ownership rule for a specific field, supporting wildcards.
   */
  private findFieldRule(field: string, rules: readonly FieldOwnershipRule[]): FieldOwnershipRule | null {
    // Exact match first
    const exact = rules.find((r) => r.field === field)
    if (exact) return exact

    // Wildcard match (e.g., "address.*")
    const wildcard = rules.find((r) => {
      if (!r.field.includes('*')) return false
      const pattern = r.field.replace(/\*/g, '.*')
      return new RegExp(`^${pattern}$`).test(field)
    })
    return wildcard ?? null
  }

  /**
   * Get the last sync cursor for resumable sync.
   */
  async getCursor(
    connectionId: string,
    entityType: string,
    direction: 'inbound' | 'outbound',
  ): Promise<SyncCursor | null> {
    return this.cursorStore.get(connectionId, entityType, direction)
  }
}
