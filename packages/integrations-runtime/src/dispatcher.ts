/**
 * Nzila OS — Integration Runtime: Dispatcher
 *
 * Unified message dispatcher: route → service → adapter.
 * Handles retry + DLQ + audit event emission.
 */
import type {
  SendRequest,
  SendResult,
  IntegrationAdapter,
  IntegrationProvider,
  IntegrationType,
  DeliveryStatus,
} from '@nzila/integrations-core'
import { withRetry, type RetryOptions, DEFAULT_RETRY_OPTIONS } from './retry'

// ── Ports (dependency injection) ────────────────────────────────────────────

export interface DispatcherPorts {
  /** Resolve the active adapter for a provider + channel */
  getAdapter(provider: IntegrationProvider, channel: IntegrationType): IntegrationAdapter
  /** Resolve credentials for a config */
  getCredentials(configId: string): Promise<Record<string, unknown>>
  /** Resolve the active config for an orgId + channel */
  resolveConfig(orgId: string, channel: IntegrationType): Promise<{
    id: string
    provider: IntegrationProvider
  }>
  /** Persist a delivery record */
  recordDelivery(data: {
    orgId: string
    configId: string
    channel: IntegrationType
    provider: IntegrationProvider
    recipientRef: string
    templateId?: string
    payload: Record<string, unknown>
    correlationId: string
    status: DeliveryStatus
    providerMessageId?: string
    lastError?: string
    attempts: number
  }): Promise<{ id: string }>
  /** Update delivery status */
  updateDeliveryStatus(
    deliveryId: string,
    status: DeliveryStatus,
    update?: { providerMessageId?: string; lastError?: string; attempts?: number },
  ): Promise<void>
  /** Send to DLQ */
  enqueueDlq(data: {
    deliveryId: string
    orgId: string
    provider: IntegrationProvider
    channel: IntegrationType
    lastError: string
    payload: Record<string, unknown>
    attempts: number
  }): Promise<void>
  /** Emit audit event */
  emitAudit(event: {
    type: string
    orgId: string
    provider: IntegrationProvider
    channel: IntegrationType
    deliveryId: string
    correlationId: string
    details?: Record<string, unknown>
  }): void
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

export interface DispatcherOptions {
  readonly retry?: RetryOptions
}

export class IntegrationDispatcher {
  private readonly ports: DispatcherPorts
  private readonly retryOptions: RetryOptions

  constructor(ports: DispatcherPorts, options?: DispatcherOptions) {
    this.ports = ports
    this.retryOptions = options?.retry ?? DEFAULT_RETRY_OPTIONS
  }

  async dispatch(request: SendRequest): Promise<SendResult> {
    // 1. Resolve config + adapter
    const config = await this.ports.resolveConfig(request.orgId, request.channel)
    const adapter = this.ports.getAdapter(config.provider, request.channel)
    const credentials = await this.ports.getCredentials(config.id)

    // 2. Record initial delivery (queued)
    const delivery = await this.ports.recordDelivery({
      orgId: request.orgId,
      configId: config.id,
      channel: request.channel,
      provider: config.provider,
      recipientRef: request.to,
      templateId: request.templateId,
      payload: request.variables ?? {},
      correlationId: request.correlationId,
      status: 'queued',
      attempts: 0,
    })

    this.ports.emitAudit({
      type: 'integration.delivery.queued',
      orgId: request.orgId,
      provider: config.provider,
      channel: request.channel,
      deliveryId: delivery.id,
      correlationId: request.correlationId,
    })

    // 3. Attempt send with retries
    const result = await withRetry(
      () => adapter.send(request, credentials),
      this.retryOptions,
    )

    if (result.ok && result.data.ok) {
      // Success
      await this.ports.updateDeliveryStatus(delivery.id, 'sent', {
        providerMessageId: result.data.providerMessageId,
        attempts: result.attempts,
      })
      this.ports.emitAudit({
        type: 'integration.delivery.sent',
        orgId: request.orgId,
        provider: config.provider,
        channel: request.channel,
        deliveryId: delivery.id,
        correlationId: request.correlationId,
        details: { providerMessageId: result.data.providerMessageId },
      })
      return result.data
    }

    // Failure — send to DLQ
    const errorMessage = result.ok ? (result.data.error ?? 'Unknown error') : result.error
    await this.ports.updateDeliveryStatus(delivery.id, 'dlq', {
      lastError: errorMessage,
      attempts: result.attempts,
    })

    this.ports.emitAudit({
      type: 'integration.delivery.failed',
      orgId: request.orgId,
      provider: config.provider,
      channel: request.channel,
      deliveryId: delivery.id,
      correlationId: request.correlationId,
      details: { error: errorMessage, attempts: result.attempts },
    })

    await this.ports.enqueueDlq({
      deliveryId: delivery.id,
      orgId: request.orgId,
      provider: config.provider,
      channel: request.channel,
      lastError: errorMessage,
      payload: request.variables ?? {},
      attempts: result.attempts,
    })

    this.ports.emitAudit({
      type: 'integration.delivery.dlq',
      orgId: request.orgId,
      provider: config.provider,
      channel: request.channel,
      deliveryId: delivery.id,
      correlationId: request.correlationId,
    })

    return { ok: false, error: errorMessage }
  }
}
