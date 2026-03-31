/**
 * Comment Form — Client component for posting comments on assets.
 */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { postComment } from '@/lib/actions/social-actions'

export function CommentForm({ assetId }: { assetId: string }) {
  const [content, setContent] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!content.trim()) return
        startTransition(async () => {
          await postComment({ assetId, content: content.trim() })
          setContent('')
          router.refresh()
        })
      }}
      className="flex gap-2"
    >
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add a comment…"
        className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric/20"
      />
      <button
        type="submit"
        disabled={pending || !content.trim()}
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
      >
        {pending ? '…' : 'Post'}
      </button>
    </form>
  )
}
