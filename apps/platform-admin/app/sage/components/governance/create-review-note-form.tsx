'use client'

/**
 * Platform Admin — SAGE create-review-note form (client component)
 *
 * Records an attributed human review note. The reviewer identity is derived
 * server-side (shown read-only here for transparency). A note never approves or
 * decides anything — it is a human observation only.
 */
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { GovernanceTargetOption } from './create-boundary-flag-form'

interface CreateReviewNoteFormProps {
  orgId: string
  workspaceId: string
  reviewerId: string
  noteTypes: readonly string[]
  targets: GovernanceTargetOption[]
}

function humanize(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function decodeTarget(value: string): { targetType: string; targetId?: string } {
  const [targetType, targetId] = value.split(':')
  return targetId ? { targetType, targetId } : { targetType }
}

export function CreateReviewNoteForm({
  orgId,
  workspaceId,
  reviewerId,
  noteTypes,
  targets,
}: CreateReviewNoteFormProps) {
  const t = useTranslations('sageGovernance')
  const router = useRouter()
  const [noteType, setNoteType] = useState(noteTypes[0] ?? '')
  const [target, setTarget] = useState(targets[0]?.value ?? 'workspace:')
  const [note, setNote] = useState('')
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
    if (!note.trim()) {
      showError(t('validation.noteRequired'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/sage/workspaces/${workspaceId}/review-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          'x-org-id': orgId,
        },
        body: JSON.stringify({ noteType, ...decodeTarget(target), note: note.trim() }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: { message?: string }
      }
      if (!res.ok || !json.ok) {
        showError(json.error?.message ?? t('error.noteFailed'))
        return
      }
      setNote('')
      router.refresh()
    } catch {
      showError(t('error.noteFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} aria-labelledby="sage-note-title" className="space-y-3">
      <h3 id="sage-note-title" className="text-sm font-semibold text-gray-900">
        {t('addReviewNote')}
      </h3>
      <p className="text-xs text-gray-500">{t('humanAuthoredHint')}</p>

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

      <div>
        <span className="text-xs font-medium text-gray-600">{t('reviewer')}</span>
        {/* Reviewer identity is server-derived and not editable. */}
        <p className="mt-1 text-sm text-gray-800" data-testid="review-note-reviewer">
          {reviewerId}
        </p>
      </div>

      <div>
        <label htmlFor="sage-note-type" className="text-xs font-medium text-gray-600">
          {t('noteType')}
        </label>
        <select
          id="sage-note-type"
          value={noteType}
          onChange={(e) => setNoteType(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        >
          {noteTypes.map((v) => (
            <option key={v} value={v}>
              {humanize(v)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="sage-note-target" className="text-xs font-medium text-gray-600">
          {t('target')}
        </label>
        <select
          id="sage-note-target"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        >
          {targets.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="sage-note-text" className="text-xs font-medium text-gray-600">
          {t('note')}
        </label>
        <textarea
          id="sage-note-text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          aria-describedby="sage-note-help"
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <p id="sage-note-help" className="mt-1 text-xs text-gray-400">
          {t('noteDoesNotDecide')}
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? t('submitting') : t('addReviewNote')}
      </button>
    </form>
  )
}
