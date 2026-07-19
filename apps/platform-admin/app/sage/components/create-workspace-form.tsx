'use client'

/**
 * Platform Admin — SAGE create-workspace form (client component)
 *
 * Collects ONLY name / institutionType / riskSurface. orgId, actorId,
 * createdBy, and boundaryProfile are derived server-side. The active org is sent
 * as the `x-org-id` header (re-validated by the server against active
 * membership) — never as a body field.
 */
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface CreateWorkspaceFormProps {
  orgId: string
  institutionTypes: readonly string[]
  riskSurfaces: readonly string[]
}

function humanize(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function CreateWorkspaceForm({
  orgId,
  institutionTypes,
  riskSurfaces,
}: CreateWorkspaceFormProps) {
  const t = useTranslations('sage')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [institutionType, setInstitutionType] = useState(institutionTypes[0] ?? '')
  const [riskSurface, setRiskSurface] = useState(riskSurfaces[0] ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  function showError(message: string) {
    setError(message)
    // Move focus to the error summary so assistive tech announces it.
    requestAnimationFrame(() => errorRef.current?.focus())
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (name.trim().length === 0) {
      showError(t('validation.nameRequired'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/sage/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          'x-org-id': orgId,
        },
        body: JSON.stringify({ name: name.trim(), institutionType, riskSurface }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: { message?: string }
      }
      if (!res.ok || !json.ok) {
        showError(json.error?.message ?? t('error.createFailed'))
        return
      }
      setOpen(false)
      setName('')
      router.refresh()
    } catch {
      showError(t('error.createFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        {t('createWorkspace')}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sage-create-title"
        >
          <form
            onSubmit={submit}
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 id="sage-create-title" className="text-lg font-semibold">
              {t('createWorkspace')}
            </h2>

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
              <label htmlFor="sage-ws-name" className="text-xs font-medium text-gray-600">
                {t('workspaceName')}
              </label>
              <input
                id="sage-ws-name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={1}
                maxLength={200}
                aria-describedby="sage-ws-name-help"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <p id="sage-ws-name-help" className="mt-1 text-xs text-gray-400">
                {t('workspaceNameHelp')}
              </p>
            </div>

            <div>
              <label
                htmlFor="sage-ws-institution"
                className="text-xs font-medium text-gray-600"
              >
                {t('institutionType')}
              </label>
              <select
                id="sage-ws-institution"
                name="institutionType"
                value={institutionType}
                onChange={(e) => setInstitutionType(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {institutionTypes.map((value) => (
                  <option key={value} value={value}>
                    {humanize(value)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sage-ws-risk" className="text-xs font-medium text-gray-600">
                {t('riskSurface')}
              </label>
              <select
                id="sage-ws-risk"
                name="riskSurface"
                value={riskSurface}
                onChange={(e) => setRiskSurface(e.target.value)}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                {riskSurfaces.map((value) => (
                  <option key={value} value={value}>
                    {humanize(value)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? t('submitting') : t('submit')}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
