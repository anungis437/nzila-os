'use client'

/**
 * Shared error panel — used by all `error.tsx` boundaries.
 *
 * Centralizes:
 *   - tone selection (forbidden = amber; otherwise red/severity)
 *   - digest surfacing (incident reference)
 *   - retry + secondary action
 *   - copy-incident-ID for support handoff
 *   - `console.error` logging for RUM
 *
 * Keeps individual `error.tsx` files trivial.
 */
import { useEffect, useState } from 'react'
import {
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  ClipboardDocumentIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'
import { cn } from './cn'

export type ErrorSeverity = 'error' | 'warn' | 'forbidden'

const TONE: Record<ErrorSeverity, { wrap: string; icon: string; btn: string }> = {
  error:     { wrap: 'border-red-200 bg-red-50',     icon: 'text-red-600',   btn: 'bg-red-600 hover:bg-red-700' },
  warn:      { wrap: 'border-amber-200 bg-amber-50', icon: 'text-amber-600', btn: 'bg-amber-600 hover:bg-amber-700' },
  forbidden: { wrap: 'border-amber-200 bg-amber-50', icon: 'text-amber-500', btn: 'bg-gray-900 hover:bg-gray-800' },
}

export function ErrorPanel({
  scope,
  error,
  reset,
  title,
  description,
  secondaryAction,
  severity,
  fullPage,
}: {
  /** Short scope tag for log lines, e.g. 'console:intelligence'. */
  scope: string
  error: Error & { digest?: string }
  reset?: () => void
  title?: string
  description?: string
  secondaryAction?: { label: string; href: string }
  /** Auto-detected from `error.message` when omitted. */
  severity?: ErrorSeverity
  /** When true, fills viewport height; otherwise inline section panel. */
  fullPage?: boolean
}) {
  useEffect(() => {
    console.error(`[${scope}:error]`, { message: error.message, digest: error.digest })
  }, [scope, error])

  const [copied, setCopied] = useState(false)
  const incidentId = error.digest ?? null

  const handleCopy = () => {
    if (!incidentId || typeof navigator === 'undefined') return
    navigator.clipboard?.writeText(incidentId).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => { /* clipboard denied — ignore */ },
    )
  }

  const isForbidden = error.message.startsWith('Forbidden:')
  const tone = severity ?? (isForbidden ? 'forbidden' : 'error')
  const cfg = TONE[tone]

  const headline =
    title ??
    (isForbidden ? 'Access Restricted' : 'Something went wrong')
  const body =
    description ??
    (isForbidden
      ? error.message.replace(/^Forbidden:\s*r/, 'R')
      : error.message || 'An unexpected error occurred. Please try again.')

  const Icon = isForbidden ? ShieldExclamationIcon : ExclamationTriangleIcon

  return (
    <div className={cn(fullPage ? 'flex min-h-[60vh] flex-col items-center justify-center p-8' : 'm-6')}>
      <div
        className={cn(
          'w-full max-w-xl rounded-2xl border p-6 shadow-sm',
          cfg.wrap,
          fullPage && 'mx-auto text-center',
        )}
        role="alert"
      >
        <div className={cn('flex gap-3', fullPage && 'flex-col items-center')}>
          <Icon className={cn('h-8 w-8 flex-none', cfg.icon)} />
          <div className={cn('flex-1', fullPage && 'text-center')}>
            <h2 className="text-base font-semibold text-gray-900">{headline}</h2>
            <p className="mt-1 text-sm text-gray-700">{body}</p>
            {error.digest ? (
              <div className="mt-2 flex items-center gap-2">
                <p className="font-mono text-xs text-gray-500">
                  Reference: <span className="select-all">{error.digest}</span>
                </p>
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Copy incident reference"
                  className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-50"
                >
                  {copied ? (
                    <><CheckIcon className="h-3 w-3 text-green-600" /> Copied</>
                  ) : (
                    <><ClipboardDocumentIcon className="h-3 w-3" /> Copy</>
                  )}
                </button>
              </div>
            ) : null}
            <div className={cn('mt-4 flex items-center gap-2', fullPage && 'justify-center')}>
              {reset ? (
                <button
                  type="button"
                  onClick={reset}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-sm font-medium text-white transition',
                    cfg.btn,
                  )}
                >
                  Retry
                </button>
              ) : null}
              {secondaryAction ? (
                <a
                  href={secondaryAction.href}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  {secondaryAction.label}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
