/**
 * Zonga — Artist Profile page (Listener-facing).
 *
 * Public artist profile with discography, social stats,
 * upcoming events, and follow/tip actions.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@nzila/ui'
import { getCreatorDetail } from '@/lib/actions/creator-actions'
import { listCatalogAssets } from '@/lib/actions/catalog-actions'
import { getSocialStats } from '@/lib/actions/social-actions'
import { FollowButton } from '@/components/dashboard/follow-button'
import { TipButton } from '@/components/dashboard/tip-button'

export default async function ArtistProfilePage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { id, locale } = await params
  const [creatorResult, socialStats] = await Promise.all([
    getCreatorDetail(id),
    getSocialStats(id),
  ])

  if (!creatorResult.creator) notFound()
  const creator = creatorResult.creator

  // Get creator's published tracks
  const allAssets = await listCatalogAssets({ status: 'published' })
  const creatorAssets = allAssets.assets.filter(
    (a) => a.creatorId === id,
  )

  return (
    <div className="space-y-8">
      <Link
        href={`/${locale}/dashboard/browse`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to Browse
      </Link>

      {/* Artist Hero */}
      <div className="rounded-2xl bg-linear-to-br from-navy via-navy/90 to-electric/70 p-8 text-white">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
          <div className="h-28 w-28 shrink-0 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center">
            <span className="text-5xl">🎤</span>
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium uppercase text-white/60 tracking-wider">Artist</p>
            <h1 className="mt-1 text-3xl font-bold">{creator.displayName}</h1>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-white/70">
              {creator.country && (
                <span>📍 {creator.country.replace(/_/g, ' ')}</span>
              )}
              {creator.genre && (
                <span>🎵 {creator.genre.replace(/_/g, ' ')}</span>
              )}
            </div>
            <div className="mt-4 flex items-center gap-6 text-sm">
              <div>
                <span className="font-bold text-white">{socialStats.followers}</span>
                <span className="ml-1 text-white/60">followers</span>
              </div>
              <div>
                <span className="font-bold text-white">{creatorAssets.length}</span>
                <span className="ml-1 text-white/60">tracks</span>
              </div>
              <div>
                <span className="font-bold text-white">{socialStats.likes}</span>
                <span className="ml-1 text-white/60">likes given</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <FollowButton followingId={id} followingName={creator.displayName} />
            <TipButton creatorId={id} creatorName={creator.displayName} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Discography */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">
                📀 Discography ({creatorAssets.length})
              </h2>
              {creatorAssets.length === 0 ? (
                <p className="text-xs text-muted-foreground">No published tracks yet.</p>
              ) : (
                <div className="space-y-2">
                  {creatorAssets.map((asset, i) => (
                    <Link
                      key={asset.id}
                      href={`/${locale}/dashboard/tracks/${asset.id}`}
                      className="flex items-center gap-4 rounded-lg p-3 hover:bg-muted/50 transition-colors"
                    >
                      <span className="w-6 text-center text-xs text-muted-foreground/70">
                        {i + 1}
                      </span>
                      <div className="h-10 w-10 shrink-0 rounded bg-navy/10 flex items-center justify-center">
                        <span>🎵</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {asset.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {asset.type ?? 'Track'}
                          {asset.genre && ` · ${asset.genre.replace(/_/g, ' ')}`}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground/70">
                        {((asset.metadata?.streams as number) ?? 0).toLocaleString()} plays
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Bio / About */}
          <Card>
            <div className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">📝 About</h2>
              <dl className="space-y-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="font-medium text-foreground capitalize">
                    {creator.status ?? 'active'}
                  </dd>
                </div>
                {creator.bio && (
                  <div>
                    <dt className="text-muted-foreground">Bio</dt>
                    <dd className="font-medium text-foreground">{creator.bio}</dd>
                  </div>
                )}
                {creator.createdAt && (
                  <div>
                    <dt className="text-muted-foreground">Joined</dt>
                    <dd className="font-medium text-foreground">
                      {new Date(creator.createdAt).toLocaleDateString('en-CA', {
                        year: 'numeric',
                        month: 'long',
                      })}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </Card>

          {/* Social Stats */}
          <Card>
            <div className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">📊 Social</h2>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-lg font-bold text-foreground">{socialStats.followers}</p>
                  <p className="text-xs text-muted-foreground">Followers</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-lg font-bold text-foreground">{socialStats.following}</p>
                  <p className="text-xs text-muted-foreground">Following</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-lg font-bold text-foreground">{socialStats.comments}</p>
                  <p className="text-xs text-muted-foreground">Comments</p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-lg font-bold text-foreground">{socialStats.likes}</p>
                  <p className="text-xs text-muted-foreground">Likes</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
