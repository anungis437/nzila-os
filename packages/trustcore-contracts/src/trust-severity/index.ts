import { z } from 'zod'

/**
 * Canonical severity levels used across TrustCore + TrustOps.
 * Order matters for `compareSeverity` / SLA escalation.
 */
export const TRUST_SEVERITY = ['low', 'medium', 'high', 'critical'] as const

export const TrustSeveritySchema = z.enum(TRUST_SEVERITY)
export type TrustSeverity = z.infer<typeof TrustSeveritySchema>

const SEVERITY_RANK: Record<TrustSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
}

/** Returns negative if a<b, 0 if equal, positive if a>b. */
export function compareSeverity(a: TrustSeverity, b: TrustSeverity): number {
  return SEVERITY_RANK[a] - SEVERITY_RANK[b]
}

/** Returns the higher severity of the two inputs. */
export function maxSeverity(a: TrustSeverity, b: TrustSeverity): TrustSeverity {
  return compareSeverity(a, b) >= 0 ? a : b
}
