/**
 * Pipeline Health Route
 *
 * Returns the health status of the decision-aggregate materialization pipeline
 * by querying recent unresolved alerts from the pipeline_alerts table.
 *
 * Responses:
 *   200 { status: 'ok' }                  — no active alerts
 *   200 { status: 'warning', alerts: [] } — warning/info alerts only
 *   503 { status: 'critical', alerts: [] } — one or more critical alerts
 */
import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/api-auth'
import { readPipelineHealth } from '@/lib/services/pipeline-health-service'

export async function GET(request: Request) {
  try {
    await requireApiAuth(request)

    const health = await readPipelineHealth()
    return NextResponse.json(health, { status: health.status === 'critical' ? 503 : 200 })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        checkedAt: new Date().toISOString(),
      },
      { status: 503 },
    )
  }
}
