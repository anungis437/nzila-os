/**
 * Zonga — Playlists Page (Server Component).
 *
 * Browse, search, and manage playlists.
 */
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@nzila/ui'
import { browsePublicPlaylists } from '@/lib/actions/browse-actions'

export default async function PlaylistsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const params = await searchParams
  const page = Number(params.page ?? '1')
  const { playlists, total } = await browsePublicPlaylists({ page, search: params.search })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Playlists</h1>
          <p className="text-muted-foreground mt-1">{total} playlist{total !== 1 ? 's' : ''}</p>
        </div>
        <Link
          href="playlists/new"
          className="inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white hover:bg-electric/90"
        >
          🎶 New Playlist
        </Link>
      </div>

      {/* Search */}
      <form action="" method="GET">
        <input
          type="text"
          name="search"
          defaultValue={params.search ?? ''}
          placeholder="Search playlists…"
          className="w-full rounded-lg border border-border bg-card py-2 pl-4 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-electric/40"
        />
      </form>

      {/* Playlist Grid */}
      {playlists.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <div className="text-5xl mb-4">🎶</div>
            <p className="font-semibold text-foreground text-lg">
              {params.search ? 'No matching playlists' : 'No playlists yet'}
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              Create your first playlist to curate tracks.
            </p>
            {!params.search && (
              <Link
                href="playlists/new"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white"
              >
                🎶 New Playlist
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {playlists.map((playlist) => (
            <Link key={playlist.id} href={`playlists/${playlist.id}`}>
              <Card>
                <div className="p-5 hover:bg-muted/50 transition-colors rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-electric/10 text-xl">
                      🎶
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{playlist.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {playlist.creatorName ?? 'You'} · {playlist.trackCount} track{playlist.trackCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      playlist.visibility === 'public'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {playlist.visibility === 'public' ? 'Public' : 'Private'}
                    </span>
                  </div>
                  {playlist.description && (
                    <p className="mt-2 text-xs text-muted-foreground/70 line-clamp-2">{playlist.description}</p>
                  )}
                  {playlist.genre && (
                    <span className="mt-2 inline-flex rounded-full bg-navy/10 px-2 py-0.5 text-[10px] text-foreground">
                      {playlist.genre.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
