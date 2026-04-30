import type { ReactNode } from 'react'

// Retokenized: same {title, description, action} API, canonical tokens
// for surface / border / type so dark/enterprise themes flow through.
interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-2)]/40 px-6 py-10 text-center">
      <div className="text-sm font-semibold text-[var(--color-fg)]">{title}</div>
      {description && <div className="mt-1 max-w-sm text-xs text-[var(--color-fg-muted)]">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
