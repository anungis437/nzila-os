/**
 * Zonga — Releases Page (Server Component).
 *
 * Manage content releases (albums, EPs, singles, compilations).
 */
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Card } from '@nzila/ui'
import { listReleases } from '@/lib/actions/release-actions'

export default async function ReleasesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const params = await searchParams
  const { releases, total } = await listReleases({
    page: Number(params.page ?? '1'),
    status: params.status,
  })

  const statusOptions = ['all', 'draft', 'scheduled', 'released', 'archived']

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Releases</h1>
          <p className="text-gray-500 mt-1">Albums, EPs, singles & compilations</p>
        </div>
        <Link
          href="releases/create"
          className="inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white hover:bg-electric/90"
        >
          💿 New Release
        </Link>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 flex-wrap">
        {statusOptions.map(s => (
          <a
            key={s}
            href={`?status=${s === 'all' ? '' : s}`}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              (params.status ?? '') === (s === 'all' ? '' : s)
                ? 'bg-navy text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </a>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <div className="p-5">
            <p className="text-xs text-gray-500">Total Releases</p>
            <p className="text-2xl font-bold text-navy">{total}</p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-xs text-gray-500">Showing</p>
            <p className="text-2xl font-bold text-navy">{releases.length}</p>
          </div>
        </Card>
      </div>

      {/* Release Cards */}
      {releases.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <div className="text-5xl mb-4">💿</div>
            <p className="font-semibold text-navy text-lg">No releases found</p>
            <p className="text-gray-500 text-sm mt-1">
              Create your first release to get started.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {releases.map((r: { id: string; title?: string; type?: string; status?: string; trackCount?: number; creatorName?: string; releaseDate?: string | null }) => (
            <Card key={r.id}>
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-navy">{r.title ?? 'Untitled'}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {r.creatorName ?? 'Unknown artist'}
                    </p>
                  </div>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.status === 'released'
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : r.status === 'scheduled'
                        ? 'bg-blue-500/10 text-blue-600'
                        : r.status === 'draft'
                          ? 'bg-amber-500/10 text-amber-600'
                          : 'bg-gray-100 text-gray-500'
                  }`}>
                    {r.status ?? 'draft'}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    🎵 {r.trackCount ?? 0} tracks
                  </span>
                  <span className="inline-flex items-center gap-1">
                    📀 {r.type ?? 'single'}
                  </span>
                </div>

                {r.releaseDate && (
                  <p className="text-xs text-gray-500">
                    Release: {new Date(r.releaseDate).toLocaleDateString('en-CA')}
                  </p>
                )}

                <Link
                  href={`releases/${r.id}`}
                  className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-navy hover:bg-gray-50 transition"
                >
                  View Details →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
