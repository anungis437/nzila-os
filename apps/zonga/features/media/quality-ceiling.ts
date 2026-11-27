import type { QualityTier } from './types'
/** Existing tier ordering, applied to every fallback as well as the request. */
export const QUALITY_RANK: Record<QualityTier, number> = {
  preview: 0,
  free: 1,
  standard: 2,
  high: 3,
  premium: 4,
  hifi: 5,
}
export function eligibleQualityTiers(
  preferred: QualityTier = 'high',
  maximum: QualityTier = preferred,
): QualityTier[] {
  if (!Object.hasOwn(QUALITY_RANK, preferred) || !Object.hasOwn(QUALITY_RANK, maximum))
    throw new Error('Unknown audio quality')
  const effective = QUALITY_RANK[preferred] <= QUALITY_RANK[maximum] ? preferred : maximum
  return [
    ...new Set<QualityTier>([effective, 'hifi', 'premium', 'high', 'standard', 'free', 'preview']),
  ].filter((tier) => QUALITY_RANK[tier] <= QUALITY_RANK[effective])
}
export function safeMediaKey(key: string) {
  return (
    !!key &&
    !/[\\?#\u0000-\u001f\u007f]/.test(key) &&
    !key.split('/').some((part) => part === '.' || part === '..') &&
    !/%(?:2e|2f|5c)/i.test(key)
  )
}
