/**
 * Upgrade Prompt — Inline CTA shown when a feature requires a higher plan.
 */
import Link from 'next/link'

interface UpgradePromptProps {
  feature: string
  requiredPlan: string
  locale?: string
}

export function UpgradePrompt({ feature, requiredPlan, locale }: UpgradePromptProps) {
  const href = locale
    ? `/${locale}/dashboard/subscription`
    : '/dashboard/subscription'

  return (
    <div className="rounded-xl border border-electric/20 bg-electric/5 p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-electric/10 flex items-center justify-center shrink-0">
        <span className="text-lg">🔒</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">
          {feature} requires {requiredPlan}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Upgrade your plan to unlock this feature.
        </p>
      </div>
      <Link
        href={href}
        className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-electric px-4 py-2 text-xs font-semibold text-white hover:bg-electric/90 transition-colors"
      >
        ⚡ Upgrade
      </Link>
    </div>
  )
}
