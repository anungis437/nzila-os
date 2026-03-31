'use client'

import { useState, useTransition } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@nzila/ui'
import { createEpisode } from '@/lib/actions/podcast-actions'

export default function NewEpisodePage() {
  const router = useRouter()
  const params = useParams()
  const podcastId = params.id as string
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    const title = (fd.get('title') as string)?.trim()
    if (!title) {
      setError('Episode title is required')
      return
    }

    const durationMin = parseInt(fd.get('durationMin') as string, 10)
    const durationSec = parseInt(fd.get('durationSec') as string, 10)
    const totalSecs =
      (Number.isFinite(durationMin) ? durationMin * 60 : 0) +
      (Number.isFinite(durationSec) ? durationSec : 0)

    startTransition(async () => {
      const result = await createEpisode(podcastId, {
        title,
        description: (fd.get('description') as string)?.trim() || undefined,
        audioUrl: (fd.get('audioUrl') as string)?.trim() || undefined,
        durationSecs: totalSecs > 0 ? totalSecs : undefined,
        episodeNumber: parseInt(fd.get('episodeNumber') as string, 10) || undefined,
        seasonNumber: parseInt(fd.get('seasonNumber') as string, 10) || 1,
        explicit: fd.get('explicit') === 'on',
      })

      if (result.success) {
        router.push(`../${podcastId}`)
      } else {
        setError(result.error ?? 'Something went wrong')
      }
    })
  }

  const inputCls =
    'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-purple-500/40'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">New Episode</h1>
        <p className="text-sm text-muted-foreground mt-1">Add a new episode to your podcast.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="title" className="mb-1.5 block text-sm font-medium text-foreground">
              Episode Title *
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              maxLength={255}
              placeholder="e.g. The Rise of Amapiano"
              className={inputCls}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-foreground">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              maxLength={5000}
              placeholder="Show notes, guest info, topics covered..."
              className={inputCls}
            />
          </div>

          {/* Audio URL */}
          <div>
            <label htmlFor="audioUrl" className="mb-1.5 block text-sm font-medium text-foreground">
              Audio File URL
            </label>
            <input
              id="audioUrl"
              name="audioUrl"
              type="url"
              placeholder="https://storage.example.com/episode.mp3"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Season */}
            <div>
              <label htmlFor="seasonNumber" className="mb-1.5 block text-sm font-medium text-foreground">
                Season
              </label>
              <input
                id="seasonNumber"
                name="seasonNumber"
                type="number"
                min={1}
                defaultValue={1}
                className={inputCls}
              />
            </div>

            {/* Episode # */}
            <div>
              <label htmlFor="episodeNumber" className="mb-1.5 block text-sm font-medium text-foreground">
                Episode #
              </label>
              <input
                id="episodeNumber"
                name="episodeNumber"
                type="number"
                min={1}
                placeholder="1"
                className={inputCls}
              />
            </div>

            {/* Duration */}
            <div>
              <label htmlFor="durationMin" className="mb-1.5 block text-sm font-medium text-foreground">
                Duration (min)
              </label>
              <input
                id="durationMin"
                name="durationMin"
                type="number"
                min={0}
                placeholder="45"
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="durationSec" className="mb-1.5 block text-sm font-medium text-foreground">
                Seconds
              </label>
              <input
                id="durationSec"
                name="durationSec"
                type="number"
                min={0}
                max={59}
                placeholder="0"
                className={inputCls}
              />
            </div>
          </div>

          {/* Explicit */}
          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input type="checkbox" name="explicit" className="rounded border-border" />
            Contains explicit content
          </label>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-purple-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-purple-700 transition disabled:opacity-50"
            >
              {isPending ? 'Adding…' : 'Add Episode'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
