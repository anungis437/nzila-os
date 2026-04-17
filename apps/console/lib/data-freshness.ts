import 'server-only'

import fs from 'node:fs'
import path from 'node:path'
import { platformDb } from '@nzila/db/platform'
import {
  auditEvents,
  commerceQuotes,
  executionInitiatives,
  platformCostRollups,
  platformIntegrationConnections,
  qboConnections,
  qboSyncRuns,
  stripeConnections,
  treasurySnapshots,
} from '@nzila/db/schema'
import { and, desc, eq } from 'drizzle-orm'

export interface FreshnessModule {
  module: string
  source: string
  lastSyncAt: Date | null
  lagHours: number | null
  score: number
  status: 'fresh' | 'aging' | 'stale' | 'unknown'
}

export interface DataFreshnessSummary {
  overallScore: number
  modules: FreshnessModule[]
}

function toDate(value: string | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function lagHours(date: Date | null): number | null {
  if (!date) return null
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 3600000))
}

function lagToScore(hours: number | null): number {
  if (hours == null) return 0
  if (hours <= 24) return 100
  if (hours <= 72) return 75
  if (hours <= 168) return 50
  return 20
}

function lagToStatus(hours: number | null): FreshnessModule['status'] {
  if (hours == null) return 'unknown'
  if (hours <= 24) return 'fresh'
  if (hours <= 72) return 'aging'
  return 'stale'
}

function fromEnv(module: string, source: string, variable: string): FreshnessModule {
  const date = toDate(process.env[variable])
  const lag = lagHours(date)
  return {
    module,
    source,
    lastSyncAt: date,
    lagHours: lag,
    score: lagToScore(lag),
    status: lagToStatus(lag),
  }
}

function readGaTimestamp(): Date | null {
  try {
    const filePath = path.join(process.cwd(), '../../governance/ga/ga-check.json')
    if (!fs.existsSync(filePath)) return null
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { timestamp?: string }
    return toDate(parsed.timestamp)
  } catch {
    return null
  }
}

export async function getDataFreshnessSummary(): Promise<DataFreshnessSummary> {
  const [
    latestCost,
    latestTreasury,
    latestQuotes,
    latestExecution,
    latestAudit,
    latestQboConnection,
    latestQboSync,
    latestStripe,
    latestM365Validation,
    latestGoogleValidation,
  ] = await Promise.all([
    platformDb.select({ last: platformCostRollups.day }).from(platformCostRollups).orderBy(desc(platformCostRollups.day)).limit(1),
    platformDb.select({ last: treasurySnapshots.date }).from(treasurySnapshots).orderBy(desc(treasurySnapshots.date)).limit(1),
    platformDb.select({ last: commerceQuotes.createdAt }).from(commerceQuotes).orderBy(desc(commerceQuotes.createdAt)).limit(1),
    platformDb.select({ last: executionInitiatives.updatedAt }).from(executionInitiatives).orderBy(desc(executionInitiatives.updatedAt)).limit(1),
    platformDb.select({ last: auditEvents.createdAt }).from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(1),
    platformDb
      .select({ last: qboConnections.connectedAt })
      .from(qboConnections)
      .where(eq(qboConnections.isActive, true))
      .orderBy(desc(qboConnections.connectedAt))
      .limit(1),
    platformDb
      .select({ last: qboSyncRuns.completedAt })
      .from(qboSyncRuns)
      .orderBy(desc(qboSyncRuns.completedAt))
      .limit(1),
    platformDb
      .select({ last: stripeConnections.lastEventAt, connectedAt: stripeConnections.connectedAt })
      .from(stripeConnections)
      .orderBy(desc(stripeConnections.updatedAt))
      .limit(1),
    platformDb
      .select({ last: platformIntegrationConnections.lastValidatedAt })
      .from(platformIntegrationConnections)
      .where(
        and(
          eq(platformIntegrationConnections.provider, 'm365'),
          eq(platformIntegrationConnections.status, 'connected'),
        ),
      )
      .orderBy(desc(platformIntegrationConnections.lastValidatedAt))
      .limit(1),
    platformDb
      .select({ last: platformIntegrationConnections.lastValidatedAt })
      .from(platformIntegrationConnections)
      .where(
        and(
          eq(platformIntegrationConnections.provider, 'google-workspace'),
          eq(platformIntegrationConnections.status, 'connected'),
        ),
      )
      .orderBy(desc(platformIntegrationConnections.lastValidatedAt))
      .limit(1),
  ])

  const gaDate = readGaTimestamp()

  const modules: FreshnessModule[] = [
    {
      module: 'Capital',
      source: 'platformCostRollups',
      lastSyncAt: latestCost[0]?.last ? new Date(String(latestCost[0].last)) : null,
      lagHours: lagHours(latestCost[0]?.last ? new Date(String(latestCost[0].last)) : null),
      score: lagToScore(lagHours(latestCost[0]?.last ? new Date(String(latestCost[0].last)) : null)),
      status: lagToStatus(lagHours(latestCost[0]?.last ? new Date(String(latestCost[0].last)) : null)),
    },
    {
      module: 'Treasury',
      source: 'treasurySnapshots',
      lastSyncAt: latestTreasury[0]?.last ? new Date(String(latestTreasury[0].last)) : null,
      lagHours: lagHours(latestTreasury[0]?.last ? new Date(String(latestTreasury[0].last)) : null),
      score: lagToScore(lagHours(latestTreasury[0]?.last ? new Date(String(latestTreasury[0].last)) : null)),
      status: lagToStatus(lagHours(latestTreasury[0]?.last ? new Date(String(latestTreasury[0].last)) : null)),
    },
    {
      module: 'Revenue Pipeline',
      source: 'commerceQuotes',
      lastSyncAt: latestQuotes[0]?.last ?? null,
      lagHours: lagHours(latestQuotes[0]?.last ?? null),
      score: lagToScore(lagHours(latestQuotes[0]?.last ?? null)),
      status: lagToStatus(lagHours(latestQuotes[0]?.last ?? null)),
    },
    {
      module: 'Execution',
      source: 'executionInitiatives',
      lastSyncAt: latestExecution[0]?.last ?? null,
      lagHours: lagHours(latestExecution[0]?.last ?? null),
      score: lagToScore(lagHours(latestExecution[0]?.last ?? null)),
      status: lagToStatus(lagHours(latestExecution[0]?.last ?? null)),
    },
    {
      module: 'Governance',
      source: 'auditEvents',
      lastSyncAt: latestAudit[0]?.last ?? null,
      lagHours: lagHours(latestAudit[0]?.last ?? null),
      score: lagToScore(lagHours(latestAudit[0]?.last ?? null)),
      status: lagToStatus(lagHours(latestAudit[0]?.last ?? null)),
    },
    {
      module: 'Repo Validators',
      source: 'governance/ga/ga-check.json',
      lastSyncAt: gaDate,
      lagHours: lagHours(gaDate),
      score: lagToScore(lagHours(gaDate)),
      status: lagToStatus(lagHours(gaDate)),
    },
    {
      module: 'QuickBooks',
      source: 'qbo_connections/qbo_sync_runs',
      lastSyncAt: latestQboSync[0]?.last ?? latestQboConnection[0]?.last ?? null,
      lagHours: lagHours(latestQboSync[0]?.last ?? latestQboConnection[0]?.last ?? null),
      score: lagToScore(lagHours(latestQboSync[0]?.last ?? latestQboConnection[0]?.last ?? null)),
      status: lagToStatus(lagHours(latestQboSync[0]?.last ?? latestQboConnection[0]?.last ?? null)),
    },
    {
      module: 'Stripe',
      source: 'stripe_connections',
      lastSyncAt: latestStripe[0]?.last ?? latestStripe[0]?.connectedAt ?? null,
      lagHours: lagHours(latestStripe[0]?.last ?? latestStripe[0]?.connectedAt ?? null),
      score: lagToScore(lagHours(latestStripe[0]?.last ?? latestStripe[0]?.connectedAt ?? null)),
      status: lagToStatus(lagHours(latestStripe[0]?.last ?? latestStripe[0]?.connectedAt ?? null)),
    },
    fromEnv('Gmail Pipeline', 'adapter', 'GMAIL_PIPELINE_LAST_SYNC_AT'),
    fromEnv('GitHub Progress', 'adapter', 'GITHUB_PROGRESS_LAST_SYNC_AT'),
    {
      module: 'Calendar Commitments',
      source: 'platform_integration_connections(m365)',
      lastSyncAt: latestM365Validation[0]?.last ?? null,
      lagHours: lagHours(latestM365Validation[0]?.last ?? null),
      score: lagToScore(lagHours(latestM365Validation[0]?.last ?? null)),
      status: lagToStatus(lagHours(latestM365Validation[0]?.last ?? null)),
    },
    {
      module: 'Notion Tasks',
      source: 'platform_integration_connections(google-workspace)',
      lastSyncAt: latestGoogleValidation[0]?.last ?? null,
      lagHours: lagHours(latestGoogleValidation[0]?.last ?? null),
      score: lagToScore(lagHours(latestGoogleValidation[0]?.last ?? null)),
      status: lagToStatus(lagHours(latestGoogleValidation[0]?.last ?? null)),
    },
  ]

  const measured = modules.filter((module) => module.score > 0)
  const overallScore = measured.length > 0
    ? Math.round(measured.reduce((sum, module) => sum + module.score, 0) / measured.length)
    : 0

  return { overallScore, modules }
}
