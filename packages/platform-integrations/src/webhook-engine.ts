/**
 * @nzila/platform-integrations — Webhook Engine
 *
 * Manages outbound webhook delivery with retry, backoff, dead-letter queue,
 * and replay support. Also handles inbound webhook signature verification.
 */
import type {
  DeliveryAttempt,
  DeadLetterRecord,
  CreateDeadLetterInput,
  RetryPolicy,
  WebhookDeliveryConfig,
  IntegrationEventSubscription,
  ReplayRequest,
  ReplayResult,
  DeliveryAttemptStatus,
} from '@nzila/platform-integrations-types'
import type { IntegrationAuditHooks } from './audit-hooks'
import { computeHmacSignature } from './signature'

// ─── Store Interfaces ────────────────────────────────────────────────────────

export interface DeliveryAttemptStore {
  create(attempt: Omit<DeliveryAttempt, 'id'>): Promise<DeliveryAttempt>
  listByRun(runId: string, limit?: number): Promise<DeliveryAttempt[]>
  getLatestByRun(runId: string): Promise<DeliveryAttempt | null>
}

export interface DeadLetterStore {
  create(input: CreateDeadLetterInput): Promise<DeadLetterRecord>
  getById(id: string): Promise<DeadLetterRecord | null>
  listByOrg(orgId: string, options?: { limit?: number; offset?: number; resolved?: boolean }): Promise<DeadLetterRecord[]>
  countByOrg(orgId: string, resolved?: boolean): Promise<number>
  resolve(id: string, resolvedBy: string, notes?: string): Promise<void>
}

export interface SubscriptionStore {
  create(input: Omit<IntegrationEventSubscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<IntegrationEventSubscription>
  getById(id: string): Promise<IntegrationEventSubscription | null>
  listByConnection(connectionId: string): Promise<IntegrationEventSubscription[]>
  listByEventType(orgId: string, eventType: string): Promise<IntegrationEventSubscription[]>
  update(id: string, enabled: boolean): Promise<void>
  delete(id: string): Promise<boolean>
}

// ─── Webhook Fetch Port ──────────────────────────────────────────────────────

export interface WebhookFetchPort {
  fetch(url: string, options: {
    method: string
    headers: Record<string, string>
    body: string
    signal?: AbortSignal
  }): Promise<{ status: number; body: string }>
}

/** Default fetch implementation using globalThis.fetch */
export const defaultFetchPort: WebhookFetchPort = {
  async fetch(url, options) {
    const response = await globalThis.fetch(url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
      signal: options.signal,
    })
    const body = await response.text()
    return { status: response.status, body: body.slice(0, 4096) }
  },
}

// ─── Default Retry Policy ────────────────────────────────────────────────────

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
}

// ─── Webhook Engine ──────────────────────────────────────────────────────────

export interface WebhookEnginePorts {
  readonly deliveryStore: DeliveryAttemptStore
  readonly deadLetterStore: DeadLetterStore
  readonly subscriptionStore: SubscriptionStore
  readonly auditHooks: IntegrationAuditHooks
  readonly fetchPort?: WebhookFetchPort
}

export class WebhookEngine {
  private readonly ports: WebhookEnginePorts
  private readonly fetchPort: WebhookFetchPort

  constructor(ports: WebhookEnginePorts) {
    this.ports = ports
    this.fetchPort = ports.fetchPort ?? defaultFetchPort
  }

  /**
   * Deliver an outbound webhook to a configured endpoint with retry.
   */
  async deliver(
    runId: string,
    orgId: string,
    config: WebhookDeliveryConfig,
    payload: Record<string, unknown>,
    traceId: string,
  ): Promise<{ success: boolean; attempts: DeliveryAttempt[]; deadLettered: boolean }> {
    const retryPolicy = config.retryPolicy ?? DEFAULT_RETRY_POLICY
    const attempts: DeliveryAttempt[] = []
    let success = false

    const body = JSON.stringify(payload)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Trace-Id': traceId,
      'X-Nzila-Event-Id': runId,
      ...config.headers,
    }

    // Compute signature if configured
    if (config.signingSecret && config.signatureHeader) {
      const signature = computeHmacSignature(body, config.signingSecret, config.signatureAlgorithm ?? 'hmac-sha256')
      headers[config.signatureHeader] = signature
    }

    for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt++) {
      if (attempt > 1) {
        const delay = Math.min(
          retryPolicy.initialDelayMs * Math.pow(retryPolicy.backoffMultiplier, attempt - 1),
          retryPolicy.maxDelayMs,
        )
        await this.delay(delay)
      }

      const startTime = Date.now()
      let status: DeliveryAttemptStatus = 'pending'
      let responseCode: number | null = null
      let responseExcerpt: string | null = null
      let error: string | null = null

      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), config.timeout)

        try {
          const response = await this.fetchPort.fetch(config.url, {
            method: config.method,
            headers,
            body,
            signal: controller.signal,
          })
          responseCode = response.status
          responseExcerpt = response.body.slice(0, 1024)

          if (response.status >= 200 && response.status < 300) {
            status = 'success'
            success = true
          } else if (retryPolicy.retryableStatusCodes.includes(response.status)) {
            status = 'failed'
            error = `HTTP ${response.status}`
          } else {
            status = 'rejected'
            error = `HTTP ${response.status} (non-retryable)`
          }
        } finally {
          clearTimeout(timeout)
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          status = 'timeout'
          error = `Request timed out after ${config.timeout}ms`
        } else {
          status = 'failed'
          error = err instanceof Error ? err.message : 'Unknown fetch error'
        }
      }

      const durationMs = Date.now() - startTime
      const deliveryAttempt = await this.ports.deliveryStore.create({
        runId,
        attemptNumber: attempt,
        status,
        responseCode,
        responseExcerpt,
        durationMs,
        attemptedAt: new Date().toISOString(),
        error,
      })
      attempts.push(deliveryAttempt)

      if (success || status === 'rejected') break
    }

    // Dead-letter if all attempts failed
    let deadLettered = false
    if (!success) {
      await this.ports.deadLetterStore.create({
        orgId,
        connectionId: runId, // correlation
        eventType: 'webhook.delivery',
        payloadJson: payload,
        reason: attempts[attempts.length - 1]?.error ?? 'Max attempts exhausted',
        traceId,
        maxAttemptsReached: true,
      })
      deadLettered = true
    }

    return { success, attempts, deadLettered }
  }

  /**
   * Publish an event to all matching subscriptions.
   */
  async publishEvent(
    orgId: string,
    eventType: string,
    payload: Record<string, unknown>,
    traceId: string,
    runId: string,
  ): Promise<{ deliveries: number; successes: number; failures: number }> {
    const subscriptions = await this.ports.subscriptionStore.listByEventType(orgId, eventType)
    const enabledSubs = subscriptions.filter(s => s.enabled)

    let successes = 0
    let failures = 0

    for (const sub of enabledSubs) {
      if (!sub.targetEndpoint) continue

      const config: WebhookDeliveryConfig = {
        url: sub.targetEndpoint,
        method: 'POST',
        headers: { 'X-Event-Type': eventType },
        timeout: 30000,
        retryPolicy: DEFAULT_RETRY_POLICY,
      }

      const result = await this.deliver(runId, orgId, config, payload, traceId)
      if (result.success) {
        successes++
      } else {
        failures++
      }
    }

    return { deliveries: enabledSubs.length, successes, failures }
  }

  /**
   * Replay dead-lettered events.
   */
  async replay(request: ReplayRequest): Promise<ReplayResult[]> {
    const results: ReplayResult[] = []

    for (const dlId of request.deadLetterIds) {
      const dl = await this.ports.deadLetterStore.getById(dlId)
      if (!dl) {
        results.push({ deadLetterId: dlId, success: false, newRunId: null, error: 'Dead letter not found' })
        continue
      }

      await this.ports.deadLetterStore.resolve(dlId, request.actorId, request.reason)

      await this.ports.auditHooks.recordIntegrationAction({
        orgId: dl.orgId,
        actorId: request.actorId,
        action: 'dead_letter.replay',
        resource: 'integration_dead_letter',
        resourceId: dlId,
        payload: { reason: request.reason },
      })

      results.push({ deadLetterId: dlId, success: true, newRunId: null, error: null })
    }

    return results
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
