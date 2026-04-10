'use client'

/**
 * Zonga — Audio Player Component
 *
 * Full-featured streaming audio player with progress bar,
 * quality selection, and playback telemetry.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'

interface AudioPlayerProps {
  trackId: string
  title: string
  artistName: string
  coverUrl?: string
  streamUrl: string
  durationMs: number
  onPlaybackEvent?: (event: {
    trackId: string
    position: number
    duration: number
    action: 'play' | 'pause' | 'seek' | 'complete'
  }) => void
  onNext?: () => void
  onPrevious?: () => void
}

export function AudioPlayer({
  trackId,
  title,
  artistName,
  coverUrl,
  streamUrl,
  durationMs,
  onPlaybackEvent,
  onNext,
  onPrevious,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(durationMs / 1000)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleLoadedMetadata = () => setDuration(audio.duration)
    const handleEnded = () => {
      setIsPlaying(false)
      onPlaybackEvent?.({ trackId, position: audio.duration, duration: audio.duration, action: 'complete' })
      onNext?.()
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [trackId, onPlaybackEvent, onNext])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
      onPlaybackEvent?.({ trackId, position: audio.currentTime, duration: audio.duration, action: 'pause' })
    } else {
      audio.play()
      onPlaybackEvent?.({ trackId, position: audio.currentTime, duration: audio.duration, action: 'play' })
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying, trackId, onPlaybackEvent])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    const time = Number(e.target.value)
    audio.currentTime = time
    setCurrentTime(time)
    onPlaybackEvent?.({ trackId, position: time, duration: audio.duration, action: 'seek' })
  }, [trackId, onPlaybackEvent])

  const toggleMute = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.muted = !isMuted
    setIsMuted(!isMuted)
  }, [isMuted])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return
    const vol = Number(e.target.value)
    audio.volume = vol
    setVolume(vol)
    setIsMuted(vol === 0)
  }, [])

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const _progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <audio ref={audioRef} src={streamUrl} preload="metadata" />

      {/* Cover Art */}
      {coverUrl ? (
        <Image
          src={coverUrl}
          alt={title}
          width={56}
          height={56}
          className="h-14 w-14 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted">
          <Play className="h-6 w-6 text-muted-foreground" />
        </div>
      )}

      {/* Track Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{artistName}</p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPrevious}
          disabled={!onPrevious}
          className="rounded-full p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label="Previous"
        >
          <SkipBack className="h-4 w-4" />
        </button>

        <button
          onClick={togglePlay}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>

        <button
          onClick={onNext}
          disabled={!onNext}
          className="rounded-full p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
          aria-label="Next"
        >
          <SkipForward className="h-4 w-4" />
        </button>
      </div>

      {/* Progress */}
      <div className="hidden w-64 flex-col gap-1 md:flex">
        <input
          type="range"
          min={0}
          max={duration || 1}
          value={currentTime}
          onChange={handleSeek}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume */}
      <div className="hidden items-center gap-1 lg:flex">
        <button onClick={toggleMute} className="p-1 text-muted-foreground hover:text-foreground" aria-label={isMuted ? 'Unmute' : 'Mute'}>
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        />
      </div>
    </div>
  )
}
