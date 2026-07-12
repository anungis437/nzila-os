'use client'

/**
 * Platform Admin — SAGE register-evidence-source form (client component)
 *
 * Collects ONLY sourceType + optional personal/sensitive-information flags.
 * orgId/actorId/workspaceId/createdBy/authorizationLevel are derived or set
 * server-side. The active org is sent as the `x-org-id` header (re-validated by
 * the server) — never as a body field. Classification is a separate later step.
 */
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface CreateSourceFormProps {
  orgId: string
  workspaceId: string
  sourceTypes: readonly string[]
}

function humanize(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function CreateSourceForm({ orgId, workspaceId, sourceTypes }: CreateSourceFormProps) {
  const t = useTranslations('sageEvidence')
  const router = useRouter()
  const [sourceType, setSourceType] = useState(sourceTypes[0] ?? '')
  const [personal, setPersonal] = useState(false)
  const [sensitive, setSensitive] = useState(false)
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
    if (!sourceType) {
      showError(t('validation.sourceTypeRequired'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(
        `/api/sage/workspaces/${workspaceId}/evidence-sources`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID(),
            'x-org-id': orgId,
          },
          body: JSON.stringify({
            sourceType,
            containsPersonalInformation: personal,
            containsSensitiveInformation: sensitive,
          }),
        },
      )
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: { message?: string }
      }
      if (!res.ok || !json.ok) {
        showError(json.error?.message ?? t('error.registerFailed'))
        return
      }
      setPersonal(false)
      setSensitive(false)
      router.refresh()
    } catch {
      showError(t('error.registerFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} aria-labelledby="sage-register-source-title" className="space-y-3">
      <h3 id="sage-register-source-title" className="text-sm font-semibold text-gray-900">
        {t('registerSource')}
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
        <label htmlFor="sage-source-type" className="text-xs font-medium text-gray-600">
          {t('sourceType')}
        </label>
        <select
          id="sage-source-type"
          name="sourceType"
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        >
          {sourceTypes.map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="sage-source-personal"
          name="containsPersonalInformation"
          type="checkbox"
          checked={personal}
          onChange={(e) => setPersonal(e.target.checked)}
          className="h-4 w-4"
        />
        <label htmlFor="sage-source-personal" className="text-xs text-gray-700">
          {t('containsPersonalInformation')}
        </label>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="sage-source-sensitive"
          name="containsSensitiveInformation"
          type="checkbox"
          checked={sensitive}
          onChange={(e) => setSensitive(e.target.checked)}
          className="h-4 w-4"
        />
        <label htmlFor="sage-source-sensitive" className="text-xs text-gray-700">
          {t('containsSensitiveInformation')}
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? t('submitting') : t('registerSource')}
      </button>
    </form>
  )
}
