/**
 * Nzila OS — Comms Email: Resend Adapter
 */
import type {
  IntegrationAdapter,
  SendRequest,
  SendResult,
  HealthCheckResult,
} from '@nzila/integrations-core'

interface ResendCredentials {
  apiKey: string
  fromAddress: string
}

function parseCredentials(creds: Record<string, unknown>): ResendCredentials {
  const apiKey = creds['apiKey']
  const fromAddress = creds['fromAddress']
  if (typeof apiKey !== 'string' || !apiKey) throw new Error('Missing Resend apiKey')
  if (typeof fromAddress !== 'string' || !fromAddress) throw new Error('Missing Resend fromAddress')
  return { apiKey, fromAddress }
}

export const resendAdapter: IntegrationAdapter = {
  provider: 'resend',
  channel: 'email',

  async send(request: SendRequest, credentials: Record<string, unknown>): Promise<SendResult> {
    const { apiKey, fromAddress } = parseCredentials(credentials)
    const { Resend } = await import('resend')
    const client = new Resend(apiKey)

    const { data, error } = await client.emails.send({
      from: fromAddress,
      to: request.to,
      subject: request.subject ?? '(no subject)',
      html: request.body ?? '',
    })

    if (error) {
      return { ok: false, error: error.message }
    }

    return { ok: true, providerMessageId: data?.id ?? undefined }
  },

  async healthCheck(credentials: Record<string, unknown>): Promise<HealthCheckResult> {
    const start = Date.now()
    try {
      const { apiKey } = parseCredentials(credentials)
      const { Resend } = await import('resend')
      const client = new Resend(apiKey)
      await client.domains.list()
      return {
        provider: 'resend',
        status: 'ok',
        latencyMs: Date.now() - start,
        details: null,
        checkedAt: new Date().toISOString(),
      }
    } catch (err) {
      return {
        provider: 'resend',
        status: 'down',
        latencyMs: Date.now() - start,
        details: err instanceof Error ? err.message : String(err),
        checkedAt: new Date().toISOString(),
      }
    }
  },
}
