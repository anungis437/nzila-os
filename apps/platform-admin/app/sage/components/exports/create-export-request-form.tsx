'use client'

/**
 * Platform Admin — SAGE create-export-request form (client component)
 *
 * Requests a controlled export over an explicit evidence/governance scope. Only
 * ACCESSIBLE, non-excluded resources are selectable (the server re-validates).
 * The requester identity is derived server-side (shown read-only). There is NO
 * recipient, destination, or external-delivery control — package generation is
 * internal only.
 */
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

export interface ExportResourceOption {
  id: string
  label: string
  authorizationLevel: string
}

interface CreateExportRequestFormProps {
  orgId: string
  workspaceId: string
  requesterId: string
  packageTypes: readonly string[]
  evidenceItems: ExportResourceOption[]
  boundaryFlags: ExportResourceOption[]
  reviewNotes: ExportResourceOption[]
  decisionRecords: ExportResourceOption[]
}

function humanize(value: string): string {
  return value.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export function CreateExportRequestForm({
  orgId,
  workspaceId,
  requesterId,
  packageTypes,
  evidenceItems,
  boundaryFlags,
  reviewNotes,
  decisionRecords,
}: CreateExportRequestFormProps) {
  const t = useTranslations('sageExports')
  const router = useRouter()
  const [purpose, setPurpose] = useState('')
  const [packageType, setPackageType] = useState(packageTypes[0] ?? 'internal_review_bundle')
  const [evidence, setEvidence] = useState<Set<string>>(new Set())
  const [flags, setFlags] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState<Set<string>>(new Set())
  const [decisions, setDecisions] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setter(next)
  }

  function showError(message: string) {
    setError(message)
    requestAnimationFrame(() => errorRef.current?.focus())
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setStatus(null)
    if (!purpose.trim()) {
      showError(t('validation.purposeRequired'))
      return
    }
    const total = evidence.size + flags.size + notes.size + decisions.size
    if (total === 0) {
      showError(t('validation.selectionRequired'))
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/sage/workspaces/${workspaceId}/export-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          'x-org-id': orgId,
        },
        body: JSON.stringify({
          purpose: purpose.trim(),
          packageType,
          evidenceItemIds: [...evidence],
          boundaryFlagIds: [...flags],
          reviewNoteIds: [...notes],
          decisionRecordIds: [...decisions],
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: { message?: string } }
      if (!res.ok || !json.ok) {
        showError(json.error?.message ?? t('error.requestFailed'))
        return
      }
      setPurpose('')
      setEvidence(new Set())
      setFlags(new Set())
      setNotes(new Set())
      setDecisions(new Set())
      setStatus(t('status.requested'))
      router.refresh()
    } catch {
      showError(t('error.requestFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  function group(title: string, options: ExportResourceOption[], set: Set<string>, setter: (s: Set<string>) => void) {
    if (options.length === 0) return null
    return (
      <fieldset className="rounded border border-gray-200 p-2">
        <legend className="text-xs font-medium text-gray-600">{title}</legend>
        <div className="space-y-1">
          {options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={set.has(o.id)} onChange={() => toggle(set, setter, o.id)} />
              <span>{o.label}</span>
              <span className="text-xs text-gray-400">[{humanize(o.authorizationLevel)}]</span>
            </label>
          ))}
        </div>
      </fieldset>
    )
  }

  return (
    <form onSubmit={submit} aria-labelledby="sage-export-request-title" className="space-y-3">
      <h3 id="sage-export-request-title" className="text-sm font-semibold text-gray-900">
        {t('requestExport')}
      </h3>

      {error && (
        <div ref={errorRef} tabIndex={-1} role="alert" aria-live="assertive" className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}
      {status && (
        <div role="status" aria-live="polite" className="rounded-md border border-green-200 bg-green-50 p-2 text-xs text-green-700">
          {status}
        </div>
      )}

      <div>
        <span className="text-xs font-medium text-gray-600">{t('requestedBy')}</span>
        {/* Requester identity is server-derived and not editable. */}
        <p className="mt-1 text-sm text-gray-800" data-testid="export-requester">{requesterId}</p>
      </div>

      <div>
        <label htmlFor="sage-export-purpose" className="text-xs font-medium text-gray-600">
          {t('purpose')}
        </label>
        <textarea
          id="sage-export-purpose"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="sage-export-package-type" className="text-xs font-medium text-gray-600">
          {t('packageType')}
        </label>
        <select
          id="sage-export-package-type"
          value={packageType}
          onChange={(e) => setPackageType(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        >
          {packageTypes.map((v) => (
            <option key={v} value={v}>{humanize(v)}</option>
          ))}
        </select>
      </div>

      {group(t('selectedEvidence'), evidenceItems, evidence, setEvidence)}
      {group(t('selectedGovernance'), [...boundaryFlags, ...reviewNotes, ...decisionRecords], new Set([...flags, ...notes, ...decisions]), (s) => {
        // Route each id back to its typed set.
        setFlags(new Set(boundaryFlags.filter((o) => s.has(o.id)).map((o) => o.id)))
        setNotes(new Set(reviewNotes.filter((o) => s.has(o.id)).map((o) => o.id)))
        setDecisions(new Set(decisionRecords.filter((o) => s.has(o.id)).map((o) => o.id)))
      })}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {submitting ? t('submitting') : t('requestExport')}
      </button>
    </form>
  )
}
