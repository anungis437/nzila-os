/**
 * Nzila OS — CRM HubSpot: Integration Adapter
 *
 * Wraps the HubSpot client as an IntegrationAdapter for the control plane.
 * CRM operations are exposed through the `send` interface with metadata routing.
 */
import type {
  IntegrationAdapter,
  SendRequest,
  SendResult,
  HealthCheckResult,
} from '@nzila/integrations-core'
import { HubSpotClient } from './client'

interface HubSpotCredentials {
  apiKey: string
}

function parseCredentials(creds: Record<string, unknown>): HubSpotCredentials {
  const apiKey = creds['apiKey']
  if (typeof apiKey !== 'string' || !apiKey) throw new Error('Missing HubSpot apiKey')
  return { apiKey }
}

/**
 * CRM operations are routed via `metadata.operation`:
 * - upsert_contact: body = JSON of HubSpotContact
 * - create_deal: body = JSON of HubSpotDeal
 * - log_engagement: body = JSON of HubSpotEngagementNote
 */
export const hubspotAdapter: IntegrationAdapter = {
  provider: 'hubspot',
  channel: 'crm',

  async send(request: SendRequest, credentials: Record<string, unknown>): Promise<SendResult> {
    const { apiKey } = parseCredentials(credentials)
    const client = new HubSpotClient({ apiKey })
    const operation = request.metadata?.['operation'] as string | undefined

    try {
      switch (operation) {
        case 'upsert_contact': {
          const contact = JSON.parse(request.body ?? '{}')
          const result = await client.upsertContact(contact)
          if (!result.ok) return { ok: false, error: result.error }
          return { ok: true, providerMessageId: result.id }
        }
        case 'create_deal': {
          const deal = JSON.parse(request.body ?? '{}')
          const result = await client.createDeal(deal)
          if (!result.ok) return { ok: false, error: result.error }
          return { ok: true, providerMessageId: result.id }
        }
        case 'log_engagement': {
          const note = JSON.parse(request.body ?? '{}')
          const result = await client.logEngagementNote(note)
          if (!result.ok) return { ok: false, error: result.error }
          return { ok: true, providerMessageId: result.id }
        }
        default:
          return { ok: false, error: `Unknown CRM operation: ${operation ?? '(none)'}` }
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  },

  async healthCheck(credentials: Record<string, unknown>): Promise<HealthCheckResult> {
    const start = Date.now()
    try {
      const { apiKey } = parseCredentials(credentials)
      const client = new HubSpotClient({ apiKey })
      const result = await client.healthCheck()
      return {
        provider: 'hubspot',
        status: result.ok ? 'ok' : 'down',
        latencyMs: result.latencyMs,
        details: result.error ?? null,
        checkedAt: new Date().toISOString(),
      }
    } catch (err) {
      return {
        provider: 'hubspot',
        status: 'down',
        latencyMs: Date.now() - start,
        details: err instanceof Error ? err.message : String(err),
        checkedAt: new Date().toISOString(),
      }
    }
  },
}
