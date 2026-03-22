/**
 * CRM — HubSpot Integration
 *
 * Thin wrapper providing CRM contact, deal, and engagement management
 * for the CFO app. Self-contained stubs until @nzila/crm-hubspot is available.
 *
 * @module cfo/crm
 */

import { z } from 'zod'

// ── Types ───────────────────────────────────────────────────────────────────

export interface HubSpotClientOptions { apiKey: string }
export interface HubSpotContact { email: string; firstName: string; lastName: string; company?: string; properties?: Record<string, string> }
export interface HubSpotDeal { name: string; amount: number; stage: string; contactEmail?: string; properties?: Record<string, string> }
export interface HubSpotEngagementNote { contactEmail: string; body: string; timestamp?: string }

export const HubSpotContactSchema = z.object({ email: z.string().email(), firstName: z.string(), lastName: z.string(), company: z.string().optional(), properties: z.record(z.string()).optional() })
export const HubSpotDealSchema = z.object({ name: z.string(), amount: z.number(), stage: z.string(), contactEmail: z.string().optional(), properties: z.record(z.string()).optional() })
export const HubSpotEngagementNoteSchema = z.object({ contactEmail: z.string(), body: z.string(), timestamp: z.string().optional() })

// ── Stub Client ─────────────────────────────────────────────────────────────

export class HubSpotClient {
  constructor(private readonly opts: HubSpotClientOptions) {}
  async upsertContact(contact: HubSpotContact) { return { id: crypto.randomUUID(), ...contact } }
  async createDeal(deal: HubSpotDeal) { return { id: crypto.randomUUID(), ...deal } }
  async healthCheck() { return { ok: Boolean(this.opts.apiKey), provider: 'hubspot' as const } }
}

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
  return getClient().createDeal(deal)
}

export async function checkCRMHealth() {
  return getClient().healthCheck()
}
