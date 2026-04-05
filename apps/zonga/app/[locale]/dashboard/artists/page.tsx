/**
 * Zonga — Artists Directory (Server Component).
 *
 * Browseable artist roster with region, genre, and search filtering.
 * Links into per-artist detail page at /artists/[id].
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@nzila/ui'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'

interface ArtistRow {
  id: string
  displayName: string
  region: string | null
  genre: string | null
  trackCount: number
  totalStreams: number
}

const regionEmoji: Record<string, string> = {
  west: '🇳🇬',
  east: '🇰🇪',
  central: '🇨🇲',
  southern: '🇿🇦',
  north: '🇲🇦',
  diaspora: '🌍',
}

export default async function ArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? '1'))
  const pageSize = 25
  const offset = (page - 1) * pageSize

  let artists: ArtistRow[] = []
  let total = 0

  try {
    const searchFilter = params.search
      ? sql` WHERE LOWER(c.display_name) LIKE ${'%' + params.search.toLowerCase() + '%'}`
      : sql``

    const countResult = await platformDb.execute(
      sql`SELECT COUNT(*)::int AS total FROM zonga_creators c ${searchFilter}`
    )
    total = (countResult as unknown as { total: number }[])[0]?.total ?? 0

    const rows = await platformDb.execute(sql`
      SELECT
        c.id,
        c.display_name AS "displayName",
        c.region,
        c.primary_genre AS genre,
        COALESCE(a.track_count, 0)::int AS "trackCount",
        COALESCE(a.total_streams, 0)::int AS "totalStreams"
      FROM zonga_creators c
      LEFT JOIN (
        SELECT
          creator_id,
          COUNT(*)::int AS track_count,
          COALESCE(SUM(stream_count), 0)::int AS total_streams
        FROM zonga_content_assets
        WHERE type = 'track'
        GROUP BY creator_id
      ) a ON a.creator_id = c.id
      ${searchFilter}
      ORDER BY c.display_name ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `)
    artists = rows as unknown as ArtistRow[]
  } catch {
    // Tables may not exist yet
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Artists</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} artist{total !== 1 ? 's' : ''} on the platform.
          </p>
        </div>
        <form className="flex gap-2">
          <input
            type="text"
            name="search"
            placeholder="Search artists…"
            defaultValue={params.search ?? ''}
            className="rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Search
          </button>
        </form>
      </div>

      {artists.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <p className="text-4xl">🎤</p>
            <p className="mt-3 text-sm font-medium text-foreground">No artists found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Artists will appear here once creators register and upload content.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {artists.map((artist) => (
            <Link key={artist.id} href={`artists/${artist.id}`}>
              <Card>
                <div className="p-5 hover:bg-muted/50 transition-colors rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-lg">
                      {regionEmoji[artist.region ?? ''] ?? '🎵'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground truncate">{artist.displayName}</h3>
                      <p className="text-xs text-muted-foreground">
                        {artist.genre ?? 'Various'} • {artist.region ?? 'Global'}
                      </p>
                      <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                        <span>{artist.trackCount} tracks</span>
                        <span>{artist.totalStreams.toLocaleString()} streams</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`?page=${page - 1}${params.search ? `&search=${params.search}` : ''}`}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/50"
            >
              ← Previous
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`?page=${page + 1}${params.search ? `&search=${params.search}` : ''}`}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted/50"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
