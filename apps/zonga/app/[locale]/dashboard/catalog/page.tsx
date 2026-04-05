/**
 * Zonga — Catalog Page (Server Component).
 *
 * Content asset library: tracks, albums, and other media.
 * Searchable, filterable grid with upload action.
 * Genre filter supports African genre taxonomy.
 */
import Link from 'next/link'
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { Card } from '@nzila/ui'
import { listCatalogAssets } from '@/lib/actions/catalog-actions'
import { AfricanGenre } from '@/lib/zonga-services'
import { CatalogCard } from '@/components/dashboard/catalog-card'

/** Top-level genre groups for the filter bar. */
const GENRE_GROUPS = [
  { label: 'All', value: '' },
  { label: 'Afrobeats', value: AfricanGenre.AFROBEATS },
  { label: 'Amapiano', value: AfricanGenre.AMAPIANO },
  { label: 'Bongo Flava', value: AfricanGenre.BONGO_FLAVA },
  { label: 'Highlife', value: AfricanGenre.HIGHLIFE },
  { label: 'Soukous', value: AfricanGenre.SOUKOUS },
  { label: 'Gospel', value: AfricanGenre.AFRO_GOSPEL },
  { label: 'Hip Hop', value: AfricanGenre.AFRO_HIP_HOP },
  { label: 'Gengetone', value: AfricanGenre.GENGETONE },
  { label: 'Kizomba', value: AfricanGenre.KIZOMBA },
  { label: 'Gqom', value: AfricanGenre.GQOM },
  { label: 'Raï', value: AfricanGenre.RAI },
] as const

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string; genre?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const params = await searchParams
  const page = Number(params.page ?? '1')
  const { assets, total, hasMore } = await listCatalogAssets({
    page,
    pageSize: 24,
    search: params.search,
    status: params.status,
  })

  // Client-side genre filter (server action already returns all; filter here for now)
  const filteredAssets = params.genre
    ? assets.filter((a) => a.genre === params.genre)
    : assets
  const displayTotal = params.genre ? filteredAssets.length : total
  const withCollaborators = filteredAssets.filter((a) => a.collaborators?.length).length
  const languages = new Set(filteredAssets.map((asset) => asset.language).filter(Boolean))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Catalog</h1>
          <p className="text-muted-foreground mt-1">{displayTotal} asset{displayTotal !== 1 ? 's' : ''} in your library{withCollaborators > 0 && ` · ${withCollaborators} with collaborators`}{languages.size > 0 && ` · ${languages.size} language${languages.size !== 1 ? 's' : ''}`}</p>
        </div>
        <Link
          href="catalog/upload"
          className="inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white hover:bg-electric/90"
        >
          🎵 Upload
        </Link>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <form className="relative flex-1" action="" method="GET">
          <input
            type="text"
            name="search"
            defaultValue={params.search ?? ''}
            placeholder="Search tracks, albums…"
            className="w-full rounded-lg border border-border bg-card py-2 pl-4 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-electric/40"
          />
        </form>
        <div className="flex gap-2">
          {['all', 'draft', 'published'].map((s) => (
            <Link
              key={s}
              href={`?status=${s === 'all' ? '' : s}${params.genre ? `&genre=${params.genre}` : ''}`}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                (params.status ?? '') === (s === 'all' ? '' : s) || (!params.status && s === 'all')
                  ? 'border-electric bg-electric/10 text-electric'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Link>
          ))}
        </div>
      </div>

      {/* Genre Filter — African Taxonomy */}
      <div className="flex gap-2 flex-wrap">
        {GENRE_GROUPS.map((g) => (
          <Link
            key={g.label}
            href={`?genre=${g.value}${params.status ? `&status=${params.status}` : ''}`}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              (params.genre ?? '') === g.value
                ? 'bg-navy text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted'
            }`}
          >
            {g.label}
          </Link>
        ))}
      </div>

      {/* Grid */}
      {filteredAssets.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <div className="text-5xl mb-4">🎵</div>
            <p className="font-semibold text-foreground text-lg">
              {params.search || params.genre ? 'No matching assets' : 'Your catalog is empty'}
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              {params.search || params.genre ? 'Try different filters.' : 'Upload your first track to get started.'}
            </p>
            {!params.search && !params.genre && (
              <Link
                href="catalog/upload"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white"
              >
                🎵 Upload Track
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAssets.map((asset) => (
            <CatalogCard
              key={asset.id}
              asset={asset}
              basePath="catalog"
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 24 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} · {total} total</p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`?page=${page - 1}`} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50">
                Previous
              </Link>
            )}
            {hasMore && (
              <Link href={`?page=${page + 1}`} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
