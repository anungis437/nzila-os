'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@nzila/ui'
import { createRelease } from '@/lib/actions/release-actions'

const RELEASE_TYPES = [
  { label: 'Single', value: 'single' },
  { label: 'EP', value: 'ep' },
  { label: 'Album', value: 'album' },
  { label: 'Compilation', value: 'compilation' },
]

export default function NewReleasePage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await createRelease({
        title: fd.get('title') as string,
        type: fd.get('type') as 'single' | 'ep' | 'album' | 'compilation',
        creatorName: fd.get('creatorName') as string || undefined,
        trackCount: fd.get('trackCount') ? Number(fd.get('trackCount')) : undefined,
        releaseDate: fd.get('releaseDate') as string || undefined,
      })

      if (!res.success) {
        setError('Failed to create release. Please try again.')
        return
      }
      router.push(`../${res.releaseId}`)
    })
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground mb-6">New Release</h1>

      <Card>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Release Title</label>
            <input
              name="title"
              required
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
              placeholder="e.g. Afro Sessions Vol. 2"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Release Type</label>
              <select
                name="type"
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
              >
                {RELEASE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Track Count</label>
              <input
                name="trackCount"
                type="number"
                min="1"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
                placeholder="e.g. 12"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Artist / Creator</label>
              <input
                name="creatorName"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
                placeholder="Primary artist name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Release Date</label>
              <input
                name="releaseDate"
                type="date"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent"
              />
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
              {isPending ? 'Creating…' : 'Create Release'}
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
