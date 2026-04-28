import React from 'react'

/**
 * EmptyState — Phase 8 calm empty.
 *
 * Required: title + description that names *why* this is empty (e.g.
 * "No invoices in the last 90 days" not just "No data"). Optional
 * action and a secondary, lower-weight action.
 *
 * No illustrations. No marketing voice. This is a working surface
 * that happens to have nothing to show right now.
 */
interface EmptyStateProps {
  title: React.ReactNode
  description?: React.ReactNode
  /** Primary action — usually "Connect data" / "Create first X". */
  action?: React.ReactNode
  /** Secondary action — usually a docs/help link. */
  secondaryAction?: React.ReactNode
  /** Optional 24-32px icon, monochrome. */
  icon?: React.ReactNode
  className?: string
}

export function EmptyState({
  title,
  description,
  action,
  secondaryAction,
  icon,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center text-center gap-3 px-6 py-10 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-2)]/40 ${className}`}
    >
      {icon ? (
        <div className="text-[var(--color-fg-subtle)]" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <div className="text-[14px] font-semibold text-[var(--color-fg)]">{title}</div>
      {description ? (
        <p className="text-[13px] text-[var(--color-fg-muted)] max-w-md">{description}</p>
      ) : null}
      {action || secondaryAction ? (
        <div className="flex items-center gap-2 mt-1">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  )
}
