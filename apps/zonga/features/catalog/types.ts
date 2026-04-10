/**
 * Zonga — Catalog Types
 *
 * Listener-facing catalog entities: tracks, artists, albums, events.
 */

export interface CatalogTrack {
  id: string
  title: string
  artistName: string
  artistId: string
  artistSlug?: string
  duration: number
  genre?: string
  language?: string
  region?: string
  coverArtUrl?: string
  releaseTitle?: string
  releaseId?: string
  playCount: number
  likeCount: number
  isExplicit: boolean
  publishedAt: Date
}

export interface CatalogArtist {
  id: string
  displayName: string
  slug: string
  avatarUrl?: string
  bannerUrl?: string
  genre?: string
  country?: string
  city?: string
  bio?: string
  followerCount: number
  trackCount: number
  monthlyListeners: number
  isVerified: boolean
  topTracks: CatalogTrack[]
  latestRelease?: CatalogRelease
}

export interface CatalogRelease {
  id: string
  title: string
  type: 'single' | 'ep' | 'album'
  artistName: string
  artistId: string
  coverArtUrl?: string
  trackCount: number
  releaseDate: Date
  genre?: string
}

export interface CatalogEvent {
  id: string
  title: string
  description?: string
  venue: string
  city: string
  country: string
  startsAt: Date
  endsAt?: Date
  imageUrl?: string
  status: 'published' | 'on_sale' | 'sold_out' | 'completed' | 'cancelled'
  performers: EventPerformer[]
  ticketTypes: EventTicketType[]
  lowestPrice?: number
  currency?: string
  genre?: string
}

export interface EventPerformer {
  id?: string
  name: string
  role: 'headliner' | 'performer' | 'dj' | 'host' | 'guest'
  avatarUrl?: string
}

export interface EventTicketType {
  id: string
  name: string
  price: number
  currency: string
  available: number
  maxPerOrder: number
}

export interface HomeFeedSection {
  id: string
  type: 'featured' | 'trending' | 'new_releases' | 'events' | 'editorial' | 'genre_pick'
  title: string
  subtitle?: string
  items: HomeFeedItem[]
}

export interface HomeFeedItem {
  entityType: 'track' | 'artist' | 'release' | 'event'
  resourceId: string
  title: string
  subtitle?: string
  imageUrl?: string
  metadata?: Record<string, unknown>
}

export interface BrowseFilters {
  genre?: string
  region?: string
  language?: string
  eventStatus?: string
  artistType?: string
  sortBy?: 'trending' | 'newest' | 'popular' | 'alphabetical'
  page?: number
  pageSize?: number
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}
