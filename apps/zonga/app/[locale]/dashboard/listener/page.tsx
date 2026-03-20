/**
 * Zonga — Listener Dashboard (Server Component).
 *
 * Listener profile overview: following, favorites, saved playlists,
 * recent activity feed, now-playing widget, queue, and discovery.
 */
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Card } from '@nzila/ui'
import {
  getListenerProfile,
  getListenerFeed,
  listSavedPlaylists,
  discoverArtists,
  discoverReleases,
} from '@/lib/actions/listener-actions'
import { listFollowing } from '@/lib/actions/social-actions'
import { NowPlayingWidget, ReleaseRow, QueueView } from '@/components/dashboard/listener-sections'

export default async function ListenerPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const { locale } = await params

  const [profile, feed, following, playlists, trendingArtists, newReleases] = await Promise.all([
    getListenerProfile(),
    getListenerFeed({ limit: 20 }),
    listFollowing(),
    listSavedPlaylists(),
    discoverArtists({ limit: 6 }),
    discoverReleases({ limit: 6 }),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">My Music</h1>
        <p className="text-gray-500 mt-1">Your listening activity, favorites &amp; discovery</p>
      </div>

      {/* Now Playing + Queue row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NowPlayingWidget />
        <QueueView />
      </div>

      {/* Profile Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="p-5">
            <p className="text-xs text-gray-500 mb-1">Following</p>
            <p className="text-2xl font-bold text-navy">{profile?.followingCount ?? following.length}</p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-xs text-gray-500 mb-1">Favorites</p>
            <p className="text-2xl font-bold text-navy">{profile?.favoritesCount ?? 0}</p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-xs text-gray-500 mb-1">Saved Playlists</p>
            <p className="text-2xl font-bold text-navy">{playlists.length}</p>
          </div>
        </Card>
      </div>

      {/* Following */}
      <div>
        <h2 className="text-lg font-semibold text-navy mb-3">Artists You Follow</h2>
        {following.length === 0 ? (
          <Card>
            <div className="p-8 text-center">
              <p className="text-gray-500 text-sm">You haven&apos;t followed any artists yet.</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {following.slice(0, 12).map((f) => (
              <Card key={f.id}>
                <div className="p-4 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full mx-auto mb-2 flex items-center justify-center text-lg">
                    🎤
                  </div>
                  <p className="text-sm font-medium text-navy truncate">{f.creatorName ?? 'Artist'}</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Saved Playlists */}
      {playlists.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-navy mb-3">Saved Playlists</h2>
          <Card>
            <div className="divide-y divide-gray-50">
              {playlists.map((p) => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-navy">{p.playlistTitle ?? 'Untitled'}</p>
                    {p.playlistDescription && (
                      <p className="text-xs text-gray-400 mt-0.5">{p.playlistDescription}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Trending Artists */}
      <div>
        <h2 className="text-lg font-semibold text-navy mb-3">Trending Artists</h2>
        {trendingArtists.length === 0 ? (
          <Card>
            <div className="p-8 text-center">
              <p className="text-gray-500 text-sm">No artists to discover yet.</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {trendingArtists.map((a) => (
              <Card key={a.id}>
                <div className="p-4 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full mx-auto mb-2 flex items-center justify-center text-lg">
                    {a.verified ? '✅' : '🎵'}
                  </div>
                  <p className="text-sm font-medium text-navy truncate">{a.displayName}</p>
                  <p className="text-xs text-gray-400">{a.followerCount} followers</p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* New Releases — now with inline play buttons */}
      <div>
        <h2 className="text-lg font-semibold text-navy mb-3">New Releases</h2>
        {newReleases.length === 0 ? (
          <Card>
            <div className="p-8 text-center">
              <p className="text-gray-500 text-sm">No published releases yet.</p>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="divide-y divide-gray-50">
              {newReleases.map((r) => (
                <ReleaseRow
                  key={r.id}
                  id={r.id}
                  title={r.title}
                  creatorName={r.creatorName}
                  releaseType={r.releaseType}
                  trackCount={r.trackCount}
                  publishedAt={r.publishedAt}
                  locale={locale}
                />
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Activity Feed */}
      <div>
        <h2 className="text-lg font-semibold text-navy mb-3">Recent Activity</h2>
        {feed.length === 0 ? (
          <Card>
            <div className="p-8 text-center">
              <p className="text-gray-500 text-sm">No activity yet. Start exploring!</p>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="divide-y divide-gray-50">
              {feed.map((a) => (
                <div key={a.id} className="px-5 py-3 flex items-center gap-3">
                  <span className="text-lg">
                    {a.activityType === 'follow' && '👤'}
                    {a.activityType === 'favorite' && '❤️'}
                    {a.activityType === 'comment' && '💬'}
                    {a.activityType === 'tip' && '💰'}
                    {a.activityType === 'stream' && '🎧'}
                    {!['follow', 'favorite', 'comment', 'tip', 'stream'].includes(a.activityType) && '📝'}
                  </span>
                  <div>
                    <p className="text-sm text-navy capitalize">{a.activityType}</p>
                    <p className="text-xs text-gray-400">
                      {a.entityType} · {a.createdAt ? new Date(a.createdAt).toLocaleString() : 'just now'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
