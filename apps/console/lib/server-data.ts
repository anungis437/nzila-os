/**
 * Console — Server-side Data Layer
 *
 * Centralised data access for all Console dashboard pages.
 * Every function tries the live platform package API first,
 * then falls back to deterministic seed data for dev / first-boot.
 *
 * @module console/server-data
 */
import 'server-only'

import { providerRegistry, type ProviderManifest } from '@nzila/platform-marketplace'
import type { ProviderHealth } from '@nzila/platform-integrations-control-plane'
import type { CostRollup } from '@nzila/platform-cost'

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
  return [
    { id: 'slack', name: 'Slack', category: 'chatops', version: '1.0.0', description: 'Push audit, compliance, and alert notifications to Slack channels.', installed: true, status: 'active', scopes: ['chat:write', 'channels:read', 'users:read'], requiredSecrets: ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET'], retryAttempts: 3, lastHealthCheck: '2 minutes ago' },
    { id: 'hubspot', name: 'HubSpot', category: 'crm', version: '1.0.0', description: 'Sync contacts, deals, and pipeline data with HubSpot CRM.', installed: true, status: 'active', scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.deals.read', 'crm.objects.deals.write'], requiredSecrets: ['HUBSPOT_ACCESS_TOKEN', 'HUBSPOT_PORTAL_ID'], retryAttempts: 5, lastHealthCheck: '5 minutes ago' },
    { id: 'azure-blob', name: 'Azure Blob Storage', category: 'storage', version: '1.0.0', description: 'Sovereign data storage with PIPEDA-compliant residency.', installed: false, status: 'inactive', scopes: ['blob.read', 'blob.write', 'container.list'], requiredSecrets: ['AZURE_STORAGE_CONNECTION_STRING'], retryAttempts: 3, lastHealthCheck: 'N/A' },
    { id: 'stripe', name: 'Stripe Payments', category: 'payments', version: '1.0.0', description: 'Process payments with full audit trail and evidence capture.', installed: false, status: 'inactive', scopes: ['charges.read', 'charges.write', 'refunds.write'], requiredSecrets: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'], retryAttempts: 3, lastHealthCheck: 'N/A' },
  ]
}

function manifestToProvider(m: ProviderManifest): MarketplaceProvider {
  return {
    id: m.providerKey,
    name: m.name,
    category: m.category,
    version: m.version,
    description: m.description,
    installed: true,
    status: 'active',
    scopes: [...m.scopes],
    requiredSecrets: m.requiredSecrets.map((s) => s.key),
    retryAttempts: m.retryPolicy.maxAttempts,
    lastHealthCheck: 'Live',
  }
}

export async function getMarketplaceProviders(): Promise<MarketplaceProvider[]> {
  try {
    const manifests = providerRegistry.list()
    if (manifests.length > 0) {
      return manifests.map(manifestToProvider)
    }
  } catch { /* fall through to seed */ }
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
  return [
    { providerId: 'stripe', orgId: 'org_acme', status: 'healthy', lastCheckedAt: '2026-03-04T12:00:00Z', webhookVerified: true, rateLimitUsage: 0.34, dlqDepth: 0 },
    { providerId: 'hubspot', orgId: 'org_acme', status: 'degraded', lastCheckedAt: '2026-03-04T11:55:00Z', webhookVerified: true, rateLimitUsage: 0.72, dlqDepth: 3 },
    { providerId: 'qbo', orgId: 'org_acme', status: 'healthy', lastCheckedAt: '2026-03-04T12:01:00Z', webhookVerified: true, rateLimitUsage: 0.18, dlqDepth: 0 },
    { providerId: 'xero', orgId: 'org_beta', status: 'down', lastCheckedAt: '2026-03-04T10:30:00Z', webhookVerified: false, rateLimitUsage: 0.0, dlqDepth: 12 },
    { providerId: 'stripe', orgId: 'org_beta', status: 'healthy', lastCheckedAt: '2026-03-04T12:02:00Z', webhookVerified: true, rateLimitUsage: 0.45, dlqDepth: 0 },
  ]
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
  return [
    { entryId: 'dlq_001', providerId: 'hubspot', orgId: 'org_acme', eventType: 'CONTACT_SYNC', failedAt: '2026-03-04T11:52:00Z', retryCount: 3, lastError: 'HTTP 429 — rate limited' },
    { entryId: 'dlq_002', providerId: 'hubspot', orgId: 'org_acme', eventType: 'DEAL_UPDATE', failedAt: '2026-03-04T11:53:00Z', retryCount: 2, lastError: 'HTTP 429 — rate limited' },
    { entryId: 'dlq_003', providerId: 'hubspot', orgId: 'org_acme', eventType: 'CONTACT_SYNC', failedAt: '2026-03-04T11:54:00Z', retryCount: 1, lastError: 'HTTP 500 — internal server error' },
    { entryId: 'dlq_004', providerId: 'xero', orgId: 'org_beta', eventType: 'INVOICE_CREATE', failedAt: '2026-03-04T10:20:00Z', retryCount: 5, lastError: 'Connection refused' },
    { entryId: 'dlq_005', providerId: 'xero', orgId: 'org_beta', eventType: 'INVOICE_CREATE', failedAt: '2026-03-04T10:21:00Z', retryCount: 5, lastError: 'Connection refused' },
    { entryId: 'dlq_006', providerId: 'xero', orgId: 'org_beta', eventType: 'PAYMENT_SYNC', failedAt: '2026-03-04T10:22:00Z', retryCount: 4, lastError: 'Connection refused' },
    { entryId: 'dlq_007', providerId: 'xero', orgId: 'org_beta', eventType: 'INVOICE_CREATE', failedAt: '2026-03-04T10:23:00Z', retryCount: 5, lastError: 'Connection refused' },
    { entryId: 'dlq_008', providerId: 'xero', orgId: 'org_beta', eventType: 'CONTACT_UPDATE', failedAt: '2026-03-04T10:24:00Z', retryCount: 3, lastError: 'Connection refused' },
    { entryId: 'dlq_009', providerId: 'xero', orgId: 'org_beta', eventType: 'INVOICE_CREATE', failedAt: '2026-03-04T10:25:00Z', retryCount: 5, lastError: 'Connection refused' },
    { entryId: 'dlq_010', providerId: 'xero', orgId: 'org_beta', eventType: 'PAYMENT_SYNC', failedAt: '2026-03-04T10:26:00Z', retryCount: 4, lastError: 'Connection refused' },
    { entryId: 'dlq_011', providerId: 'xero', orgId: 'org_beta', eventType: 'INVOICE_CREATE', failedAt: '2026-03-04T10:27:00Z', retryCount: 5, lastError: 'Connection refused' },
    { entryId: 'dlq_012', providerId: 'xero', orgId: 'org_beta', eventType: 'CONTACT_UPDATE', failedAt: '2026-03-04T10:28:00Z', retryCount: 3, lastError: 'Connection refused' },
  ]
}

export async function getDlqEntries(): Promise<DlqRow[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/integrations/dlq`, { cache: 'no-store' })
    if (res.ok) {
      const json = (await res.json()) as { entries?: DlqRow[] }
      if (json.entries && json.entries.length > 0) {
        return json.entries
      }
    }
  } catch { /* fall through to seed */ }
  return seedDlqEntries()
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
  return [
    { provider: 'resend', displayName: 'Resend', availability: 0.998, availabilityTarget: 0.99, p95LatencyMs: 120, p95LatencyTarget: 5000, errorRate: 0.002, sentCount: 14200, failureCount: 28, availabilityMet: true, latencyMet: true, compliant: true, status: 'compliant' },
    { provider: 'sendgrid', displayName: 'SendGrid', availability: 0.995, availabilityTarget: 0.99, p95LatencyMs: 180, p95LatencyTarget: 5000, errorRate: 0.005, sentCount: 8500, failureCount: 42, availabilityMet: true, latencyMet: true, compliant: true, status: 'compliant' },
    { provider: 'mailgun', displayName: 'Mailgun', availability: 0.997, availabilityTarget: 0.99, p95LatencyMs: 150, p95LatencyTarget: 5000, errorRate: 0.003, sentCount: 6200, failureCount: 18, availabilityMet: true, latencyMet: true, compliant: true, status: 'compliant' },
    { provider: 'twilio', displayName: 'Twilio', availability: 0.999, availabilityTarget: 0.99, p95LatencyMs: 80, p95LatencyTarget: 5000, errorRate: 0.001, sentCount: 3100, failureCount: 3, availabilityMet: true, latencyMet: true, compliant: true, status: 'compliant' },
    { provider: 'firebase', displayName: 'Firebase', availability: 0.996, availabilityTarget: 0.99, p95LatencyMs: 200, p95LatencyTarget: 5000, errorRate: 0.004, sentCount: 22000, failureCount: 88, availabilityMet: true, latencyMet: true, compliant: true, status: 'compliant' },
    { provider: 'slack', displayName: 'Slack', availability: 0.993, availabilityTarget: 0.99, p95LatencyMs: 250, p95LatencyTarget: 5000, errorRate: 0.007, sentCount: 4800, failureCount: 33, availabilityMet: true, latencyMet: true, compliant: true, status: 'compliant' },
    { provider: 'teams', displayName: 'Microsoft Teams', availability: 0.991, availabilityTarget: 0.99, p95LatencyMs: 300, p95LatencyTarget: 5000, errorRate: 0.009, sentCount: 1500, failureCount: 13, availabilityMet: true, latencyMet: true, compliant: true, status: 'compliant' },
    { provider: 'hubspot', displayName: 'HubSpot', availability: 0.988, availabilityTarget: 0.99, p95LatencyMs: 400, p95LatencyTarget: 5000, errorRate: 0.012, sentCount: 9400, failureCount: 112, availabilityMet: false, latencyMet: true, compliant: false, status: 'breached' },
  ]
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
  const now = new Date().toISOString()
  return [
    { provider: 'resend', displayName: 'Resend', status: 'ok', successRate: 99.8, p95LatencyMs: 120, rateLimitedCount: 0, circuitState: 'closed', consecutiveFailures: 0, lastCheckedAt: now },
    { provider: 'sendgrid', displayName: 'SendGrid', status: 'ok', successRate: 99.5, p95LatencyMs: 180, rateLimitedCount: 2, circuitState: 'closed', consecutiveFailures: 0, lastCheckedAt: now },
    { provider: 'mailgun', displayName: 'Mailgun', status: 'ok', successRate: 99.7, p95LatencyMs: 150, rateLimitedCount: 0, circuitState: 'closed', consecutiveFailures: 0, lastCheckedAt: now },
    { provider: 'twilio', displayName: 'Twilio', status: 'ok', successRate: 99.9, p95LatencyMs: 80, rateLimitedCount: 0, circuitState: 'closed', consecutiveFailures: 0, lastCheckedAt: now },
    { provider: 'firebase', displayName: 'Firebase', status: 'ok', successRate: 99.6, p95LatencyMs: 200, rateLimitedCount: 1, circuitState: 'closed', consecutiveFailures: 0, lastCheckedAt: now },
    { provider: 'slack', displayName: 'Slack', status: 'ok', successRate: 99.3, p95LatencyMs: 250, rateLimitedCount: 5, circuitState: 'closed', consecutiveFailures: 0, lastCheckedAt: now },
    { provider: 'teams', displayName: 'Microsoft Teams', status: 'ok', successRate: 99.1, p95LatencyMs: 300, rateLimitedCount: 1, circuitState: 'closed', consecutiveFailures: 0, lastCheckedAt: now },
    { provider: 'hubspot', displayName: 'HubSpot', status: 'ok', successRate: 98.8, p95LatencyMs: 400, rateLimitedCount: 8, circuitState: 'closed', consecutiveFailures: 0, lastCheckedAt: now },
  ]
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
      status: 'ok',
      consecutiveFailures: 0,
      circuitState: 'closed',
      circuitOpenedAt: null,
      circuitNextRetryAt: null,
      lastCheckedAt: new Date().toISOString(),
      lastErrorCode: null,
      lastErrorMessage: null,
    },
    metrics: {
      successRate: 99.5,
      p50LatencyMs: 80,
      p95LatencyMs: 180,
      p99LatencyMs: 350,
      sentCount: 1240,
      failureCount: 6,
      rateLimitedCount: 2,
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

function seedOpsScoreHistory(currentScore: number, currentGrade: string): OpsScoreHistoryEntry[] {
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
