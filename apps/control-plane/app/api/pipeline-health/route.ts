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
 *
 * Public route — safe for external uptime monitors and internal health dashboards.
 * Listed in proxy.ts allowlist (no auth required).
 */
import { NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { pipelineAlerts } from '@nzila/db/schema'
import { and, gte, isNull } from 'drizzle-orm'

const LOOKBACK_HOURS = 24

export async function GET() {
  try {
    const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000)

    const alerts = await db
      .select({
        id: pipelineAlerts.id,
        pipelineName: pipelineAlerts.pipelineName,
        errorCode: pipelineAlerts.errorCode,
        severity: pipelineAlerts.severity,
        message: pipelineAlerts.message,
        createdAt: pipelineAlerts.createdAt,
      })
      .from(pipelineAlerts)
      .where(
        and(
          gte(pipelineAlerts.createdAt, since),
          isNull(pipelineAlerts.resolvedAt),
        ),
      )

    const critical = alerts.filter((a) => a.severity === 'critical')
    const warnings = alerts.filter((a) => a.severity === 'warning')

    if (critical.length > 0) {
      return NextResponse.json(
        {
          status: 'critical',
          alerts: critical,
          checkedAt: new Date().toISOString(),
          lookbackHours: LOOKBACK_HOURS,
        },
        { status: 503 },
      )
    }

    if (warnings.length > 0) {
      return NextResponse.json({
        status: 'warning',
        alerts: warnings,
        checkedAt: new Date().toISOString(),
        lookbackHours: LOOKBACK_HOURS,
      })
    }

    return NextResponse.json({
      status: 'ok',
      alerts: [],
      checkedAt: new Date().toISOString(),
      lookbackHours: LOOKBACK_HOURS,
    })
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
