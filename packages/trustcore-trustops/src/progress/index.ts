import {
  TRUSTOPS_MANDATE_STAGES,
  type TrustOpsMandateStage,
} from '@nzila/trustcore-contracts'

/**
 * Linear progress ratio (0..1) of a mandate based on its current stage in
 * the canonical forward order. Pure — used by dashboards and reports. The
 * archived terminal stage maps to 1.0; intake to 0.
 */
export function computeMandateProgress(stage: TrustOpsMandateStage): number {
  const idx = TRUSTOPS_MANDATE_STAGES.indexOf(stage)
  if (idx < 0) return 0
  const denom = TRUSTOPS_MANDATE_STAGES.length - 1
  if (denom <= 0) return 1
  return idx / denom
}
