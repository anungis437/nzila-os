/**
 * Zonga — Inline Play Button
 *
 * Reusable button that plays a track via the global player context.
 * Use on browse cards, catalog rows, search results, etc.
 */
'use client'

import { usePlayer, type PlayerTrack } from '@/components/player'

interface PlayButtonProps {
  /** Track data to play */
  track: PlayerTrack
  /** Visual variant */
  variant?: 'icon' | 'pill' | 'overlay'
  /** Additional CSS classes */
  className?: string
}

export function PlayButton({ track, variant = 'icon', className = '' }: PlayButtonProps) {
  const { state, currentTrack, playTrack, togglePlayPause } = usePlayer()

  const isThisTrack = currentTrack?.assetId === track.assetId
  const isPlaying = isThisTrack && state.playbackState === 'playing'

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (isThisTrack) {
      togglePlayPause()
    } else {
      playTrack(track)
    }
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 rounded-full bg-electric px-3 py-1.5 text-xs font-medium text-white hover:bg-electric/90 transition-colors ${className}`}
        aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
      >
        {isPlaying ? '⏸' : '▶'} {isPlaying ? 'Pause' : 'Play'}
      </button>
    )
  }

  if (variant === 'overlay') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg ${className}`}
        aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-electric text-white shadow-lg">
          {isPlaying ? '⏸' : '▶'}
        </span>
      </button>
    )
  }

  // Default: icon
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex h-8 w-8 items-center justify-center rounded-full bg-electric/10 text-electric hover:bg-electric hover:text-white transition-colors ${className}`}
      aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
    >
      {isPlaying ? '⏸' : '▶'}
    </button>
  )
}

/** Helper to build a PlayerTrack from minimal asset data */
export function toPlayerTrack(asset: {
  id: string
  title: string
  creatorName?: string | null
  coverArtUrl?: string | null
  durationSeconds?: number | null
  streamUrl?: string | null
}): PlayerTrack {
  return {
    assetId: asset.id,
    title: asset.title,
    artistName: asset.creatorName ?? 'Unknown Artist',
    coverArtUrl: asset.coverArtUrl ?? null,
    durationSeconds: asset.durationSeconds ?? 0,
    streamUrl: asset.streamUrl ?? null,
  }
}
