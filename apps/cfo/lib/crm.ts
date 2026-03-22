/**
 * CRM — HubSpot Integration (re-export from @nzila/crm-hubspot)
 *
 * Thin wrapper providing CRM contact, deal, and engagement management
 * for the CFO app. Adds CFO-specific facade functions on top of the
 * shared HubSpot package.
 *
 * @module cfo/crm
 */

// ── Re-exports from workspace package ───────────────────────────────────────

export {
  hubspotAdapter,
  HubSpotClient,
  HubSpotContactSchema,
  HubSpotDealSchema,
  HubSpotEngagementNoteSchema,
} from '@nzila/crm-hubspot'

export type {
  HubSpotClientOptions,
  HubSpotContact,
  HubSpotDeal,
  HubSpotEngagementNote,
} from '@nzila/crm-hubspot'

// ── CFO Facades ─────────────────────────────────────────────────────────────

import { HubSpotClient } from '@nzila/crm-hubspot'
import type { HubSpotContact, HubSpotDeal } from '@nzila/crm-hubspot'

/** Singleton CRM client for the CFO app */
let _client: InstanceType<typeof HubSpotClient> | null = null

function getClient(): InstanceType<typeof HubSpotClient> {
  if (_client) return _client
  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) throw new Error('CRM integration requires HUBSPOT_API_KEY')
  _client = new HubSpotClient({ apiKey })
  return _client
}

/**
 * Upsert a financial client contact into HubSpot CRM.
 */
export async function upsertFinancialContact(contact: HubSpotContact) {
  const client = getClient()
  return client.upsertContact(contact)
}

/**
 * Create a financial deal in HubSpot CRM.
 */
export async function createFinancialDeal(deal: HubSpotDeal) {
  const client = getClient()
  return client.createDeal(deal)
}

/**
 * Check CRM connection health.
 */
export async function checkCRMHealth() {
  const client = getClient()
  return client.healthCheck()
}
