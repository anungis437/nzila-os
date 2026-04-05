/**
 * CRM Service — HubSpot Integration
 *
 * Provides CRM operations for Union-Eyes: contact upsert, deal creation,
 * and engagement logging via the @nzila/crm-hubspot package.
 *
 * Lazy-initialised — gracefully degrades when HUBSPOT_API_KEY is not set.
 */

import { HubSpotClient } from '@nzila/crm-hubspot'
import type { HubSpotContact, HubSpotDeal, HubSpotEngagementNote } from '@nzila/crm-hubspot'
import { logger } from '@/lib/logger'

let client: HubSpotClient | null = null

function getClient(): HubSpotClient | null {
  if (client) return client
  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) {
    logger.warn('HUBSPOT_API_KEY not set — CRM sync disabled')
    return null
  }
  client = new HubSpotClient({ apiKey })
  return client
}

/**
 * Upsert a contact in HubSpot. No-op if HUBSPOT_API_KEY is unset.
 */
export async function upsertContact(contact: HubSpotContact) {
  const hs = getClient()
  if (!hs) return null

  const result = await hs.upsertContact(contact)
  if (!result.ok) {
    logger.error('HubSpot upsertContact failed', { error: result.error, email: contact.email })
    return null
  }

  logger.info('HubSpot contact upserted', { contactId: result.id, email: contact.email })
  return result.id
}

/**
 * Create a deal in HubSpot. No-op if HUBSPOT_API_KEY is unset.
 */
export async function createDeal(deal: HubSpotDeal) {
  const hs = getClient()
  if (!hs) return null

  const result = await hs.createDeal(deal)
  if (!result.ok) {
    logger.error('HubSpot createDeal failed', { error: result.error, deal: deal.name })
    return null
  }

  logger.info('HubSpot deal created', { dealId: result.id, name: deal.name })
  return result.id
}

/**
 * Log an engagement note against a HubSpot contact.
 */
export async function logEngagement(note: HubSpotEngagementNote) {
  const hs = getClient()
  if (!hs) return null

  const result = await hs.logEngagementNote(note)
  if (!result.ok) {
    logger.error('HubSpot logEngagement failed', { error: result.error, contactId: note.contactId })
    return null
  }

  logger.info('HubSpot engagement logged', { noteId: result.id, contactId: note.contactId })
  return result.id
}

/**
 * HubSpot health check. Returns { ok, latencyMs } or null if unconfigured.
 */
export async function healthCheck() {
  const hs = getClient()
  if (!hs) return null
  return hs.healthCheck()
}
