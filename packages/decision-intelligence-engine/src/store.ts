import type { SituationAssessment } from './schema/situation'
import type { ProblemAnalysis } from './schema/problem'
import type { DecisionAnalysis } from './schema/decision'
import type { PPOAAnalysis } from './schema/ppoa'

// ─── Situation Appraisal Store ────────────────────────────────────────────────

export interface SituationAppraisalStore {
  append(assessment: SituationAssessment): Promise<void>
  getById(id: string): Promise<SituationAssessment | undefined>
  getByOrg(orgId: string, options?: ListOptions): Promise<SituationAssessment[]>
  update(id: string, delta: Partial<SituationAssessment>): Promise<SituationAssessment>
}

// ─── Problem Analysis Store ───────────────────────────────────────────────────

export interface ProblemAnalysisStore {
  append(analysis: ProblemAnalysis): Promise<void>
  getById(id: string): Promise<ProblemAnalysis | undefined>
  getByOrg(orgId: string, options?: ListOptions): Promise<ProblemAnalysis[]>
  update(id: string, delta: Partial<ProblemAnalysis>): Promise<ProblemAnalysis>
}

// ─── Decision Analysis Store ──────────────────────────────────────────────────

export interface DecisionAnalysisStore {
  append(decision: DecisionAnalysis): Promise<void>
  getById(id: string): Promise<DecisionAnalysis | undefined>
  getByOrg(orgId: string, options?: ListOptions): Promise<DecisionAnalysis[]>
  update(id: string, delta: Partial<DecisionAnalysis>): Promise<DecisionAnalysis>
}

// ─── PPOA Store ───────────────────────────────────────────────────────────────

export interface PPOAStore {
  append(analysis: PPOAAnalysis): Promise<void>
  getById(id: string): Promise<PPOAAnalysis | undefined>
  getByOrg(orgId: string, options?: ListOptions): Promise<PPOAAnalysis[]>
  update(id: string, delta: Partial<PPOAAnalysis>): Promise<PPOAAnalysis>
}

// ─── Shared ───────────────────────────────────────────────────────────────────

export interface ListOptions {
  limit?: number
  offset?: number
  status?: string
  fromDate?: string
  toDate?: string
}
