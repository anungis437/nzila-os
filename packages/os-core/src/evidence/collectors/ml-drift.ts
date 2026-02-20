/**
 * Evidence Collector: ML Model Drift
 *
 * Reports drift metrics for all production ML models.
 * Tied to the model evaluation pipeline in tooling/ml/.
 */
import type { EvidenceArtifact } from '../types'

export interface ModelDriftRecord {
  modelName: string
  modelVersion: string
  evaluatedAt: string
  /** Population Stability Index — threshold: 0.25 */
  psi: number
  /** Concept drift p-value (Page-Hinkley) — threshold: 0.05 */
  driftPValue?: number
  /** Accuracy delta vs baseline */
  accuracyDelta?: number
  /** Drift detected by any metric */
  driftDetected: boolean
  retrainingRequired: boolean
}

export interface MLDriftOptions {
  periodLabel: string
  models: ModelDriftRecord[]
  /** PSI threshold for drift classification */
  psiThreshold?: number
}

export function collectMLDriftEvidence(opts: MLDriftOptions): EvidenceArtifact[] {
  const psiThreshold = opts.psiThreshold ?? 0.25
  const driftedModels = opts.models.filter((m) => m.driftDetected)
  const retrainingRequired = opts.models.filter((m) => m.retrainingRequired)
  const maxPsi = Math.max(...opts.models.map((m) => m.psi), 0)

  return [
    {
      type: 'ml-drift-summary',
      periodLabel: opts.periodLabel,
      modelCount: opts.models.length,
      driftedModelCount: driftedModels.length,
      retrainingRequiredCount: retrainingRequired.length,
      maxPsi,
      psiThreshold,
      passed: driftedModels.length === 0,
      models: opts.models,
      collectedAt: new Date().toISOString(),
    },
  ]
}
