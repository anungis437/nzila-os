import type { DecisionDomain } from '@nzila/decision-core'
import type {
  BenchmarkQuery,
  DecisionAggregate,
  DecisionAggregateInputRecord,
  DecisionAggregateOptions,
  DecisionAggregateRow,
  DecisionBenchmark,
  NarAggregateSource,
} from './types'

type AggregateAccumulator = {
  organizationId: string
  domain: string
  decisionType: string
  policyVersion: string
  total: number
  approvals: number
  rejections: number
  escalations: number
  interventionCount: number
  overrideCount: number
  totalDecisionTimeMs: number
}

function toRate(value: number, total: number): number {
  if (total === 0) return 0
  return Number((value / total).toFixed(4))
}

function scoreEffectiveness(accumulator: AggregateAccumulator): number {
  const approvalWeight = accumulator.approvals * 1
  const escalationPenalty = accumulator.escalations * 0.5
  const rejectionPenalty = accumulator.rejections * 0.35
  const overridePenalty = accumulator.overrideCount * 0.35
  const interventionPenalty = accumulator.interventionCount * 0.2
  const raw = approvalWeight - escalationPenalty - rejectionPenalty - overridePenalty - interventionPenalty
  const normalized = accumulator.total === 0 ? 0 : raw / accumulator.total
  return Number(Math.max(0, Math.min(1, normalized)).toFixed(4))
}

function inferDecisionTimeMs(record: DecisionAggregateInputRecord, fallback: number): number {
  const input = record.payload.input as Record<string, unknown> | undefined
  const explicit = input?.decisionTimeMs
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit >= 0) {
    return explicit
  }
  return fallback
}

function inferIntervention(record: DecisionAggregateInputRecord): boolean {
  const actorType = record.payload.actor.type
  const trace = record.payload.outcome.explanationTrace ?? []
  return actorType === 'user' || trace.some((entry: string) => entry.toLowerCase().includes('approval'))
}

function inferOverride(record: DecisionAggregateInputRecord): boolean {
  const proof = record.payload.proof
  const trace = record.payload.outcome.explanationTrace ?? []
  return Boolean(proof?.previousHash) || trace.some((entry: string) => entry.toLowerCase().includes('override'))
}

function toDomain(record: DecisionAggregateInputRecord): string {
  return record.payload.domain satisfies DecisionDomain
}

function toWindow(options: DecisionAggregateOptions, records: DecisionAggregateInputRecord[]): { start: string; end: string } {
  const sorted = [...records].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  return {
    start: options.windowStart ?? sorted[0]?.createdAt ?? new Date(0).toISOString(),
    end: options.windowEnd ?? sorted.at(-1)?.createdAt ?? new Date(0).toISOString(),
  }
}

export function aggregateDecisionRecords(
  records: DecisionAggregateInputRecord[],
  options: DecisionAggregateOptions = {},
): DecisionAggregateRow[] {
  const defaultDecisionTimeMs = options.defaultDecisionTimeMs ?? 0
  const window = toWindow(options, records)
  const buckets = new Map<string, AggregateAccumulator>()

  for (const record of records) {
    const key = [record.organizationId, record.decisionType, record.policyVersion].join('::')
    const existing = buckets.get(key) ?? {
      organizationId: record.organizationId,
      domain: toDomain(record),
      decisionType: record.decisionType,
      policyVersion: record.policyVersion,
      total: 0,
      approvals: 0,
      rejections: 0,
      escalations: 0,
      interventionCount: 0,
      overrideCount: 0,
      totalDecisionTimeMs: 0,
    }

    existing.total += 1
    existing.totalDecisionTimeMs += inferDecisionTimeMs(record, defaultDecisionTimeMs)

    if (record.payload.outcome.status === 'approved') existing.approvals += 1
    if (record.payload.outcome.status === 'rejected') existing.rejections += 1
    if (record.payload.outcome.status === 'escalated') existing.escalations += 1
    if (inferIntervention(record)) existing.interventionCount += 1
    if (inferOverride(record)) existing.overrideCount += 1

    buckets.set(key, existing)
  }

  return [...buckets.values()].map((bucket) => ({
    organizationId: bucket.organizationId,
    domain: bucket.domain,
    decisionType: bucket.decisionType,
    metrics: {
      total: bucket.total,
      approvalRate: toRate(bucket.approvals, bucket.total),
      rejectionRate: toRate(bucket.rejections, bucket.total),
      escalationRate: toRate(bucket.escalations, bucket.total),
      avgDecisionTimeMs: bucket.total === 0 ? 0 : Math.round(bucket.totalDecisionTimeMs / bucket.total),
    },
    behavior: {
      overrideRate: toRate(bucket.overrideCount, bucket.total),
      humanInterventionRate: toRate(bucket.interventionCount, bucket.total),
    },
    policy: {
      version: bucket.policyVersion,
      effectivenessScore: scoreEffectiveness(bucket),
    },
    timeWindow: window,
    source: options.source ?? 'audit_records',
    windowKey: `${window.start}:${window.end}`,
  }))
}

export function aggregateNarExportPack(
  pack: NarAggregateSource,
  options: Omit<DecisionAggregateOptions, 'source'> = {},
): DecisionAggregate[] {
  return aggregateDecisionRecords(pack.records, {
    ...options,
    source: 'nar_export_pack',
  })
}

function quartile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * percentile)))
  return Number(sorted[index].toFixed(4))
}

export function buildDecisionBenchmarks(aggregates: DecisionAggregate[]): DecisionBenchmark[] {
  const grouped = new Map<string, DecisionAggregate[]>()

  for (const aggregate of aggregates) {
    const key = `${aggregate.domain}::${aggregate.decisionType}`
    const existing = grouped.get(key) ?? []
    existing.push(aggregate)
    grouped.set(key, existing)
  }

  return [...grouped.entries()].map(([key, items]) => {
    const [domain, decisionType] = key.split('::')
    const approvalRates = items
      .map((item) => item.metrics.approvalRate)
      .sort((left, right) => left - right)

    return {
      decisionType,
      domain,
      avgApprovalRate: Number((approvalRates.reduce((sum, value) => sum + value, 0) / approvalRates.length).toFixed(4)),
      topQuartile: quartile(approvalRates, 0.75),
      bottomQuartile: quartile(approvalRates, 0.25),
      sampleSize: items.length,
    }
  })
}

export function getBenchmark(
  aggregates: DecisionAggregate[],
  query: BenchmarkQuery,
): DecisionBenchmark | undefined {
  return buildDecisionBenchmarks(aggregates).find(
    (entry) => entry.decisionType === query.decisionType && entry.domain === query.domain,
  )
}