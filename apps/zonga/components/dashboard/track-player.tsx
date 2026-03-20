/**
 * Track Player — Client component wired to the global player context.
 *
 * Inline player with waveform visualization and real playback controls.
 * Used on catalog detail pages.
 */
'use client'

import { usePlayer, toPlayerTrack } from '@/components/player'

export function TrackPlayer({
  assetId,
  title,
  creatorName,
  durationSeconds,
}: {
  assetId: string
  title: string
  creatorName?: string
  durationSeconds?: number
}) {
  const { state, currentTrack, playTrack, addToQueue, togglePlayPause } = usePlayer()

  const isThisTrack = currentTrack?.assetId === assetId
  const isPlaying = isThisTrack && state.playbackState === 'playing'
  const isLoading = isThisTrack && state.playbackState === 'loading'
  const progress = isThisTrack && state.duration > 0
    ? (state.currentTime / state.duration) * 100
    : 0

  const track = toPlayerTrack({ id: assetId, title, creatorName, durationSeconds })

  function handlePlay() {
    if (isThisTrack) {
      togglePlayPause()
    } else {
      playTrack(track)
    }
  }

  function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className="space-y-3">
      {/* Waveform visualization */}
      <div className="h-16 rounded-lg bg-navy/5 flex items-end gap-0.5 px-2 py-1 overflow-hidden">
        {Array.from({ length: 60 }).map((_, i) => {
          const h = 20 + Math.sin(i * 0.5) * 30 + Math.cos(i * 0.3) * 20
          const active = (i / 60) * 100 <= progress
          return (
            <div
              key={i}
              className={`flex-1 rounded-t transition-colors ${
                active ? 'bg-electric' : 'bg-navy/20'
              }`}
              style={{ height: `${Math.max(10, h)}%` }}
            />
          )
        })}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePlay}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white hover:bg-electric/90 transition-colors disabled:opacity-50"
            aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`}
          >
            {isLoading ? '⏳ Loading…' : isPlaying ? '⏸ Pause' : '▶️ Play'}
          </button>
          <button
            type="button"
            onClick={() => addToQueue(track)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            + Queue
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {isThisTrack && state.duration > 0 && (
            <span>{formatTime(state.currentTime)} / {formatTime(state.duration)}</span>
          )}
          {!isThisTrack && durationSeconds && (
            <span>{formatTime(durationSeconds)}</span>
          )}
          <span className="truncate max-w-[150px]">{title}</span>
        </div>
      </div>

      {/* Error display */}
      {isThisTrack && state.error && (
        <p className="text-xs text-red-500 bg-red-50 rounded px-2 py-1">{state.error}</p>
      )}
    </div>
  )
}
