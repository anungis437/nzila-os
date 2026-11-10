/**
 * GET /api/metrics/prometheus
 *
 * Authenticated platform operational telemetry in Prometheus text format. `/api/metrics` remains the tenant analytics-record API; the
 * two contracts are deliberately separate. No tenant content or high-cardinality/request-controlled label is exposed here.
 */
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  authenticateOperationalMetrics,
  OPERATIONAL_METRICS_CAPABILITY,
  readOperationalMetrics,
  toPrometheus,
} from '@/lib/observability/operational-metrics';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const access = authenticateOperationalMetrics(request);
  if (access !== 'allowed') {
    if (access === 'unconfigured') logger.error('operational_metrics_service_key_unconfigured', { capability: OPERATIONAL_METRICS_CAPABILITY });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const body = toPrometheus(await readOperationalMetrics());
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error('operational_metrics_failed', { error });
    return NextResponse.json({ error: 'Failed to compute metrics' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
