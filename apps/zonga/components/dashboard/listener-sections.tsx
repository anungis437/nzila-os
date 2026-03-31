/**
 * Zonga — Listener Music Client Components
 *
 * Client sections for the My Music page that integrate
 * with the global player context.
 */
'use client'

import Link from 'next/link'
import { Card } from '@nzila/ui'
import { PlayButton, toPlayerTrack, usePlayer } from '@/components/player'

// ── Now Playing Widget ──────────────────────────────────────────────────────

export function NowPlayingWidget() {
  const { state, currentTrack, togglePlayPause, skipNext, skipPrevious } = usePlayer()

  if (!currentTrack) {
    return (
      <Card>
        <div className="p-6 text-center">
          <p className="text-3xl mb-2">🎧</p>
          <p className="text-sm font-medium text-foreground">Nothing playing</p>
          <p className="text-xs text-muted-foreground mt-1">Browse or search for music to start listening</p>
        </div>
      </Card>
    )
  }

  const isPlaying = state.playbackState === 'playing'
  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0

  return (
    <Card>
      <div className="p-5">
        <p className="text-xs text-muted-foreground mb-3">Now Playing</p>
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-lg bg-linear-to-br from-electric/20 to-navy/20 flex items-center justify-center shrink-0">
            <span className="text-2xl">🎵</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{currentTrack.title}</p>
            <p className="text-xs text-muted-foreground truncate">{currentTrack.artistName}</p>
            <div className="mt-2 h-1 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-electric transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={skipPrevious}
              className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center text-xs"
              aria-label="Previous"
            >
              ⏮
            </button>
            <button
              type="button"
              onClick={togglePlayPause}
              className="h-9 w-9 rounded-full bg-electric text-white flex items-center justify-center hover:bg-electric/90"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <button
              type="button"
              onClick={skipNext}
              className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center text-xs"
              aria-label="Next"
            >
              ⏭
            </button>
          </div>
        </div>
        {state.queue.length > 1 && (
          <p className="text-xs text-muted-foreground mt-2">
            Track {state.currentIndex + 1} of {state.queue.length} in queue
          </p>
        )}
      </div>
    </Card>
  )
}

// ── Release Row with Play Button ─────────────────────────────────────────────

interface ReleaseRowProps {
  id: string
  title: string
  creatorName?: string
  releaseType?: string
  trackCount: number
  publishedAt?: Date | null
  locale: string
}

export function ReleaseRow({ id, title, creatorName, releaseType, trackCount, publishedAt, locale }: ReleaseRowProps) {
  const pt = toPlayerTrack({
    id,
    title,
    creatorName,
  })

  return (
    <div className="px-5 py-3 flex items-center justify-between group hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <PlayButton track={pt} variant="icon" />
        <Link href={`/${locale}/dashboard/releases/${id}`} className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate hover:text-electric transition-colors">{title}</p>
          <p className="text-xs text-muted-foreground">
            {creatorName} · {releaseType ?? 'single'} · {trackCount} tracks
          </p>
        </Link>
      </div>
      {publishedAt && (
        <p className="text-xs text-muted-foreground shrink-0">
          {new Date(publishedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  )
}

// ── Queue View ───────────────────────────────────────────────────────────────

export function QueueView() {
  const { state, removeFromQueue } = usePlayer()

  if (state.queue.length === 0) return null

  return (
    <Card>
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Queue</h2>
          <span className="text-xs text-muted-foreground">{state.queue.length} tracks</span>
        </div>
        <div className="divide-y divide-border max-h-64 overflow-y-auto">
          {state.queue.map((track, idx) => (
            <div
              key={`${track.assetId}-${idx}`}
              className={`flex items-center gap-3 py-2 ${
                idx === state.currentIndex ? 'bg-electric/5 -mx-2 px-2 rounded' : ''
              }`}
            >
              <span className="text-xs text-muted-foreground w-5 text-right">
                {idx === state.currentIndex ? '▶' : idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{track.title}</p>
                <p className="text-xs text-muted-foreground truncate">{track.artistName}</p>
              </div>
              {idx !== state.currentIndex && (
                <button
                  type="button"
                  onClick={() => removeFromQueue(idx)}
                  className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
                  aria-label={`Remove ${track.title} from queue`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
