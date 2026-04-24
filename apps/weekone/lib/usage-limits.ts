export type WeekonePlan = 'free' | 'pro' | 'team'

export interface UsageSnapshot {
  prioritiesCreatedThisWeek: number
  collaborators: number
  integrationsConnected: number
}

const LIMITS: Record<WeekonePlan, UsageSnapshot> = {
  free: {
    prioritiesCreatedThisWeek: 12,
    collaborators: 1,
    integrationsConnected: 1,
  },
  pro: {
    prioritiesCreatedThisWeek: 200,
    collaborators: 5,
    integrationsConnected: 5,
  },
  team: {
    prioritiesCreatedThisWeek: 2_000,
    collaborators: 50,
    integrationsConnected: 20,
  },
}

export function getUsageLimits(plan: WeekonePlan): UsageSnapshot {
  return LIMITS[plan]
}

export function shouldShowUpgradePrompt(params: {
  plan: WeekonePlan
  usage: UsageSnapshot
}): boolean {
  if (params.plan === 'team') return false

  const limits = getUsageLimits(params.plan)
  return (
    params.usage.prioritiesCreatedThisWeek >= limits.prioritiesCreatedThisWeek ||
    params.usage.collaborators >= limits.collaborators ||
    params.usage.integrationsConnected >= limits.integrationsConnected
  )
}
