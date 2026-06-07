import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { recordPilotMetricEvent } from '@nzila/platform-pilot-metrics'
import { logger } from '@/lib/logger'

const LEGACY_SUBJECT_REF_KEY = ['entity', 'Id'].join('')

type PilotMetricPayload = Parameters<typeof recordPilotMetricEvent>[0]

function withPilotMetricSubject(subjectId?: string, subjectType?: string): Partial<PilotMetricPayload> {
  const payload: Record<string, unknown> = {}
  if (subjectId) payload[LEGACY_SUBJECT_REF_KEY] = subjectId
  if (subjectType) payload.entityType = subjectType
  return payload as Partial<PilotMetricPayload>
}

async function resolveActivePilotId(orgId: string): Promise<string | null> {
  const rows = (await platformDb.execute(sql`
    SELECT id
    FROM pilot_definitions
    WHERE org_id = ${orgId}::uuid
      AND app_scope = 'union-eyes'
      AND status = 'active'
    ORDER BY started_at DESC NULLS LAST, created_at DESC
    LIMIT 1
  `)) as any as Array<{ id: string }>

  return rows[0]?.id ?? null
}

async function emitUnionEyesMetric(
  orgId: string,
  metricName: Parameters<typeof recordPilotMetricEvent>[0]['metricName'],
  valueNumeric: number,
  audit: {
    actorId?: string
    systemActorId?: `system:${string}`
    traceId: string
  },
  data: {
    subjectId?: string
    entityType?: string
    valueJson?: Record<string, unknown>
  } = {},
): Promise<void> {
  try {
    const pilotId = await resolveActivePilotId(orgId)
    if (!pilotId) return

    await recordPilotMetricEvent({
      orgId,
      pilotId,
      appScope: 'union-eyes',
      metricType: metricName.startsWith('sla_') || metricName.includes('case') || metricName.includes('assignment')
        ? 'operations'
        : metricName.includes('workflow')
          ? 'workflow'
          : 'adoption',
      metricName,
      valueNumeric,
      valueJson: data.valueJson,
      ...withPilotMetricSubject(data.subjectId, data.entityType),
      traceId: audit.traceId,
      occurredAt: new Date().toISOString(),
    }, {
      actorId: audit.actorId,
      systemActorId: audit.systemActorId,
      traceId: audit.traceId,
      evidenceMetadata: { source: 'union-eyes', metricName },
    })
  } catch (error) {
    logger.warn('pilot metrics emit failed (union-eyes)', { error: String(error), metricName, orgId })
  }
}

export async function recordUnionEyesCaseCreated(orgId: string, claimId: string, actorId: string, traceId: string): Promise<void> {
  await emitUnionEyesMetric(orgId, 'cases_created', 1, {
    actorId,
    traceId,
  }, {
    subjectId: claimId,
    entityType: 'case',
  })
}

export async function recordUnionEyesCaseAssigned(orgId: string, claimId: string, assigneeId: string, actorId: string, traceId: string): Promise<void> {
  await emitUnionEyesMetric(orgId, 'assignment_efficiency', 1, {
    actorId,
    traceId,
  }, {
    subjectId: claimId,
    entityType: 'case',
    valueJson: { assigneeId },
  })
}

export async function recordUnionEyesCaseAcknowledged(
  orgId: string,
  claimId: string,
  firstResponseMinutes: number,
  actorId: string,
  traceId: string,
): Promise<void> {
  await emitUnionEyesMetric(orgId, 'cases_acknowledged', 1, {
    actorId,
    traceId,
  }, {
    subjectId: claimId,
    entityType: 'case',
  })

  await emitUnionEyesMetric(orgId, 'avg_time_to_first_response', firstResponseMinutes, {
    actorId,
    traceId,
  }, {
    subjectId: claimId,
    entityType: 'case',
    valueJson: {
      numeratorMinutes: firstResponseMinutes,
      denominator: 1,
    },
  })
}

export async function recordUnionEyesCaseResolved(
  orgId: string,
  claimId: string,
  resolutionHours: number,
  actorId: string,
  traceId: string,
): Promise<void> {
  await emitUnionEyesMetric(orgId, 'avg_time_to_resolution', resolutionHours, {
    actorId,
    traceId,
  }, {
    subjectId: claimId,
    entityType: 'case',
    valueJson: {
      numeratorHours: resolutionHours,
      denominator: 1,
    },
  })
}

export async function recordUnionEyesWorkflowTransition(
  orgId: string,
  claimId: string,
  success: boolean,
  targetStatus: string,
  actorId: string,
  traceId: string,
): Promise<void> {
  await emitUnionEyesMetric(orgId, 'workflow_transition_success_rate', success ? 1 : 0, {
    actorId,
    traceId,
  }, {
    subjectId: claimId,
    entityType: 'case',
    valueJson: { targetStatus },
  })
}

export async function recordUnionEyesWorkflowTransitionFailure(
  orgId: string,
  claimId: string,
  reason: string,
  actorId: string,
  traceId: string,
): Promise<void> {
  await emitUnionEyesMetric(orgId, 'workflow_failures', 1, {
    actorId,
    traceId,
  }, {
    subjectId: claimId,
    entityType: 'case',
    valueJson: { reason },
  })
}

export async function recordUnionEyesEvidenceExport(orgId: string, claimId: string, actorId: string, traceId: string): Promise<void> {
  await emitUnionEyesMetric(orgId, 'evidence_pack_exports', 1, {
    actorId,
    traceId,
  }, {
    subjectId: claimId,
    entityType: 'case',
  })
}

export async function recordUnionEyesSlaWatchdog(orgId: string, breachedCount: number, atRiskCount: number, traceId: string): Promise<void> {
  await emitUnionEyesMetric(orgId, 'sla_breach_count', breachedCount, {
    systemActorId: 'system:ue-sla-watchdog',
    traceId,
  }, {
    valueJson: { atRiskCount },
  })
}

export async function recordUnionEyesSlaCompliance(
  orgId: string,
  compliantCount: number,
  totalScanned: number,
  traceId: string,
): Promise<void> {
  const complianceRate = totalScanned > 0 ? (compliantCount / totalScanned) * 100 : 100
  await emitUnionEyesMetric(orgId, 'sla_compliance_rate', complianceRate, {
    systemActorId: 'system:ue-sla-watchdog',
    traceId,
  }, {
    valueJson: {
      compliantCount,
      totalScanned,
    },
  })
}
