/**
 * Tip Button — Client component for tipping creators.
 */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { tipCreator } from '@/lib/actions/social-actions'

const tipAmounts = [
  { value: 1, label: '$1' },
  { value: 5, label: '$5' },
  { value: 10, label: '$10' },
  { value: 25, label: '$25' },
]

export function TipButton({
  creatorId,
  creatorName,
}: {
  creatorId: string
  creatorName: string
}) {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  if (sent) {
    return (
      <span className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-600">
        ✅ Tip sent to {creatorName}
      </span>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
      >
        🎁 Tip {creatorName}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
      {tipAmounts.map((tip) => (
        <button
          key={tip.value}
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await tipCreator({
                creatorId,
                creatorName,
                amount: tip.value,
                currency: 'USD',
                message: `Tip from a fan`,
              })
              setSent(true)
              router.refresh()
            })
          }
          className="rounded-md bg-foreground/10 px-3 py-1 text-xs font-medium text-foreground hover:bg-foreground/20 transition-colors disabled:opacity-50"
        >
          {tip.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="ml-1 text-xs text-muted-foreground hover:text-foreground"
      >
        ✕
      </button>
    </div>
  )
}
