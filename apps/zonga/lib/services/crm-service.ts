import { HubSpotClient } from '@nzila/crm-hubspot'
import type { HubSpotContact, HubSpotDeal } from '@nzila/crm-hubspot'
import { logger } from '@/lib/logger'
import { enqueueJob, claimPendingJobs, completeJob, failOrRetryJob, type QueueJob } from '@/lib/queue-jobs'
import { resolveCommercialDbOrgId } from '@/lib/commercial-context'

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

export type CrmSyncResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'crm_unavailable' | 'upsert_failed' | 'deal_failed'; error: string }

export type CrmQueuePayload = {
  op: 'lead_upsert' | 'deal_create'
  contact?: HubSpotContact
  deal?: HubSpotDeal
}

export async function upsertZongaLead(contact: HubSpotContact): Promise<CrmSyncResult> {
  const hs = getClient()
  if (!hs) {
    return { ok: false, reason: 'crm_unavailable', error: 'HUBSPOT_API_KEY not configured' }
  }

  const result = await hs.upsertContact(contact)
  if (!result.ok) {
    logger.error('Zonga HubSpot upsertContact failed', { error: result.error, email: contact.email })
    return { ok: false, reason: 'upsert_failed', error: result.error ?? 'HubSpot upsert failed' }
  }

  return { ok: true, id: result.id }
}

export async function createZongaDeal(deal: HubSpotDeal): Promise<CrmSyncResult> {
  const hs = getClient()
  if (!hs) {
    return { ok: false, reason: 'crm_unavailable', error: 'HUBSPOT_API_KEY not configured' }
  }

  const result = await hs.createDeal(deal)
  if (!result.ok) {
    logger.error('Zonga HubSpot createDeal failed', { error: result.error, deal: deal.name })
    return { ok: false, reason: 'deal_failed', error: result.error ?? 'HubSpot create deal failed' }
  }

  return { ok: true, id: result.id }
}

export async function enqueueCrmRetryJob(payload: CrmQueuePayload, idempotencyKey: string): Promise<string> {
  const orgId = resolveCommercialDbOrgId(process.env.PLATFORM_ORG_ID)
  return enqueueJob({
    orgId,
    queue: 'crm',
    jobType: 'hubspot.sync',
    payload,
    idempotencyKey,
    maxRetries: 6,
  })
}

async function processCrmQueueJob(job: QueueJob): Promise<void> {
  const payload = (job.payload ?? {}) as CrmQueuePayload

  if (payload.op === 'lead_upsert' && payload.contact) {
    const result = await upsertZongaLead(payload.contact)
    if (!result.ok) {
      throw new Error(result.error)
    }
    return
  }

  if (payload.op === 'deal_create' && payload.deal) {
    const result = await createZongaDeal(payload.deal)
    if (!result.ok) {
      throw new Error(result.error)
    }
    return
  }

  throw new Error('Invalid CRM queue payload')
}

export async function processCrmRetryBatch(limit = 25): Promise<{ processed: number; failed: number }> {
  const jobs = await claimPendingJobs('crm', 'hubspot.sync', limit)

  let processed = 0
  let failed = 0

  for (const job of jobs) {
    try {
      await processCrmQueueJob(job)
      await completeJob(job.id)
      processed += 1
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : String(error)
      await failOrRetryJob(job, message, 120)
      logger.error('CRM retry job failed', { jobId: job.id, error: message })
    }
  }

  return { processed, failed }
}
