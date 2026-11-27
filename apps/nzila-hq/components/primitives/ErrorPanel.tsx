'use client'

/**
 * Standardized error surface for Nzila HQ route boundaries.
 *
 * - Displays a calm, on-brand panel rather than the raw Next.js error overlay.
 * - Surfaces an "incident ID" derived from the error.digest (or a generated one)
 *   so a user can copy it and paste into a support thread.
 * - Provides a retry action that calls Next.js `reset()`.
 *
 * RBAC errors thrown by `assertCapability` follow the convention
 * `NZILA_HQ_RBAC_DENIED: ...` — we detect that prefix and render a friendlier
 * message.
 */
import { useEffect, useId, useState } from 'react'
import { browserErrorReference, recordBrowserError } from '@nzila/os-core/browser-diagnostics'

interface ErrorPanelProps {
  error: Error & { digest?: string }
  reset: () => void
  scope: string
}

export function ErrorPanel({ error, reset }: ErrorPanelProps) {
  const [copied, setCopied] = useState(false)
  const localReference = useId()
  const diagnosticReference = browserErrorReference(error.digest, localReference)
  const incidentId = diagnosticReference.value
  const isRbac = error.message.startsWith('NZILA_HQ_RBAC_DENIED')

  useEffect(() => {
    recordBrowserError({ app: 'nzila-hq', surface: 'error-panel', code: 'CLIENT_BOUNDARY_ERROR',
      reference: diagnosticReference.value, referenceOrigin: diagnosticReference.origin })
  }, [error, diagnosticReference.value, diagnosticReference.origin])

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(incidentId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable — silently ignore; user can still read the ID.
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-6">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-rose-700">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />
          {isRbac ? 'Access denied' : 'Something went wrong'}
        </div>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
          {isRbac
            ? 'You do not have permission to view this surface.'
            : 'This part of the cockpit failed to load.'}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {isRbac
            ? 'If you believe this is a mistake, contact a founder or president to adjust your role.'
            : 'You can retry, or share this reference with support.'}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {!isRbac && (
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Try again
            </button>
          )}
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {copied ? 'Copied ✓' : 'Copy incident ID'}
          </button>
          <code className="rounded bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700">
            {diagnosticReference.origin === 'local' ? 'Local reference: ' : 'Reference: '}{incidentId}
          </code>
        </div>

        <details className="mt-5">
          <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Technical detail
          </summary>
          <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
            {error.message}
          </pre>
        </details>
      </div>
    </div>
  )
}
