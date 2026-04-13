/**
 * Webhook Connector — receives and sends webhook payloads.
 * Capabilities: inbound (webhook_receive), outbound (webhook_send).
 */
import type { IntegrationConnection } from '@nzila/platform-integrations-types'
import type {
  ConnectorAdapter,
  ConnectionTestResult,
  ConnectorExecutionResult,
} from '@nzila/platform-integrations/connector-registry'
import { computeHmacSignature, verifyHmacSignature } from '@nzila/platform-integrations/signature'

export class WebhookConnector implements ConnectorAdapter {
  readonly definition = {
    id: 'nzila.webhook',
    type: 'webhook' as const,
    name: 'Webhook',
    description: 'Send and receive payloads via HTTP webhooks with HMAC signature verification.',
    version: '1.0.0',
    capabilities: ['inbound', 'outbound', 'webhook_receive', 'webhook_send'] as const,
    configSchema: {
      targetUrl: { type: 'string', description: 'Outbound webhook URL' },
      secret: { type: 'string', description: 'HMAC signing secret' },
      signatureHeader: { type: 'string', description: 'Header name for signature', default: 'x-signature-256' },
    },
    authMethods: ['hmac_signature', 'none'] as const,
  }

  async testConnection(connection: IntegrationConnection): Promise<ConnectionTestResult> {
    const config = connection.config as { targetUrl?: string }
    const start = Date.now()

    if (!config.targetUrl) {
      return { success: true, latencyMs: 0, message: 'Inbound-only webhook (no target URL configured).' }
    }

    // Validate that the target URL is reachable
    try {
      const url = new URL(config.targetUrl)
      if (!['http:', 'https:'].includes(url.protocol)) {
        return { success: false, latencyMs: 0, message: `Invalid protocol: ${url.protocol}` }
      }
      const response = await fetch(config.targetUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10_000),
      })
      return {
        success: response.ok || response.status === 405,
        latencyMs: Date.now() - start,
        message: response.ok ? 'Webhook endpoint reachable.' : `HTTP ${response.status}`,
      }
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        message: err instanceof Error ? err.message : 'Connection test failed.',
      }
    }
  }

  async executeInbound(
    connection: IntegrationConnection,
    payload: Record<string, unknown>,
  ): Promise<ConnectorExecutionResult> {
    const start = Date.now()
    const config = connection.config as { secret?: string; signatureHeader?: string }

    // Verify inbound signature if secret is configured
    if (config.secret && payload.__signature) {
      const body = JSON.stringify(payload.__body ?? payload)
      const signature = payload.__signature as string
      const valid = verifyHmacSignature(body, config.secret, signature, 'sha256')
      if (!valid) {
        return {
          success: false,
          data: null,
          statusCode: 401,
          error: 'Webhook signature verification failed.',
          durationMs: Date.now() - start,
          retryable: false,
        }
      }
    }

    // Pass-through: the payload is the data
    const data = (payload.__body ?? payload) as Record<string, unknown>
    return {
      success: true,
      data,
      statusCode: 200,
      error: null,
      durationMs: Date.now() - start,
      retryable: false,
    }
  }

  async executeOutbound(
    connection: IntegrationConnection,
    payload: Record<string, unknown>,
  ): Promise<ConnectorExecutionResult> {
    const start = Date.now()
    const config = connection.config as { targetUrl?: string; secret?: string; signatureHeader?: string }

    if (!config.targetUrl) {
      return {
        success: false,
        data: null,
        statusCode: null,
        error: 'No target URL configured for outbound webhook.',
        durationMs: 0,
        retryable: false,
      }
    }

    const body = JSON.stringify(payload)
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }

    if (config.secret) {
      const sig = computeHmacSignature(body, config.secret, 'sha256')
      headers[config.signatureHeader ?? 'x-signature-256'] = `sha256=${sig}`
    }

    try {
      const response = await fetch(config.targetUrl, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(30_000),
      })
      const text = await response.text()
      let data: Record<string, unknown> | null = null
      try {
        data = JSON.parse(text) as Record<string, unknown>
      } catch {
        // Non-JSON response is fine
      }

      return {
        success: response.ok,
        data,
        statusCode: response.status,
        error: response.ok ? null : `HTTP ${response.status}: ${text.slice(0, 500)}`,
        durationMs: Date.now() - start,
        retryable: response.status >= 500 || response.status === 429,
      }
    } catch (err) {
      return {
        success: false,
        data: null,
        statusCode: null,
        error: err instanceof Error ? err.message : 'Outbound webhook failed.',
        durationMs: Date.now() - start,
        retryable: true,
      }
    }
  }
}
