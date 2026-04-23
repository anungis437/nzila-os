/**
 * Campaign runs — record a dispatch and capture its outcome.
 */
import { campaignRunSchema } from '../schemas'
import { listRecords, readRecord, writeRecord } from '../store'
import type { CampaignRun, CampaignRunResult, GrowthScope } from '../types'
import { makeId, nowISO, scopeKey } from '../utils'
import { getCampaign } from './campaign'
import { getContentAsset } from './assets'

const ENTITY = 'campaign-run'

export class UnapprovedAssetDispatchError extends Error {
  constructor(assetId: string, approval: string) {
    super(`Cannot dispatch run with content asset ${assetId} in approval=${approval}; required=approved`)
    this.name = 'UnapprovedAssetDispatchError'
  }
}

export interface StartCampaignRunInput {
  campaignId: string
  contentAssetId: string
  audienceSize: number
  id?: string
}

/**
 * Start a campaign run. Fails closed if the campaign is not live OR the
 * content asset is not approved.
 */
export function startCampaignRun(input: StartCampaignRunInput): CampaignRun {
  const cmp = getCampaign(input.campaignId)
  if (!cmp) throw new Error(`Campaign not found: ${input.campaignId}`)
  if (cmp.status !== 'live') {
    throw new Error(`Cannot start run on campaign in status=${cmp.status}; required=live`)
  }
  const asset = getContentAsset(input.contentAssetId)
  if (!asset) throw new Error(`Content asset not found: ${input.contentAssetId}`)
  if (asset.approval !== 'approved') {
    throw new UnapprovedAssetDispatchError(asset.id, asset.approval)
  }
  const run: CampaignRun = {
    id: input.id ?? makeId('run'),
    scope: cmp.scope,
    campaignId: input.campaignId,
    contentAssetId: input.contentAssetId,
    audienceSize: input.audienceSize,
    startedAt: nowISO(),
  }
  return writeRecord(ENTITY, run.id, run, campaignRunSchema)
}

export function recordRunResult(id: string, result: CampaignRunResult): CampaignRun {
  const run = readRecord(ENTITY, id, campaignRunSchema)
  if (!run) throw new Error(`Campaign run not found: ${id}`)
  if (result.responded > result.reached) {
    throw new Error('responded must not exceed reached')
  }
  if (result.converted > result.responded) {
    throw new Error('converted must not exceed responded')
  }
  const updated: CampaignRun = {
    ...run,
    completedAt: nowISO(),
    result,
  }
  return writeRecord(ENTITY, id, updated, campaignRunSchema)
}

export function getCampaignRun(id: string): CampaignRun | null {
  return readRecord(ENTITY, id, campaignRunSchema)
}

export function listCampaignRuns(scope?: GrowthScope, campaignId?: string): CampaignRun[] {
  return listRecords(ENTITY, campaignRunSchema).filter((r) => {
    if (scope && scopeKey(r.scope) !== scopeKey(scope)) return false
    if (campaignId && r.campaignId !== campaignId) return false
    return true
  })
}
