/**
 * Zonga — Tracks Directory (Server Component).
 *
 * Browseable track catalog with search, genre, and status filtering.
 * Links into per-track detail page at /tracks/[id].
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@nzila/ui'
import { listCatalogAssets } from '@/lib/actions/catalog-actions'

const statusBadge = (status: string) => {
  const colors: Record<string, string> = {
    published: 'bg-green-100 text-green-700',
    draft: 'bg-muted text-muted-foreground',
    pending_review: 'bg-yellow-100 text-yellow-700',
    rejected: 'bg-red-100 text-red-700',
    archived: 'bg-muted text-muted-foreground',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? colors.draft}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default async function TracksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? '1'))

  const { assets: tracks, total } = await listCatalogAssets({
    page,
    pageSize: 25,
    search: params.search,
    type: 'track',
    status: params.status,
  })

  const totalPages = Math.ceil(total / 25)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tracks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} track{total !== 1 ? 's' : ''} in the catalog.
          </p>
        </div>
        <form className="flex gap-2">
          <input
            type="text"
            name="search"
            placeholder="Search tracks…"
            defaultValue={params.search ?? ''}
            className="rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <select
            name="status"
            defaultValue={params.status ?? ''}
            className="rounded-lg border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="pending_review">Pending Review</option>
            <option value="rejected">Rejected</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Search
          </button>
        </form>
      </div>

      {tracks.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <p className="text-4xl">🎵</p>
            <p className="mt-3 text-sm font-medium text-foreground">No tracks found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tracks will appear here once creators upload content to the catalog.
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Artist</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Genre</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Streams</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tracks.map((track, i) => (
                  <tr key={track.id} className="hover:bg-muted/50 transition-colors group">
                    <td className="px-4 py-3 text-xs text-muted-foreground/70">
                      {(page - 1) * 25 + i + 1}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      <Link
                        href={`tracks/${track.id}`}
                        className="hover:text-emerald-600 transition-colors"
                      >
                        {track.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {(track as unknown as Record<string, unknown>).creatorName as string ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDuration((track as unknown as Record<string, unknown>).duration as number | null)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {(track as unknown as Record<string, unknown>).genre as string ?? '—'}
                    </td>
                    <td className="px-4 py-3">{statusBadge(track.status)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {((track as unknown as Record<string, unknown>).streamCount as number ?? 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`?page=${page - 1}${params.search ? `&search=${params.search}` : ''}${params.status ? `&status=${params.status}` : ''}`}
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
              href={`?page=${page + 1}${params.search ? `&search=${params.search}` : ''}${params.status ? `&status=${params.status}` : ''}`}
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
