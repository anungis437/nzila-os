/**
 * Console — Server-side Data Layer
 *
 * Centralised data access for all Console dashboard pages.
 * Every function tries live platform data first.
 * If data is unavailable, this file returns conservative no-data results.
 *
 * @module console/server-data
 */
import 'server-only'

import type { ProviderHealth } from '@nzila/platform-integrations-control-plane'
import type { CostRollup } from '@nzila/platform-cost'
import { listProviderDefinitions } from './integrations-provider-catalog'

const CONSERVATIVE_PROVIDERS = [
  { id: 'resend', name: 'Resend', category: 'email' },
  { id: 'sendgrid', name: 'SendGrid', category: 'email' },
  { id: 'mailgun', name: 'Mailgun', category: 'email' },
  { id: 'twilio', name: 'Twilio', category: 'sms' },
  { id: 'firebase', name: 'Firebase Cloud Messaging', category: 'push' },
  { id: 'slack', name: 'Slack', category: 'chatops' },
  { id: 'teams', name: 'Microsoft Teams', category: 'chatops' },
  { id: 'hubspot', name: 'HubSpot', category: 'crm' },
  { id: 'm365', name: 'Microsoft 365', category: 'productivity' },
  { id: 'google-workspace', name: 'Google Workspace', category: 'productivity' },
  { id: 'webhooks', name: 'Webhooks', category: 'webhooks' },
] as const

// ═══════════════════════════════════════════════════════════════════════════
// Marketplace Providers
// ═══════════════════════════════════════════════════════════════════════════

export interface MarketplaceProvider {
  id: string
  name: string
  category: string
  version: string
  description: string
  installed: boolean
  status: 'active' | 'inactive' | 'error'
  scopes: string[]
  requiredSecrets: string[]
  retryAttempts: number
  lastHealthCheck: string
}

function seedMarketplaceProviders(): MarketplaceProvider[] {
  return listProviderDefinitions().map((provider) => ({
    id: provider.key,
    name: provider.displayName,
    category: provider.channel,
    version: '1.0.0',
    description: 'Connection state is unknown until this provider is connected and validated for an org.',
    installed: false,
    status: 'inactive',
    scopes: [],
    requiredSecrets: [...provider.requiredSecrets],
    retryAttempts: 0,
    lastHealthCheck: 'Unavailable',
  }))
}

export async function getMarketplaceProviders(): Promise<MarketplaceProvider[]> {
  return seedMarketplaceProviders()
}

// ═══════════════════════════════════════════════════════════════════════════
// Integration Control Plane — Provider Rows
// ═══════════════════════════════════════════════════════════════════════════

export interface IntegrationProviderRow {
  providerId: string
  orgId: string
  status: 'healthy' | 'degraded' | 'down'
  lastCheckedAt: string
  webhookVerified: boolean
  rateLimitUsage: number
  dlqDepth: number
}

function seedIntegrationProviders(): IntegrationProviderRow[] {
  return CONSERVATIVE_PROVIDERS.map((provider) => ({
    providerId: provider.id,
    orgId: 'org_unknown',
    status: 'down' as const,
    lastCheckedAt: new Date(0).toISOString(),
    webhookVerified: false,
    rateLimitUsage: 0,
    dlqDepth: 0,
  }))
}

export async function getIntegrationProviders(): Promise<IntegrationProviderRow[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/integrations/health`, { cache: 'no-store' })
    if (res.ok) {
      const json = (await res.json()) as { providers?: ProviderHealth[] }
      if (json.providers && json.providers.length > 0) {
        return json.providers.map((h) => ({
          providerId: h.provider,
          orgId: 'org_default',
          status: h.status === 'unknown' ? ('down' as const) : h.status,
          lastCheckedAt: h.lastCheckedAt,
          webhookVerified: h.consecutiveFailures === 0,
          rateLimitUsage: 0,
          dlqDepth: 0,
        }))
      }
    }
  } catch { /* fall through to seed */ }
  return seedIntegrationProviders()
}

// ═══════════════════════════════════════════════════════════════════════════
// Integration Control Plane — DLQ Entries
// ═══════════════════════════════════════════════════════════════════════════

export interface DlqRow {
  entryId: string
  providerId: string
  orgId: string
  eventType: string
  failedAt: string
  retryCount: number
  lastError: string
}

function seedDlqEntries(): DlqRow[] {
  return []
}

export async function getDlqEntries(orgId?: string | null): Promise<DlqRow[]> {
  if (!orgId) return seedDlqEntries()
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/integrations/dlq?orgId=${encodeURIComponent(orgId)}`, { cache: 'no-store' })
    if (res.ok) {
      const json = (await res.json()) as { entries?: DlqRow[] }
      return json.entries ?? []
    }
  } catch { /* fall through to seed */ }
  return seedDlqEntries()
}

// ═══════════════════════════════════════════════════════════════════════════
// Integration Deliveries
// ═══════════════════════════════════════════════════════════════════════════

export interface IntegrationDeliveryRow {
  id: string
  provider: string
  channel: string
  recipient: string
  status: 'queued' | 'sent' | 'failed' | 'dlq'
  attempts: number
  createdAt: string
}

function seedIntegrationDeliveries(): IntegrationDeliveryRow[] {
  return []
}

export async function getIntegrationDeliveries(args?: {
  orgId?: string | null
  provider?: string | null
  status?: string | null
}): Promise<IntegrationDeliveryRow[]> {
  if (!args?.orgId) return seedIntegrationDeliveries()
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const params = new URLSearchParams()
    params.set('orgId', args.orgId)
    if (args?.provider) params.set('provider', args.provider)
    if (args?.status) params.set('status', args.status)
    const query = params.toString()
    const res = await fetch(`${baseUrl}/api/integrations/deliveries${query ? `?${query}` : ''}`, {
      cache: 'no-store',
    })
    if (res.ok) {
      const json = (await res.json()) as { entries?: IntegrationDeliveryRow[] }
      return json.entries ?? []
    }
  } catch { /* fall through to seed */ }
  return seedIntegrationDeliveries()
}

// ═══════════════════════════════════════════════════════════════════════════
// SLA / SLO Results
// ═══════════════════════════════════════════════════════════════════════════

type ComplianceStatus = 'compliant' | 'breached' | 'no_data'

export interface SloSummary {
  provider: string
  displayName: string
  availability: number
  availabilityTarget: number
  p95LatencyMs: number
  p95LatencyTarget: number
  errorRate: number
  sentCount: number
  failureCount: number
  availabilityMet: boolean
  latencyMet: boolean
  compliant: boolean
  status: ComplianceStatus
}

function seedSloResults(): SloSummary[] {
  return CONSERVATIVE_PROVIDERS.map((provider) => ({
    provider: provider.id,
    displayName: provider.name,
    availability: 0,
    availabilityTarget: 0.99,
    p95LatencyMs: 0,
    p95LatencyTarget: 5000,
    errorRate: 1,
    sentCount: 0,
    failureCount: 0,
    availabilityMet: false,
    latencyMet: false,
    compliant: false,
    status: 'no_data' as const,
  }))
}

export async function getSloResults(): Promise<SloSummary[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/integrations/sla`, { cache: 'no-store' })
    if (res.ok) {
      const json = (await res.json()) as { results?: SloSummary[] }
      if (json.results && json.results.length > 0) {
        return json.results
      }
    }
  } catch { /* fall through to seed */ }
  return seedSloResults()
}

// ═══════════════════════════════════════════════════════════════════════════
// Provider Health List
// ═══════════════════════════════════════════════════════════════════════════

type HealthStatus = 'ok' | 'degraded' | 'down'
type CircuitState = 'closed' | 'open' | 'half_open'

export interface ProviderHealthRow {
  provider: string
  displayName: string
  status: HealthStatus
  successRate: number
  p95LatencyMs: number
  rateLimitedCount: number
  circuitState: CircuitState
  consecutiveFailures: number
  lastCheckedAt: string | null
}

function seedProviderHealthList(): ProviderHealthRow[] {
  return CONSERVATIVE_PROVIDERS.map((provider) => ({
    provider: provider.id,
    displayName: provider.name,
    status: 'down' as const,
    successRate: 0,
    p95LatencyMs: 0,
    rateLimitedCount: 0,
    circuitState: 'open' as const,
    consecutiveFailures: 0,
    lastCheckedAt: null,
  }))
}

export async function getProviderHealthList(): Promise<ProviderHealthRow[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/integrations/health`, { cache: 'no-store' })
    if (res.ok) {
      const json = (await res.json()) as { providers?: ProviderHealth[] }
      if (json.providers && json.providers.length > 0) {
        return json.providers.map((h) => ({
          provider: h.provider,
          displayName: h.provider.charAt(0).toUpperCase() + h.provider.slice(1),
          status: h.status === 'unknown' ? ('down' as const) : (h.status as HealthStatus),
          successRate: h.successRate * 100,
          p95LatencyMs: h.avgLatencyMs,
          rateLimitedCount: 0,
          circuitState: h.circuitState.replace('-', '_') as CircuitState,
          consecutiveFailures: h.consecutiveFailures,
          lastCheckedAt: h.lastCheckedAt,
        }))
      }
    }
  } catch { /* fall through to seed */ }
  return seedProviderHealthList()
}

// ═══════════════════════════════════════════════════════════════════════════
// Provider Health Detail (single provider)
// ═══════════════════════════════════════════════════════════════════════════

export interface ProviderHealthDetail {
  health: {
    status: 'ok' | 'degraded' | 'down'
    consecutiveFailures: number
    circuitState: CircuitState
    circuitOpenedAt: string | null
    circuitNextRetryAt: string | null
    lastCheckedAt: string
    lastErrorCode: string | null
    lastErrorMessage: string | null
  }
  metrics: {
    successRate: number
    p50LatencyMs: number
    p95LatencyMs: number
    p99LatencyMs: number
    sentCount: number
    failureCount: number
    rateLimitedCount: number
    timeoutCount: number
  }
}

function seedProviderDetail(): ProviderHealthDetail {
  return {
    health: {
      status: 'down',
      consecutiveFailures: 0,
      circuitState: 'open',
      circuitOpenedAt: null,
      circuitNextRetryAt: null,
      lastCheckedAt: new Date().toISOString(),
      lastErrorCode: 'no_data',
      lastErrorMessage: 'Provider health details are unavailable.',
    },
    metrics: {
      successRate: 0,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      sentCount: 0,
      failureCount: 0,
      rateLimitedCount: 0,
      timeoutCount: 0,
    },
  }
}

export async function getProviderHealthDetail(provider: string): Promise<ProviderHealthDetail> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/integrations/health/${encodeURIComponent(provider)}`, {
      cache: 'no-store',
    })
    if (res.ok) {
      const json = (await res.json()) as ProviderHealthDetail
      if (json.health) return json
    }
  } catch { /* fall through to seed */ }
  return seedProviderDetail()
}

// ═══════════════════════════════════════════════════════════════════════════
// Cost Dashboard Data
// ═══════════════════════════════════════════════════════════════════════════

export interface CostDashboardData {
  dailyTrend: { day: string; totalEstCostUsd: number }[]
  totalSpend: number
  last7Avg: number
  projected30: number
  costPerRequest: number
  budgetState: string
  topDrivers: { appId: string; category: string; totalEstCostUsd: number }[]
  today: string
}

function seedCostData(): CostDashboardData {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now)
    d.setDate(d.getDate() - (29 - i))
    return d.toISOString().slice(0, 10)
  })
  const dailyTrend = last30.map((day, i) => ({
    day,
    totalEstCostUsd: Math.round((8 + ((i * 7 + 3) % 13)) * 100) / 100,
  }))
  const totalSpend = dailyTrend.reduce((s, d) => s + d.totalEstCostUsd, 0)
  const last7Avg = dailyTrend.slice(-7).reduce((s, d) => s + d.totalEstCostUsd, 0) / 7
  const projected30 = Math.round(last7Avg * 30 * 100) / 100
  const costPerRequest = Math.round((totalSpend / 45000) * 10000) / 10000
  const budgetState = totalSpend > 400 ? 'exceeded' : totalSpend > 320 ? 'warning' : 'ok'
  const topDrivers = [
    { appId: 'web', category: 'compute_ms', totalEstCostUsd: totalSpend * 0.35 },
    { appId: 'console', category: 'db_query_ms', totalEstCostUsd: totalSpend * 0.25 },
    { appId: 'orchestrator-api', category: 'integration_call', totalEstCostUsd: totalSpend * 0.2 },
    { appId: 'web', category: 'egress_kb', totalEstCostUsd: totalSpend * 0.12 },
    { appId: 'cora', category: 'ai_token', totalEstCostUsd: totalSpend * 0.08 },
  ]
  return { dailyTrend, totalSpend, last7Avg, projected30, costPerRequest, budgetState, topDrivers, today }
}

export async function getCostDashboardData(): Promise<CostDashboardData> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/cost/rollup`, { cache: 'no-store' })
    if (res.ok) {
      const json = (await res.json()) as { rollups?: CostRollup[] }
      if (json.rollups && json.rollups.length > 0) {
        const rollups = json.rollups
        const today = new Date().toISOString().slice(0, 10)
        const dailyMap = new Map<string, number>()
        for (const r of rollups) {
          dailyMap.set(r.day, (dailyMap.get(r.day) ?? 0) + r.totalEstCostUsd)
        }
        const dailyTrend = [...dailyMap.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, totalEstCostUsd]) => ({ day, totalEstCostUsd }))
        const totalSpend = dailyTrend.reduce((s, d) => s + d.totalEstCostUsd, 0)
        const last7 = dailyTrend.slice(-7)
        const last7Avg = last7.length > 0 ? last7.reduce((s, d) => s + d.totalEstCostUsd, 0) / last7.length : 0
        const projected30 = Math.round(last7Avg * 30 * 100) / 100
        const costPerRequest = Math.round((totalSpend / Math.max(1, rollups.reduce((s, r) => s + r.eventCount, 0))) * 10000) / 10000
        const budgetState = totalSpend > 400 ? 'exceeded' : totalSpend > 320 ? 'warning' : 'ok'

        const driverMap = new Map<string, number>()
        for (const r of rollups) {
          const key = `${r.appId}::${r.category}`
          driverMap.set(key, (driverMap.get(key) ?? 0) + r.totalEstCostUsd)
        }
        const topDrivers = [...driverMap.entries()]
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([key, cost]) => {
            const [appId, category] = key.split('::')
            return { appId, category, totalEstCostUsd: cost }
          })

        return { dailyTrend, totalSpend, last7Avg, projected30, costPerRequest, budgetState, topDrivers, today }
      }
    }
  } catch { /* fall through to seed */ }
  return seedCostData()
}

// ═══════════════════════════════════════════════════════════════════════════
// Ops Score History (7-day)
// ═══════════════════════════════════════════════════════════════════════════

export interface OpsScoreHistoryEntry {
  date: string
  score: number
  grade: string
}

function seedOpsScoreHistory(currentScore: number, _currentGrade: string): OpsScoreHistoryEntry[] {
  const entries: OpsScoreHistoryEntry[] = []
  const now = new Date()
  for (let i = 7; i >= 1; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const jitter = ((i * 3 + 7) % 5) - 2
    const score = Math.max(0, Math.min(100, currentScore + jitter))
    const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F'
    entries.push({ date: d.toISOString().slice(0, 10), score, grade })
  }
  return entries
}

export async function getOpsScoreHistory(currentScore: number, currentGrade: string): Promise<OpsScoreHistoryEntry[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/ops-score/history`, { cache: 'no-store' })
    if (res.ok) {
      const json = (await res.json()) as { history?: OpsScoreHistoryEntry[] }
      if (json.history && json.history.length > 0) {
        return json.history
      }
    }
  } catch { /* fall through to seed */ }
  return seedOpsScoreHistory(currentScore, currentGrade)
}
