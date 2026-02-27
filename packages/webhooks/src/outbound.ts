/**
 * Nzila OS — Webhooks: Outbound Webhook Dispatcher
 *
 * Delivers events to org-scoped webhook subscriptions with:
 * - HMAC-SHA256 signatures
 * - Idempotency keys (replay protection)
 * - Retry + DLQ
 * - Audit trail
 */
import type { WebhookSubscription, WebhookDeliveryAttempt } from './types'

// ── Ports ───────────────────────────────────────────────────────────────────

export interface OutboundWebhookPorts {
  /** Find all active subscriptions for an org that subscribe to this event */
  findSubscriptions(orgId: string, event: string): Promise<readonly WebhookSubscription[]>
  /** Record a delivery attempt */
  recordAttempt(attempt: Omit<WebhookDeliveryAttempt, 'id' | 'createdAt'>): Promise<void>
  /** Emit audit event */
  emitAudit(event: {
    type: string
    orgId: string
    subscriptionId: string
    deliveryEvent: string
    idempotencyKey: string
    details?: Record<string, unknown>
  }): void
}

export interface OutboundWebhookOptions {
  readonly maxAttempts: number
  readonly baseDelayMs: number
}

const DEFAULT_OPTIONS: OutboundWebhookOptions = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
}

// ── HMAC signature ──────────────────────────────────────────────────────────

async function computeHmacSha256(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

export class OutboundWebhookDispatcher {
  private readonly ports: OutboundWebhookPorts
  private readonly options: OutboundWebhookOptions

  constructor(ports: OutboundWebhookPorts, options?: Partial<OutboundWebhookOptions>) {
    this.ports = ports
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Deliver an event to all matching webhook subscriptions for an org.
   */
  async deliver(
    orgId: string,
    event: string,
    payload: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<{ delivered: number; failed: number }> {
    const subscriptions = await this.ports.findSubscriptions(orgId, event)
    let delivered = 0
    let failed = 0

    for (const sub of subscriptions) {
      const success = await this.deliverToSubscription(sub, event, payload, idempotencyKey)
      if (success) delivered++
      else failed++
    }

    return { delivered, failed }
  }

  private async deliverToSubscription(
    sub: WebhookSubscription,
    event: string,
    payload: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<boolean> {
    const body = JSON.stringify({
      event,
      payload,
      idempotencyKey,
      timestamp: new Date().toISOString(),
    })

    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      try {
        const signature = await computeHmacSha256(sub.secret, body)

        const response = await fetch(sub.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Nzila-Signature': `sha256=${signature}`,
            'X-Nzila-Event': event,
            'X-Nzila-Idempotency-Key': idempotencyKey,
            'X-Nzila-Delivery-Attempt': String(attempt),
          },
          body,
        })

        const responseBody = await response.text()
        const success = response.ok

        await this.ports.recordAttempt({
          subscriptionId: sub.id,
          event,
          payload,
          idempotencyKey,
          responseStatus: response.status,
          responseBody: responseBody.slice(0, 1024), // cap stored response
          success,
          attemptNumber: attempt,
        })

        if (success) {
          this.ports.emitAudit({
            type: 'integration.webhook.delivered',
            orgId: sub.orgId,
            subscriptionId: sub.id,
            deliveryEvent: event,
            idempotencyKey,
            details: { status: response.status, attempt },
          })
          return true
        }

        // Retry with backoff
        if (attempt < this.options.maxAttempts) {
          const delay = this.options.baseDelayMs * Math.pow(2, attempt - 1)
          await new Promise((r) => setTimeout(r, delay))
        }
      } catch (err) {
        await this.ports.recordAttempt({
          subscriptionId: sub.id,
          event,
          payload,
          idempotencyKey,
          responseStatus: null,
          responseBody: err instanceof Error ? err.message : String(err),
          success: false,
          attemptNumber: attempt,
        })

        if (attempt < this.options.maxAttempts) {
          const delay = this.options.baseDelayMs * Math.pow(2, attempt - 1)
          await new Promise((r) => setTimeout(r, delay))
        }
      }
    }

    // All attempts exhausted
    this.ports.emitAudit({
      type: 'integration.webhook.failed',
      orgId: sub.orgId,
      subscriptionId: sub.id,
      deliveryEvent: event,
      idempotencyKey,
      details: { maxAttempts: this.options.maxAttempts },
    })
    return false
  }
}
