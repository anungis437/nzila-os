/**
 * CRM — HubSpot Integration
 *
 * Thin wrapper providing CRM contact, deal, and engagement management
 * for the CFO app.
 *
 * @module cfo/crm
 */

import { z } from 'zod'
import {
  HubSpotClient as BaseHubSpotClient,
  HubSpotContactSchema as BaseHubSpotContactSchema,
  HubSpotDealSchema as BaseHubSpotDealSchema,
  HubSpotEngagementNoteSchema as BaseHubSpotEngagementNoteSchema,
  type HubSpotClientOptions,
  type HubSpotContact,
  type HubSpotEngagementNote,
} from '@nzila/crm-hubspot'

// ── Types ───────────────────────────────────────────────────────────────────

export interface HubSpotDeal { name: string; amount: number; stage: string; contactEmail?: string; properties?: Record<string, string> }
export interface FinancialHubSpotEngagementNote { contactEmail: string; body: string; timestamp?: string }

export const HubSpotContactSchema = BaseHubSpotContactSchema
export const HubSpotDealSchema = z.object({ name: z.string(), amount: z.number(), stage: z.string(), contactEmail: z.string().optional(), properties: z.record(z.string()).optional() })
export const HubSpotEngagementNoteSchema = z.object({ contactEmail: z.string().email(), body: z.string(), timestamp: z.string().optional() })

// ── Client ──────────────────────────────────────────────────────────────────

export class HubSpotClient extends BaseHubSpotClient {}

export const hubspotAdapter = { name: 'hubspot' as const, createClient: (opts: HubSpotClientOptions) => new HubSpotClient(opts) }

// ── CFO Facades ─────────────────────────────────────────────────────────────

let _client: HubSpotClient | null = null

function getClient(): HubSpotClient {
  if (_client) return _client
  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) throw new Error('CRM integration requires HUBSPOT_API_KEY')
  _client = new HubSpotClient({ apiKey })
  return _client
}

export async function upsertFinancialContact(contact: HubSpotContact) {
  return getClient().upsertContact(contact)
}

export async function createFinancialDeal(deal: HubSpotDeal) {
  const client = getClient()

  let contactId: string | undefined
  if (deal.contactEmail) {
    const contactResult = await client.upsertContact({
      email: deal.contactEmail,
      firstName: 'Finance',
      lastName: 'Contact',
    })
    if (contactResult.ok) {
      contactId = contactResult.id
    }
  }

  return client.createDeal({
    name: deal.name,
    amount: deal.amount,
    stage: deal.stage,
    contactId,
    properties: deal.properties,
  })
}

export async function logFinancialEngagement(note: FinancialHubSpotEngagementNote) {
  const client = getClient()
  const contactResult = await client.upsertContact({
    email: note.contactEmail,
    firstName: 'Finance',
    lastName: 'Contact',
  })

  if (!contactResult.ok) {
    return { ok: false as const, error: contactResult.error }
  }

  const engagement: HubSpotEngagementNote = {
    contactId: contactResult.id,
    body: note.body,
  }

  return client.logEngagementNote(engagement)
}

export async function checkCRMHealth() {
  const health = await getClient().healthCheck()
  return {
    ok: health.ok,
    provider: 'hubspot' as const,
    latencyMs: health.latencyMs,
    error: health.error,
  }
}

export const HubSpotDealBaseSchema = BaseHubSpotDealSchema
export const HubSpotEngagementBaseSchema = BaseHubSpotEngagementNoteSchema
