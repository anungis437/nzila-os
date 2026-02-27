/**
 * Nzila OS — Comms SMS: Twilio Adapter
 */
import type {
  IntegrationAdapter,
  SendRequest,
  SendResult,
  HealthCheckResult,
} from '@nzila/integrations-core'

interface TwilioCredentials {
  accountSid: string
  authToken: string
  fromNumber: string
}

function parseCredentials(creds: Record<string, unknown>): TwilioCredentials {
  const accountSid = creds['accountSid']
  const authToken = creds['authToken']
  const fromNumber = creds['fromNumber']
  if (typeof accountSid !== 'string' || !accountSid) throw new Error('Missing Twilio accountSid')
  if (typeof authToken !== 'string' || !authToken) throw new Error('Missing Twilio authToken')
  if (typeof fromNumber !== 'string' || !fromNumber) throw new Error('Missing Twilio fromNumber')
  return { accountSid, authToken, fromNumber }
}

export const twilioAdapter: IntegrationAdapter = {
  provider: 'twilio',
  channel: 'sms',

  async send(request: SendRequest, credentials: Record<string, unknown>): Promise<SendResult> {
    const { accountSid, authToken, fromNumber } = parseCredentials(credentials)
    const twilio = await import('twilio')
    const client = twilio.default(accountSid, authToken)

    try {
      const message = await client.messages.create({
        to: request.to,
        from: fromNumber,
        body: request.body ?? '',
      })
      return { ok: true, providerMessageId: message.sid }
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
      const { accountSid, authToken } = parseCredentials(credentials)
      const twilio = await import('twilio')
      const client = twilio.default(accountSid, authToken)
      await client.api.accounts(accountSid).fetch()
      return {
        provider: 'twilio',
        status: 'ok',
        latencyMs: Date.now() - start,
        details: null,
        checkedAt: new Date().toISOString(),
      }
    } catch (err) {
      return {
        provider: 'twilio',
        status: 'down',
        latencyMs: Date.now() - start,
        details: err instanceof Error ? err.message : String(err),
        checkedAt: new Date().toISOString(),
      }
    }
  },
}
