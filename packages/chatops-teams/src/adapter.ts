/**
 * Nzila OS — ChatOps: Microsoft Teams Adapter
 *
 * Phase 1: Incoming Webhook connector (fast, no app registration needed)
 * Phase 2: Graph API messaging (future — requires Azure AD app registration)
 */
import type {
  IntegrationAdapter,
  SendRequest,
  SendResult,
  HealthCheckResult,
} from '@nzila/integrations-core'

interface TeamsCredentials {
  webhookUrl: string
}

function parseCredentials(creds: Record<string, unknown>): TeamsCredentials {
  const webhookUrl = creds['webhookUrl']
  if (typeof webhookUrl !== 'string' || !webhookUrl) throw new Error('Missing Teams webhookUrl')
  return { webhookUrl }
}

/**
 * Build an Adaptive Card payload for Teams incoming webhook.
 */
function buildAdaptiveCard(subject: string | undefined, body: string): Record<string, unknown> {
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            ...(subject
              ? [
                  {
                    type: 'TextBlock',
                    size: 'Medium',
                    weight: 'Bolder',
                    text: subject,
                  },
                ]
              : []),
            {
              type: 'TextBlock',
              text: body,
              wrap: true,
            },
          ],
        },
      },
    ],
  }
}

export const teamsAdapter: IntegrationAdapter = {
  provider: 'teams',
  channel: 'chatops',

  async send(request: SendRequest, credentials: Record<string, unknown>): Promise<SendResult> {
    const { webhookUrl } = parseCredentials(credentials)

    try {
      const payload = buildAdaptiveCard(request.subject, request.body ?? '')
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const text = await response.text()
        return { ok: false, error: `Teams webhook returned ${response.status}: ${text}` }
      }

      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  },

  async healthCheck(credentials: Record<string, unknown>): Promise<HealthCheckResult> {
    const start = Date.now()
    try {
      parseCredentials(credentials)
      // Incoming webhooks don't have a health endpoint — validate config presence
      return {
        provider: 'teams',
        status: 'ok',
        latencyMs: Date.now() - start,
        details: 'webhook-only mode',
        checkedAt: new Date().toISOString(),
      }
    } catch (err) {
      return {
        provider: 'teams',
        status: 'down',
        latencyMs: Date.now() - start,
        details: err instanceof Error ? err.message : String(err),
        checkedAt: new Date().toISOString(),
      }
    }
  },
}
