'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@nzila/ui'
import { createPlaylist } from '@/lib/actions/playlist-actions'

const GENRES = [
  { label: 'Afrobeats', value: 'AFROBEATS' },
  { label: 'Amapiano', value: 'AMAPIANO' },
  { label: 'Soukous', value: 'SOUKOUS' },
  { label: 'Highlife', value: 'HIGHLIFE' },
  { label: 'Bongo Flava', value: 'BONGO_FLAVA' },
  { label: 'Gospel', value: 'AFRO_GOSPEL' },
  { label: 'Afro Hip Hop', value: 'AFRO_HIP_HOP' },
  { label: 'Gengetone', value: 'GENGETONE' },
  { label: 'Kizomba', value: 'KIZOMBA' },
  { label: 'Gqom', value: 'GQOM' },
  { label: 'Mixed', value: 'MIXED' },
]

export default function NewPlaylistPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await createPlaylist({
        title: fd.get('title') as string,
        description: fd.get('description') as string || undefined,
        genre: fd.get('genre') as string || undefined,
        visibility: fd.get('visibility') as string || 'public',
      })

      if (!res.success) {
        setError('Failed to create playlist. Please try again.')
        return
      }
      router.push(`../${res.playlistId}`)
    })
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">New Playlist</h1>

      <Card>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Playlist Name</label>
            <input
              name="title"
              required
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
              placeholder="e.g. Afro Chill Vibes"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea
              name="description"
              rows={3}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent resize-none"
              placeholder="What's this playlist about?"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Genre</label>
              <select
                name="genre"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
              >
                <option value="">Any genre</option>
                {GENRES.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Visibility</label>
              <select
                name="visibility"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="bg-electric text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-electric/90 transition disabled:opacity-50"
            >
              {isPending ? 'Creating…' : 'Create Playlist'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2.5 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:bg-muted/50 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
