import type { ReactNode } from 'react'

// Retokenized: HQ's {eyebrow, title, description, action} API preserved.
// Type colors now use canonical fg / fg-muted / fg-subtle tokens so the
// hierarchy looks identical in light/dark/enterprise themes.
interface SectionHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}

export function SectionHeader({ eyebrow, title, description, action }: SectionHeaderProps) {
  return (
    <div className="mb-6 flex items-end justify-between gap-6">
      <div>
        {eyebrow && (
          <div className="text-[11px] font-medium uppercase tracking-widest text-[var(--color-fg-subtle)]">
            {eyebrow}
          </div>
        )}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--color-fg)]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-[var(--color-fg-muted)]">{description}</p>}
      </div>
      {action}
    </div>
  )
}
