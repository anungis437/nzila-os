/** Authenticated fixed published projections, independent of tenant selection. */
'use server'
import { resolveOrgContext } from '@/lib/resolve-org'
import {
  publishedAssets,
  publicPlaylists,
  publishedEvents,
  trending,
  publishedCreator,
  publishedAsset,
  type PublishedAssetList,
  type PublishedAsset,
  type PublishedCreator,
  type SearchResult,
} from '@/lib/services/published-catalog'
import type { PlaylistListResult } from './playlist-actions'
import type { EventListResult } from './event-actions'
export type {
  PublishedAssetList,
  PublishedAsset,
  PublishedCreator,
} from '@/lib/services/published-catalog'
export async function browsePublishedAssets(opts?: {
  page?: number
  pageSize?: number
  search?: string
  type?: string
  creatorId?: string
}): Promise<PublishedAssetList> {
  return resolveOrgContext('published', (context) => publishedAssets(context, opts))
}
export async function browsePublicPlaylists(opts?: {
  page?: number
  search?: string
}): Promise<PlaylistListResult> {
  return resolveOrgContext('published', (context) => publicPlaylists(context, opts))
}
export async function browseTrending(): Promise<SearchResult[]> {
  return resolveOrgContext('published', trending)
}
export async function browsePublishedEvents(opts?: { page?: number }): Promise<EventListResult> {
  return resolveOrgContext('published', (context) => publishedEvents(context, opts))
}
export async function getPublishedCreator(id: string): Promise<PublishedCreator | null> {
  return resolveOrgContext('published', (context) => publishedCreator(context, id))
}
export async function getPublishedAsset(id: string): Promise<PublishedAsset | null> {
  return resolveOrgContext('published', (context) => publishedAsset(context, id))
}
