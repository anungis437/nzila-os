/**
 * @nzila/governance-operations — Design tokens
 *
 * Semantic tokens for governance operations surfaces. Tokens are
 * categorical, not raw colour values, so host apps can map them into
 * their own theme. Avoids any vendor-dashboard aesthetic.
 *
 * @module @nzila/governance-operations/design-tokens
 */
import type { PostureBand } from './posture'

export const GOVERNANCE_DESIGN_TOKENS = {
  posture: {
    stable: 'governance.posture.stable',
    warming: 'governance.posture.warming',
    concerning: 'governance.posture.concerning',
    destabilizing: 'governance.posture.destabilizing',
  },
  background: 'governance.background.institutional',
  typography: {
    heading: 'governance.typography.heading',
    body: 'governance.typography.body',
  },
  spacing: {
    section: 'governance.spacing.section',
  },
  motion: {
    cadence: 'governance.motion.cadence-slow',
  },
} as const

export function postureToken(band: PostureBand): string {
  return GOVERNANCE_DESIGN_TOKENS.posture[band]
}

/**
 * Refresh cadence in milliseconds for governance operations surfaces.
 * Real-time refresh is rejected by design.
 */
export const REFRESH_CADENCE_MS = {
  dashboard: 60_000,
  stabilization: 5 * 60_000,
  attestation: 60_000,
  evidence: 5 * 60_000,
} as const
