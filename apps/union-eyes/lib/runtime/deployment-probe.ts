import { timingSafeEqual } from 'node:crypto'

/**
 * Whether a request carries the deployment-probe credential (`Authorization: Bearer <UE_CANDIDATE_PROBE_TOKEN>`),
 * the same secret the deploy workflow already sends to a candidate host. With no token configured nothing is ever
 * authorized, so an unconfigured environment discloses only the minimal public build identity.
 */
export function hasDeploymentProbeCredential(authorization: string | null, configuredToken = process.env.UE_CANDIDATE_PROBE_TOKEN): boolean {
  if (!configuredToken || !authorization) return false
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim())
  if (!match) return false
  const presented = Buffer.from(match[1])
  const expected = Buffer.from(configuredToken)
  return presented.length === expected.length && timingSafeEqual(presented, expected)
}
