/**
 * ZongaBrandMark — Platform brand mark (always visible, always dominant)
 */
'use client'

import Link from 'next/link'
import type { BrandPlacement } from '@/lib/branding/types'
import { getSafeBrandMode } from '@/lib/branding/policy'

interface ZongaBrandMarkProps {
  placement: BrandPlacement
  size?: 'sm' | 'md' | 'lg'
  /** Link destination (defaults to /) */
  href?: string
  /** Color theme — 'dark' renders white text (dark bg), 'light' renders dark text (light bg) */
  theme?: 'dark' | 'light'
  className?: string
}

const sizeMap = {
  sm: { logo: 24, text: 'text-base' },
  md: { logo: 32, text: 'text-xl' },
  lg: { logo: 40, text: 'text-2xl' },
} as const

export function ZongaBrandMark({
  placement,
  size = 'md',
  href = '/',
  theme = 'dark',
  className = '',
}: ZongaBrandMarkProps) {
  const mode = getSafeBrandMode('platform', placement)
  if (mode === 'hidden') return null

  const { text } = sizeMap[size]
  const textColor = theme === 'light' ? 'text-navy' : 'text-white'

  const content = (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {mode !== 'text_only' && (
        <span
          className={`flex items-center justify-center rounded-lg bg-linear-to-br from-electric to-gold font-bold text-navy ${
            size === 'sm' ? 'h-7 w-7 text-xs' : size === 'md' ? 'h-9 w-9 text-sm' : 'h-11 w-11 text-base'
          } ${mode === 'grayscale_logo' ? 'grayscale' : ''} ${mode === 'muted_logo' ? 'opacity-60' : ''}`}
        >
          Z
        </span>
      )}
      <span className={`font-bold tracking-tight ${textColor} ${text}`}>Zonga</span>
    </span>
  )

  if (href) {
    return (
      <Link href={href} className="transition-opacity hover:opacity-80">
        {content}
      </Link>
    )
  }

  return content
}
