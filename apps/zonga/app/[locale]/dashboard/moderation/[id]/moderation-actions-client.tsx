/**
 * Moderation case action buttons (Client Component).
 *
 * Resolve, dismiss, or escalate moderation cases with notes.
 */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  resolveModerationCase,
  assignModerationCase,
} from '@/lib/actions/moderation-actions'

export function ModerationActions({
  caseId,
  currentStatus,
}: {
  caseId: string
  currentStatus: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleAction(status: string) {
    setError(null)
    startTransition(async () => {
      const result = await resolveModerationCase(caseId, { status, notes })
      if (!result.success) {
        setError('Action failed. Please try again.')
      } else {
        router.refresh()
      }
    })
  }

  function handleAssign() {
    setError(null)
    startTransition(async () => {
      // Self-assign — uses current userId from server context
      const result = await assignModerationCase(caseId, 'self')
      if (!result.success) {
        setError('Assignment failed.')
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-3">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add resolution notes…"
        rows={3}
        className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:ring-2 focus:ring-electric focus:border-transparent resize-none"
      />

      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{error}</p>
      )}

      <div className="space-y-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleAction('resolved')}
          className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition disabled:opacity-50"
        >
          {isPending ? 'Processing…' : '✓ Resolve Case'}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleAction('dismissed')}
          className="w-full rounded-lg bg-muted px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/80 transition disabled:opacity-50"
        >
          Dismiss
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleAction('escalated')}
          className="w-full rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition disabled:opacity-50"
        >
          🔺 Escalate
        </button>
        {currentStatus === 'open' && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleAssign}
            className="w-full rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50 transition disabled:opacity-50"
          >
            Assign to Me
          </button>
        )}
      </div>
    </div>
  )
}
