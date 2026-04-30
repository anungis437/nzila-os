import type { ReactNode } from 'react'

// Retokenized: structural API preserved (title/description/action/children),
// surfaces / borders / shadow now consume canonical @nzila/ui tokens so
// themes and product accent flow through globally.
interface CardProps {
  children: ReactNode
  className?: string
  title?: string
  description?: string
  action?: ReactNode
}

export function Card({ children, className = '', title, description, action }: CardProps) {
  return (
    <section
      className={`rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-[var(--shadow-low)] ${className}`}
    >
      {(title || action) && (
        <header className="flex items-start justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/50 px-6 py-4">
          <div>
            {title && (
              <h2 className="text-sm font-semibold tracking-tight text-[var(--color-fg)]">{title}</h2>
            )}
            {description && <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="px-6 py-5">{children}</div>
    </section>
  )
}
