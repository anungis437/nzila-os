/**
 * Campaign records — create, list, update, lifecycle transitions.
 */
import { campaignSchema } from '../schemas'
import { listRecords, readRecord, writeRecord } from '../store'
import type { Campaign, CampaignStatus, GrowthScope } from '../types'
import { makeId, nowISO, scopeKey } from '../utils'

const ENTITY = 'campaign'

const ALLOWED_TRANSITIONS: Record<CampaignStatus, ReadonlyArray<CampaignStatus>> = {
  draft: ['scheduled', 'live', 'archived'],
  scheduled: ['live', 'paused', 'archived', 'draft'],
  live: ['paused', 'completed'],
  paused: ['live', 'completed', 'archived'],
  completed: ['archived'],
  archived: [],
}

export interface CreateCampaignInput {
  scope: GrowthScope
  name: string
  objective: string
  channels: Campaign['channels']
  audienceSegmentIds?: string[]
  brandVoiceId: string
  offerIds?: string[]
  ownerId?: string
  startsAt?: string
  endsAt?: string
  tags?: string[]
  id?: string
}

export function createCampaign(input: CreateCampaignInput): Campaign {
  const now = nowISO()
  const record: Campaign = {
    id: input.id ?? makeId('cmp'),
    scope: input.scope,
    name: input.name,
    objective: input.objective,
    channels: input.channels,
    audienceSegmentIds: input.audienceSegmentIds ?? [],
    brandVoiceId: input.brandVoiceId,
    offerIds: input.offerIds ?? [],
    ownerId: input.ownerId,
    status: 'draft',
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
  }
  return writeRecord(ENTITY, record.id, record, campaignSchema)
}

export function getCampaign(id: string): Campaign | null {
  return readRecord(ENTITY, id, campaignSchema)
}

export function listCampaigns(scope?: GrowthScope, status?: CampaignStatus): Campaign[] {
  const all = listRecords(ENTITY, campaignSchema)
  return all.filter((c) => {
    if (scope && scopeKey(c.scope) !== scopeKey(scope)) return false
    if (status && c.status !== status) return false
    return true
  })
}

export class IllegalCampaignTransitionError extends Error {
  constructor(from: CampaignStatus, to: CampaignStatus) {
    super(`Cannot transition campaign from "${from}" to "${to}"`)
    this.name = 'IllegalCampaignTransitionError'
  }
}

export function transitionCampaign(id: string, to: CampaignStatus): Campaign {
  const cmp = readRecord(ENTITY, id, campaignSchema)
  if (!cmp) throw new Error(`Campaign not found: ${id}`)
  if (cmp.status === to) return cmp
  if (!ALLOWED_TRANSITIONS[cmp.status].includes(to)) {
    throw new IllegalCampaignTransitionError(cmp.status, to)
  }
  const updated: Campaign = { ...cmp, status: to, updatedAt: nowISO() }
  return writeRecord(ENTITY, id, updated, campaignSchema)
}
