import { HubSpotClient } from '@nzila/crm-hubspot'
import type { HubSpotContact, HubSpotDeal } from '@nzila/crm-hubspot'
import { logger } from '@/lib/logger'

let client: HubSpotClient | null = null

function getClient(): HubSpotClient | null {
  if (client) return client
  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) {
    logger.warn('HUBSPOT_API_KEY not set - Zonga CRM sync disabled')
    return null
  }
  client = new HubSpotClient({ apiKey })
  return client
}

export async function upsertZongaLead(contact: HubSpotContact) {
  const hs = getClient()
  if (!hs) return null
  const result = await hs.upsertContact(contact)
  if (!result.ok) {
    logger.error('Zonga HubSpot upsertContact failed', { error: result.error, email: contact.email })
    return null
  }
  return result.id
}

export async function createZongaDeal(deal: HubSpotDeal) {
  const hs = getClient()
  if (!hs) return null
  const result = await hs.createDeal(deal)
  if (!result.ok) {
    logger.error('Zonga HubSpot createDeal failed', { error: result.error, deal: deal.name })
    return null
  }
  return result.id
}
