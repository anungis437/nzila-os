/**
 * Zonga — Search & Discovery page.
 *
 * Global search across assets, creators, events, and playlists.
 * Client component for real-time search.
 */
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Card } from '@nzila/ui'
import { globalSearch, type SearchResults, type SearchResult } from '@/lib/actions/search-actions'
import { PlayButton, toPlayerTrack } from '@/components/player'

const typeConfig: Record<string, { icon: string; color: string; basePath: string }> = {
  asset: { icon: '🎵', color: 'bg-electric/10 text-electric', basePath: 'catalog' },
  creator: { icon: '🎤', color: 'bg-amber-100 text-amber-700', basePath: 'creators' },
  event: { icon: '🎪', color: 'bg-purple-100 text-purple-700', basePath: 'events' },
  playlist: { icon: '📋', color: 'bg-emerald-100 text-emerald-700', basePath: 'playlists' },
}

function ResultCard({ result, locale }: { result: SearchResult; locale: string }) {
  const config = typeConfig[result.type] ?? typeConfig.asset

  return (
    <Link href={`/${locale}/dashboard/${config.basePath}/${result.id}`}>
      <Card>
        <div className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors rounded-lg">
          {result.type === 'asset' ? (
            <PlayButton
              track={toPlayerTrack({
                id: result.id,
                title: result.title ?? 'Untitled',
                creatorName: result.subtitle,
              })}
              variant="icon"
            />
          ) : (
            <span className="text-2xl">{config.icon}</span>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-navy truncate">{result.title ?? 'Untitled'}</p>
            {result.subtitle && (
              <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {result.genre && (
              <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs text-navy">
                {result.genre.replace(/_/g, ' ')}
              </span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}>
              {result.type}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  )
}

export default function SearchPage() {
  const params = useParams()
  const locale = (params?.locale as string) ?? 'en'
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSearch(value: string) {
    setQuery(value)
    if (value.trim().length < 2) {
      setResults(null)
      return
    }
    startTransition(async () => {
      const res = await globalSearch(value)
      setResults(res)
    })
  }

  const sections: Array<{ key: keyof Omit<SearchResults, 'total'>; label: string }> = [
    { key: 'assets', label: 'Tracks & Content' },
    { key: 'creators', label: 'Creators' },
    { key: 'events', label: 'Events' },
    { key: 'playlists', label: 'Playlists' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Search & Discovery</h1>
        <p className="mt-1 text-sm text-gray-500">
          Search tracks, creators, events, and playlists across the platform.
        </p>
      </div>

      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name, genre, city, or keyword…"
          className="w-full rounded-xl border border-gray-200 bg-white px-5 py-3 pl-12 text-sm text-navy shadow-sm placeholder:text-gray-400 focus:border-electric focus:outline-none focus:ring-2 focus:ring-electric/20"
        />
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          🔍
        </span>
        {pending && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            Searching…
          </span>
        )}
      </div>

      {/* Results */}
      {results && results.total > 0 && (
        <div className="space-y-6">
          <p className="text-xs text-gray-500">
            {results.total} result{results.total !== 1 ? 's' : ''} found
          </p>

          {sections.map(({ key, label }) => {
            const items = results[key]
            if (!items || items.length === 0) return null
            return (
              <div key={key}>
                <h2 className="mb-2 text-sm font-semibold text-navy">{label}</h2>
                <div className="space-y-1">
                  {items.map((r) => (
                    <ResultCard key={r.id} result={r} locale={locale} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* No results */}
      {results && results.total === 0 && query.trim().length >= 2 && (
        <Card>
          <div className="p-12 text-center">
            <p className="text-4xl">🔍</p>
            <p className="mt-3 text-sm font-medium text-navy">No results found</p>
            <p className="mt-1 text-xs text-gray-500">
              Try a different search term or browse by category.
            </p>
          </div>
        </Card>
      )}

      {/* Initial state */}
      {!results && (
        <Card>
          <div className="p-12 text-center">
            <p className="text-4xl">🌍</p>
            <p className="mt-3 text-sm font-medium text-navy">
              Discover African music & culture
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Search for afrobeats, rumba, highlife, amapiano, and more.
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
