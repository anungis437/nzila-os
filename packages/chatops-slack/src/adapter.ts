/**
 * Nzila OS — ChatOps: Slack Adapter
 *
 * Supports:
 * - Incoming Webhook (default, fast)
 * - Bot token (optional, for richer interactions)
 *
 * Channel mapping via credentials metadata per org.
 */
import type {
  IntegrationAdapter,
  SendRequest,
  SendResult,
  HealthCheckResult,
} from '@nzila/integrations-core'

interface SlackWebhookCredentials {
  webhookUrl: string
  defaultChannel?: string
  /** Optional bot token for richer API access */
  botToken?: string
}

function parseCredentials(creds: Record<string, unknown>): SlackWebhookCredentials {
  const webhookUrl = creds['webhookUrl']
  if (typeof webhookUrl !== 'string' || !webhookUrl) throw new Error('Missing Slack webhookUrl')
  return {
    webhookUrl,
    defaultChannel: typeof creds['defaultChannel'] === 'string' ? creds['defaultChannel'] : undefined,
    botToken: typeof creds['botToken'] === 'string' ? creds['botToken'] : undefined,
  }
}

export const slackAdapter: IntegrationAdapter = {
  provider: 'slack',
  channel: 'chatops',

  async send(request: SendRequest, credentials: Record<string, unknown>): Promise<SendResult> {
    const { webhookUrl, botToken } = parseCredentials(credentials)

    // If bot token is available and a channel is specified, use Slack Web API
    if (botToken && request.to) {
      try {
        const response = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${botToken}`,
          },
          body: JSON.stringify({
            channel: request.to,
            text: request.body ?? '',
            ...(request.subject ? { blocks: [{ type: 'header', text: { type: 'plain_text', text: request.subject } }, { type: 'section', text: { type: 'mrkdwn', text: request.body ?? '' } }] } : {}),
          }),
        })
        const data = (await response.json()) as { ok: boolean; ts?: string; error?: string }
        if (!data.ok) return { ok: false, error: data.error ?? 'Slack API error' }
        return { ok: true, providerMessageId: data.ts }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    }

    // Fallback: use incoming webhook
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: request.subject
            ? `*${request.subject}*\n${request.body ?? ''}`
            : (request.body ?? ''),
        }),
      })
      if (!response.ok) {
        return { ok: false, error: `Slack webhook returned ${response.status}` }
      }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  },

  async healthCheck(credentials: Record<string, unknown>): Promise<HealthCheckResult> {
    const start = Date.now()
    try {
      const { botToken } = parseCredentials(credentials)
      if (botToken) {
        const response = await fetch('https://slack.com/api/auth.test', {
          method: 'POST',
          headers: { Authorization: `Bearer ${botToken}` },
        })
        const data = (await response.json()) as { ok: boolean; error?: string }
        return {
          provider: 'slack',
          status: data.ok ? 'ok' : 'degraded',
          latencyMs: Date.now() - start,
          details: data.ok ? null : (data.error ?? 'auth.test failed'),
          checkedAt: new Date().toISOString(),
        }
      }
      // Webhook-only: we can't verify without sending — assume ok if config present
      return {
        provider: 'slack',
        status: 'ok',
        latencyMs: Date.now() - start,
        details: 'webhook-only mode (no bot token)',
        checkedAt: new Date().toISOString(),
      }
    } catch (err) {
      return {
        provider: 'slack',
        status: 'down',
        latencyMs: Date.now() - start,
        details: err instanceof Error ? err.message : String(err),
        checkedAt: new Date().toISOString(),
      }
    }
  },
}
