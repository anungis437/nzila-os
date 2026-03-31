'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@nzila/ui'
import { createPodcast } from '@/lib/actions/podcast-actions'

const CATEGORIES = [
  'Arts & Culture',
  'Business',
  'Comedy',
  'Education',
  'Health & Wellness',
  'History',
  'Music',
  'News & Politics',
  'Science & Technology',
  'Society',
  'Sports',
  'Storytelling',
  'True Crime',
]

const LANGUAGES = [
  { label: 'English', value: 'en' },
  { label: 'French', value: 'fr' },
  { label: 'Swahili', value: 'sw' },
  { label: 'Arabic', value: 'ar' },
  { label: 'Portuguese', value: 'pt' },
  { label: 'Lingala', value: 'ln' },
  { label: 'Yoruba', value: 'yo' },
  { label: 'Hausa', value: 'ha' },
  { label: 'Amharic', value: 'am' },
  { label: 'Zulu', value: 'zu' },
]

export default function NewPodcastPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    const title = (fd.get('title') as string)?.trim()
    if (!title) {
      setError('Title is required')
      return
    }

    startTransition(async () => {
      const result = await createPodcast({
        title,
        description: (fd.get('description') as string)?.trim() || undefined,
        coverUrl: (fd.get('coverUrl') as string)?.trim() || undefined,
        language: (fd.get('language') as string) || 'en',
        category: (fd.get('category') as string) || undefined,
        explicit: fd.get('explicit') === 'on',
      })

      if (result.success && result.podcastId) {
        router.push(`podcasts/${result.podcastId}`)
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
        <h1 className="text-2xl font-bold text-foreground">New Podcast</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Set up your podcast show. You can add episodes after creating it.
        </p>
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
              Podcast Title *
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              maxLength={255}
              placeholder="e.g. The Afrobeats Radio Hour"
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
              maxLength={2000}
              placeholder="What is your podcast about?"
              className={inputCls}
            />
          </div>

          {/* Cover URL */}
          <div>
            <label htmlFor="coverUrl" className="mb-1.5 block text-sm font-medium text-foreground">
              Cover Image URL
            </label>
            <input
              id="coverUrl"
              name="coverUrl"
              type="url"
              placeholder="https://..."
              className={inputCls}
            />
            <p className="mt-1 text-xs text-muted-foreground">Square image recommended (1400×1400 px)</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Language */}
            <div>
              <label htmlFor="language" className="mb-1.5 block text-sm font-medium text-foreground">
                Language
              </label>
              <select id="language" name="language" className={inputCls} defaultValue="en">
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-foreground">
                Category
              </label>
              <select id="category" name="category" className={inputCls} defaultValue="">
                <option value="">Select category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
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
              {isPending ? 'Creating…' : 'Create Podcast'}
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
