/**
 * @nzila/platform-growth-os — ICP scoring engine
 *
 * Same design contract as lead-score.ts:
 *   - Interpretable weights, hand-calibrated (not ML-trained)
 *   - Version-pinned — bump ICP_VERSION when changing WEIGHTS
 *   - Per-dimension contributions published to caller
 */
import { clamp01 } from '../utils'
import type { IcpScore, IcpScoreContribution, IcpTier, OrganisationAttributes } from './types'
import { SECTOR_WEIGHTS } from './types'

export const ICP_SCORE_VERSION = 'ue-icp-score-v1'

/** Tier thresholds. */
const TIER_THRESHOLDS: { min: number; tier: IcpTier }[] = [
  { min: 0.7, tier: 'A' },
  { min: 0.4, tier: 'B' },
  { min: 0.0, tier: 'C' },
]

function deriveTier(score: number): IcpTier {
  for (const t of TIER_THRESHOLDS) {
    if (score >= t.min) return t.tier
  }
  return 'C'
}

/**
 * Score a target organisation against UE ICP dimensions.
 *
 * Returns a full contribution breakdown. Pure; no IO.
 */
export function scoreIcp(attrs: OrganisationAttributes): IcpScore {
  const contributions: IcpScoreContribution[] = []
  let total = 0

  // ── 1. Sector fit (weight 0.30) ──────────────────────────────
  {
    const w = 0.30
    const sectorWeight = attrs.sector ? SECTOR_WEIGHTS[attrs.sector] ?? 0.3 : 0
    const value = clamp01(sectorWeight)
    const contribution = w * value
    total += contribution
    contributions.push({
      dimension: 'sectorFit',
      weight: w,
      value,
      contribution,
      rationale: attrs.sector
        ? `Sector '${attrs.sector}' scores ${sectorWeight.toFixed(2)} on UE design fit.`
        : 'Sector unknown — no contribution.',
    })
  }

  // ── 2. Member scale (weight 0.20) ────────────────────────────
  {
    const w = 0.20
    const members = attrs.memberCount ?? 0
    // Sweet spot: 500–10,000 members. Saturates at 10k.
    const value = clamp01(Math.min(members, 10000) / 10000)
    const contribution = w * value
    total += contribution
    contributions.push({
      dimension: 'memberScale',
      weight: w,
      value,
      contribution,
      rationale: members > 0
        ? `${members} members → ${(value * 100).toFixed(0)}% of 10k saturation.`
        : 'Member count unknown.',
    })
  }

  // ── 3. Governance complexity (weight 0.20) ───────────────────
  {
    const w = 0.20
    const value = clamp01(attrs.governanceComplexity ?? 0)
    const contribution = w * value
    total += contribution
    contributions.push({
      dimension: 'governanceComplexity',
      weight: w,
      value,
      contribution,
      rationale: attrs.governanceComplexity != null
        ? `Hand-rated complexity: ${(value * 100).toFixed(0)}%.`
        : 'Complexity not yet rated.',
    })
  }

  // ── 4. Tech maturity (weight 0.15) ───────────────────────────
  // Low tech maturity = high need for modernisation = higher ICP fit.
  {
    const w = 0.15
    const techMaturityScores: Record<string, number> = {
      spreadsheet_only:      1.0,
      email_plus_sharepoint: 0.85,
      generic_crm:           0.65,
      union_specific_legacy: 0.5,
      modern_stack:          0.15,
    }
    const value = attrs.techMaturity ? clamp01(techMaturityScores[attrs.techMaturity] ?? 0.5) : 0
    const contribution = w * value
    total += contribution
    contributions.push({
      dimension: 'techModernisationNeed',
      weight: w,
      value,
      contribution,
      rationale: attrs.techMaturity
        ? `Tech posture '${attrs.techMaturity}' → ${(value * 100).toFixed(0)}% modernisation urgency.`
        : 'Tech maturity unknown.',
    })
  }

  // ── 5. Warm path (weight 0.10) ───────────────────────────────
  {
    const w = 0.10
    const value = attrs.warmPathDescription ? 1 : 0
    const contribution = w * value
    total += contribution
    contributions.push({
      dimension: 'warmPath',
      weight: w,
      value,
      contribution,
      rationale: attrs.warmPathDescription
        ? `Warm path: "${attrs.warmPathDescription}".`
        : 'No warm path identified.',
    })
  }

  // ── 6. Collective agreement recency (weight 0.05) ────────────
  {
    const w = 0.05
    const currentYear = new Date().getFullYear()
    const expiry = attrs.collectiveAgreementExpiryYear
    // Expiring within 2 years → highest urgency (contracts often precede tech modernisation)
    const yearsUntilExpiry = expiry != null ? expiry - currentYear : null
    const value = yearsUntilExpiry != null
      ? clamp01(1 - Math.max(0, yearsUntilExpiry) / 4)
      : 0
    const contribution = w * value
    total += contribution
    contributions.push({
      dimension: 'contractExpirySoon',
      weight: w,
      value,
      contribution,
      rationale: expiry != null
        ? `CA expires ${expiry} — ${yearsUntilExpiry} years away.`
        : 'CA expiry unknown.',
    })
  }

  const clamped = clamp01(total)
  return {
    total: clamped,
    tier: deriveTier(clamped),
    contributions,
    modelVersion: ICP_SCORE_VERSION,
    computedAt: new Date().toISOString(),
  }
}
