import React from 'react'

/**
 * Card — disciplined container.
 *
 * Three elevation roles only (per the design tokens): `default` (low
 * shadow), `bordered` (no shadow, border-only), `elevated` (mid shadow,
 * for popovers/sheets). Surfaces and borders use semantic CSS variables
 * so themes (light/dark/enterprise) flip globally.
 */
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'bordered' | 'elevated'
}

const variantClass = {
  default: 'border border-[var(--color-border)] shadow-[var(--shadow-low)]',
  bordered: 'border border-[var(--color-border-strong)]',
  elevated: 'border border-[var(--color-border)] shadow-[var(--shadow-mid)]',
} as const

export function Card({
  variant = 'default',
  className = '',
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] bg-[var(--color-surface-1)] text-[var(--color-fg)] overflow-hidden ${variantClass[variant]} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

Card.Header = function CardHeader({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/50 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

Card.Body = function CardBody({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-5 py-4 ${className}`} {...props}>
      {children}
    </div>
  )
}

Card.Footer = function CardFooter({
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`px-5 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/40 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
