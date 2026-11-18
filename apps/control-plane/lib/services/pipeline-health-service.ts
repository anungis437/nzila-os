import { platformDb } from '@nzila/db/platform'
import { pipelineAlerts } from '@nzila/db/schema'
import { and, gte, isNull } from 'drizzle-orm'

const LOOKBACK_HOURS = 24

export async function readPipelineHealth() {
  const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000)
  const alerts = await platformDb
    .select({
      id: pipelineAlerts.id,
      pipelineName: pipelineAlerts.pipelineName,
      errorCode: pipelineAlerts.errorCode,
      severity: pipelineAlerts.severity,
      message: pipelineAlerts.message,
      createdAt: pipelineAlerts.createdAt,
    })
    .from(pipelineAlerts)
    .where(and(gte(pipelineAlerts.createdAt, since), isNull(pipelineAlerts.resolvedAt)))
  const critical = alerts.filter((a) => a.severity === 'critical')
  const warnings = alerts.filter((a) => a.severity === 'warning')
  if (critical.length > 0)
    return {
      status: 'critical',
      alerts: critical,
      checkedAt: new Date().toISOString(),
      lookbackHours: LOOKBACK_HOURS,
    }
  if (warnings.length > 0)
    return {
      status: 'warning',
      alerts: warnings,
      checkedAt: new Date().toISOString(),
      lookbackHours: LOOKBACK_HOURS,
    }
  return {
    status: 'ok',
    alerts: [],
    checkedAt: new Date().toISOString(),
    lookbackHours: LOOKBACK_HOURS,
  }
}
