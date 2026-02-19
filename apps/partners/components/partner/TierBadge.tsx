/**
 * TierBadge — renders a partner's current tier with appropriate styling.
 */

export type PartnerTier =
  | 'registered'
  | 'select'
  | 'certified'
  | 'professional'
  | 'premier'
  | 'advanced'
  | 'enterprise'
  | 'elite'
  | 'strategic'

const tierConfig: Record<PartnerTier, { label: string; className: string }> = {
  registered:    { label: 'Registered',    className: 'bg-slate-100 text-slate-700 border-slate-200' },
  select:        { label: 'Select',        className: 'bg-blue-50 text-blue-700 border-blue-200' },
  certified:     { label: 'Certified',     className: 'bg-blue-50 text-blue-700 border-blue-200' },
  professional:  { label: 'Professional',  className: 'bg-blue-50 text-blue-700 border-blue-200' },
  premier:       { label: 'Premier',       className: 'bg-amber-50 text-amber-700 border-amber-200' },
  advanced:      { label: 'Advanced',      className: 'bg-amber-50 text-amber-700 border-amber-200' },
  enterprise:    { label: 'Enterprise',    className: 'bg-amber-50 text-amber-700 border-amber-200' },
  elite:         { label: 'Elite',         className: 'bg-purple-50 text-purple-700 border-purple-200' },
  strategic:     { label: 'Strategic',     className: 'bg-purple-50 text-purple-700 border-purple-200' },
}

interface TierBadgeProps {
  tier: PartnerTier
  size?: 'sm' | 'md'
}

export function TierBadge({ tier, size = 'sm' }: TierBadgeProps) {
  const config = tierConfig[tier]
  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-xs'
    : 'px-3 py-1 text-sm'

  return (
    <span className={`inline-flex items-center font-medium rounded-full border ${config.className} ${sizeClasses}`}>
      {config.label}
    </span>
  )
}
