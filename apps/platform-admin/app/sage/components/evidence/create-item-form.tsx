'use client'

/**
 * Platform Admin — SAGE create-evidence-item form (client component)
 *
 * Creates an evidence item under a *classified* source. Only a classified
 * source is offered in the picker (the server also enforces this invariant).
 * orgId/actorId/workspaceId/createdBy are server-derived.
 */
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { SageEvidenceSourceResponse } from '@/lib/sage/evidence-schemas'

interface CreateItemFormProps {
  orgId: string
  workspaceId: string
  classifiedSources: SageEvidenceSourceResponse[]
  confidenceLevels: readonly string[]
}

function humanize(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function CreateItemForm({
  orgId,
  workspaceId,
  classifiedSources,
  confidenceLevels,
}: CreateItemFormProps) {
  const t = useTranslations('sageEvidence')
  const router = useRouter()
  const [sourceId, setSourceId] = useState(classifiedSources[0]?.id ?? '')
  const [confidenceLevel, setConfidenceLevel] = useState(confidenceLevels[0] ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  function showError(message: string) {
    setError(message)
    requestAnimationFrame(() => errorRef.current?.focus())
  }

  if (classifiedSources.length === 0) {
    return <p className="text-sm text-gray-400">{t('needClassifiedSource')}</p>
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!sourceId) {
      showError(t('validation.sourceRequired'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/sage/workspaces/${workspaceId}/evidence-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          'x-org-id': orgId,
        },
        body: JSON.stringify({ sourceId, confidenceLevel }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: { message?: string }
      }
      if (!res.ok || !json.ok) {
        showError(json.error?.message ?? t('error.createItemFailed'))
        return
      }
      router.refresh()
    } catch {
      showError(t('error.createItemFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} aria-labelledby="sage-create-item-title" className="space-y-3">
      <h3 id="sage-create-item-title" className="text-sm font-semibold text-gray-900">
        {t('createItem')}
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
        <label htmlFor="sage-item-source" className="text-xs font-medium text-gray-600">
          {t('evidenceSource')}
        </label>
        <select
          id="sage-item-source"
          name="sourceId"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        >
          {classifiedSources.map((source) => (
            <option key={source.id} value={source.id}>
              {humanize(source.sourceType)} · {humanize(source.authorizationLevel)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="sage-item-confidence" className="text-xs font-medium text-gray-600">
          {t('confidenceLevel')}
        </label>
        <select
          id="sage-item-confidence"
          name="confidenceLevel"
          value={confidenceLevel}
          onChange={(e) => setConfidenceLevel(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        >
          {confidenceLevels.map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? t('submitting') : t('createItem')}
      </button>
    </form>
  )
}
