import { ApiAuthError } from './api-auth'

export type IntelligenceTier = 'basic' | 'pro' | 'enterprise'

const tierRank: Record<IntelligenceTier, number> = {
  basic: 1,
  pro: 2,
  enterprise: 3,
}

export function resolveIntelligenceTier(request: Request): IntelligenceTier {
  const header = request.headers.get('x-intelligence-tier')?.toLowerCase()
  const query = new URL(request.url).searchParams.get('tier')?.toLowerCase()
  const value = header ?? query ?? 'basic'

  if (value === 'basic' || value === 'pro' || value === 'enterprise') {
    return value
  }

  throw new ApiAuthError('Invalid intelligence tier', 400)
}

export function requireIntelligenceTier(request: Request, minimumTier: IntelligenceTier): IntelligenceTier {
  const tier = resolveIntelligenceTier(request)
  if (tierRank[tier] < tierRank[minimumTier]) {
    throw new ApiAuthError(`This endpoint requires ${minimumTier} intelligence access`, 403)
  }
  return tier
}