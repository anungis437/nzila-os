import React from 'react'

/**
 * Badge — semantic status pill.
 *
 * Variants are *roles*: neutral / ok / warning / critical / info / accent.
 * No hue-named variants. The status palette in `globals.css` adapts to
 * dark and enterprise themes; the badge follows automatically.
 */
/**
 * Canonical roles: neutral / ok / warning / critical / info / accent.
 * Legacy aliases (`default`, `success`, `danger`) kept for migration —
 * they map one-to-one onto the new roles.
 */
type BadgeVariant =
  | 'neutral' | 'ok' | 'warning' | 'critical' | 'info' | 'accent'
  | 'default' | 'success' | 'danger'

type CanonicalVariant = 'neutral' | 'ok' | 'warning' | 'critical' | 'info' | 'accent'

const aliasMap: Record<BadgeVariant, CanonicalVariant> = {
  neutral: 'neutral', ok: 'ok', warning: 'warning', critical: 'critical', info: 'info', accent: 'accent',
  default: 'neutral', success: 'ok', danger: 'critical',
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  /** Render a leading dot for at-a-glance status reads. */
  dot?: boolean
}

const variantStyles: Record<CanonicalVariant, string> = {
  neutral: 'bg-[var(--color-status-neutral-soft)] text-[var(--color-status-neutral)]',
  ok: 'bg-[var(--color-status-ok-soft)] text-[var(--color-status-ok)]',
  warning: 'bg-[var(--color-status-warning-soft)] text-[var(--color-status-warning)]',
  critical: 'bg-[var(--color-status-critical-soft)] text-[var(--color-status-critical)]',
  info: 'bg-[var(--color-status-info-soft)] text-[var(--color-status-info)]',
  accent: 'bg-[var(--color-accent-soft)] text-[var(--color-accent)]',
}

const dotColor: Record<CanonicalVariant, string> = {
  neutral: 'bg-[var(--color-status-neutral)]',
  ok: 'bg-[var(--color-status-ok)]',
  warning: 'bg-[var(--color-status-warning)]',
  critical: 'bg-[var(--color-status-critical)]',
  info: 'bg-[var(--color-status-info)]',
  accent: 'bg-[var(--color-accent)]',
}

export function Badge({
  variant = 'neutral',
  dot = false,
  className = '',
  children,
  ...props
}: BadgeProps) {
  const role = aliasMap[variant]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-0.5 text-[11px] font-semibold tabular-nums ${variantStyles[role]} ${className}`}
      {...props}
    >
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${dotColor[role]}`} aria-hidden="true" /> : null}
      {children}
    </span>
  )
}
