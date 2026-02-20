/**
 * Evidence Collector: AI Evaluation Results
 *
 * Captures LLM eval outputs from tooling/ai-evals/* and packages them
 * as evidence that AI behaviour meets quality and safety thresholds.
 */
import type { EvidenceArtifact } from '../types'

export interface AIEvalRun {
  evalName: string
  model: string
  runAt: string
  sampleCount: number
  passCount: number
  failCount: number
  scorecard: Record<string, number>
  failureExamples?: Array<{ input: string; expected: string; actual: string }>
}

export interface AIEvalOptions {
  periodLabel: string
  evalRuns: AIEvalRun[]
  /** Minimum pass rate across all evals (0-1) */
  minPassRate?: number
}

export function collectAIEvalEvidence(opts: AIEvalOptions): EvidenceArtifact[] {
  const minPassRate = opts.minPassRate ?? 0.9
  const totalSamples = opts.evalRuns.reduce((s, r) => s + r.sampleCount, 0)
  const totalPassed = opts.evalRuns.reduce((s, r) => s + r.passCount, 0)
  const overallPassRate = totalSamples > 0 ? totalPassed / totalSamples : 0

  const failingEvals = opts.evalRuns.filter(
    (r) => r.sampleCount > 0 && r.passCount / r.sampleCount < minPassRate,
  )

  return [
    {
      type: 'ai-eval-results',
      periodLabel: opts.periodLabel,
      runCount: opts.evalRuns.length,
      totalSamples,
      overallPassRate,
      minPassRateTarget: minPassRate,
      passed: overallPassRate >= minPassRate && failingEvals.length === 0,
      failingEvalCount: failingEvals.length,
      evalRuns: opts.evalRuns,
      collectedAt: new Date().toISOString(),
    },
  ]
}
