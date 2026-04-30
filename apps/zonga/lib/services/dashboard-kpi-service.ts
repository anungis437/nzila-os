/**
 * Dashboard KPI service — Zonga.
 *
 * Centralizes the KPI roll-ups exposed in admin/operations and revenue
 * dashboards, attaches a provenance envelope (data sources, time window,
 * cache hit/miss), and serves results through a Redis cache with an
 * in-memory fallback. Mirror of `apps/union-eyes/lib/services/dashboard-kpi-service.ts`
 * adapted to the music-distribution domain.
 */
import { cacheGet, cacheSet } from '@/lib/services/cache-service'
import {
  getUploadHealthPanel,
  getModerationQueuePanel,
  getPayoutQueuePanel,
  getTakedownPanel,
  type UploadHealthPanel,
  type ModerationQueuePanel,
  type PayoutQueuePanel,
  type TakedownPanel,
} from '@/features/admin/observability-dashboard'

export type DashboardTimeframe = 'daily' | 'weekly' | 'monthly'

const CACHE_NAMESPACE = 'dashboard-kpis'
const CACHE_VERSION = 'v1'
const OPERATIONS_TTL_SECONDS = 120

interface CacheProvenance {
  namespace: string
  key: string
  ttlSeconds: number
  hit: boolean
}

export interface DashboardProvenance {
  version: string
  generatedAt: string
  window: {
    timeframe: DashboardTimeframe
    start: string
    end: string
  }
  sources: Array<{
    table: string
    rowCount: number
    organizationScoped: boolean
  }>
  cache: CacheProvenance
}

export interface OperationsDashboardPayload {
  upload: UploadHealthPanel
  moderation: ModerationQueuePanel
  payouts: PayoutQueuePanel
  takedowns: TakedownPanel
  totals: {
    openWorkItems: number
    failedJobs: number
    payoutsAwaiting: number
  }
  provenance: DashboardProvenance
}

function resolveWindow(timeframe: DashboardTimeframe, now: Date) {
  const end = now
  const start = new Date(end)
  switch (timeframe) {
    case 'daily':
      start.setUTCDate(start.getUTCDate() - 1)
      break
    case 'weekly':
      start.setUTCDate(start.getUTCDate() - 7)
      break
    case 'monthly':
      start.setUTCMonth(start.getUTCMonth() - 1)
      break
  }
  return { start, end }
}

function reviveProvenanceWithCacheHit(payload: OperationsDashboardPayload): OperationsDashboardPayload {
  return {
    ...payload,
    provenance: {
      ...payload.provenance,
      cache: { ...payload.provenance.cache, hit: true },
    },
  }
}

export async function getZongaOperationsDashboard(args: {
  organizationId: string
  timeframe?: DashboardTimeframe
  now?: Date
}): Promise<OperationsDashboardPayload> {
  const timeframe = args.timeframe ?? 'weekly'
  const now = args.now ?? new Date()
  const cacheKey = `operations:${args.organizationId}:${timeframe}:${CACHE_VERSION}`

  const cached = await cacheGet<OperationsDashboardPayload>(cacheKey, {
    namespace: CACHE_NAMESPACE,
  })
  if (cached) {
    return reviveProvenanceWithCacheHit(cached)
  }

  const [upload, moderation, payouts, takedowns] = await Promise.all([
    getUploadHealthPanel(args.organizationId),
    getModerationQueuePanel(args.organizationId),
    getPayoutQueuePanel(args.organizationId),
    getTakedownPanel(args.organizationId),
  ])

  const window = resolveWindow(timeframe, now)
  const totals = {
    openWorkItems:
      upload.pendingJobs +
      upload.processingJobs +
      moderation.pendingReview +
      payouts.pendingRequests +
      takedowns.activeRequests,
    failedJobs: upload.failedJobs,
    payoutsAwaiting: payouts.pendingRequests + payouts.approvedAwaitingProcessing,
  }

  const payload: OperationsDashboardPayload = {
    upload,
    moderation,
    payouts,
    takedowns,
    totals,
    provenance: {
      version: CACHE_VERSION,
      generatedAt: now.toISOString(),
      window: {
        timeframe,
        start: window.start.toISOString(),
        end: window.end.toISOString(),
      },
      sources: [
        { table: 'zonga_upload_jobs', rowCount: upload.stuckJobs.length, organizationScoped: true },
        {
          table: 'zonga_content_assets',
          rowCount: moderation.pendingReview,
          organizationScoped: true,
        },
        {
          table: 'zonga_payout_requests',
          rowCount:
            payouts.pendingRequests +
            payouts.approvedAwaitingProcessing +
            payouts.processingNow,
          organizationScoped: true,
        },
        {
          table: 'zonga_takedown_requests',
          rowCount: takedowns.activeRequests,
          organizationScoped: true,
        },
      ],
      cache: {
        namespace: CACHE_NAMESPACE,
        key: cacheKey,
        ttlSeconds: OPERATIONS_TTL_SECONDS,
        hit: false,
      },
    },
  }

  await cacheSet(cacheKey, payload, {
    namespace: CACHE_NAMESPACE,
    ttl: OPERATIONS_TTL_SECONDS,
  })

  return payload
}
