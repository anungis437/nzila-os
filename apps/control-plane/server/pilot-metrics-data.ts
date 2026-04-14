import 'server-only'

import {
  createPilotDefinition,
  updatePilotDefinition,
  listPilots,
  getPilotSummary,
  getPilotMetrics,
  getPilotHealthScore,
  listPilotAlerts,
  listPilotAlertRules,
  upsertPilotAlertRule,
  listPilotAlertEscalations,
  upsertPilotAlertEscalation,
  acknowledgeAlert,
  resolveAlert,
  escalateAlert,
  listAlertInbox,
  computeAlertOpsMetrics,
  computePilotRollups,
  computePilotHealthScore,
  exportPilotReport,
  type CreatePilotInput,
  type UpdatePilotInput,
} from '@nzila/platform-pilot-metrics/service'

export async function listPilotMetricsPilots(orgId: string) {
  return listPilots(orgId)
}

export async function createPilot(orgId: string, input: Omit<CreatePilotInput, 'orgId'>) {
  return createPilotDefinition({ ...input, orgId })
}

export async function patchPilot(orgId: string, pilotId: string, patch: UpdatePilotInput) {
  return updatePilotDefinition(orgId, pilotId, patch)
}

export async function getPilotDetail(orgId: string, pilotId: string) {
  await computePilotRollups(orgId, pilotId, 'day')
  await computePilotHealthScore(orgId, pilotId)

  const [summary, metrics, health, alerts, alertOps] = await Promise.all([
    getPilotSummary(orgId, pilotId),
    getPilotMetrics(orgId, pilotId),
    getPilotHealthScore(orgId, pilotId),
    listPilotAlerts(orgId, pilotId),
    computeAlertOpsMetrics(orgId, pilotId, 30),
  ])

  return {
    ...summary,
    metrics,
    health,
    alerts,
    alertOps,
  }
}

export async function recomputePilotHealth(orgId: string, pilotId: string) {
  await computePilotRollups(orgId, pilotId, 'day')
  return computePilotHealthScore(orgId, pilotId)
}

export async function getPilotDashboard(orgId: string) {
  const pilots = await listPilots(orgId)
  type PilotRow = (typeof pilots)[number]

  const detailRows = await Promise.all(
    pilots.map(async (pilot: PilotRow) => {
      const [health, alerts] = await Promise.all([
        getPilotHealthScore(orgId, pilot.id),
        listPilotAlerts(orgId, pilot.id),
      ])
      const alertOps = await computeAlertOpsMetrics(orgId, pilot.id, 30)
      type AlertRow = (typeof alerts)[number]

      const startedAt = pilot.startedAt ? new Date(pilot.startedAt) : null
      const daysActive = startedAt
        ? Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 86_400_000))
        : 0

      return {
        pilot,
        health,
        alertsOpen: alerts.filter((a: AlertRow) => !a.resolvedAt).length,
        daysActive,
        alertOps,
      }
    }),
  )
  type DetailRow = (typeof detailRows)[number]

  return {
    pilots: detailRows,
    summary: {
      totalPilots: detailRows.length,
      activePilots: detailRows.filter((p: DetailRow) => p.pilot.status === 'active').length,
      highRisk: detailRows.filter((p: DetailRow) => p.health?.riskLevel === 'high').length,
      avgScore: detailRows.length > 0
        ? Math.round(
          detailRows.reduce((sum: number, row: DetailRow) => sum + (row.health?.scoreTotal ?? 0), 0)
          / detailRows.length,
        )
        : 0,
      avgMttaMinutes: detailRows.length > 0
        ? Math.round(detailRows.reduce((sum: number, row: DetailRow) => sum + (row.alertOps?.mttaMinutes ?? 0), 0) / detailRows.length)
        : 0,
      avgMttrMinutes: detailRows.length > 0
        ? Math.round(detailRows.reduce((sum: number, row: DetailRow) => sum + (row.alertOps?.mttrMinutes ?? 0), 0) / detailRows.length)
        : 0,
    },
  }
}

export async function getAlertInbox(
  orgId: string,
  filters: { severity?: Array<'info' | 'warning' | 'critical'>; status?: Array<'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'auto_resolved'>; activeIncidentsOnly?: boolean } = {},
) {
  const alerts = await listAlertInbox(orgId, filters)
  return {
    alerts,
    summary: {
      total: alerts.length,
      active: alerts.filter((a) => a.status === 'open' || a.status === 'acknowledged' || a.status === 'in_progress').length,
      critical: alerts.filter((a) => a.severity === 'critical').length,
    },
  }
}

export async function getPilotAlertRules(orgId: string, pilotId: string) {
  return listPilotAlertRules(orgId, pilotId)
}

export async function savePilotAlertRule(orgId: string, pilotId: string, input: Parameters<typeof upsertPilotAlertRule>[2]) {
  return upsertPilotAlertRule(orgId, pilotId, input)
}

export async function getPilotAlertEscalations(orgId: string, pilotId: string) {
  return listPilotAlertEscalations(orgId, pilotId)
}

export async function savePilotAlertEscalation(orgId: string, pilotId: string, input: Parameters<typeof upsertPilotAlertEscalation>[2]) {
  return upsertPilotAlertEscalation(orgId, pilotId, input)
}

export async function acknowledgePilotAlert(orgId: string, pilotId: string, alertId: string, actorId: string, traceId: string) {
  return acknowledgeAlert(orgId, pilotId, alertId, { actorId, traceId })
}

export async function resolvePilotAlert(orgId: string, pilotId: string, alertId: string, actorId: string, traceId: string, resolutionNotes?: string) {
  return resolveAlert(orgId, pilotId, alertId, { actorId, traceId }, resolutionNotes)
}

export async function escalatePilotAlert(orgId: string, pilotId: string, alertId: string, actorId: string, traceId: string) {
  return escalateAlert(orgId, pilotId, alertId, { actorId, traceId }, true)
}

export async function getPilotAlertOps(orgId: string, pilotId: string, windowDays = 30) {
  return computeAlertOpsMetrics(orgId, pilotId, windowDays)
}

export async function exportPilot(orgId: string, pilotId: string, format: 'json' | 'csv' | 'markdown') {
  await computePilotRollups(orgId, pilotId, 'day')
  await computePilotHealthScore(orgId, pilotId)
  return exportPilotReport(orgId, pilotId, format)
}
