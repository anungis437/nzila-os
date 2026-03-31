/**
 * Zonga — Track Detail / Player page (Listener-facing).
 *
 * Full track view with streaming player, waveform,
 * like/comment/tip, creator info, and related tracks.
 */
import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@nzila/ui'
import { getAssetDetail } from '@/lib/actions/catalog-actions'
import { getAssetLikeCount, listComments } from '@/lib/actions/social-actions'
import { TrackPlayer } from '@/components/dashboard/track-player'
import { LikeButton } from '@/components/dashboard/like-button'
import { CommentForm } from '@/components/dashboard/comment-form'
import { TipButton } from '@/components/dashboard/tip-button'

export default async function TrackPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { id, locale } = await params
  const [asset, likeCount, comments] = await Promise.all([
    getAssetDetail(id),
    getAssetLikeCount(id),
    listComments(id),
  ])

  if (!asset) notFound()

  return (
    <div className="space-y-8">
      <Link
        href={`/${locale}/dashboard/browse`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to Browse
      </Link>

      {/* Hero */}
      <div className="rounded-2xl bg-linear-to-br from-navy via-navy/90 to-electric/80 p-8 text-white">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
          <div className="h-40 w-40 flex-shrink-0 rounded-xl bg-white/10 flex items-center justify-center">
            <span className="text-6xl">🎵</span>
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium uppercase text-white/60 tracking-wider">
              {asset.type ?? 'Track'}
            </p>
            <h1 className="mt-1 text-3xl font-bold">{asset.title}</h1>
            {(asset.metadata?.creatorName as string) && (
              <p className="mt-2 text-sm text-white/80">
                by{' '}
                <Link
                  href={`/${locale}/dashboard/artists/${asset.creatorId ?? ''}`}
                  className="font-medium text-white underline-offset-2 hover:underline"
                >
                  {(asset.metadata?.creatorName as string)}
                </Link>
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {asset.genre && (
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs">
                  {asset.genre.replace(/_/g, ' ')}
                </span>
              )}
              {asset.language && (
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs uppercase">
                  {asset.language}
                </span>
              )}
              <span className="text-xs text-white/60">
                {asset.durationSeconds
                  ? `${Math.floor(asset.durationSeconds / 60)}:${String(
                      asset.durationSeconds % 60,
                    ).padStart(2, '0')}`
                  : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Player */}
          <Card>
            <div className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">▶️ Now Playing</h2>
              <TrackPlayer
                assetId={id}
                title={asset.title}
                creatorName={(asset.metadata?.creatorName as string) ?? undefined}
                durationSeconds={asset.durationSeconds ?? undefined}
              />
            </div>
          </Card>

          {/* Social Actions */}
          <div className="flex items-center gap-3">
            <LikeButton assetId={id} assetTitle={asset.title} initialCount={likeCount} />
            <TipButton
              creatorId={asset.creatorId ?? ''}
              creatorName={(asset.metadata?.creatorName as string) ?? 'Creator'}
            />
          </div>

          {/* Comments */}
          <Card>
            <div className="p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">
                💬 Comments ({comments.length})
              </h2>

              <CommentForm assetId={id} />

              {comments.length === 0 ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  No comments yet. Be the first to share your thoughts!
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {comments.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg bg-muted p-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-foreground">
                          {c.userName ?? 'Anonymous'}
                        </p>
                        <p className="text-xs text-muted-foreground/70">
                          {c.createdAt
                            ? new Date(c.createdAt).toLocaleDateString('en-CA', {
                                month: 'short',
                                day: 'numeric',
                              })
                            : ''}
                        </p>
                      </div>
                      <p className="mt-1 text-sm text-foreground">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stats */}
          <Card>
            <div className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">📊 Stats</h2>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-xl font-bold text-foreground">
                    {((asset.metadata?.streams as number) ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Streams</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{likeCount}</p>
                  <p className="text-xs text-muted-foreground">Likes</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{comments.length}</p>
                  <p className="text-xs text-muted-foreground">Comments</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">
                    {((asset.metadata?.downloads as number) ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Downloads</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Creator Card */}
          {(asset.metadata?.creatorName as string) && (
            <Card>
              <div className="p-5">
                <h2 className="mb-3 text-sm font-semibold text-foreground">🎤 Creator</h2>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-navy/10 flex items-center justify-center">
                    <span className="text-sm">🎤</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{(asset.metadata?.creatorName as string)}</p>
                    <Link
                      href={`/${locale}/dashboard/creators/${asset.creatorId ?? ''}`}
                      className="text-xs text-electric hover:underline"
                    >
                      View profile →
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Quality */}
          {asset.qualityTiers && asset.qualityTiers.length > 0 && (
            <Card>
              <div className="p-5">
                <h2 className="mb-3 text-sm font-semibold text-foreground">🎵 Quality</h2>
                <div className="space-y-1">
                  {asset.qualityTiers.map((tier: string) => (
                    <div
                      key={tier}
                      className="flex items-center justify-between rounded bg-muted px-3 py-1.5 text-xs"
                    >
                      <span className="font-medium text-foreground capitalize">{tier}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
