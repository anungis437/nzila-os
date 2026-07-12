'use client'

/**
 * Platform Admin — SAGE classify-evidence-source form (client component)
 *
 * Classifies an already-registered source: source quality + authorization
 * level. sourceId/workspaceId/orgId are passed as props (route-derived) and
 * sent via the URL path + `x-org-id` header — never as free body identity.
 */
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface ClassifySourceFormProps {
  orgId: string
  workspaceId: string
  sourceId: string
  sourceQualities: readonly string[]
  authorizationLevels: readonly string[]
}

function humanize(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function ClassifySourceForm({
  orgId,
  workspaceId,
  sourceId,
  sourceQualities,
  authorizationLevels,
}: ClassifySourceFormProps) {
  const t = useTranslations('sageEvidence')
  const router = useRouter()
  const [sourceQuality, setSourceQuality] = useState(sourceQualities[0] ?? '')
  const [authorizationLevel, setAuthorizationLevel] = useState(authorizationLevels[0] ?? '')
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
      const res = await fetch(
        `/api/sage/workspaces/${workspaceId}/evidence-sources/${sourceId}/classify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID(),
            'x-org-id': orgId,
          },
          body: JSON.stringify({ sourceQuality, authorizationLevel }),
        },
      )
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: { message?: string }
      }
      if (!res.ok || !json.ok) {
        showError(json.error?.message ?? t('error.classifyFailed'))
        return
      }
      router.refresh()
    } catch {
      showError(t('error.classifyFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 flex flex-wrap items-end gap-2">
      {error && (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          className="w-full rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700"
        >
          {error}
        </div>
      )}
      <div>
        <label htmlFor={`sage-quality-${sourceId}`} className="block text-xs font-medium text-gray-600">
          {t('sourceQuality')}
        </label>
        <select
          id={`sage-quality-${sourceId}`}
          value={sourceQuality}
          onChange={(e) => setSourceQuality(e.target.value)}
          className="mt-1 rounded border border-gray-300 px-2 py-1 text-xs"
        >
          {sourceQualities.map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`sage-auth-${sourceId}`} className="block text-xs font-medium text-gray-600">
          {t('authorizationLevel')}
        </label>
        <select
          id={`sage-auth-${sourceId}`}
          value={authorizationLevel}
          onChange={(e) => setAuthorizationLevel(e.target.value)}
          className="mt-1 rounded border border-gray-300 px-2 py-1 text-xs"
        >
          {authorizationLevels.map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-900 disabled:opacity-50"
      >
        {submitting ? t('submitting') : t('classify')}
      </button>
    </form>
  )
}
