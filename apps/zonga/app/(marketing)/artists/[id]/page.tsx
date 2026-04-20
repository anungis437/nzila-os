/**
 * Artist Profile — Public page for a single creator
 *
 * Shows artist bio, releases, and follower count.
 * Publicly accessible — no auth required.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPublicArtistProfile } from '@/lib/public-data'
import ScrollReveal from '@/components/public/scroll-reveal'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const { artist } = await getPublicArtistProfile(id)
  if (!artist) return { title: 'Artist Not Found | Zonga' }

  return {
    title: `${artist.name} | Zonga`,
    description: artist.bio ?? `Listen to ${artist.name} on Zonga — the fair-share music platform.`,
    openGraph: {
      title: `${artist.name} | Zonga`,
      description: artist.bio ?? `Listen to ${artist.name} on Zonga.`,
    },
  }
}

export const dynamic = 'force-dynamic'

export default async function ArtistProfilePage({ params }: Props) {
  const { id } = await params
  const { artist, releases } = await getPublicArtistProfile(id)

  if (!artist) notFound()

  const shareText = encodeURIComponent(`Listen to ${artist.name} on Zonga`)
  const shareUrl = encodeURIComponent(`https://zonga.ca/artists/${artist.id}`)

  return (
    <>
      {/* Hero */}
      <section className="relative bg-navy -mt-16 md:-mt-20 pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-mesh opacity-20" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Avatar */}
              <div className="w-40 h-40 md:w-52 md:h-52 rounded-2xl bg-linear-to-br from-electric/20 to-purple-500/20 flex items-center justify-center overflow-hidden shadow-2xl shadow-electric/20">
                {artist.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={artist.avatarUrl}
                    alt={artist.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-7xl text-white/40">🎵</span>
                )}
              </div>

              {/* Info */}
              <div className="text-center md:text-left">
                <h1 className="text-4xl md:text-5xl font-bold text-white">{artist.name}</h1>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3 text-gray-300">
                  {artist.genre && (
                    <span className="px-3 py-1 rounded-full bg-white/10 text-sm">{artist.genre}</span>
                  )}
                  {artist.country && (
                    <span className="px-3 py-1 rounded-full bg-white/10 text-sm">{artist.country}</span>
                  )}
                </div>
                <div className="flex items-center justify-center md:justify-start gap-6 mt-4 text-sm text-gray-400">
                  <div>
                    <span className="text-white font-semibold text-lg">
                      {artist.followerCount.toLocaleString()}
                    </span>{' '}
                    followers
                  </div>
                  <div>
                    <span className="text-white font-semibold text-lg">{artist.releaseCount}</span>{' '}
                    releases
                  </div>
                </div>
                {artist.bio && (
                  <p className="mt-4 text-gray-300 max-w-xl leading-relaxed">{artist.bio}</p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <a
                    href={`https://wa.me/?text=${shareText}%20${shareUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30"
                  >
                    Share on WhatsApp
                  </a>
                  <a
                    href={`https://www.instagram.com/?url=${shareUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-pink-500/20 px-3 py-1 text-xs font-semibold text-pink-200 hover:bg-pink-500/30"
                  >
                    Instagram
                  </a>
                  <a
                    href={`https://www.tiktok.com/search?q=${encodeURIComponent(artist.name)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/30"
                  >
                    TikTok
                  </a>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      <section className="bg-navy py-10 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-xs uppercase tracking-wider text-gray-400">Artist Story · Histoire de l&apos;artiste</p>
              <p className="mt-2 text-sm text-gray-200 leading-relaxed">
                {artist.name} represents the diaspora sound bridge between local roots and global stages.
                This page supports event tie-ins, playlist placement, and cross-market discovery.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Link href="/events" className="rounded-full bg-electric/20 px-3 py-1 text-electric-light hover:bg-electric/30">Upcoming events</Link>
                <Link href="/for-labels#community-playlists" className="rounded-full bg-white/10 px-3 py-1 text-white hover:bg-white/20">Community playlists</Link>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Releases */}
      <section className="bg-navy py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <h2 className="text-2xl font-bold text-white mb-8">Releases</h2>
          </ScrollReveal>

          {releases.length === 0 ? (
            <p className="text-gray-400">No published releases yet.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {releases.map((release, i) => (
                <ScrollReveal key={release.id} delay={i * 0.05}>
                  <div className="glass-card rounded-xl overflow-hidden hover-lift transition-all group">
                    {/* Cover */}
                    <div className="aspect-square bg-linear-to-br from-electric/10 to-purple-500/10 flex items-center justify-center">
                      {release.coverArtUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={release.coverArtUrl}
                          alt={release.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <span className="text-4xl text-white/30">💿</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <h3 className="text-white font-medium truncate">{release.title}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <span className="capitalize">{release.releaseType}</span>
                        <span>·</span>
                        <span>{release.trackCount} tracks</span>
                      </div>
                      {release.releaseDate && (
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(release.releaseDate).toLocaleDateString('en-GB', {
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Back link */}
      <section className="bg-navy pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/artists"
            className="text-electric hover:text-electric-light transition-colors text-sm font-medium"
          >
            ← All Artists
          </Link>
        </div>
      </section>
    </>
  )
}
