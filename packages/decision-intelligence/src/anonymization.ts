import type { AnonymizedDecisionAggregate, DecisionAggregate } from './types'

function bucketOrganization(organizationId: string): string {
  const prefix = organizationId.slice(0, 8) || 'unknown'
  return `org-bucket-${prefix.length}`
}

function bucketLatency(avgDecisionTimeMs: number): number {
  if (avgDecisionTimeMs <= 1000) return 1000
  if (avgDecisionTimeMs <= 5000) return 5000
  if (avgDecisionTimeMs <= 15000) return 15000
  return 60000
}

export function anonymizeAggregate(aggregate: DecisionAggregate): AnonymizedDecisionAggregate {
  return {
    organizationBucket: bucketOrganization(aggregate.organizationId),
    domain: aggregate.domain,
    decisionType: aggregate.decisionType,
    metrics: {
      ...aggregate.metrics,
      avgDecisionTimeMs: bucketLatency(aggregate.metrics.avgDecisionTimeMs),
    },
    behavior: aggregate.behavior,
    policy: aggregate.policy,
    timeWindow: aggregate.timeWindow,
  }
}

export function anonymizeAggregates(aggregates: DecisionAggregate[]): AnonymizedDecisionAggregate[] {
  return aggregates.map(anonymizeAggregate)
}