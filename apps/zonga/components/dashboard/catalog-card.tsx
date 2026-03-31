/**
 * Zonga — Catalog Asset Card (Client Component)
 *
 * Renders a single catalog asset card with an inline play button
 * that integrates with the global player context.
 */
'use client'

import Link from 'next/link'
import { Card } from '@nzila/ui'
import { PlayButton, toPlayerTrack } from '@/components/player'

interface CatalogCardAsset {
  id: string
  title: string | null
  type?: string | null
  status?: string | null
  genre?: string | null
  language?: string | null
  durationSeconds?: number | null
  collaborators?: readonly string[] | null
  metadata?: Record<string, unknown> | null
}

export function CatalogCard({ asset, basePath }: { asset: CatalogCardAsset; basePath: string }) {
  const pt = toPlayerTrack({
    id: asset.id,
    title: asset.title ?? 'Untitled',
    creatorName: asset.metadata?.creatorName as string | undefined,
    durationSeconds: asset.durationSeconds,
  })

  return (
    <div className="group relative">
      <Link href={`${basePath}/${asset.id}`}>
        <Card>
            <div className="p-4 hover:bg-muted transition-colors rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-electric/10 text-2xl">
                {asset.type === 'album' ? '💿' : asset.type === 'video' ? '🎬' : '🎵'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{asset.title ?? 'Untitled'}</p>
                <p className="text-xs text-muted-foreground">
                  {(asset.metadata?.creatorName as string) ?? 'Unknown'}
                  {asset.collaborators?.length ? ` ft. ${asset.collaborators.join(', ')}` : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{asset.genre?.replace(/_/g, ' ') ?? '—'}</span>
                {asset.language && (
                  <span className="inline-flex rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                    {asset.language}
                  </span>
                )}
              </div>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                asset.status === 'published'
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-amber-500/10 text-amber-600'
              }`}>
                {asset.status ?? 'draft'}
              </span>
            </div>
          </div>
        </Card>
      </Link>
      {/* Overlay play button on hover */}
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <PlayButton track={pt} variant="icon" />
      </div>
    </div>
  )
}
