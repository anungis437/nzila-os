'use client'

import { cn } from '@/lib/utils'

/**
 * LifecycleBadge — visual indicator for governed policy lifecycle state.
 * 10 states with distinct colors for immediate recognition.
 */
const STATE_CONFIG: Record<string, { label: string; className: string }> = {
  draft:             { label: 'Draft',             className: 'bg-gray-100 text-gray-700 border-gray-200' },
  review_pending:    { label: 'Review Pending',    className: 'bg-blue-100 text-blue-700 border-blue-200' },
  approval_required: { label: 'Approval Required', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved:          { label: 'Approved',          className: 'bg-teal-100 text-teal-700 border-teal-200' },
  published:         { label: 'Published',         className: 'bg-green-100 text-green-700 border-green-200' },
  active:            { label: 'Active',            className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  superseded:        { label: 'Superseded',        className: 'bg-slate-100 text-slate-600 border-slate-200' },
  deprecated:        { label: 'Deprecated',        className: 'bg-orange-100 text-orange-700 border-orange-200' },
  revoked:           { label: 'Revoked',           className: 'bg-red-100 text-red-700 border-red-200' },
  archived:          { label: 'Archived',          className: 'bg-muted text-muted-foreground border-border' },
}

interface LifecycleBadgeProps {
  state: string
  className?: string
  size?: 'sm' | 'md'
}

export function LifecycleBadge({ state, className, size = 'md' }: LifecycleBadgeProps) {
  const config = STATE_CONFIG[state] ?? { label: state, className: 'bg-gray-100 text-gray-600 border-gray-200' }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  )
}
