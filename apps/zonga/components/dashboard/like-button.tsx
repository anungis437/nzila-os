/**
 * Like Button — Client component for liking/unliking assets.
 */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { likeAsset, unlikeAsset } from '@/lib/actions/social-actions'

export function LikeButton({
  assetId,
  assetTitle,
  initialCount,
}: {
  assetId: string
  assetTitle?: string
  initialCount: number
}) {
  const [liked, setLiked] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          if (liked) {
            await unlikeAsset(assetId)
            setLiked(false)
            setCount((c) => Math.max(0, c - 1))
          } else {
            await likeAsset(assetId, assetTitle)
            setLiked(true)
            setCount((c) => c + 1)
          }
          router.refresh()
        })
      }
      className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
        liked
          ? 'border-red-300 bg-red-50 text-red-600'
          : 'border-border bg-card text-foreground hover:bg-muted'
      }`}
    >
      {liked ? '❤️' : '🤍'} {count}
    </button>
  )
}
