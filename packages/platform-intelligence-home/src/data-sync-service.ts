/**
 * @nzila/platform-intelligence-home — Data Sync Service
 *
 * Tracks ingestion health for all public data sources in the
 * @nzila/platform-lakehouse catalog.
 *
 * In production: sync records would come from lh_data_source_syncs table.
 * Here: mock status overlay provides a realistic starting state.
 *
 * TODO: Replace SYNC_OVERLAY with DB queries from lh_data_source_syncs
 */
import { PUBLIC_DATA_SOURCES } from '@nzila/platform-lakehouse/catalog'
import type { DataSourceHealth, SyncHealthKpis, SyncStatus } from './types'

// ── Sync Status Overlay ───────────────────────────────────────────────────────

interface SyncOverlay {
  status: SyncStatus
  lastSyncAt: string | null
  lastSyncRecords: number
  nextScheduledAt: string | null
  errorMessage: string | null
}

// ISO date helpers relative to "now" (April 20, 2026)
const D = {
  today: '2026-04-20T06:00:00Z',
  yesterday: '2026-04-19T06:00:00Z',
  threeDaysAgo: '2026-04-17T06:00:00Z',
  weekAgo: '2026-04-13T06:00:00Z',
  twoWeeksAgo: '2026-04-06T06:00:00Z',
  monthAgo: '2026-03-20T06:00:00Z',
  tomorrow: '2026-04-21T06:00:00Z',
  nextWeek: '2026-04-27T06:00:00Z',
  nextMonth: '2026-05-20T06:00:00Z',
}

const SYNC_OVERLAYS: Record<string, SyncOverlay> = {
  'ca-open-gov-grants': {
    status: 'healthy',
    lastSyncAt: D.today,
    lastSyncRecords: 14_872,
    nextScheduledAt: D.nextMonth,
    errorMessage: null,
  },
  'ca-open-gov-contracts': {
    status: 'healthy',
    lastSyncAt: D.weekAgo,
    lastSyncRecords: 43_200,
    nextScheduledAt: D.nextMonth,
    errorMessage: null,
  },
  'ca-open-gov-datasets': {
    status: 'stale',
    lastSyncAt: D.monthAgo,
    lastSyncRecords: 2_441,
    nextScheduledAt: D.today,
    errorMessage: null,
  },
  'buyandsell-gc-ca': {
    status: 'healthy',
    lastSyncAt: D.yesterday,
    lastSyncRecords: 892,
    nextScheduledAt: D.tomorrow,
    errorMessage: null,
  },
  'ontario-gets': {
    status: 'healthy',
    lastSyncAt: D.threeDaysAgo,
    lastSyncRecords: 312,
    nextScheduledAt: D.nextWeek,
    errorMessage: null,
  },
  'esdc-labour-standards': {
    status: 'healthy',
    lastSyncAt: D.weekAgo,
    lastSyncRecords: 1_204,
    nextScheduledAt: D.nextWeek,
    errorMessage: null,
  },
  'canlii-arbitration': {
    status: 'failed',
    lastSyncAt: D.twoWeeksAgo,
    lastSyncRecords: 0,
    nextScheduledAt: null,
    errorMessage: 'HTTP 429 Too Many Requests — rate limit exceeded on CanLII API. Requires backoff + retry.',
  },
  'esdc-collective-agreements': {
    status: 'healthy',
    lastSyncAt: D.threeDaysAgo,
    lastSyncRecords: 3_812,
    nextScheduledAt: D.nextWeek,
    errorMessage: null,
  },
  'a2aj-canadian-legal-corpus': {
    status: 'never_run',
    lastSyncAt: null,
    lastSyncRecords: 0,
    nextScheduledAt: null,
    errorMessage: null,
  },
  'justice-canada-consolidated-acts': {
    status: 'healthy',
    lastSyncAt: D.weekAgo,
    lastSyncRecords: 7_204,
    nextScheduledAt: D.nextMonth,
    errorMessage: null,
  },
  'ised-corporations-canada': {
    status: 'stale',
    lastSyncAt: D.twoWeeksAgo,
    lastSyncRecords: 0,
    nextScheduledAt: D.today,
    errorMessage: null,
  },
  'ised-innovation-funding-history': {
    status: 'healthy',
    lastSyncAt: D.weekAgo,
    lastSyncRecords: 28_441,
    nextScheduledAt: D.nextMonth,
    errorMessage: null,
  },
  'factor-funding-history': {
    status: 'never_run',
    lastSyncAt: null,
    lastSyncRecords: 0,
    nextScheduledAt: null,
    errorMessage: null,
  },
  'canada-council-arts-grants': {
    status: 'healthy',
    lastSyncAt: D.weekAgo,
    lastSyncRecords: 12_044,
    nextScheduledAt: D.nextMonth,
    errorMessage: null,
  },
  'statistics-canada-cultural': {
    status: 'healthy',
    lastSyncAt: D.weekAgo,
    lastSyncRecords: 5_812,
    nextScheduledAt: D.nextMonth,
    errorMessage: null,
  },
}

// ── Service Functions ────────────────────────────────────────────────────────

export function getDataSourceHealth(): DataSourceHealth[] {
  return PUBLIC_DATA_SOURCES.map((source) => {
    const overlay = SYNC_OVERLAYS[source.id] ?? {
      status: 'never_run' as SyncStatus,
      lastSyncAt: null,
      lastSyncRecords: 0,
      nextScheduledAt: null,
      errorMessage: null,
    }

    return {
      sourceId: source.id,
      sourceName: source.name,
      category: source.category,
      status: overlay.status,
      lastSyncAt: overlay.lastSyncAt,
      lastSyncRecords: overlay.lastSyncRecords,
      nextScheduledAt: overlay.nextScheduledAt,
      errorMessage: overlay.errorMessage,
      isPublic: source.isPublic,
    } satisfies DataSourceHealth
  })
}

export function getSyncHealthKpis(): SyncHealthKpis {
  const all = getDataSourceHealth()
  const healthy = all.filter((s) => s.status === 'healthy').length
  const stale = all.filter((s) => s.status === 'stale').length
  const failed = all.filter((s) => s.status === 'failed').length
  const neverRun = all.filter((s) => s.status === 'never_run').length

  return {
    total: all.length,
    healthy,
    stale,
    failed,
    neverRun,
    healthPct: Math.round((healthy / all.length) * 100),
  }
}

export function getFailedSyncs(): DataSourceHealth[] {
  return getDataSourceHealth().filter((s) => s.status === 'failed')
}

export function getNeverRunSyncs(): DataSourceHealth[] {
  return getDataSourceHealth().filter((s) => s.status === 'never_run')
}
