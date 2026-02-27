/**
 * Nzila OS — Comms Email: SendGrid Adapter
 */
import type {
  IntegrationAdapter,
  SendRequest,
  SendResult,
  HealthCheckResult,
} from '@nzila/integrations-core'

interface SendGridCredentials {
  apiKey: string
  fromAddress: string
}

function parseCredentials(creds: Record<string, unknown>): SendGridCredentials {
  const apiKey = creds['apiKey']
  const fromAddress = creds['fromAddress']
  if (typeof apiKey !== 'string' || !apiKey) throw new Error('Missing SendGrid apiKey')
  if (typeof fromAddress !== 'string' || !fromAddress) throw new Error('Missing SendGrid fromAddress')
  return { apiKey, fromAddress }
}

export const sendgridAdapter: IntegrationAdapter = {
  provider: 'sendgrid',
  channel: 'email',

  async send(request: SendRequest, credentials: Record<string, unknown>): Promise<SendResult> {
    const { apiKey, fromAddress } = parseCredentials(credentials)
    const sgMail = await import('@sendgrid/mail')
    const client = sgMail.default ?? sgMail
    client.setApiKey(apiKey)

    try {
      const [response] = await client.send({
        to: request.to,
        from: fromAddress,
        subject: request.subject ?? '(no subject)',
        html: request.body ?? '',
      })
      return {
        ok: true,
        providerMessageId: response?.headers?.['x-message-id'] as string | undefined,
      }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  },

  async healthCheck(credentials: Record<string, unknown>): Promise<HealthCheckResult> {
    const start = Date.now()
    try {
      parseCredentials(credentials)
      // SendGrid doesn't have a simple ping — validate key format
      return {
        provider: 'sendgrid',
        status: 'ok',
        latencyMs: Date.now() - start,
        details: null,
        checkedAt: new Date().toISOString(),
      }
    } catch (err) {
      return {
        provider: 'sendgrid',
        status: 'down',
        latencyMs: Date.now() - start,
        details: err instanceof Error ? err.message : String(err),
        checkedAt: new Date().toISOString(),
      }
    }
  },
}
