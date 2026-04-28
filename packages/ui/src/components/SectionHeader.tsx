import React from 'react'

/**
 * SectionHeader — page or panel section title.
 *
 * One H-level, optional eyebrow, optional description, optional
 * trailing action slot. Honest: no decorative emoji, no glow, no
 * gradient. The visual weight is reserved for the data below.
 */
interface SectionHeaderProps {
  /** Small uppercase eyebrow above the title. Optional. */
  eyebrow?: string
  title: React.ReactNode
  description?: React.ReactNode
  /** Right-side slot for buttons/filters. */
  actions?: React.ReactNode
  /** Heading level — defaults to h2 (page-level should explicitly set h1). */
  as?: 'h1' | 'h2' | 'h3'
  className?: string
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  as: Tag = 'h2',
  className = '',
}: SectionHeaderProps) {
  return (
    <header className={`flex items-start justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-fg-subtle)]">
            {eyebrow}
          </div>
        ) : null}
        <Tag className="text-[18px] font-semibold text-[var(--color-fg)] leading-tight mt-0.5">
          {title}
        </Tag>
        {description ? (
          <p className="text-[13px] text-[var(--color-fg-muted)] mt-1 max-w-prose">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0 flex items-center gap-2">{actions}</div> : null}
    </header>
  )
}
