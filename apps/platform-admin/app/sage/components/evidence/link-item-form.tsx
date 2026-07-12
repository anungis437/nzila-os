'use client'

/**
 * Platform Admin — SAGE link-evidence-item control (client component)
 *
 * A single, accessible action that transitions an evidence item to the linked
 * lifecycle state. The item is identified by the route path; no user-supplied
 * body identity is sent. The server enforces EVIDENCE_LINK authority and the
 * classified-source / authorized-only invariants.
 */
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface LinkItemFormProps {
  orgId: string
  workspaceId: string
  itemId: string
}

export function LinkItemForm({ orgId, workspaceId, itemId }: LinkItemFormProps) {
  const t = useTranslations('sageEvidence')
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLSpanElement>(null)

  function showError(message: string) {
    setError(message)
    requestAnimationFrame(() => errorRef.current?.focus())
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/sage/workspaces/${workspaceId}/evidence-items/${itemId}/link`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID(),
            'x-org-id': orgId,
          },
          body: JSON.stringify({}),
        },
      )
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: { message?: string }
      }
      if (!res.ok || !json.ok) {
        showError(json.error?.message ?? t('error.linkFailed'))
        return
      }
      router.refresh()
    } catch {
      showError(t('error.linkFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="inline-flex items-center gap-2">
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {submitting ? t('submitting') : t('link')}
      </button>
      {error && (
        <span
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          className="text-xs text-red-700"
        >
          {error}
        </span>
      )}
    </form>
  )
}
