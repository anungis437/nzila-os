/**
 * Console Button primitive.
 *
 * - Server component (no 'use client')
 * - 4 variants × 3 sizes
 * - Forwards every native button prop
 * - Focus ring is keyboard-only (`focus-visible`)
 * - Disabled state never moves layout
 */
import { forwardRef } from 'react'
import { cn } from './cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gray-900 text-white hover:bg-gray-800 active:bg-black focus-visible:ring-gray-900',
  secondary:
    'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 active:bg-gray-100 focus-visible:ring-gray-300',
  ghost:
    'bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200 focus-visible:ring-gray-300',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-600',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs rounded-md gap-1.5',
  md: 'h-9 px-4 text-sm rounded-lg gap-2',
  lg: 'h-11 px-5 text-sm rounded-lg gap-2',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Render only the label, no padding/background — useful for inline links. */
  unstyled?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', unstyled, className, type, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={
        unstyled
          ? className
          : cn(
              'inline-flex items-center justify-center font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              'disabled:opacity-50 disabled:pointer-events-none',
              VARIANTS[variant],
              SIZES[size],
              className,
            )
      }
      {...rest}
    >
      {children}
    </button>
  )
})
