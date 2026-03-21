/**
 * Plan Badge — Shows the user's current plan tier.
 */
import type { ListenerPlan, CreatorPlan } from '@/lib/plans'

const PLAN_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  free: { bg: 'bg-gray-100', text: 'text-gray-600', icon: '🎵' },
  premium: { bg: 'bg-gold/10', text: 'text-gold', icon: '⭐' },
  artist: { bg: 'bg-electric/10', text: 'text-electric', icon: '🎤' },
  label: { bg: 'bg-purple-500/10', text: 'text-purple-600', icon: '🏷️' },
  enterprise: { bg: 'bg-navy/10', text: 'text-navy', icon: '🏢' },
}

export function PlanBadge({ plan }: { plan: ListenerPlan | CreatorPlan }) {
  const style = PLAN_STYLES[plan] ?? PLAN_STYLES.free
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.bg} ${style.text}`}>
      <span>{style.icon}</span>
      {plan.charAt(0).toUpperCase() + plan.slice(1)}
    </span>
  )
}
