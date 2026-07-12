'use client'

/**
 * Platform Admin — SAGE open-boundary-flag form (client component)
 *
 * Opens a boundary flag against the workspace or an ACCESSIBLE evidence target.
 * The target selector only offers targets the actor can see. orgId/actorId are
 * derived server-side; the active org is sent as the `x-org-id` header.
 */
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

export interface GovernanceTargetOption {
  /** Encoded as `${targetType}:${targetId ?? ''}` for a single <select>. */
  value: string
  label: string
}

interface CreateBoundaryFlagFormProps {
  orgId: string
  workspaceId: string
  flagTypes: readonly string[]
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

export function CreateBoundaryFlagForm({
  orgId,
  workspaceId,
  flagTypes,
  targets,
}: CreateBoundaryFlagFormProps) {
  const t = useTranslations('sageGovernance')
  const router = useRouter()
  const [flagType, setFlagType] = useState(flagTypes[0] ?? '')
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
    setSubmitting(true)
    try {
      const res = await fetch(`/api/sage/workspaces/${workspaceId}/boundary-flags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          'x-org-id': orgId,
        },
        body: JSON.stringify({ flagType, ...decodeTarget(target), note: note.trim() || undefined }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: { message?: string }
      }
      if (!res.ok || !json.ok) {
        showError(json.error?.message ?? t('error.flagFailed'))
        return
      }
      setNote('')
      router.refresh()
    } catch {
      showError(t('error.flagFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} aria-labelledby="sage-flag-title" className="space-y-3">
      <h3 id="sage-flag-title" className="text-sm font-semibold text-gray-900">
        {t('openFlag')}
      </h3>

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
        <label htmlFor="sage-flag-type" className="text-xs font-medium text-gray-600">
          {t('flagType')}
        </label>
        <select
          id="sage-flag-type"
          value={flagType}
          onChange={(e) => setFlagType(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        >
          {flagTypes.map((v) => (
            <option key={v} value={v}>
              {humanize(v)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="sage-flag-target" className="text-xs font-medium text-gray-600">
          {t('target')}
        </label>
        <select
          id="sage-flag-target"
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
        <label htmlFor="sage-flag-note" className="text-xs font-medium text-gray-600">
          {t('note')}
        </label>
        <textarea
          id="sage-flag-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? t('submitting') : t('openFlag')}
      </button>
    </form>
  )
}
