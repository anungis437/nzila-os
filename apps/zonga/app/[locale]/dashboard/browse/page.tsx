/**
 * Zonga — Browse / Discover page (Server Component).
 *
 * Fetches published content, trending tracks, featured playlists,
 * and upcoming events, then delegates rendering to the client
 * BrowseGrid which integrates with the global player.
 */
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Card } from '@nzila/ui'
import {
  browsePublishedAssets,
  browsePublishedEvents,
  browsePublicPlaylists,
  browseTrending,
} from '@/lib/actions/browse-actions'
import type { CatalogListResult } from '@/lib/actions/catalog-actions'
import type { EventListResult } from '@/lib/actions/event-actions'
import type { PlaylistListResult } from '@/lib/actions/playlist-actions'
import type { SearchResult } from '@/lib/actions/search-actions'
import { BrowseGrid } from '@/components/dashboard/browse-grid'

export default async function BrowsePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const { locale } = await params

  const [publishedAssets, upcomingEvents, playlists, trending] = await Promise.all([
    browsePublishedAssets() as Promise<CatalogListResult>,
    browsePublishedEvents() as Promise<EventListResult>,
    browsePublicPlaylists() as Promise<PlaylistListResult>,
    browseTrending() as Promise<SearchResult[]>,
  ])

  return (
    <Card className="text-navy">
      <BrowseGrid
        locale={locale}
        trending={trending}
        assets={publishedAssets.assets}
        playlists={playlists.playlists}
        events={upcomingEvents.events}
      />
    </Card>
  )
}
