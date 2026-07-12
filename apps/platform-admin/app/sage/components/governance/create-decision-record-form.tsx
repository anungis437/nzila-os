'use client'

/**
 * Platform Admin — SAGE create-decision-record form (client component)
 *
 * Captures a NAMED-HUMAN decision: a decision statement, rationale, an explicit
 * uncertainty/limitations statement, and references to accessible reviewed
 * evidence and related boundary flags. The reviewer identity is derived
 * server-side (shown read-only). The UI only structures human-entered text — it
 * never manufactures a recommendation or conclusion.
 */
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

export interface DecisionReferenceOption {
  id: string
  label: string
}

interface CreateDecisionRecordFormProps {
  orgId: string
  workspaceId: string
  reviewerId: string
  evidenceOptions: DecisionReferenceOption[]
  boundaryFlagOptions: DecisionReferenceOption[]
}

export function CreateDecisionRecordForm({
  orgId,
  workspaceId,
  reviewerId,
  evidenceOptions,
  boundaryFlagOptions,
}: CreateDecisionRecordFormProps) {
  const t = useTranslations('sageGovernance')
  const router = useRouter()
  const [decision, setDecision] = useState('')
  const [rationale, setRationale] = useState('')
  const [uncertainty, setUncertainty] = useState('')
  const [evidence, setEvidence] = useState<string[]>([])
  const [flags, setFlags] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  function showError(message: string) {
    setError(message)
    requestAnimationFrame(() => errorRef.current?.focus())
  }

  function toggle(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!decision.trim()) {
      showError(t('validation.decisionRequired'))
      return
    }
    if (!uncertainty.trim()) {
      showError(t('validation.uncertaintyRequired'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/sage/workspaces/${workspaceId}/decisions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          'x-org-id': orgId,
        },
        body: JSON.stringify({
          decision: decision.trim(),
          rationale: rationale.trim() || undefined,
          uncertainty: uncertainty.trim(),
          referencedEvidenceItemIds: evidence,
          referencedBoundaryFlagIds: flags,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: { message?: string }
      }
      if (!res.ok || !json.ok) {
        showError(json.error?.message ?? t('error.decisionFailed'))
        return
      }
      setDecision('')
      setRationale('')
      setUncertainty('')
      setEvidence([])
      setFlags([])
      router.refresh()
    } catch {
      showError(t('error.decisionFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} aria-labelledby="sage-decision-title" className="space-y-3">
      <h3 id="sage-decision-title" className="text-sm font-semibold text-gray-900">
        {t('createDecision')}
      </h3>
      <p className="text-xs text-gray-500">{t('humanDecisionHint')}</p>

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
        <p className="mt-1 text-sm text-gray-800" data-testid="decision-reviewer">
          {reviewerId}
        </p>
      </div>

      <div>
        <label htmlFor="sage-decision-statement" className="text-xs font-medium text-gray-600">
          {t('decisionStatement')}
        </label>
        <textarea
          id="sage-decision-statement"
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="sage-decision-rationale" className="text-xs font-medium text-gray-600">
          {t('rationale')}
        </label>
        <textarea
          id="sage-decision-rationale"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="sage-decision-uncertainty" className="text-xs font-medium text-gray-600">
          {t('uncertainty')}
        </label>
        <textarea
          id="sage-decision-uncertainty"
          value={uncertainty}
          onChange={(e) => setUncertainty(e.target.value)}
          rows={2}
          aria-describedby="sage-decision-uncertainty-help"
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <p id="sage-decision-uncertainty-help" className="mt-1 text-xs text-gray-400">
          {t('uncertaintyHelp')}
        </p>
      </div>

      {evidenceOptions.length > 0 && (
        <fieldset>
          <legend className="text-xs font-medium text-gray-600">{t('reviewedEvidence')}</legend>
          <div className="mt-1 space-y-1">
            {evidenceOptions.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={evidence.includes(o.id)}
                  onChange={() => setEvidence((prev) => toggle(prev, o.id))}
                  className="h-4 w-4"
                />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {boundaryFlagOptions.length > 0 && (
        <fieldset>
          <legend className="text-xs font-medium text-gray-600">{t('relatedFlags')}</legend>
          <div className="mt-1 space-y-1">
            {boundaryFlagOptions.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={flags.includes(o.id)}
                  onChange={() => setFlags((prev) => toggle(prev, o.id))}
                  className="h-4 w-4"
                />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? t('submitting') : t('createDecision')}
      </button>
    </form>
  )
}
