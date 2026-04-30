import React from 'react'

/**
 * Button — canonical control.
 *
 * Variants are *role*-based (primary, secondary, ghost, danger), never
 * hue-based. Colors come from CSS variables exposed in `globals.css`,
 * so a `data-product` swap on `<html>` automatically restyles every
 * primary button across the app without any per-product overrides.
 *
 * Loading state is width-stable: the spinner replaces, not augments,
 * so layout doesn't shift mid-action.
 */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-accent)] text-[var(--color-accent-fg)] hover:brightness-110',
  secondary:
    'bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]',
  ghost:
    'bg-transparent text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]',
  danger:
    'bg-[var(--color-status-critical)] text-white hover:brightness-110',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-[12px] rounded-[var(--radius-sm)]',
  md: 'h-9 px-3.5 text-[13px] rounded-[var(--radius-md)]',
  lg: 'h-11 px-5 text-[14px] rounded-[var(--radius-md)]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 font-semibold transition-[background-color,color,filter] duration-[var(--duration-fast)] ease-[var(--ease-standard)] disabled:cursor-not-allowed disabled:opacity-60 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      aria-busy={loading || undefined}
      disabled={isDisabled}
      {...props}
    >
      {loading ? <Spinner /> : null}
      <span className={loading ? 'opacity-70' : undefined}>{children}</span>
    </button>
  )
}

function Spinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
