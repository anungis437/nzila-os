/**
 * Nzila OS — CRM HubSpot: API Client
 *
 * Lightweight HubSpot REST client with exponential backoff for rate limits.
 * Uses native fetch — no SDK dependency.
 */
import { z } from 'zod'

const HUBSPOT_BASE = 'https://api.hubapi.com'

export interface HubSpotClientOptions {
  apiKey: string
  /** Max retries on 429 rate-limit */
  maxRetries?: number
  /** Base delay (ms) for backoff */
  baseDelay?: number
}

export interface HubSpotContact {
  email: string
  firstName?: string
  lastName?: string
  phone?: string
  company?: string
  properties?: Record<string, string>
}

export interface HubSpotDeal {
  name: string
  stage: string
  amount?: number
  contactId?: string
  properties?: Record<string, string>
}

export interface HubSpotEngagementNote {
  contactId: string
  body: string
  ownerId?: string
}

export const HubSpotContactSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  properties: z.record(z.string()).optional(),
})

export const HubSpotDealSchema = z.object({
  name: z.string().min(1),
  stage: z.string().min(1),
  amount: z.number().optional(),
  contactId: z.string().optional(),
  properties: z.record(z.string()).optional(),
})

export const HubSpotEngagementNoteSchema = z.object({
  contactId: z.string().min(1),
  body: z.string().min(1),
  ownerId: z.string().optional(),
})

export class HubSpotClient {
  private readonly apiKey: string
  private readonly maxRetries: number
  private readonly baseDelay: number

  constructor(options: HubSpotClientOptions) {
    this.apiKey = options.apiKey
    this.maxRetries = options.maxRetries ?? 3
    this.baseDelay = options.baseDelay ?? 1_000
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
    let lastError = ''
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${HUBSPOT_BASE}${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: body ? JSON.stringify(body) : undefined,
        })

        if (response.status === 429) {
          // Rate limited — backoff and retry
          const delay = this.baseDelay * Math.pow(2, attempt)
          await new Promise((r) => setTimeout(r, delay))
          lastError = 'Rate limited (429)'
          continue
        }

        if (!response.ok) {
          const text = await response.text()
          return { ok: false, error: `HubSpot ${response.status}: ${text}` }
        }

        const data = (await response.json()) as T
        return { ok: true, data }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
      }
    }
    return { ok: false, error: lastError }
  }

  async upsertContact(
    contact: HubSpotContact,
  ): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
    const properties: Record<string, string> = {
      email: contact.email,
      ...(contact.firstName ? { firstname: contact.firstName } : {}),
      ...(contact.lastName ? { lastname: contact.lastName } : {}),
      ...(contact.phone ? { phone: contact.phone } : {}),
      ...(contact.company ? { company: contact.company } : {}),
      ...contact.properties,
    }

    // Try create, then update if 409
    const result = await this.request<{ id: string }>(
      'POST',
      '/crm/v3/objects/contacts',
      { properties },
    )

    if (result.ok) return { ok: true, id: result.data.id }

    // If conflict (409), search and update
    if (result.error.includes('409')) {
      const searchResult = await this.request<{ results: { id: string }[] }>(
        'POST',
        '/crm/v3/objects/contacts/search',
        {
          filterGroups: [
            {
              filters: [
                { propertyName: 'email', operator: 'EQ', value: contact.email },
              ],
            },
          ],
        },
      )
      if (searchResult.ok && searchResult.data.results[0]) {
        const contactId = searchResult.data.results[0].id
        const updateResult = await this.request<{ id: string }>(
          'PATCH',
          `/crm/v3/objects/contacts/${contactId}`,
          { properties },
        )
        if (updateResult.ok) return { ok: true, id: updateResult.data.id }
        return { ok: false, error: updateResult.error }
      }
    }

    return { ok: false, error: result.error }
  }

  async createDeal(
    deal: HubSpotDeal,
  ): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
    const properties: Record<string, string> = {
      dealname: deal.name,
      dealstage: deal.stage,
      ...(deal.amount !== undefined ? { amount: String(deal.amount) } : {}),
      ...deal.properties,
    }

    const result = await this.request<{ id: string }>(
      'POST',
      '/crm/v3/objects/deals',
      { properties },
    )

    if (!result.ok) return result

    // Associate with contact if provided
    if (deal.contactId) {
      await this.request(
        'PUT',
        `/crm/v3/objects/deals/${result.data.id}/associations/contacts/${deal.contactId}/deal_to_contact`,
        {},
      )
    }

    return { ok: true, id: result.data.id }
  }

  async logEngagementNote(
    note: HubSpotEngagementNote,
  ): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
    const result = await this.request<{ id: string }>(
      'POST',
      '/crm/v3/objects/notes',
      {
        properties: {
          hs_note_body: note.body,
          hs_timestamp: new Date().toISOString(),
          ...(note.ownerId ? { hubspot_owner_id: note.ownerId } : {}),
        },
        associations: [
          {
            to: { id: note.contactId },
            types: [
              {
                associationCategory: 'HUBSPOT_DEFINED',
                associationTypeId: 202, // note_to_contact
              },
            ],
          },
        ],
      },
    )

    if (!result.ok) return result
    return { ok: true, id: result.data.id }
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now()
    const result = await this.request('GET', '/crm/v3/objects/contacts?limit=1')
    return {
      ok: result.ok,
      latencyMs: Date.now() - start,
      error: result.ok ? undefined : result.error,
    }
  }
}
