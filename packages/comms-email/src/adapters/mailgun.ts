/**
 * Nzila OS — Comms Email: Mailgun Adapter
 */
import type {
  IntegrationAdapter,
  SendRequest,
  SendResult,
  HealthCheckResult,
} from '@nzila/integrations-core'

interface MailgunCredentials {
  apiKey: string
  domain: string
  fromAddress: string
  region?: 'us' | 'eu'
}

function parseCredentials(creds: Record<string, unknown>): MailgunCredentials {
  const apiKey = creds['apiKey']
  const domain = creds['domain']
  const fromAddress = creds['fromAddress']
  if (typeof apiKey !== 'string' || !apiKey) throw new Error('Missing Mailgun apiKey')
  if (typeof domain !== 'string' || !domain) throw new Error('Missing Mailgun domain')
  if (typeof fromAddress !== 'string' || !fromAddress) throw new Error('Missing Mailgun fromAddress')
  const region = creds['region'] === 'eu' ? 'eu' : 'us'
  return { apiKey, domain, fromAddress, region }
}

export const mailgunAdapter: IntegrationAdapter = {
  provider: 'mailgun',
  channel: 'email',

  async send(request: SendRequest, credentials: Record<string, unknown>): Promise<SendResult> {
    const { apiKey, domain, fromAddress, region } = parseCredentials(credentials)
    const FormData = (await import('form-data')).default
    const Mailgun = (await import('mailgun.js')).default
    const mg = new Mailgun(FormData)
    const client = mg.client({
      username: 'api',
      key: apiKey,
      url: region === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net',
    })

    try {
      const result = await client.messages.create(domain, {
        from: fromAddress,
        to: [request.to],
        subject: request.subject ?? '(no subject)',
        html: request.body ?? '',
      })
      return { ok: true, providerMessageId: result.id }
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
      const { apiKey, domain, region } = parseCredentials(credentials)
      const FormData = (await import('form-data')).default
      const Mailgun = (await import('mailgun.js')).default
      const mg = new Mailgun(FormData)
      const client = mg.client({
        username: 'api',
        key: apiKey,
        url: region === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net',
      })
      await client.domains.get(domain)
      return {
        provider: 'mailgun',
        status: 'ok',
        latencyMs: Date.now() - start,
        details: null,
        checkedAt: new Date().toISOString(),
      }
    } catch (err) {
      return {
        provider: 'mailgun',
        status: 'down',
        latencyMs: Date.now() - start,
        details: err instanceof Error ? err.message : String(err),
        checkedAt: new Date().toISOString(),
      }
    }
  },
}
