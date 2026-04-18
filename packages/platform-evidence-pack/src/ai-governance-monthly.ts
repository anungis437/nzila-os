import { createHash } from 'node:crypto'

export interface MonthlyGovernanceInput {
  orgId: string
  month: string
  modelUsageSummary: Record<string, number>
  spendSummaryUsd: Record<string, number>
  latencySummaryMs: { p50: number; p95: number }
  incidents: Array<{ id: string; severity: 'warning' | 'critical'; summary: string }>
  overrides: { approvals: number; overrides: number; rejections: number }
  topRiskyPrompts: string[]
  blockedActions: number
  domainPolicyTriggers: Record<string, number>
  dataRetentionCompliancePassed: boolean
  configDriftDetected: boolean
}

export interface MonthlyGovernanceArtifact {
  artifactId: string
  name: string
  mimeType: string
  content: string
  sha256: string
}

export interface MonthlyAIGovernanceEvidencePack {
  packId: string
  orgId: string
  month: string
  generatedAt: string
  immutableDigest: string
  artifacts: MonthlyGovernanceArtifact[]
}

export interface MonthlyGovernancePoint {
  month: string
  spendUsd: number
  p95LatencyMs: number
  incidents: number
  overrideRatePct: number
  blockedActions: number
}

export interface AIGovernanceTrendView {
  months: number
  avgSpendUsd: number
  avgP95LatencyMs: number
  totalIncidents: number
  avgOverrideRatePct: number
  totalBlockedActions: number
}

export interface AIGovernanceTrendSummary {
  window3m: AIGovernanceTrendView
  window6m: AIGovernanceTrendView
  window12m: AIGovernanceTrendView
}

function toSha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

function sortKeys(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(sortKeys)

  const out: Record<string, unknown> = {}
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    out[key] = sortKeys((value as Record<string, unknown>)[key])
  }
  return out
}

function summarizeInput(input: MonthlyGovernanceInput): Record<string, unknown> {
  return {
    month: input.month,
    model_usage_summary: input.modelUsageSummary,
    spend_summary_usd: input.spendSummaryUsd,
    latency_summary_ms: input.latencySummaryMs,
    incidents: input.incidents,
    overrides: input.overrides,
    top_risky_prompts: input.topRiskyPrompts,
    blocked_actions: input.blockedActions,
    domain_policy_triggers: input.domainPolicyTriggers,
    retention_compliance: input.dataRetentionCompliancePassed,
    config_drift_detected: input.configDriftDetected,
  }
}

export function generateMonthlyAIGovernanceEvidencePack(
  input: MonthlyGovernanceInput,
): MonthlyAIGovernanceEvidencePack {
  const generatedAt = new Date().toISOString()
  const basePayload = summarizeInput(input)

  const artifacts: MonthlyGovernanceArtifact[] = [
    {
      artifactId: `${input.month}-usage-summary`,
      name: `ai-usage-summary-${input.month}.json`,
      mimeType: 'application/json',
      content: stableStringify({ month: input.month, model_usage_summary: input.modelUsageSummary }),
      sha256: '',
    },
    {
      artifactId: `${input.month}-governance-summary`,
      name: `ai-governance-summary-${input.month}.json`,
      mimeType: 'application/json',
      content: stableStringify(basePayload),
      sha256: '',
    },
    {
      artifactId: `${input.month}-compliance-checks`,
      name: `ai-compliance-checks-${input.month}.json`,
      mimeType: 'application/json',
      content: stableStringify({
        month: input.month,
        data_retention_compliance_passed: input.dataRetentionCompliancePassed,
        config_drift_detected: input.configDriftDetected,
      }),
      sha256: '',
    },
  ]

  for (const artifact of artifacts) {
    artifact.sha256 = toSha256(artifact.content)
  }

  const immutableDigest = toSha256(
    stableStringify({
      orgId: input.orgId,
      month: input.month,
      generatedAt,
      artifacts: artifacts.map((artifact) => ({
        artifactId: artifact.artifactId,
        sha256: artifact.sha256,
      })),
    }),
  )

  return {
    packId: `AI-GOV-${input.month}-${immutableDigest.slice(0, 8)}`,
    orgId: input.orgId,
    month: input.month,
    generatedAt,
    immutableDigest,
    artifacts,
  }
}

function summarizeWindow(history: readonly MonthlyGovernancePoint[], months: number): AIGovernanceTrendView {
  const slice = history.slice(-months)
  if (!slice.length) {
    return {
      months,
      avgSpendUsd: 0,
      avgP95LatencyMs: 0,
      totalIncidents: 0,
      avgOverrideRatePct: 0,
      totalBlockedActions: 0,
    }
  }

  const totalSpend = slice.reduce((sum, row) => sum + row.spendUsd, 0)
  const totalLatency = slice.reduce((sum, row) => sum + row.p95LatencyMs, 0)
  const totalIncidents = slice.reduce((sum, row) => sum + row.incidents, 0)
  const totalOverrideRate = slice.reduce((sum, row) => sum + row.overrideRatePct, 0)
  const totalBlockedActions = slice.reduce((sum, row) => sum + row.blockedActions, 0)

  return {
    months,
    avgSpendUsd: Number((totalSpend / slice.length).toFixed(2)),
    avgP95LatencyMs: Number((totalLatency / slice.length).toFixed(2)),
    totalIncidents,
    avgOverrideRatePct: Number((totalOverrideRate / slice.length).toFixed(2)),
    totalBlockedActions,
  }
}

export function buildAIGovernanceTrendSummary(
  history: readonly MonthlyGovernancePoint[],
): AIGovernanceTrendSummary {
  const normalized = [...history].sort((left, right) => left.month.localeCompare(right.month))
  return {
    window3m: summarizeWindow(normalized, 3),
    window6m: summarizeWindow(normalized, 6),
    window12m: summarizeWindow(normalized, 12),
  }
}
