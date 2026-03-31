/**
 * Zonga — Browse / Discover page (Server Component).
 *
 * Fetches published content, trending tracks, featured playlists,
 * and upcoming events, then delegates rendering to the client
 * BrowseGrid which integrates with the global player.
 */
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import {
  browsePublishedAssets,
  browsePublishedEvents,
  browsePublicPlaylists,
  browseTrending,
} from '@/lib/actions/browse-actions'
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
    browsePublishedAssets(),
    browsePublishedEvents(),
    browsePublicPlaylists(),
    browseTrending(),
  ])

  return (
    <div className="text-navy">
      <BrowseGrid
        locale={locale}
        trending={trending}
        assets={publishedAssets.assets}
        playlists={playlists.playlists}
        events={upcomingEvents.events}
      />
    </div>
  )
}
