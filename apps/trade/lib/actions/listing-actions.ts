/**
 * Trade Server Actions — Listings.
 *
 * CRUD for trade listings (generic + vehicle).
 * Every action calls `resolveOrgContext()` first and emits audit.
 */
'use server'

import { resolveOrgContext } from '@/lib/resolve-org'
import { revalidatePath } from 'next/cache'
import {
  createListingSchema,
  updateListingSchema,
  addListingMediaSchema,
  buildActionAuditEntry,
  type TradeServiceResult,
  type TradeListing,
} from '@nzila/trade-core'

export async function createListing(
  data: unknown,
): Promise<TradeServiceResult<{ listingId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = createListingSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const id = crypto.randomUUID()

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    entityId: ctx.entityId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'trade_listing',
    targetEntityId: id,
    action: 'listing.created',
    label: `Created listing "${parsed.data.title}"`,
    metadata: { listingType: parsed.data.listingType, currency: parsed.data.currency },
  })

  // TODO: persist listing + audit entry via trade-db repository
  // const repo = createTradeListingRepository(scopedDb)
  // await repo.create({ ...parsed.data, id, entityId: ctx.entityId })

  revalidatePath('/trade/listings')

  return { ok: true, data: { listingId: id }, error: null, auditEntries: [entry] }
}

export async function updateListing(
  data: unknown,
): Promise<TradeServiceResult<{ listingId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = updateListingSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    entityId: ctx.entityId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'trade_listing',
    targetEntityId: parsed.data.id,
    action: 'listing.updated',
    label: `Updated listing ${parsed.data.id}`,
    metadata: { fields: Object.keys(parsed.data).filter((k) => k !== 'id') },
  })

  // TODO: persist via trade-db repository
  // const repo = createTradeListingRepository(scopedDb)
  // await repo.update(parsed.data.id, { ...parsed.data })

  revalidatePath('/trade/listings')

  return { ok: true, data: { listingId: parsed.data.id }, error: null, auditEntries: [entry] }
}

export async function addListingMedia(
  data: unknown,
): Promise<TradeServiceResult<{ mediaId: string }>> {
  const ctx = await resolveOrgContext()
  const parsed = addListingMediaSchema.safeParse(data)

  if (!parsed.success) {
    return { ok: false, data: null, error: parsed.error.message, auditEntries: [] }
  }

  const id = crypto.randomUUID()

  const entry = buildActionAuditEntry({
    id: crypto.randomUUID(),
    entityId: ctx.entityId,
    actorId: ctx.actorId,
    role: ctx.role,
    entityType: 'trade_listing_media',
    targetEntityId: id,
    action: 'listing.media_added',
    label: `Added ${parsed.data.mediaType} media to listing ${parsed.data.listingId}`,
  })

  // TODO: persist via trade-db repository

  revalidatePath('/trade/listings')

  return { ok: true, data: { mediaId: id }, error: null, auditEntries: [entry] }
}

export async function listListings(opts?: {
  page?: number
  pageSize?: number
  status?: string
  listingType?: string
}): Promise<TradeServiceResult<{ listings: TradeListing[]; total: number }>> {
  const ctx = await resolveOrgContext()

  // TODO: read via trade-db repository scoped to ctx.entityId

  return {
    ok: true,
    data: { listings: [], total: 0 },
    error: null,
    auditEntries: [],
  }
}
