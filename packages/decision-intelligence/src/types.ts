import type { DecisionDomain, DecisionOutcomeStatus } from '@nzila/decision-core'
import type { NarExportPack, NarRecord } from '@nzila/nar'

export type DecisionAggregate = {
  organizationId: string
  domain: string
  decisionType: string
  metrics: {
    total: number
    approvalRate: number
    rejectionRate: number
    escalationRate: number
    avgDecisionTimeMs: number
  }
  behavior: {
    overrideRate: number
    humanInterventionRate: number
  }
  policy: {
    version: string
    effectivenessScore: number
  }
  timeWindow: {
    start: string
    end: string
  }
}

export type DecisionAggregateSource = 'audit_records' | 'nar_export_pack'

export type DecisionAggregateInputRecord = Pick<
  NarRecord,
  'organizationId' | 'decisionType' | 'createdAt' | 'policyVersion' | 'payload'
> & {
  payload: NarRecord['payload'] & {
    outcome: NarRecord['payload']['outcome'] & {
      status: DecisionOutcomeStatus
    }
  }
}

export type DecisionAggregateOptions = {
  windowStart?: string
  windowEnd?: string
  defaultDecisionTimeMs?: number
  source?: DecisionAggregateSource
}

export type DecisionAggregateRow = DecisionAggregate & {
  source: DecisionAggregateSource
  windowKey: string
}

export type DecisionBenchmark = {
  decisionType: string
  domain: DecisionDomain | string
  avgApprovalRate: number
  topQuartile: number
  bottomQuartile: number
  sampleSize: number
}

export type AnonymizedDecisionAggregate = Omit<DecisionAggregate, 'organizationId'> & {
  organizationBucket: string
}

export type BenchmarkQuery = {
  decisionType: string
  domain: DecisionDomain | string
}

export type DecisionAggregatePack = {
  source: DecisionAggregateSource
  records: DecisionAggregateInputRecord[]
  aggregate: DecisionAggregateRow[]
}

export type NarAggregateSource = Pick<NarExportPack, 'organizationId' | 'records'>