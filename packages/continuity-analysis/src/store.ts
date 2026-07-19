import type {
  ContinuityRiskScore,
  ContinuityRiskSignal,
  ContinuityDriftEvent,
} from './schema'

// ─── Continuity Analysis Store ────────────────────────────────────────────────

export interface ContinuityAnalysisStore {
  appendScore(score: ContinuityRiskScore): Promise<void>
  getLatestScore(orgId: string): Promise<ContinuityRiskScore | undefined>
  getScoreHistory(orgId: string, limit?: number): Promise<ContinuityRiskScore[]>

  appendDriftEvent(event: ContinuityDriftEvent): Promise<void>
  getDriftEvents(orgId: string, options?: { status?: string; limit?: number }): Promise<ContinuityDriftEvent[]>
  updateDriftEvent(id: string, delta: Partial<ContinuityDriftEvent>): Promise<ContinuityDriftEvent>
  getDriftEventById(id: string): Promise<ContinuityDriftEvent | undefined>
}

// ─── Signal Aggregation Input ─────────────────────────────────────────────────

export interface SignalAggregationInput {
  orgId: string
  signals: Omit<ContinuityRiskSignal, 'id' | 'riskIndex' | 'detectedAt' | 'updatedAt'>[]
}
