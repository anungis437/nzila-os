/**
 * Zonga — Creator Catalog (Client Component).
 *
 * Displays a creator's track list with inline play buttons.
 * Used on the creator detail page.
 */
'use client'

import { PlayButton, toPlayerTrack } from '@/components/player'
import { StatusBadge } from '@/components'

interface CatalogAsset {
  id: string
  title: string | null
  type?: string | null
  status?: string | null
  genre?: string | null
  language?: string | null
  duration?: number | null
  creatorName?: string | null
  createdAt?: string | null
  coverArtUrl?: string | null
  streamUrl?: string | null
}

export function CreatorCatalog({ assets }: { assets: CatalogAsset[] }) {
  if (assets.length === 0) return null

  return (
    <div className="divide-y divide-gray-100">
      {assets.map((a, idx) => (
        <div
          key={a.id}
          className="flex items-center justify-between gap-3 py-3 group"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <PlayButton
              track={toPlayerTrack({
                id: a.id,
                title: a.title ?? 'Untitled',
                creatorName: a.creatorName,
                coverArtUrl: a.coverArtUrl,
                durationSeconds: a.duration,
                streamUrl: a.streamUrl,
              })}
              variant="icon"
            />
            <span className="w-5 text-center text-xs font-medium text-gray-400 shrink-0">
              {idx + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-navy truncate">
                {a.title ?? 'Untitled'}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {a.genre && (
                  <span className="rounded-full bg-navy/10 px-1.5 py-0.5 text-[10px] text-navy">
                    {a.genre.replace(/_/g, ' ')}
                  </span>
                )}
                {a.language && (
                  <span className="rounded-full bg-electric/10 px-1.5 py-0.5 text-[10px] text-electric">
                    {a.language}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {a.duration != null && a.duration > 0 && (
              <span className="text-xs text-gray-400 tabular-nums">
                {Math.floor(a.duration / 60)}:{String(Math.round(a.duration % 60)).padStart(2, '0')}
              </span>
            )}
            <StatusBadge status={a.status ?? 'draft'} />
          </div>
        </div>
      ))}
    </div>
  )
}
