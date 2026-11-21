/** Own listening history and fixed published cross-organization discovery. */
'use server'
import { resolveOrgContext } from '@/lib/resolve-org'
import {
  search,
  trending,
  recentlyPlayed,
  type SearchResults,
  type SearchResult,
} from '@/lib/services/published-catalog'
export type { SearchResults, SearchResult } from '@/lib/services/published-catalog'
export async function globalSearch(query: string): Promise<SearchResults> {
  return resolveOrgContext('published', (context) => search(context, query))
}
export async function getTrending(): Promise<SearchResult[]> {
  return resolveOrgContext('published', trending)
}
export async function getRecentlyPlayed(): Promise<SearchResult[]> {
  return resolveOrgContext('personal', recentlyPlayed)
}
