/**
 * Content assets and commercial offers — approval-gated creative artifacts.
 *
 * No public-facing asset is allowed to leave `draft`/`in_review` without an
 * approver id and timestamp. The voice check is the operator's responsibility
 * to invoke before submitting for approval; this layer enforces the audit gate.
 */
import { commercialOfferSchema, contentAssetSchema } from '../schemas'
import { listRecords, readRecord, writeRecord } from '../store'
import type {
  ApprovalState,
  CommercialOffer,
  ContentAsset,
  GrowthScope,
  OfferComponent,
} from '../types'
import { makeId, nowISO, scopeKey } from '../utils'

const ASSET_ENTITY = 'content-asset'
const OFFER_ENTITY = 'commercial-offer'

// ── Content assets ──────────────────────────────────────────────────────────

export interface CreateContentAssetInput {
  scope: GrowthScope
  campaignId?: string
  brandVoiceId: string
  channel: ContentAsset['channel']
  kind: ContentAsset['kind']
  title: string
  body: string
  sources?: string[]
  id?: string
}

export function createContentAsset(input: CreateContentAssetInput): ContentAsset {
  const now = nowISO()
  const record: ContentAsset = {
    id: input.id ?? makeId('asset'),
    scope: input.scope,
    campaignId: input.campaignId,
    brandVoiceId: input.brandVoiceId,
    channel: input.channel,
    kind: input.kind,
    title: input.title,
    body: input.body,
    sources: input.sources ?? [],
    approval: 'draft',
    createdAt: now,
    updatedAt: now,
    version: 1,
  }
  return writeRecord(ASSET_ENTITY, record.id, record, contentAssetSchema)
}

export function getContentAsset(id: string): ContentAsset | null {
  return readRecord(ASSET_ENTITY, id, contentAssetSchema)
}

export function listContentAssets(scope?: GrowthScope, approval?: ApprovalState): ContentAsset[] {
  return listRecords(ASSET_ENTITY, contentAssetSchema).filter((a) => {
    if (scope && scopeKey(a.scope) !== scopeKey(scope)) return false
    if (approval && a.approval !== approval) return false
    return true
  })
}

export class UnsourcedAssetError extends Error {
  constructor(id: string) {
    super(`Content asset ${id} cannot be approved without at least one source reference`)
    this.name = 'UnsourcedAssetError'
  }
}

/**
 * Mutate body / title — bumps version and resets approval to 'draft'.
 */
export function reviseContentAsset(
  id: string,
  patch: Partial<Pick<ContentAsset, 'title' | 'body' | 'sources'>>,
): ContentAsset {
  const cur = readRecord(ASSET_ENTITY, id, contentAssetSchema)
  if (!cur) throw new Error(`Content asset not found: ${id}`)
  const updated: ContentAsset = {
    ...cur,
    ...patch,
    version: cur.version + 1,
    approval: 'draft',
    approvedBy: undefined,
    approvedAt: undefined,
    updatedAt: nowISO(),
  }
  return writeRecord(ASSET_ENTITY, id, updated, contentAssetSchema)
}

export function submitContentAssetForReview(id: string): ContentAsset {
  const cur = readRecord(ASSET_ENTITY, id, contentAssetSchema)
  if (!cur) throw new Error(`Content asset not found: ${id}`)
  if (cur.sources.length === 0) throw new UnsourcedAssetError(id)
  const updated: ContentAsset = { ...cur, approval: 'in_review', updatedAt: nowISO() }
  return writeRecord(ASSET_ENTITY, id, updated, contentAssetSchema)
}

export function approveContentAsset(id: string, approverId: string): ContentAsset {
  const cur = readRecord(ASSET_ENTITY, id, contentAssetSchema)
  if (!cur) throw new Error(`Content asset not found: ${id}`)
  if (cur.approval !== 'in_review') {
    throw new Error(`Asset ${id} is in "${cur.approval}", expected "in_review"`)
  }
  const now = nowISO()
  const updated: ContentAsset = {
    ...cur,
    approval: 'approved',
    approvedBy: approverId,
    approvedAt: now,
    updatedAt: now,
  }
  return writeRecord(ASSET_ENTITY, id, updated, contentAssetSchema)
}

export function rejectContentAsset(id: string): ContentAsset {
  const cur = readRecord(ASSET_ENTITY, id, contentAssetSchema)
  if (!cur) throw new Error(`Content asset not found: ${id}`)
  const updated: ContentAsset = { ...cur, approval: 'rejected', updatedAt: nowISO() }
  return writeRecord(ASSET_ENTITY, id, updated, contentAssetSchema)
}

// ── Commercial offers ──────────────────────────────────────────────────────

export interface CreateCommercialOfferInput {
  scope: GrowthScope
  label: string
  product: string
  buyerType: string
  pilotDurationDays?: number
  pilotPriceCad?: number
  annualPriceLowCad?: number
  annualPriceHighCad?: number
  components: OfferComponent[]
  id?: string
}

export function createCommercialOffer(input: CreateCommercialOfferInput): CommercialOffer {
  const now = nowISO()
  const record: CommercialOffer = {
    id: input.id ?? makeId('offer'),
    scope: input.scope,
    label: input.label,
    product: input.product,
    buyerType: input.buyerType,
    pilotDurationDays: input.pilotDurationDays,
    pilotPriceCad: input.pilotPriceCad,
    annualPriceLowCad: input.annualPriceLowCad,
    annualPriceHighCad: input.annualPriceHighCad,
    components: input.components,
    approval: 'draft',
    createdAt: now,
    updatedAt: now,
  }
  return writeRecord(OFFER_ENTITY, record.id, record, commercialOfferSchema)
}

export function getCommercialOffer(id: string): CommercialOffer | null {
  return readRecord(OFFER_ENTITY, id, commercialOfferSchema)
}

export function listCommercialOffers(scope?: GrowthScope): CommercialOffer[] {
  const all = listRecords(OFFER_ENTITY, commercialOfferSchema)
  if (!scope) return all
  const key = scopeKey(scope)
  return all.filter((o) => scopeKey(o.scope) === key)
}

/**
 * Recommend a packet given product + buyer type. Returns the highest-scoring
 * approved offer matching both, or null. Tie-breaker: most components.
 */
export function recommendOffer(
  scope: GrowthScope,
  product: string,
  buyerType: string,
): CommercialOffer | null {
  const candidates = listCommercialOffers(scope).filter(
    (o) => o.approval === 'approved' && o.product === product && o.buyerType === buyerType,
  )
  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.components.length - a.components.length)
  return candidates[0]
}
