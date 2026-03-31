'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Check, Upload, X } from 'lucide-react'

/**
 * Pre-selected avatar options — African / music-themed illustration set.
 * These are emoji-based placeholders rendered as styled circles.
 * In production, replace with hosted illustration URLs.
 */
const PRESET_AVATARS = [
  { id: 'djembe', emoji: '🥁', label: 'Djembe Drummer' },
  { id: 'guitar', emoji: '🎸', label: 'Guitar Player' },
  { id: 'mic', emoji: '🎤', label: 'Vocalist' },
  { id: 'headphones', emoji: '🎧', label: 'Listener' },
  { id: 'vinyl', emoji: '💿', label: 'Vinyl Collector' },
  { id: 'notes', emoji: '🎵', label: 'Music Lover' },
  { id: 'saxophone', emoji: '🎷', label: 'Saxophonist' },
  { id: 'piano', emoji: '🎹', label: 'Pianist' },
  { id: 'trumpet', emoji: '🪘', label: 'Percussionist' },
  { id: 'globe', emoji: '🌍', label: 'Global Listener' },
  { id: 'fire', emoji: '🔥', label: 'Hot Tracks' },
  { id: 'star', emoji: '⭐', label: 'Star Fan' },
] as const

interface AvatarSelectorProps {
  currentAvatarUrl?: string | null
  onSelect: (avatarUrl: string) => void
}

export function AvatarSelector({ currentAvatarUrl, onSelect }: AvatarSelectorProps) {
  const [showSelector, setShowSelector] = useState(false)
  const [customUrl, setCustomUrl] = useState('')

  const isPreset = currentAvatarUrl?.startsWith('emoji:')
  const presetId = isPreset ? currentAvatarUrl?.replace('emoji:', '') : null
  const selectedPreset = PRESET_AVATARS.find((a) => a.id === presetId)

  return (
    <div className="space-y-4">
      {/* Current Avatar Display */}
      <div className="flex items-center gap-4">
        <div className="relative group">
          {selectedPreset ? (
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-3xl border-2 border-emerald-500/30">
              {selectedPreset.emoji}
            </div>
          ) : currentAvatarUrl ? (
            <Image
              src={currentAvatarUrl}
              alt="Profile avatar"
              width={80}
              height={80}
              className="w-20 h-20 rounded-full object-cover border-2 border-emerald-500/30"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center border-2 border-dashed border-gray-600">
              <span className="text-2xl text-gray-500">?</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowSelector(!showSelector)}
            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-400 transition-colors"
          >
            <Upload size={14} />
          </button>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {selectedPreset ? selectedPreset.label : currentAvatarUrl ? 'Custom Avatar' : 'No avatar set'}
          </p>
          <button
            type="button"
            onClick={() => setShowSelector(!showSelector)}
            className="text-xs text-emerald-500 hover:text-emerald-400 mt-0.5"
          >
            {showSelector ? 'Close selector' : 'Change avatar'}
          </button>
        </div>
      </div>

      {/* Avatar Selector Panel */}
      {showSelector && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Choose an Avatar</h3>
            <button
              type="button"
              onClick={() => setShowSelector(false)}
              className="text-gray-400 hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>

          {/* Preset Grid */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Pre-selected avatars</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {PRESET_AVATARS.map((avatar) => {
                const isSelected = presetId === avatar.id
                return (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => {
                      onSelect(`emoji:${avatar.id}`)
                      setShowSelector(false)
                    }}
                    className={`relative flex flex-col items-center gap-1 p-2 rounded-xl transition-all hover:bg-white/5 ${
                      isSelected ? 'bg-emerald-500/10 ring-2 ring-emerald-500' : ''
                    }`}
                    title={avatar.label}
                  >
                    <span className="text-2xl">{avatar.emoji}</span>
                    <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                      {avatar.label}
                    </span>
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                        <Check size={10} className="text-white" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Custom URL */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Or paste an image URL</p>
            <div className="flex gap-2">
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <button
                type="button"
                disabled={!customUrl}
                onClick={() => {
                  if (customUrl) {
                    onSelect(customUrl)
                    setCustomUrl('')
                    setShowSelector(false)
                  }
                }}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Use
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Render an avatar given a URL that may be a preset emoji reference or a real image URL.
 */
export function ProfileAvatar({
  avatarUrl,
  size = 40,
  className = '',
}: {
  avatarUrl?: string | null
  size?: number
  className?: string
}) {
  if (avatarUrl?.startsWith('emoji:')) {
    const presetId = avatarUrl.replace('emoji:', '')
    const preset = PRESET_AVATARS.find((a) => a.id === presetId)
    if (preset) {
      return (
        <div
          className={`rounded-full bg-white/10 flex items-center justify-center ${className}`}
          style={{ width: size, height: size, fontSize: size * 0.5 }}
        >
          {preset.emoji}
        </div>
      )
    }
  }

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt="Avatar"
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
      />
    )
  }

  return (
    <div
      className={`rounded-full bg-white/10 flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <span className="text-gray-500" style={{ fontSize: size * 0.4 }}>?</span>
    </div>
  )
}
