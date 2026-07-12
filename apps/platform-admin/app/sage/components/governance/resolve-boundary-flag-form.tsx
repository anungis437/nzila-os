'use client'

/**
 * Platform Admin — SAGE resolve-boundary-flag form (client component)
 *
 * Resolves or retains a boundary flag. A human resolution note is required. The
 * resolver identity is derived server-side. flagId is route-derived.
 */
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface ResolveBoundaryFlagFormProps {
  orgId: string
  workspaceId: string
  flagId: string
  resolutions: readonly string[]
}

function humanize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function ResolveBoundaryFlagForm({
  orgId,
  workspaceId,
  flagId,
  resolutions,
}: ResolveBoundaryFlagFormProps) {
  const t = useTranslations('sageGovernance')
  const router = useRouter()
  const [resolution, setResolution] = useState(resolutions[0] ?? 'resolved')
  const [resolutionNote, setResolutionNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  function showError(message: string) {
    setError(message)
    requestAnimationFrame(() => errorRef.current?.focus())
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!resolutionNote.trim()) {
      showError(t('validation.resolutionNoteRequired'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/sage/workspaces/${workspaceId}/boundary-flags/${flagId}/resolve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID(),
            'x-org-id': orgId,
          },
          body: JSON.stringify({ resolution, resolutionNote: resolutionNote.trim() }),
        },
      )
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: { message?: string }
      }
      if (!res.ok || !json.ok) {
        showError(json.error?.message ?? t('error.resolveFailed'))
        return
      }
      router.refresh()
    } catch {
      showError(t('error.resolveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-2 border-t border-gray-100 pt-2">
      {error && (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700"
        >
          {error}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label
            htmlFor={`sage-resolve-outcome-${flagId}`}
            className="block text-xs font-medium text-gray-600"
          >
            {t('resolutionOutcome')}
          </label>
          <select
            id={`sage-resolve-outcome-${flagId}`}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            className="mt-1 rounded border border-gray-300 px-2 py-1 text-xs"
          >
            {resolutions.map((v) => (
              <option key={v} value={v}>
                {humanize(v)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label
            htmlFor={`sage-resolve-note-${flagId}`}
            className="block text-xs font-medium text-gray-600"
          >
            {t('resolutionNote')}
          </label>
          <input
            id={`sage-resolve-note-${flagId}`}
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-900 disabled:opacity-50"
        >
          {submitting ? t('submitting') : t('resolveFlag')}
        </button>
      </div>
    </form>
  )
}
