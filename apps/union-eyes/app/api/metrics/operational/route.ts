/**
 * GET /api/metrics/operational
 *
 * Dedicated, read-only infrastructure measurement. An operator title or a
 * generic AI service secret never gives access. The caller must hold the
 * distinct capability credential metrics:platform_operational:read.
 * No union claim, member, grievance, case or tenant tables may be queried.
 */
import { NextResponse } from 'next/server'
import { getAllQueueStats } from '@/lib/job-queue'
import { constantTimeEquals } from '@/lib/security/constant-time'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const CAPABILITY = 'metrics:platform_operational:read'

function authenticateMetricsService(req: Request): 'allowed' | 'unconfigured' | 'denied' {
  const expected = process.env.UE_METRICS_SERVICE_KEY
  // Absence, underlength and secret re-use are configuration errors, never
  // invitations to fall back to interactive/platform or shared AI authority.
  if (!expected || expected.length < 32 ||
      expected === process.env.AI_SERVICE_KEY ||
      expected === process.env.QUEUE_STATUS_SERVICE_KEY) {
    return 'unconfigured'
  }
  return constantTimeEquals(req.headers.get('x-service-key'), expected) ? 'allowed' : 'denied'
}

export async function GET(req: Request) {
  const access = authenticateMetricsService(req)
  if (access === 'unconfigured') {
    return NextResponse.json({ error: 'Operational metrics service unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  if (access === 'denied') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  logger.info('operational_metrics_service_authorized', {
    principal: 'control-plane-operational-metrics',
    capability: CAPABILITY,
  })

  try {
    const queueStats = await getAllQueueStats()
    const queueDepth = queueStats.reduce((sum, q) => sum + (q.active ?? 0) + (q.reserved ?? 0) + (q.scheduled ?? 0), 0)

    return NextResponse.json({
      scope: 'platform',
      workflow_transition_rate: null,
      sla_violations: null,
      failure_like_updates: null,
      queue_depth: queueDepth,
      request_count: null,
      error_rate: null,
      window: '24h',
      generated_at: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    logger.error('operational_metrics_failed', { error })
    return NextResponse.json({ error: 'Failed to compute metrics' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
