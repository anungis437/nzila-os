import type { DecisionAggregate } from '@nzila/decision-intelligence'

export type PolicyScore = {
  decisionType: string
  policyVersion: string
  successRate: number
  disputeRate: number
  overrideRate: number
  escalationRate: number
  humanInterventionRate: number
  effectivenessScore: number
}

export type PolicyInsight = {
  policyId: string
  version: string
  issues: string[]
  recommendations: string[]
  confidenceScore: number
}

export type PolicyDriftResult = {
  decisionType: string
  oldVersion: string
  newVersion: string
  driftDetected: boolean
  deltas: {
    effectivenessScore: number
    approvalRate: number
    overrideRate: number
    escalationRate: number
  }
  severity: 'low' | 'medium' | 'high'
}

export type PolicySuggestionRequest = {
  decisionType: string
  aggregates: DecisionAggregate[]
}