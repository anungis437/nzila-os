/**
 * Zonga — Global Player Bar
 *
 * Persistent bottom bar with play controls, progress, volume,
 * queue toggle, and track info. Docked to the bottom of the viewport.
 */
'use client'

import Image from 'next/image'
import { usePlayer } from './player-context'

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function PlayerBar() {
  const {
    state,
    currentTrack,
    togglePlayPause,
    skipNext,
    skipPrevious,
    seekTo,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer()

  if (!currentTrack) return null

  const progressPercent = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0

  const repeatIcon = state.repeat === 'off' ? '🔁' : state.repeat === 'all' ? '🔁' : '🔂'
  const repeatOpacity = state.repeat === 'off' ? 'opacity-40' : ''

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-navy/95 backdrop-blur-xl text-white">
      {/* Progress bar (thin clickable strip) */}
      <button
        type="button"
        className="absolute -top-1 left-0 right-0 h-2 cursor-pointer group"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const pct = (e.clientX - rect.left) / rect.width
          seekTo(pct * state.duration)
        }}
        aria-label="Seek"
      >
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 group-hover:h-1 transition-all">
          <div
            className="h-full bg-electric transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </button>

      <div className="mx-auto flex max-w-screen-2xl items-center gap-4 px-4 py-2">
        {/* Track Info */}
        <div className="flex items-center gap-3 min-w-0 w-1/4">
          <div className="h-10 w-10 shrink-0 rounded bg-white/10 flex items-center justify-center overflow-hidden relative">
            {currentTrack.coverArtUrl ? (
              <Image
                src={currentTrack.coverArtUrl}
                alt=""
                fill
                className="object-cover"
              />
            ) : (
              <span className="text-lg">🎵</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{currentTrack.title}</p>
            <p className="text-xs text-white/50 truncate">{currentTrack.artistName}</p>
          </div>
        </div>

        {/* Center Controls */}
        <div className="flex flex-1 flex-col items-center gap-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleShuffle}
              className={`text-sm transition-opacity ${state.shuffle ? '' : 'opacity-40'} hover:opacity-100`}
              aria-label="Shuffle"
            >
              🔀
            </button>
            <button
              type="button"
              onClick={skipPrevious}
              className="text-lg hover:scale-110 transition-transform"
              aria-label="Previous"
            >
              ⏮
            </button>
            <button
              type="button"
              onClick={togglePlayPause}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-navy hover:scale-105 transition-transform"
              aria-label={state.playbackState === 'playing' ? 'Pause' : 'Play'}
            >
              {state.playbackState === 'loading' ? (
                <span className="animate-spin text-sm">⏳</span>
              ) : state.playbackState === 'playing' ? (
                <span className="text-sm">⏸</span>
              ) : (
                <span className="text-sm ml-0.5">▶</span>
              )}
            </button>
            <button
              type="button"
              onClick={skipNext}
              className="text-lg hover:scale-110 transition-transform"
              aria-label="Next"
            >
              ⏭
            </button>
            <button
              type="button"
              onClick={cycleRepeat}
              className={`text-sm transition-opacity ${repeatOpacity} hover:opacity-100`}
              aria-label="Repeat"
            >
              {repeatIcon}
            </button>
          </div>

          {/* Time */}
          <div className="flex items-center gap-2 text-xs text-white/50">
            <span className="w-10 text-right">{formatTime(state.currentTime)}</span>
            <span>/</span>
            <span className="w-10">{formatTime(state.duration)}</span>
          </div>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2 w-1/4 justify-end">
          <span className="text-xs text-white/40">
            {state.queue.length > 1 && `${state.currentIndex + 1}/${state.queue.length}`}
          </span>
          <button
            type="button"
            onClick={toggleMute}
            className="text-sm hover:opacity-100 opacity-60"
            aria-label={state.muted ? 'Unmute' : 'Mute'}
          >
            {state.muted || state.volume === 0 ? '🔇' : state.volume < 0.5 ? '🔉' : '🔊'}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={state.muted ? 0 : state.volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-20 accent-electric"
            aria-label="Volume"
          />
        </div>
      </div>

      {/* Error state */}
      {state.error && (
        <div className="bg-red-600/90 text-xs text-center py-1">
          {state.error}
        </div>
      )}
    </div>
  )
}
