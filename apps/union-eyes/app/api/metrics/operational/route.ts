/**
 * GET /api/metrics/operational
 *
 * Dedicated, read-only infrastructure measurement. An operator title or a
 * generic AI service secret never gives access. The caller must hold the
 * distinct capability credential metrics:platform_operational:read.
 * No union claim, member, grievance, case or tenant tables may be queried.
 */
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { authenticateOperationalMetrics, OPERATIONAL_METRICS_CAPABILITY, readOperationalMetrics } from '@/lib/observability/operational-metrics'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: Request) {
  const access = authenticateOperationalMetrics(req)
  if (access !== 'allowed') {
    // A caller without the matching credential is unauthorized whatever the server's configuration: answering 503 to an
    // anonymous request would tell it whether the key is configured. The unconfigured or unsafe state is the operator's to
    // see, so it is logged here (and the Control Plane consumer shows no data), never returned to the caller.
    if (access === 'unconfigured') logger.error('operational_metrics_service_key_unconfigured', { capability: OPERATIONAL_METRICS_CAPABILITY })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  logger.info('operational_metrics_service_authorized', {
    principal: 'control-plane-operational-metrics',
    capability: OPERATIONAL_METRICS_CAPABILITY,
  })

  try {
    const snapshot = await readOperationalMetrics()

    return NextResponse.json({
      scope: 'platform',
      workflow_transition_rate: null,
      sla_violations: null,
      failure_like_updates: null,
      queue_depth: snapshot.queueDepth,
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
