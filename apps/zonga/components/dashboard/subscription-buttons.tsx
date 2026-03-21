/**
 * Subscription Buttons — Client components for checkout & portal actions.
 */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface ButtonProps {
  action: string
  label: string
  creatorId?: string
}

export function UpgradeButton({ action, label, creatorId }: ButtonProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            const res = await fetch('/api/subscriptions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action, creatorId }),
            })
            const data = await res.json()
            if (data.ok && data.data?.url) {
              router.push(data.data.url)
            } else {
              setError(data.error ?? 'Something went wrong')
            }
          })
        }
        className="inline-flex items-center gap-2 rounded-xl bg-electric px-5 py-2.5 text-sm font-semibold text-white hover:bg-electric/90 transition-colors disabled:opacity-50"
      >
        {pending ? '...' : `⚡ ${label}`}
      </button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

export function ManageSubscriptionButton({ action, label, creatorId }: ButtonProps) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            const res = await fetch('/api/subscriptions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action, creatorId }),
            })
            const data = await res.json()
            if (data.ok && data.data?.url) {
              router.push(data.data.url)
            } else {
              setError(data.error ?? 'Something went wrong')
            }
          })
        }
        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-navy hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        {pending ? '...' : `⚙️ ${label}`}
      </button>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
