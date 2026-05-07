import { z } from 'zod'
import {
  TrustOpsMandateStageSchema,
  type TrustOpsMandateStage,
} from '@nzila/trustcore-contracts'
import { computeMandateProgress } from '@nzila/trustcore-trustops/progress'

/**
 * Pure, deterministic risk scoring for a TrustOps mandate.
 *
 * Inputs are intentionally narrow facts (no DB / no IO) so the scorer is
 * fully testable and reproducible across executions and processes.
 */
export const MandateRiskInputSchema = z.object({
  currentStage: TrustOpsMandateStageSchema,
  daysSinceIntake: z.number().int().min(0),
  creditorCount: z.number().int().min(0),
  totalClaimAmountCents: z.number().int().min(0),
  contestedClaimCount: z.number().int().min(0),
  missedDeadlineCount: z.number().int().min(0),
})

export type MandateRiskInput = z.infer<typeof MandateRiskInputSchema>

export const MANDATE_RISK_BANDS = ['low', 'medium', 'high', 'critical'] as const
export type MandateRiskBand = (typeof MANDATE_RISK_BANDS)[number]

export interface MandateRiskDriver {
  readonly code: string
  readonly weight: number
  readonly detail: string
}

export interface MandateRiskResult {
  readonly score: number
  readonly band: MandateRiskBand
  readonly drivers: ReadonlyArray<MandateRiskDriver>
  readonly stage: TrustOpsMandateStage
  readonly progress: number
}

const MAX_SCORE = 100

function clampScore(value: number): number {
  if (value < 0) return 0
  if (value > MAX_SCORE) return MAX_SCORE
  return Math.round(value)
}

function bandFor(score: number): MandateRiskBand {
  if (score >= 80) return 'critical'
  if (score >= 60) return 'high'
  if (score >= 30) return 'medium'
  return 'low'
}

/**
 * Compute a deterministic risk score in `[0, 100]` for a TrustOps mandate.
 *
 * Heuristic (intentionally simple and auditable):
 *  - missed deadlines: 12 points each (cap 36)
 *  - contested claims: 4 points each (cap 24)
 *  - aging: +1 point per 10 days since intake (cap 20)
 *  - creditor concentration: large creditor pools add up to 10
 *  - high-value mandates (>= $5M) add 10
 */
export function computeMandateRiskScore(input: MandateRiskInput): MandateRiskResult {
  const parsed = MandateRiskInputSchema.parse(input)
  const drivers: MandateRiskDriver[] = []

  const missedWeight = Math.min(parsed.missedDeadlineCount * 12, 36)
  if (missedWeight > 0) {
    drivers.push({
      code: 'missed_deadlines',
      weight: missedWeight,
      detail: `${parsed.missedDeadlineCount} missed deadline(s)`,
    })
  }

  const contestedWeight = Math.min(parsed.contestedClaimCount * 4, 24)
  if (contestedWeight > 0) {
    drivers.push({
      code: 'contested_claims',
      weight: contestedWeight,
      detail: `${parsed.contestedClaimCount} contested claim(s)`,
    })
  }

  const agingWeight = Math.min(Math.floor(parsed.daysSinceIntake / 10), 20)
  if (agingWeight > 0) {
    drivers.push({
      code: 'aging',
      weight: agingWeight,
      detail: `${parsed.daysSinceIntake} days since intake`,
    })
  }

  const concentrationWeight = parsed.creditorCount >= 100 ? 10 : parsed.creditorCount >= 25 ? 5 : 0
  if (concentrationWeight > 0) {
    drivers.push({
      code: 'creditor_concentration',
      weight: concentrationWeight,
      detail: `${parsed.creditorCount} creditors`,
    })
  }

  const highValueWeight = parsed.totalClaimAmountCents >= 500_000_000 ? 10 : 0
  if (highValueWeight > 0) {
    drivers.push({
      code: 'high_value_mandate',
      weight: highValueWeight,
      detail: `$${(parsed.totalClaimAmountCents / 100).toFixed(0)} aggregate claims`,
    })
  }

  const rawScore = drivers.reduce((sum, d) => sum + d.weight, 0)
  const score = clampScore(rawScore)

  return {
    score,
    band: bandFor(score),
    drivers,
    stage: parsed.currentStage,
    progress: computeMandateProgress(parsed.currentStage),
  }
}
