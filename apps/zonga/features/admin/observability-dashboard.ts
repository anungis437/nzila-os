/**
 * Zonga — Operational Observability Service
 *
 * Admin dashboards for platform health, upload queue,
 * moderation queue, payout queue, and content integrity.
 */

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'

// ── Upload Health ───────────────────────────────────────────────────────────

export interface UploadHealthPanel {
  pendingJobs: number
  processingJobs: number
  failedJobs: number
  completedLast24h: number
  avgProcessingTimeMs: number
  stuckJobs: Array<{
    jobId: string
    contentAssetId: string
    profile: string
    startedAt: Date
  }>
}

export async function getUploadHealthPanel(orgId: string): Promise<UploadHealthPanel> {
  const statsRows = await platformDb.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending')::int as pending,
      COUNT(*) FILTER (WHERE status = 'processing')::int as processing,
      COUNT(*) FILTER (WHERE status = 'failed')::int as failed,
      COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= now() - interval '24 hours')::int as completed_24h,
      COALESCE(
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)
        FILTER (WHERE status = 'completed'),
        0
      )::int as avg_processing_ms
    FROM zonga_upload_jobs
    WHERE org_id = ${orgId}
  `)
  const stats = (statsRows as unknown as Array<Record<string, unknown>>)[0]!

  // Stuck jobs: processing for >30 minutes
  const stuckRows = await platformDb.execute(sql`
    SELECT id, content_asset_id, profile, started_at
    FROM zonga_upload_jobs
    WHERE org_id = ${orgId}
      AND status = 'processing'
      AND started_at < now() - interval '30 minutes'
    ORDER BY started_at
    LIMIT 20
  `)

  return {
    pendingJobs: stats.pending as number,
    processingJobs: stats.processing as number,
    failedJobs: stats.failed as number,
    completedLast24h: stats.completed_24h as number,
    avgProcessingTimeMs: stats.avg_processing_ms as number,
    stuckJobs: (stuckRows as unknown as Array<Record<string, unknown>>).map((r) => ({
      jobId: r.id as string,
      contentAssetId: r.content_asset_id as string,
      profile: r.profile as string,
      startedAt: new Date(r.started_at as string),
    })),
  }
}

// ── Moderation Queue Panel ──────────────────────────────────────────────────

export interface ModerationQueuePanel {
  pendingReview: number
  approvedToday: number
  rejectedToday: number
  escalatedOpen: number
  avgReviewTimeHours: number
  oldestPendingAge: string
}

export async function getModerationQueuePanel(orgId: string): Promise<ModerationQueuePanel> {
  const rows = await platformDb.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM zonga_content_assets
       WHERE org_id = ${orgId} AND status = 'ready_for_review') as pending,
      (SELECT COUNT(*)::int FROM zonga_moderation_decisions
       WHERE org_id = ${orgId} AND verdict = 'approved' AND created_at >= CURRENT_DATE) as approved_today,
      (SELECT COUNT(*)::int FROM zonga_moderation_decisions
       WHERE org_id = ${orgId} AND verdict = 'rejected' AND created_at >= CURRENT_DATE) as rejected_today,
      (SELECT COUNT(*)::int FROM zonga_moderation_decisions
       WHERE org_id = ${orgId} AND verdict = 'escalated'
       AND NOT EXISTS (
         SELECT 1 FROM zonga_moderation_decisions md2
         WHERE md2.content_id = zonga_moderation_decisions.content_id
           AND md2.verdict IN ('approved', 'rejected')
           AND md2.created_at > zonga_moderation_decisions.created_at
       )) as escalated_open,
      COALESCE(
        (SELECT EXTRACT(EPOCH FROM (MIN(now() - updated_at))) / 3600
         FROM zonga_content_assets
         WHERE org_id = ${orgId} AND status = 'ready_for_review'),
        0
      )::numeric as oldest_pending_hours
  `)
  const r = (rows as unknown as Array<Record<string, unknown>>)[0]!

  const pendingHrs = Number(r.oldest_pending_hours ?? 0)

  return {
    pendingReview: r.pending as number,
    approvedToday: r.approved_today as number,
    rejectedToday: r.rejected_today as number,
    escalatedOpen: r.escalated_open as number,
    avgReviewTimeHours: 0, // requires timestamp pairing across tables
    oldestPendingAge: pendingHrs > 24
      ? `${Math.round(pendingHrs / 24)}d`
      : `${Math.round(pendingHrs)}h`,
  }
}

// ── Payout Queue Panel ──────────────────────────────────────────────────────

export interface PayoutQueuePanel {
  pendingRequests: number
  approvedAwaitingProcessing: number
  processingNow: number
  completedThisMonth: number
  totalPayoutsThisMonth: number
  failedThisMonth: number
}

export async function getPayoutQueuePanel(orgId: string): Promise<PayoutQueuePanel> {
  const rows = await platformDb.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'requested')::int as pending,
      COUNT(*) FILTER (WHERE status = 'approved')::int as approved,
      COUNT(*) FILTER (WHERE status = 'processing')::int as processing,
      COUNT(*) FILTER (WHERE status = 'completed' AND processed_at >= date_trunc('month', now()))::int as completed_month,
      COALESCE(SUM(amount) FILTER (WHERE status = 'completed' AND processed_at >= date_trunc('month', now())), 0)::numeric as total_month,
      COUNT(*) FILTER (WHERE status = 'failed' AND updated_at >= date_trunc('month', now()))::int as failed_month
    FROM zonga_payout_requests
    WHERE org_id = ${orgId}
  `)
  const r = (rows as unknown as Array<Record<string, unknown>>)[0]!

  return {
    pendingRequests: r.pending as number,
    approvedAwaitingProcessing: r.approved as number,
    processingNow: r.processing as number,
    completedThisMonth: r.completed_month as number,
    totalPayoutsThisMonth: Number(r.total_month),
    failedThisMonth: r.failed_month as number,
  }
}

// ── Takedown Panel ──────────────────────────────────────────────────────────

export interface TakedownPanel {
  activeRequests: number
  enforcedTotal: number
  counterFiledPending: number
  avgResolutionDays: number
}

export async function getTakedownPanel(orgId: string): Promise<TakedownPanel> {
  const rows = await platformDb.execute(sql`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('requested', 'under_review'))::int as active,
      COUNT(*) FILTER (WHERE status = 'enforced')::int as enforced,
      COUNT(*) FILTER (WHERE status = 'counter_filed')::int as counter_filed,
      COALESCE(
        AVG(EXTRACT(EPOCH FROM (COALESCE(enforced_at, updated_at) - created_at)) / 86400)
        FILTER (WHERE status IN ('enforced', 'resolved')),
        0
      )::numeric as avg_resolution_days
    FROM zonga_takedown_requests
    WHERE org_id = ${orgId}
  `)
  const r = (rows as unknown as Array<Record<string, unknown>>)[0]!

  return {
    activeRequests: r.active as number,
    enforcedTotal: r.enforced as number,
    counterFiledPending: r.counter_filed as number,
    avgResolutionDays: Math.round(Number(r.avg_resolution_days)),
  }
}

// ── Combined Admin Dashboard ────────────────────────────────────────────────

export interface AdminDashboard {
  upload: UploadHealthPanel
  moderation: ModerationQueuePanel
  payouts: PayoutQueuePanel
  takedowns: TakedownPanel
}

export async function getAdminDashboard(orgId: string): Promise<AdminDashboard> {
  const [upload, moderation, payouts, takedowns] = await Promise.all([
    getUploadHealthPanel(orgId),
    getModerationQueuePanel(orgId),
    getPayoutQueuePanel(orgId),
    getTakedownPanel(orgId),
  ])

  return { upload, moderation, payouts, takedowns }
}
