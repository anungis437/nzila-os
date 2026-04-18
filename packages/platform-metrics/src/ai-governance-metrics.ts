export type AiConversionType = 'lead' | 'deal' | 'workflow'

export interface AiTelemetryRecord {
  timestamp: string
  appKey: string
  orgId: string
  endpoint: string
  modelUsed: string
  provider: string
  status: 'success' | 'error' | 'pending_review' | 'approved' | 'rejected'
  latencyMs: number | null
  tokenCostUsd: number | null
  tokensIn: number | null
  tokensOut: number | null
  timedOut?: boolean
  retryCount?: number
  degradedMode?: boolean
  providerFailure?: boolean
  errorClass?: string | null
  confidenceScore?: number | null
  evidenceRefsCount?: number
  reviewRequired?: boolean
  approved?: boolean | null
  overridden?: boolean | null
  conversionType?: AiConversionType | null
  converted?: boolean
  queueName?: string | null
  queueBacklog?: number | null
}

export interface AiConfidenceDistribution {
  low: number
  medium: number
  high: number
}

export interface AiPeakLoadWindow {
  hour: string
  volume: number
}

export interface AiCostMetrics {
  tokenSpendUsd: number
  tokenSpendByOrgUsd: Record<string, number>
  costPerSuccessfulActionUsd: number
  costPerConvertedLeadUsd: number | null
  costPerConvertedDealUsd: number | null
  costPerConvertedWorkflowUsd: number | null
}

export interface AiPerformanceMetrics {
  p50LatencyMs: number
  p95LatencyMs: number
  timeoutPct: number
  retryPct: number
  providerFailurePct: number
  degradedModePct: number
}

export interface AiQualityMetrics {
  approvalRatePct: number
  overrideRatePct: number
  rejectionRatePct: number
  confidenceDistribution: AiConfidenceDistribution
  evidenceAttachedPct: number
}

export interface AiOperationsMetrics {
  volumeByEndpoint: Record<string, number>
  peakLoadWindows: AiPeakLoadWindow[]
  errorClasses: Record<string, number>
  queueBacklog: Record<string, number>
  modelRoutingPct: Record<string, number>
}

export interface AiAppOperatingMetrics {
  appKey: string
  totalVolume: number
  cost: AiCostMetrics
  performance: AiPerformanceMetrics
  quality: AiQualityMetrics
  operations: AiOperationsMetrics
}

export interface AiOperatingMetrics {
  generatedAt: string
  recordCount: number
  byApp: Record<string, AiAppOperatingMetrics>
}

function toPct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Number(((numerator / denominator) * 100).toFixed(2))
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return Math.round(sorted[idx] ?? 0)
}

function roundMoney(value: number): number {
  return Number(value.toFixed(4))
}

function divideCostByConversions(totalCostUsd: number, convertedCount: number): number | null {
  if (convertedCount <= 0) return null
  return roundMoney(totalCostUsd / convertedCount)
}

function confidenceBucket(distribution: AiConfidenceDistribution, score: number): void {
  if (score < 0.5) {
    distribution.low += 1
    return
  }

  if (score < 0.8) {
    distribution.medium += 1
    return
  }

  distribution.high += 1
}

export function aggregateAiOperatingMetrics(records: readonly AiTelemetryRecord[]): AiOperatingMetrics {
  const byAppRecords = new Map<string, AiTelemetryRecord[]>()

  for (const record of records) {
    if (!byAppRecords.has(record.appKey)) {
      byAppRecords.set(record.appKey, [])
    }
    byAppRecords.get(record.appKey)!.push(record)
  }

  const byApp: Record<string, AiAppOperatingMetrics> = {}

  for (const [appKey, appRecords] of byAppRecords.entries()) {
    const tokenSpendUsd = appRecords.reduce((sum, row) => sum + (row.tokenCostUsd ?? 0), 0)
    const successCount = appRecords.filter((row) => row.status === 'success' || row.status === 'approved').length

    const leadConversions = appRecords.filter((row) => row.conversionType === 'lead' && row.converted).length
    const dealConversions = appRecords.filter((row) => row.conversionType === 'deal' && row.converted).length
    const workflowConversions = appRecords.filter((row) => row.conversionType === 'workflow' && row.converted).length

    const tokenSpendByOrgUsd = appRecords.reduce<Record<string, number>>((acc, row) => {
      acc[row.orgId] = roundMoney((acc[row.orgId] ?? 0) + (row.tokenCostUsd ?? 0))
      return acc
    }, {})

    const latencies = appRecords
      .map((row) => row.latencyMs)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

    const timedOutCount = appRecords.filter((row) => row.timedOut).length
    const retryCount = appRecords.filter((row) => (row.retryCount ?? 0) > 0).length
    const providerFailureCount = appRecords.filter((row) => row.providerFailure).length
    const degradedCount = appRecords.filter((row) => row.degradedMode).length

    const reviewRecords = appRecords.filter((row) => row.reviewRequired)
    const approvedCount = reviewRecords.filter((row) => row.approved === true || row.status === 'approved').length
    const rejectedCount = reviewRecords.filter((row) => row.approved === false || row.status === 'rejected').length
    const overriddenCount = reviewRecords.filter((row) => row.overridden).length

    const confidenceDistribution: AiConfidenceDistribution = { low: 0, medium: 0, high: 0 }
    for (const row of appRecords) {
      const confidence = row.confidenceScore
      if (typeof confidence === 'number' && Number.isFinite(confidence)) {
        confidenceBucket(confidenceDistribution, confidence)
      }
    }

    const evidenceAttachedCount = appRecords.filter((row) => (row.evidenceRefsCount ?? 0) > 0).length

    const volumeByEndpoint = appRecords.reduce<Record<string, number>>((acc, row) => {
      acc[row.endpoint] = (acc[row.endpoint] ?? 0) + 1
      return acc
    }, {})

    const volumeByHour = appRecords.reduce<Record<string, number>>((acc, row) => {
      const hour = row.timestamp.slice(0, 13)
      acc[hour] = (acc[hour] ?? 0) + 1
      return acc
    }, {})

    const peakLoadWindows = Object.entries(volumeByHour)
      .map(([hour, volume]) => ({ hour, volume }))
      .sort((left, right) => right.volume - left.volume)
      .slice(0, 3)

    const errorClasses = appRecords.reduce<Record<string, number>>((acc, row) => {
      if (!row.errorClass) return acc
      acc[row.errorClass] = (acc[row.errorClass] ?? 0) + 1
      return acc
    }, {})

    const queueBacklog = appRecords.reduce<Record<string, number>>((acc, row) => {
      if (!row.queueName) return acc
      const backlog = row.queueBacklog ?? 0
      acc[row.queueName] = Math.max(acc[row.queueName] ?? 0, backlog)
      return acc
    }, {})

    const modelCounts = appRecords.reduce<Record<string, number>>((acc, row) => {
      const modelKey = `${row.provider}:${row.modelUsed}`
      acc[modelKey] = (acc[modelKey] ?? 0) + 1
      return acc
    }, {})

    const modelRoutingPct = Object.entries(modelCounts).reduce<Record<string, number>>((acc, [modelKey, count]) => {
      acc[modelKey] = toPct(count, appRecords.length)
      return acc
    }, {})

    byApp[appKey] = {
      appKey,
      totalVolume: appRecords.length,
      cost: {
        tokenSpendUsd: roundMoney(tokenSpendUsd),
        tokenSpendByOrgUsd,
        costPerSuccessfulActionUsd: successCount > 0 ? roundMoney(tokenSpendUsd / successCount) : 0,
        costPerConvertedLeadUsd: divideCostByConversions(tokenSpendUsd, leadConversions),
        costPerConvertedDealUsd: divideCostByConversions(tokenSpendUsd, dealConversions),
        costPerConvertedWorkflowUsd: divideCostByConversions(tokenSpendUsd, workflowConversions),
      },
      performance: {
        p50LatencyMs: percentile(latencies, 50),
        p95LatencyMs: percentile(latencies, 95),
        timeoutPct: toPct(timedOutCount, appRecords.length),
        retryPct: toPct(retryCount, appRecords.length),
        providerFailurePct: toPct(providerFailureCount, appRecords.length),
        degradedModePct: toPct(degradedCount, appRecords.length),
      },
      quality: {
        approvalRatePct: toPct(approvedCount, reviewRecords.length),
        overrideRatePct: toPct(overriddenCount, reviewRecords.length),
        rejectionRatePct: toPct(rejectedCount, reviewRecords.length),
        confidenceDistribution,
        evidenceAttachedPct: toPct(evidenceAttachedCount, appRecords.length),
      },
      operations: {
        volumeByEndpoint,
        peakLoadWindows,
        errorClasses,
        queueBacklog,
        modelRoutingPct,
      },
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    recordCount: records.length,
    byApp,
  }
}
