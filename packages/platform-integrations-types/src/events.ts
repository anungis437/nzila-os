/**
 * @nzila/platform-integrations-types — Event Types
 *
 * Canonical types for integration events, subscriptions, and runs.
 */

// ─── Sync Direction ──────────────────────────────────────────────────────────

export type SyncDirection = 'inbound' | 'outbound' | 'bidirectional'

// ─── Integration Event Definition ────────────────────────────────────────────

export interface IntegrationEventDefinition {
  readonly type: string
  readonly version: string
  readonly description: string
  readonly direction: SyncDirection
  readonly payloadSchema: Record<string, unknown>
}

// ─── Integration Run ─────────────────────────────────────────────────────────

export type RunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'partial'
  | 'cancelled'
  | 'retrying'

export interface IntegrationRun {
  readonly id: string
  readonly orgId: string
  readonly connectionId: string
  readonly direction: SyncDirection
  readonly eventType: string
  readonly sourceSystem: string
  readonly targetSystem: string
  readonly status: RunStatus
  readonly traceId: string
  readonly idempotencyKey: string | null
  readonly startedAt: string
  readonly finishedAt: string | null
  readonly errorSummary: string | null
  readonly payloadSummary: Record<string, unknown> | null
  readonly recordsProcessed: number
  readonly recordsFailed: number
}

export interface CreateRunInput {
  readonly orgId: string
  readonly connectionId: string
  readonly direction: SyncDirection
  readonly eventType: string
  readonly sourceSystem: string
  readonly targetSystem: string
  readonly traceId: string
  readonly idempotencyKey?: string
}

// ─── Event Subscription ──────────────────────────────────────────────────────

export interface IntegrationEventSubscription {
  readonly id: string
  readonly orgId: string
  readonly connectionId: string
  readonly eventType: string
  readonly targetEndpoint: string | null
  readonly targetAction: string | null
  readonly enabled: boolean
  readonly filterRules: Record<string, unknown> | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CreateSubscriptionInput {
  readonly orgId: string
  readonly connectionId: string
  readonly eventType: string
  readonly targetEndpoint?: string
  readonly targetAction?: string
  readonly filterRules?: Record<string, unknown>
}

// ─── Integration Event ───────────────────────────────────────────────────────

export interface IntegrationEvent {
  readonly id: string
  readonly type: string
  readonly version: string
  readonly orgId: string
  readonly connectionId: string | null
  readonly actorId: string
  readonly actorType: 'user' | 'service' | 'connector' | 'system'
  readonly payload: Record<string, unknown>
  readonly metadata: IntegrationEventMetadata
  readonly createdAt: string
}

export interface IntegrationEventMetadata {
  readonly traceId: string
  readonly spanId?: string
  readonly correlationId: string
  readonly causationId?: string
  readonly source: string
  readonly sourceSystem?: string
  readonly idempotencyKey?: string
}
