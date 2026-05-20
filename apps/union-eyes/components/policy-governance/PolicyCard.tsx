'use client'

import { LifecycleBadge } from './LifecycleBadge'
import { cn } from '@/lib/utils'

export interface PolicyCardData {
  id: string
  name: string
  domain: string
  semver: string
  lifecycleStatus: string
  riskClassification: string
  ownerUserId?: string | null
  activatedAt?: string | Date | null
  publishedAt?: string | Date | null
  contentHash?: string | null
}

interface PolicyCardProps {
  policy: PolicyCardData
  onClick?: (id: string) => void
  selected?: boolean
  className?: string
}

const RISK_COLOR: Record<string, string> = {
  low:      'text-green-600',
  medium:   'text-amber-600',
  high:     'text-orange-600',
  critical: 'text-red-600',
}

export function PolicyCard({ policy, onClick, selected, className }: PolicyCardProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={() => onClick?.(policy.id)}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onClick) onClick(policy.id) }}
      className={cn(
        'rounded-lg border bg-card text-card-foreground shadow-sm p-4 space-y-2',
        onClick && 'cursor-pointer hover:border-primary transition-colors',
        selected && 'ring-2 ring-primary border-primary',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium truncate text-sm">{policy.name}</p>
          <p className="text-xs text-muted-foreground truncate">{policy.domain}</p>
        </div>
        <LifecycleBadge state={policy.lifecycleStatus} size="sm" />
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>v{policy.semver}</span>
        <span className={cn('font-medium', RISK_COLOR[policy.riskClassification] ?? '')}>
          {policy.riskClassification}
        </span>
        {policy.activatedAt && (
          <span>Active {new Date(policy.activatedAt).toLocaleDateString()}</span>
        )}
      </div>

      {policy.contentHash && (
        <p className="text-[10px] text-muted-foreground font-mono truncate">
          {policy.contentHash.slice(0, 16)}…
        </p>
      )}
    </div>
  )
}
