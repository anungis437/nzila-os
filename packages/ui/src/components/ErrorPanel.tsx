import React from 'react'

/**
 * ErrorPanel — Phase 7 trust UX.
 *
 * What broke, what to do, who to contact, what the incident ID is.
 * No stack traces in production. Always shows the incident ID prominently
 * (copyable) so support can correlate.
 */
interface ErrorPanelProps {
  title?: React.ReactNode
  /** Plain-language description — no jargon, no apology theatre. */
  description?: React.ReactNode
  /** Incident ID / trace ID — rendered monospace and copyable. */
  incidentId?: string
  /** Primary recovery action — usually "Retry". */
  action?: React.ReactNode
  /** Secondary action — usually "Contact support" / "Open status page". */
  secondaryAction?: React.ReactNode
  /** Severity — drives the border color and icon. */
  severity?: 'warning' | 'critical'
  className?: string
}

const severityClass = {
  warning: 'border-[var(--color-status-warning)] bg-[var(--color-status-warning-soft)]',
  critical: 'border-[var(--color-status-critical)] bg-[var(--color-status-critical-soft)]',
} as const

export function ErrorPanel({
  title = 'Something went wrong',
  description,
  incidentId,
  action,
  secondaryAction,
  severity = 'critical',
  className = '',
}: ErrorPanelProps) {
  return (
    <div
      role="alert"
      className={`rounded-[var(--radius-lg)] border-l-4 border border-[var(--color-border)] p-4 ${severityClass[severity]} ${className}`}
    >
      <div className="text-[14px] font-semibold text-[var(--color-fg)]">{title}</div>
      {description ? (
        <p className="text-[13px] text-[var(--color-fg-muted)] mt-1">{description}</p>
      ) : null}
      {incidentId ? (
        <div className="mt-2 text-[11px] text-[var(--color-fg-muted)] font-mono">
          Incident ID: <span className="text-[var(--color-fg)]">{incidentId}</span>
        </div>
      ) : null}
      {action || secondaryAction ? (
        <div className="flex items-center gap-2 mt-3">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  )
}
