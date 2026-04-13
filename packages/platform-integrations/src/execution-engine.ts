/**
 * @nzila/platform-integrations — Execution Engine
 *
 * Orchestrates the lifecycle of an integration run:
 * validate → map → check idempotency → execute → record → audit → emit event.
 */
import type {
  IntegrationRun,
  CreateRunInput,
  RunStatus,
  SyncDirection,
  IntegrationConnection,
  IntegrationEventMetadata,
} from '@nzila/platform-integrations-types'
import { inboundPayloadSchema } from '@nzila/platform-integrations-types/schemas'
import type { ConnectorAdapter, ConnectorExecutionResult } from './connector-registry'
import type { IntegrationAuditHooks } from './audit-hooks'
import type { IdempotencyStore } from './idempotency'

// ─── Run Store Interface ─────────────────────────────────────────────────────

export interface RunStore {
  create(input: CreateRunInput): Promise<IntegrationRun>
  getById(id: string): Promise<IntegrationRun | null>
  listByOrg(orgId: string, options?: { limit?: number; offset?: number; status?: RunStatus }): Promise<IntegrationRun[]>
  listByConnection(connectionId: string, options?: { limit?: number; offset?: number }): Promise<IntegrationRun[]>
  updateStatus(id: string, status: RunStatus, update?: { errorSummary?: string; finishedAt?: string; recordsProcessed?: number; recordsFailed?: number }): Promise<void>
}

// ─── Event Emitter Interface ─────────────────────────────────────────────────

export interface IntegrationEventEmitter {
  emit(event: {
    type: string
    orgId: string
    connectionId: string | null
    actorId: string
    actorType: 'user' | 'service' | 'connector' | 'system'
    payload: Record<string, unknown>
    metadata: IntegrationEventMetadata
  }): Promise<void>
}

// ─── Execution Context ───────────────────────────────────────────────────────

export interface ExecutionContext {
  readonly orgId: string
  readonly actorId: string
  readonly actorType: 'user' | 'service' | 'connector' | 'system'
  readonly traceId: string
  readonly spanId?: string
  readonly correlationId: string
  readonly idempotencyKey?: string
}

// ─── Execution Engine ────────────────────────────────────────────────────────

export interface ExecutionEnginePorts {
  readonly runStore: RunStore
  readonly auditHooks: IntegrationAuditHooks
  readonly eventEmitter: IntegrationEventEmitter
  readonly idempotencyStore: IdempotencyStore
}

export class IntegrationExecutionEngine {
  private readonly ports: ExecutionEnginePorts

  constructor(ports: ExecutionEnginePorts) {
    this.ports = ports
  }

  /**
   * Execute an inbound integration — external system pushing data into Nzila.
   */
  async executeInbound(
    connection: IntegrationConnection,
    adapter: ConnectorAdapter,
    payload: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<IntegrationRun> {
    // Check idempotency
    if (context.idempotencyKey) {
      const existing = await this.ports.idempotencyStore.check(context.idempotencyKey)
      if (existing) {
        return existing as unknown as IntegrationRun
      }
    }

    // Create run record
    const run = await this.ports.runStore.create({
      orgId: context.orgId,
      connectionId: connection.id,
      direction: 'inbound',
      eventType: 'inbound.payload',
      sourceSystem: connection.name,
      targetSystem: 'nzila',
      traceId: context.traceId,
      idempotencyKey: context.idempotencyKey,
    })

    await this.ports.runStore.updateStatus(run.id, 'running')

    try {
      const result = await adapter.executeInbound(connection, payload)

      if (result.success) {
        await this.ports.runStore.updateStatus(run.id, 'completed', {
          finishedAt: new Date().toISOString(),
          recordsProcessed: 1,
        })
      } else {
        await this.ports.runStore.updateStatus(run.id, 'failed', {
          errorSummary: result.error ?? 'Unknown error',
          finishedAt: new Date().toISOString(),
          recordsFailed: 1,
        })
      }

      // Record idempotency
      if (context.idempotencyKey) {
        await this.ports.idempotencyStore.record(context.idempotencyKey, { runId: run.id })
      }

      // Audit
      await this.ports.auditHooks.recordIntegrationAction({
        orgId: context.orgId,
        actorId: context.actorId,
        action: 'inbound.execute',
        resource: 'integration_run',
        resourceId: run.id,
        payload: {
          connectionId: connection.id,
          connectorType: connection.connectorType,
          success: result.success,
          traceId: context.traceId,
        },
        traceId: context.traceId,
      })

      // Emit event
      await this.ports.eventEmitter.emit({
        type: result.success ? 'integration.run.completed' : 'integration.run.failed',
        orgId: context.orgId,
        connectionId: connection.id,
        actorId: context.actorId,
        actorType: context.actorType,
        payload: { runId: run.id, direction: 'inbound', success: result.success },
        metadata: {
          traceId: context.traceId,
          correlationId: context.correlationId,
          source: 'platform-integrations',
          idempotencyKey: context.idempotencyKey,
        },
      })

      return { ...run, status: result.success ? 'completed' : 'failed' as RunStatus }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      await this.ports.runStore.updateStatus(run.id, 'failed', {
        errorSummary: errorMsg,
        finishedAt: new Date().toISOString(),
        recordsFailed: 1,
      })
      throw error
    }
  }

  /**
   * Execute an outbound integration — Nzila pushing data to external system.
   */
  async executeOutbound(
    connection: IntegrationConnection,
    adapter: ConnectorAdapter,
    payload: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<IntegrationRun> {
    const run = await this.ports.runStore.create({
      orgId: context.orgId,
      connectionId: connection.id,
      direction: 'outbound',
      eventType: 'outbound.push',
      sourceSystem: 'nzila',
      targetSystem: connection.name,
      traceId: context.traceId,
      idempotencyKey: context.idempotencyKey,
    })

    await this.ports.runStore.updateStatus(run.id, 'running')

    try {
      const result = await adapter.executeOutbound(connection, payload)

      const finalStatus: RunStatus = result.success ? 'completed' : 'failed'
      await this.ports.runStore.updateStatus(run.id, finalStatus, {
        errorSummary: result.error ?? undefined,
        finishedAt: new Date().toISOString(),
        recordsProcessed: result.success ? 1 : 0,
        recordsFailed: result.success ? 0 : 1,
      })

      await this.ports.auditHooks.recordIntegrationAction({
        orgId: context.orgId,
        actorId: context.actorId,
        action: 'outbound.execute',
        resource: 'integration_run',
        resourceId: run.id,
        payload: {
          connectionId: connection.id,
          connectorType: connection.connectorType,
          success: result.success,
          traceId: context.traceId,
        },
        traceId: context.traceId,
      })

      await this.ports.eventEmitter.emit({
        type: result.success ? 'integration.run.completed' : 'integration.run.failed',
        orgId: context.orgId,
        connectionId: connection.id,
        actorId: context.actorId,
        actorType: context.actorType,
        payload: { runId: run.id, direction: 'outbound', success: result.success },
        metadata: {
          traceId: context.traceId,
          correlationId: context.correlationId,
          source: 'platform-integrations',
        },
      })

      return { ...run, status: finalStatus }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      await this.ports.runStore.updateStatus(run.id, 'failed', {
        errorSummary: errorMsg,
        finishedAt: new Date().toISOString(),
        recordsFailed: 1,
      })
      throw error
    }
  }
}
