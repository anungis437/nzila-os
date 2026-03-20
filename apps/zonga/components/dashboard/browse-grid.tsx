/**
 * Zonga — Browse Grid (client component)
 *
 * Renders the browse / discover sections with inline play buttons.
 * Receives data props from the server page component.
 */
'use client'

import Link from 'next/link'
import { Card } from '@nzila/ui'
import { PlayButton, toPlayerTrack, usePlayer } from '@/components/player'

// ── Mood / Genre quick-filter chips ─────────────────────────────────────────

const moodChips = [
  { label: 'Chill', emoji: '🌙', mood: 'chill' },
  { label: 'Party', emoji: '🎉', mood: 'party' },
  { label: 'Focus', emoji: '🧠', mood: 'focus' },
  { label: 'Workout', emoji: '💪', mood: 'workout' },
  { label: 'Romance', emoji: '💕', mood: 'romance' },
  { label: 'Spiritual', emoji: '🙏', mood: 'spiritual' },
] as const

const regionChips = [
  { label: 'West Africa', emoji: '🇳🇬' },
  { label: 'East Africa', emoji: '🇰🇪' },
  { label: 'Southern Africa', emoji: '🇿🇦' },
  { label: 'Central Africa', emoji: '🇨🇩' },
  { label: 'North Africa', emoji: '🇲🇦' },
  { label: 'Diaspora', emoji: '🌍' },
] as const

// ── Shared data shape from server ───────────────────────────────────────────

export interface BrowseAsset {
  id: string
  title: string
  genre?: string | null
  durationSeconds?: number | null
  metadata?: Record<string, unknown> | null
}

export interface BrowseTrendingItem {
  id: string
  title: string | null
  subtitle?: string | null
}

export interface BrowsePlaylist {
  id: string
  title: string
  trackCount?: number | null
}

export interface BrowseEvent {
  id: string
  title: string
  startsAt?: Date | string | null
  venue?: string | null
  city?: string | null
  ticketPrice?: number
  currency?: string | null
}

interface BrowseGridProps {
  locale: string
  trending: BrowseTrendingItem[]
  assets: BrowseAsset[]
  playlists: BrowsePlaylist[]
  events: BrowseEvent[]
}

// ── Component ───────────────────────────────────────────────────────────────

export function BrowseGrid({ locale, trending, assets, playlists, events }: BrowseGridProps) {
  const { playQueue } = usePlayer()

  // Build player tracks from trending items
  const trendingTracks = trending.map((t) =>
    toPlayerTrack({
      id: t.id,
      title: t.title ?? 'Untitled',
      creatorName: t.subtitle,
    }),
  )

  return (
    <div className="space-y-10">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-navy via-navy/90 to-electric p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-electric/10 rounded-full blur-3xl" />
        <h1 className="text-3xl font-bold relative z-10">Discover</h1>
        <p className="mt-2 text-sm text-white/70 relative z-10">
          Explore the best of African music — afrobeats, amapiano, highlife, rumba, and more.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 relative z-10">
          <Link
            href={`/${locale}/dashboard/search`}
            className="rounded-lg bg-white/20 px-4 py-2 text-sm font-medium hover:bg-white/30 transition-colors backdrop-blur-sm"
          >
            🔍 Search
          </Link>
          <Link
            href={`/${locale}/dashboard/playlists`}
            className="rounded-lg bg-electric px-4 py-2 text-sm font-medium hover:bg-electric/90 transition-colors"
          >
            📋 Playlists
          </Link>
          {trending.length >= 3 && (
            <button
              type="button"
              onClick={() => playQueue(trendingTracks)}
              className="rounded-lg bg-gold px-4 py-2 text-sm font-medium text-navy hover:bg-gold/90 transition-colors"
            >
              ▶ Play Trending
            </button>
          )}
        </div>
      </div>

      {/* Mood Chips */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wider">Browse by Mood</h2>
        <div className="flex flex-wrap gap-2">
          {moodChips.map((chip) => (
            <Link
              key={chip.mood}
              href={`/${locale}/dashboard/search?mood=${chip.mood}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-navy hover:border-electric hover:bg-electric/5 transition-colors"
            >
              <span>{chip.emoji}</span> {chip.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Region Chips */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wider">Explore by Region</h2>
        <div className="flex flex-wrap gap-2">
          {regionChips.map((chip) => (
            <Link
              key={chip.label}
              href={`/${locale}/dashboard/search?region=${encodeURIComponent(chip.label)}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-navy hover:border-electric hover:bg-electric/5 transition-colors"
            >
              <span>{chip.emoji}</span> {chip.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Trending */}
      {trending.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-bold text-navy">🔥 Trending Now</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {trending.slice(0, 10).map((track, idx) => {
              const pt = trendingTracks[idx]!
              return (
                <div key={track.id} className="group relative">
                  <Link href={`/${locale}/dashboard/catalog/${track.id}`}>
                    <Card>
                      <div className="p-4 text-center hover:bg-gray-50 transition-colors rounded-lg">
                        <div className="relative mx-auto mb-3 h-16 w-16 rounded-full bg-gradient-to-br from-electric/20 to-navy/20 flex items-center justify-center">
                          <span className="text-2xl group-hover:scale-110 transition-transform">🎵</span>
                        </div>
                        <p className="text-xs font-medium text-navy truncate">{track.title ?? 'Untitled'}</p>
                        <p className="mt-0.5 text-xs text-gray-500 truncate">{track.subtitle ?? '—'}</p>
                      </div>
                    </Card>
                  </Link>
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <PlayButton track={pt} variant="icon" />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* New Releases */}
      {assets.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-navy">📀 New Releases</h2>
            <Link href={`/${locale}/dashboard/catalog`} className="text-xs text-electric hover:underline">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {assets.slice(0, 8).map((asset) => {
              const pt = toPlayerTrack({
                id: asset.id,
                title: asset.title,
                creatorName: asset.metadata?.creatorName as string | undefined,
                durationSeconds: asset.durationSeconds,
              })
              return (
                <div key={asset.id} className="group relative">
                  <Link href={`/${locale}/dashboard/catalog/${asset.id}`}>
                    <Card>
                      <div className="p-4 hover:bg-gray-50 transition-colors rounded-lg">
                        <div className="relative mb-3 h-32 rounded-lg bg-gradient-to-br from-navy/10 to-electric/10 flex items-center justify-center">
                          <span className="text-4xl group-hover:scale-110 transition-transform">🎶</span>
                          <PlayButton track={pt} variant="overlay" />
                        </div>
                        <p className="text-sm font-medium text-navy truncate">{asset.title}</p>
                        <p className="mt-0.5 text-xs text-gray-500 truncate">
                          {(asset.metadata?.creatorName as string) ?? '—'}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          {asset.genre && (
                            <span className="inline-flex rounded-full bg-navy/10 px-2 py-0.5 text-xs text-navy">
                              {asset.genre.replace(/_/g, ' ')}
                            </span>
                          )}
                          {asset.durationSeconds && (
                            <span className="text-xs text-gray-400">
                              {Math.floor(asset.durationSeconds / 60)}:{String(asset.durationSeconds % 60).padStart(2, '0')}
                            </span>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Link>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Featured Playlists */}
      {playlists.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-navy">📋 Featured Playlists</h2>
            <Link href={`/${locale}/dashboard/playlists`} className="text-xs text-electric hover:underline">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {playlists.slice(0, 6).map((pl) => (
              <Link key={pl.id} href={`/${locale}/dashboard/playlists/${pl.id}`}>
                <Card>
                  <div className="p-4 hover:bg-gray-50 transition-colors rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-emerald-400 to-electric flex items-center justify-center flex-shrink-0">
                        <span className="text-lg text-white">♫</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy truncate">{pl.title}</p>
                        <p className="text-xs text-gray-500">{pl.trackCount ?? 0} tracks</p>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming Events */}
      {events.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-navy">🎪 Upcoming Events</h2>
            <Link href={`/${locale}/dashboard/events`} className="text-xs text-electric hover:underline">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {events.slice(0, 6).map((event) => (
              <Link key={event.id} href={`/${locale}/dashboard/events/${event.id}`}>
                <Card>
                  <div className="p-4 hover:bg-gray-50 transition-colors rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 rounded-lg bg-purple-100 px-3 py-2 text-center">
                        <p className="text-xs font-bold text-purple-700">
                          {event.startsAt
                            ? new Date(event.startsAt).toLocaleDateString('en-CA', { month: 'short' })
                            : '—'}
                        </p>
                        <p className="text-lg font-bold text-purple-800">
                          {event.startsAt
                            ? new Date(event.startsAt).getDate()
                            : '—'}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy truncate">{event.title}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {[event.venue, event.city].filter(Boolean).join(', ')}
                        </p>
                        {event.ticketPrice !== undefined && (
                          <p className="mt-1 text-xs font-medium text-emerald-600">
                            From {event.currency ?? 'USD'} {event.ticketPrice}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {assets.length === 0 && trending.length === 0 && (
        <Card>
          <div className="p-12 text-center">
            <p className="text-4xl">🌍</p>
            <p className="mt-3 text-sm font-medium text-navy">Content coming soon</p>
            <p className="mt-1 text-xs text-gray-500">
              Creators are uploading new music. Check back soon!
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
