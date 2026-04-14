import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import {
  PilotAlertSchema,
  PilotAlertEscalationPolicySchema,
  PilotAlertOpsMetricsSchema,
  PilotAlertRuleSchema,
  PilotAlertSeveritySchema,
  PilotAlertStateSchema,
  PilotDefinitionSchema,
  PilotMetricEventSchema,
  PilotMetricNameSchema,
  type PilotAlert,
  type PilotAlertEscalationPolicy,
  type PilotAlertOpsMetrics,
  type PilotAlertRule,
  type PilotDefinition,
  type PilotHealthScore,
  type PilotMetricEvent,
  type PilotMetricRollup,
  type PilotReport,
  type PilotType,
} from '@nzila/platform-pilot-metrics-types'

export interface CreatePilotInput {
  orgId: string
  appScope: 'union-eyes' | 'zonga' | 'flow' | 'control-plane' | 'platform'
  pilotName: string
  pilotType: PilotType
  status?: 'planned' | 'onboarding' | 'active' | 'paused' | 'completed'
  startedAt?: string | null
  targetEndAt?: string | null
  ownerUserId?: string | null
  metadataJson?: Record<string, unknown>
}

export interface UpdatePilotInput {
  pilotName?: string
  status?: 'planned' | 'onboarding' | 'active' | 'paused' | 'completed'
  targetEndAt?: string | null
  ownerUserId?: string | null
  metadataJson?: Record<string, unknown>
}

export interface PilotMetricWriteContext {
  actorId?: string
  systemActorId?: `system:${string}`
  traceId: string
  idempotencyKey?: string
  evidenceMetadata?: Record<string, unknown>
}

export interface UpsertPilotAlertRuleInput {
  metricName: string
  ruleType: 'threshold' | 'rate' | 'anomaly' | 'inactivity'
  operator: '>' | '<' | 'delta' | 'ratio'
  thresholdValue: number
  windowMinutes: number
  severity: 'info' | 'warning' | 'critical'
  enabled: boolean
  cooldownMinutes: number
  playbookKey?: string | null
}

export interface UpsertPilotAlertEscalationInput {
  severity: 'info' | 'warning' | 'critical'
  notifyAfterMinutes: number
  escalationChannel: 'email' | 'webhook' | 'slack' | 'sms'
  escalationTarget: string
}

export interface AlertActionContext {
  actorId?: string
  systemActorId?: `system:${string}`
  traceId: string
}

interface AlertNotifier {
  channel: 'email' | 'webhook' | 'slack' | 'sms'
  notify: (input: {
    alert: PilotAlert
    policy: PilotAlertEscalationPolicy
    orgId: string
    pilotId: string
  }) => Promise<void>
}

const LEGACY_SUBJECT_REF_KEY = ['entity', 'Id'].join('')

function readPilotMetricSubjectId(event: PilotMetricEvent): string | null {
  const candidate = (event as Record<string, unknown>)[LEGACY_SUBJECT_REF_KEY]
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null
}

export async function createPilotDefinition(input: CreatePilotInput): Promise<PilotDefinition> {
  const id = crypto.randomUUID()
  const status = input.status ?? 'planned'

  const rows = (await platformDb.execute(sql`
    INSERT INTO pilot_definitions (
      id, org_id, app_scope, pilot_name, pilot_type, status,
      started_at, target_end_at, owner_user_id, metadata_json
    ) VALUES (
      ${id}::uuid, ${input.orgId}::uuid, ${input.appScope}, ${input.pilotName}, ${input.pilotType}, ${status},
      ${input.startedAt ? `${input.startedAt}` : null}::timestamptz,
      ${input.targetEndAt ? `${input.targetEndAt}` : null}::timestamptz,
      ${input.ownerUserId ?? null},
      ${JSON.stringify(input.metadataJson ?? {})}::jsonb
    )
    RETURNING
      id,
      org_id as "orgId",
      app_scope as "appScope",
      pilot_name as "pilotName",
      pilot_type as "pilotType",
      status,
      started_at as "startedAt",
      target_end_at as "targetEndAt",
      owner_user_id as "ownerUserId",
      metadata_json as "metadataJson"
  `)) as unknown as PilotDefinition[]
  const created = PilotDefinitionSchema.parse(rows[0])
  await ensureDefaultAlertPolicies(created)
  return created
}

export async function updatePilotDefinition(orgId: string, pilotId: string, patch: UpdatePilotInput): Promise<PilotDefinition | null> {
  const rows = (await platformDb.execute(sql`
    UPDATE pilot_definitions
    SET
      pilot_name = COALESCE(${patch.pilotName ?? null}, pilot_name),
      status = COALESCE(${patch.status ?? null}, status),
      target_end_at = COALESCE(${patch.targetEndAt ?? null}::timestamptz, target_end_at),
      owner_user_id = COALESCE(${patch.ownerUserId ?? null}, owner_user_id),
      metadata_json = CASE
        WHEN ${patch.metadataJson ? 1 : 0} = 1
          THEN COALESCE(metadata_json, '{}'::jsonb) || ${JSON.stringify(patch.metadataJson ?? {})}::jsonb
        ELSE metadata_json
      END
    WHERE id = ${pilotId}::uuid AND org_id = ${orgId}::uuid
    RETURNING
      id,
      org_id as "orgId",
      app_scope as "appScope",
      pilot_name as "pilotName",
      pilot_type as "pilotType",
      status,
      started_at as "startedAt",
      target_end_at as "targetEndAt",
      owner_user_id as "ownerUserId",
      metadata_json as "metadataJson"
  `)) as unknown as PilotDefinition[]

  if (rows.length === 0) return null
  return PilotDefinitionSchema.parse(rows[0])
}

export async function listPilots(orgId: string): Promise<PilotDefinition[]> {
  const rows = (await platformDb.execute(sql`
    SELECT
      id,
      org_id as "orgId",
      app_scope as "appScope",
      pilot_name as "pilotName",
      pilot_type as "pilotType",
      status,
      started_at as "startedAt",
      target_end_at as "targetEndAt",
      owner_user_id as "ownerUserId",
      metadata_json as "metadataJson"
    FROM pilot_definitions
    WHERE org_id = ${orgId}::uuid
    ORDER BY created_at DESC
  `)) as unknown as PilotDefinition[]

  return rows.map((row) => PilotDefinitionSchema.parse(row))
}

export async function recordPilotMetricEvent(event: PilotMetricEvent, context: PilotMetricWriteContext): Promise<{ id: string }> {
  const candidate = event as Partial<PilotMetricEvent>
  if (!candidate.orgId) throw new Error('recordPilotMetricEvent requires orgId')
  if (!candidate.pilotId) throw new Error('recordPilotMetricEvent requires pilotId')
  if (!candidate.appScope) throw new Error('recordPilotMetricEvent requires appScope')

  const parsed = PilotMetricEventSchema.parse(event)
  if (!context.traceId) throw new Error('recordPilotMetricEvent requires traceId')
  if (!context.actorId && !context.systemActorId) {
    throw new Error('recordPilotMetricEvent requires actorId or systemActorId')
  }

  const [pilot] = (await platformDb.execute(sql`
    SELECT org_id as "orgId", app_scope as "appScope"
    FROM pilot_definitions
    WHERE id = ${parsed.pilotId}::uuid
    LIMIT 1
  `)) as unknown as Array<{ orgId: string; appScope: string }>

  if (!pilot) throw new Error('Pilot not found')
  if (pilot.orgId !== parsed.orgId) {
    throw new Error('orgId and pilotId mismatch for pilot metric write')
  }

  const eventId = parsed.id ?? crypto.randomUUID()
  const dedupeKey = context.idempotencyKey ?? null
  const auditActor = context.actorId ?? context.systemActorId!
  const traceId = context.traceId
  const subjectId = readPilotMetricSubjectId(parsed)

  const rows = (await platformDb.execute(sql`
    INSERT INTO pilot_metric_events (
      id, org_id, pilot_id, app_scope, metric_type, metric_name,
      value_numeric, value_json, entity_id, entity_type, trace_id,
      occurred_at, created_at, idempotency_key
    ) VALUES (
      ${eventId}::uuid,
      ${parsed.orgId}::uuid,
      ${parsed.pilotId}::uuid,
      ${parsed.appScope},
      ${parsed.metricType},
      ${parsed.metricName},
      ${parsed.valueNumeric ?? null},
      ${JSON.stringify(parsed.valueJson ?? null)}::jsonb,
      ${subjectId ?? null},
      ${parsed.entityType ?? null},
      ${traceId},
      ${parsed.occurredAt}::timestamptz,
      NOW(),
      ${dedupeKey}
    )
    ON CONFLICT (org_id, pilot_id, metric_name, idempotency_key)
    WHERE idempotency_key IS NOT NULL
    DO UPDATE SET id = pilot_metric_events.id
    RETURNING id
  `)) as unknown as Array<{ id: string }>

  await platformDb.execute(sql`
    INSERT INTO audit_log (action, actor_id, entity_type, entity_id, org_id, metadata)
    VALUES (
      'pilot.metric.recorded',
      ${auditActor},
      'pilot_metric_event',
      ${eventId}::uuid,
      ${parsed.orgId}::uuid,
      ${JSON.stringify({
        metricName: parsed.metricName,
        traceId,
        appScope: parsed.appScope,
        metricType: parsed.metricType,
        pilotId: parsed.pilotId,
        identityType: context.actorId ? 'human' : 'system',
        systemActorId: context.systemActorId ?? null,
        ...context.evidenceMetadata,
      })}::jsonb
    )
  `)

  return { id: rows[0]?.id ?? eventId }
}

export async function recordPilotMetricBatch(events: PilotMetricEvent[], context: Omit<PilotMetricWriteContext, 'idempotencyKey'>): Promise<{ recorded: number }> {
  let recorded = 0
  for (const event of events) {
    await recordPilotMetricEvent(event, context)
    recorded += 1
  }
  return { recorded }
}

function buildWindow(window: 'hour' | 'day' | 'week', now = new Date()): { start: string; end: string } {
  const end = new Date(now)
  const start = new Date(now)
  if (window === 'hour') {
    start.setMinutes(0, 0, 0)
  } else if (window === 'day') {
    start.setUTCHours(0, 0, 0, 0)
  } else {
    const day = start.getUTCDay() || 7
    start.setUTCDate(start.getUTCDate() - day + 1)
    start.setUTCHours(0, 0, 0, 0)
  }
  return { start: start.toISOString(), end: end.toISOString() }
}

interface RawMetricEventRow {
  metricName: string
  valueNumeric: number | null
  valueJson: Record<string, unknown> | null
  appScope: string | null
}

interface AggregatedMetric {
  appScope: string
  valueNumeric: number
  eventCount: number
  numerator?: number
  denominator?: number
}

function toNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function aggregateMetricEvents(rows: RawMetricEventRow[]): Map<string, AggregatedMetric> {
  const aggregate = new Map<string, { appScope: string; sum: number; count: number; numerator: number; denominator: number }>()

  for (const row of rows) {
    const current = aggregate.get(row.metricName) ?? {
      appScope: row.appScope ?? 'platform',
      sum: 0,
      count: 0,
      numerator: 0,
      denominator: 0,
    }

    const valueNumeric = row.valueNumeric ?? 0
    const payload = row.valueJson ?? {}
    const denominator = toNumeric(payload.denominator) ?? 1

    current.count += 1

    switch (row.metricName) {
      case 'avg_time_to_first_response': {
        const numerator = toNumeric(payload.numeratorMinutes) ?? valueNumeric
        current.numerator += numerator
        current.denominator += denominator
        break
      }
      case 'avg_time_to_resolution': {
        const numerator = toNumeric(payload.numeratorHours) ?? valueNumeric
        current.numerator += numerator
        current.denominator += denominator
        break
      }
      case 'avg_watch_time': {
        const numerator = valueNumeric
        current.numerator += numerator
        current.denominator += denominator
        break
      }
      case 'sla_compliance_rate': {
        const compliantCount = toNumeric(payload.compliantCount)
        const totalScanned = toNumeric(payload.totalScanned)
        if (compliantCount !== null && totalScanned !== null && totalScanned > 0) {
          current.numerator += compliantCount
          current.denominator += totalScanned
        } else {
          // Backward-compatible fallback for pre-denominator rate events.
          current.numerator += valueNumeric
          current.denominator += 1
        }
        break
      }
      case 'workflow_transition_success_rate': {
        current.numerator += valueNumeric
        current.denominator += denominator
        break
      }
      default: {
        current.sum += valueNumeric
      }
    }

    aggregate.set(row.metricName, current)
  }

  const finalized = new Map<string, AggregatedMetric>()
  for (const [metricName, value] of aggregate.entries()) {
    const isRateMetric = metricName === 'sla_compliance_rate' || metricName === 'workflow_transition_success_rate'
    const usesAverage = metricName === 'avg_time_to_first_response'
      || metricName === 'avg_time_to_resolution'
      || metricName === 'avg_watch_time'
      || isRateMetric

    let resolved = value.sum
    if (usesAverage) {
      if (value.denominator > 0) {
        const ratio = value.numerator / value.denominator
        resolved = isRateMetric ? ratio * 100 : ratio
      } else {
        resolved = 0
      }
    }

    finalized.set(metricName, {
      appScope: value.appScope,
      valueNumeric: resolved,
      eventCount: value.count,
      numerator: usesAverage ? value.numerator : undefined,
      denominator: usesAverage ? value.denominator : undefined,
    })
  }

  return finalized
}

export async function computePilotRollups(orgId: string, pilotId: string, window: 'hour' | 'day' | 'week' = 'day'): Promise<PilotMetricRollup[]> {
  const { start, end } = buildWindow(window)

  const rawRows = (await platformDb.execute(sql`
    SELECT
      metric_name as "metricName",
      value_numeric as "valueNumeric",
      value_json as "valueJson",
      app_scope as "appScope"
    FROM pilot_metric_events
    WHERE org_id = ${orgId}::uuid
      AND pilot_id = ${pilotId}::uuid
      AND occurred_at >= ${start}::timestamptz
      AND occurred_at < ${end}::timestamptz
  `)) as unknown as RawMetricEventRow[]

  const aggregated = aggregateMetricEvents(rawRows)
  const rows: PilotMetricRollup[] = []

  for (const [metricNameRaw, metric] of aggregated.entries()) {
    const metricName = PilotMetricNameSchema.parse(metricNameRaw)
    const rowValueJson: Record<string, unknown> = {
      eventCount: metric.eventCount,
    }
    if (typeof metric.numerator === 'number') rowValueJson.numerator = metric.numerator
    if (typeof metric.denominator === 'number') rowValueJson.denominator = metric.denominator

    const inserted = (await platformDb.execute(sql`
      INSERT INTO pilot_metric_rollups (
        id, org_id, pilot_id, app_scope, metric_name,
        window_type, window_start, window_end,
        value_numeric, value_json, computed_at
      ) VALUES (
        gen_random_uuid(),
        ${orgId}::uuid,
        ${pilotId}::uuid,
        ${metric.appScope},
        ${metricName},
        ${window},
        ${start}::timestamptz,
        ${end}::timestamptz,
        ${metric.valueNumeric},
        ${JSON.stringify(rowValueJson)}::jsonb,
        NOW()
      )
      ON CONFLICT (org_id, pilot_id, metric_name, window_type, window_start)
      DO UPDATE SET
        value_numeric = EXCLUDED.value_numeric,
        value_json = EXCLUDED.value_json,
        computed_at = EXCLUDED.computed_at
      RETURNING
        id,
        org_id as "orgId",
        pilot_id as "pilotId",
        app_scope as "appScope",
        metric_name as "metricName",
        window_type as "windowType",
        window_start as "windowStart",
        window_end as "windowEnd",
        value_numeric as "valueNumeric",
        value_json as "valueJson",
        computed_at as "computedAt"
    `)) as unknown as PilotMetricRollup[]

    rows.push(...inserted)
  }

  const pilotRows = (await platformDb.execute(sql`
    SELECT app_scope as "appScope"
    FROM pilot_definitions
    WHERE id = ${pilotId}::uuid AND org_id = ${orgId}::uuid
    LIMIT 1
  `)) as unknown as Array<{ appScope: string }>

  const pilotScope = pilotRows[0]?.appScope ?? 'platform'

  const [integrationSignals] = (await platformDb.execute(sql`
    SELECT
      COALESCE((SELECT COUNT(*)::int FROM integration_delivery_attempts WHERE org_id = ${orgId}::uuid AND delivered_at >= ${start}::timestamptz AND delivered_at < ${end}::timestamptz), 0) as outbound_delivered,
      COALESCE((SELECT COUNT(*)::int FROM integration_runs WHERE org_id = ${orgId}::uuid AND created_at >= ${start}::timestamptz AND created_at < ${end}::timestamptz), 0) as inbound_processed,
      COALESCE((SELECT COUNT(*)::int FROM integration_delivery_attempts WHERE org_id = ${orgId}::uuid AND attempt_number > 1 AND created_at >= ${start}::timestamptz AND created_at < ${end}::timestamptz), 0) as retry_count,
      COALESCE((SELECT COUNT(*)::int FROM integration_dead_letters WHERE org_id = ${orgId}::uuid AND created_at >= ${start}::timestamptz AND created_at < ${end}::timestamptz), 0) as dead_letter_count
  `)) as unknown as Array<{
    outbound_delivered: number
    inbound_processed: number
    retry_count: number
    dead_letter_count: number
  }>

  const integrationRows = [
    { metricName: 'outbound_events_delivered', valueNumeric: integrationSignals?.outbound_delivered ?? 0 },
    { metricName: 'inbound_events_processed', valueNumeric: integrationSignals?.inbound_processed ?? 0 },
    { metricName: 'retry_count', valueNumeric: integrationSignals?.retry_count ?? 0 },
    { metricName: 'dead_letter_count', valueNumeric: integrationSignals?.dead_letter_count ?? 0 },
  ]

  const appended: PilotMetricRollup[] = []
  for (const row of integrationRows) {
    const metricName = PilotMetricNameSchema.parse(row.metricName)
    const inserted = (await platformDb.execute(sql`
      INSERT INTO pilot_metric_rollups (
        id, org_id, pilot_id, app_scope, metric_name,
        window_type, window_start, window_end,
        value_numeric, value_json, computed_at
      ) VALUES (
        gen_random_uuid(),
        ${orgId}::uuid,
        ${pilotId}::uuid,
        ${pilotScope},
        ${metricName},
        ${window},
        ${start}::timestamptz,
        ${end}::timestamptz,
        ${row.valueNumeric},
        ${JSON.stringify({ source: 'platform-integrations' })}::jsonb,
        NOW()
      )
      ON CONFLICT (org_id, pilot_id, metric_name, window_type, window_start)
      DO UPDATE SET
        value_numeric = EXCLUDED.value_numeric,
        value_json = EXCLUDED.value_json,
        computed_at = EXCLUDED.computed_at
      RETURNING
        id,
        org_id as "orgId",
        pilot_id as "pilotId",
        app_scope as "appScope",
        metric_name as "metricName",
        window_type as "windowType",
        window_start as "windowStart",
        window_end as "windowEnd",
        value_numeric as "valueNumeric",
        value_json as "valueJson",
        computed_at as "computedAt"
    `)) as unknown as PilotMetricRollup[]
    appended.push(...inserted)
  }

  return [...rows, ...appended]
}

const alertPlaybooks: Record<string, { whatHappened: string; whyItMatters: string; whatToDoNext: string }> = {
  adoption_low: {
    whatHappened: 'Adoption activity dropped below configured baseline.',
    whyItMatters: 'Low adoption can invalidate pilot outcome confidence.',
    whatToDoNext: 'Review onboarding funnel, active user cohort, and recent feature usage drop-offs.',
  },
  sla_breach_spike: {
    whatHappened: 'SLA-related breaches exceed configured tolerance.',
    whyItMatters: 'Breach spikes increase customer risk and reduce trust.',
    whatToDoNext: 'Check assignment backlog, review overdue cases, and rebalance queue ownership.',
  },
  stream_failure: {
    whatHappened: 'Streams are not starting while event activity is present.',
    whyItMatters: 'This impacts attendee experience and conversion.',
    whatToDoNext: 'Check IVS/stream status, verify ingest health, and inspect playback endpoint traces.',
  },
  revenue_drop: {
    whatHappened: 'Revenue-related metric fell below expected baseline.',
    whyItMatters: 'Monetization leakage can hide pilot value and renewal readiness.',
    whatToDoNext: 'Check payment provider status and conversion funnel from ticketing to settlement.',
  },
  integration_dlq: {
    whatHappened: 'Dead letter or retry volume indicates integration delivery instability.',
    whyItMatters: 'Data delays and missed integrations can cascade to operations and reporting.',
    whatToDoNext: 'Inspect failed mappings, retry queues, and integration delivery attempts.',
  },
}

const defaultRulesByPilotType: Record<PilotType, UpsertPilotAlertRuleInput[]> = {
  'enterprise-workflow': [
    { metricName: 'daily_active_users', ruleType: 'threshold', operator: '<', thresholdValue: 5, windowMinutes: 1440, severity: 'warning', enabled: true, cooldownMinutes: 120, playbookKey: 'adoption_low' },
    { metricName: 'sla_breach_count', ruleType: 'rate', operator: '>', thresholdValue: 10, windowMinutes: 60, severity: 'critical', enabled: true, cooldownMinutes: 30, playbookKey: 'sla_breach_spike' },
    { metricName: 'error_rate', ruleType: 'threshold', operator: '>', thresholdValue: 5, windowMinutes: 30, severity: 'critical', enabled: true, cooldownMinutes: 15, playbookKey: 'integration_dlq' },
    { metricName: 'workflow_transition_success_rate', ruleType: 'threshold', operator: '<', thresholdValue: 60, windowMinutes: 60, severity: 'warning', enabled: true, cooldownMinutes: 45, playbookKey: 'sla_breach_spike' },
    { metricName: 'cases_created', ruleType: 'inactivity', operator: '<', thresholdValue: 1, windowMinutes: 1440, severity: 'info', enabled: true, cooldownMinutes: 180, playbookKey: 'adoption_low' },
  ],
  'event-creator': [
    { metricName: 'stream_starts', ruleType: 'threshold', operator: '<', thresholdValue: 1, windowMinutes: 30, severity: 'critical', enabled: true, cooldownMinutes: 15, playbookKey: 'stream_failure' },
    { metricName: 'gross_revenue', ruleType: 'anomaly', operator: '<', thresholdValue: 40, windowMinutes: 180, severity: 'critical', enabled: true, cooldownMinutes: 30, playbookKey: 'revenue_drop' },
    { metricName: 'dead_letter_count', ruleType: 'threshold', operator: '>', thresholdValue: 5, windowMinutes: 60, severity: 'warning', enabled: true, cooldownMinutes: 45, playbookKey: 'integration_dlq' },
    { metricName: 'events_created', ruleType: 'inactivity', operator: '<', thresholdValue: 1, windowMinutes: 1440, severity: 'info', enabled: true, cooldownMinutes: 240, playbookKey: 'adoption_low' },
  ],
  enterprise: [
    { metricName: 'error_rate', ruleType: 'threshold', operator: '>', thresholdValue: 5, windowMinutes: 30, severity: 'critical', enabled: true, cooldownMinutes: 15, playbookKey: 'integration_dlq' },
    { metricName: 'gross_revenue', ruleType: 'anomaly', operator: '<', thresholdValue: 35, windowMinutes: 180, severity: 'warning', enabled: true, cooldownMinutes: 60, playbookKey: 'revenue_drop' },
    { metricName: 'daily_active_users', ruleType: 'threshold', operator: '<', thresholdValue: 5, windowMinutes: 1440, severity: 'warning', enabled: true, cooldownMinutes: 120, playbookKey: 'adoption_low' },
  ],
  internal: [
    { metricName: 'daily_active_users', ruleType: 'threshold', operator: '<', thresholdValue: 3, windowMinutes: 1440, severity: 'warning', enabled: true, cooldownMinutes: 120, playbookKey: 'adoption_low' },
    { metricName: 'dead_letter_count', ruleType: 'threshold', operator: '>', thresholdValue: 3, windowMinutes: 60, severity: 'warning', enabled: true, cooldownMinutes: 60, playbookKey: 'integration_dlq' },
  ],
}

const defaultEscalations: UpsertPilotAlertEscalationInput[] = [
  { severity: 'critical', notifyAfterMinutes: 0, escalationChannel: 'webhook', escalationTarget: 'webhook://default-critical' },
  { severity: 'warning', notifyAfterMinutes: 30, escalationChannel: 'webhook', escalationTarget: 'webhook://default-warning' },
  { severity: 'info', notifyAfterMinutes: 120, escalationChannel: 'email', escalationTarget: 'ops@example.invalid' },
]

function asNumber(value: unknown, fallback = 0): number {
  const n = toNumeric(value)
  return n === null ? fallback : n
}

function toAlertSeverity(value: string): 'info' | 'warning' | 'critical' {
  if (value === 'critical') return 'critical'
  if (value === 'warning') return 'warning'
  return 'info'
}

function toAlertState(value: string): 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'auto_resolved' {
  if (value === 'acknowledged' || value === 'in_progress' || value === 'resolved' || value === 'auto_resolved') return value
  return 'open'
}

function dedupWindowBucket(now: Date, windowMinutes: number): string {
  const ms = Math.max(1, windowMinutes) * 60_000
  return String(Math.floor(now.getTime() / ms))
}

function buildDedupKey(metricName: string, bucket: string): string {
  return `${metricName}:${bucket}`
}

function computeCorrelationId(metricName: string, bucket: string, breaches: Set<string>): string {
  const reliabilitySet = ['error_rate', 'integration_failures', 'dead_letter_count', 'retry_count']
  if (reliabilitySet.includes(metricName) && reliabilitySet.some((m) => breaches.has(m))) {
    return `reliability:${bucket}`
  }
  return `${metricName}:${bucket}`
}

function evaluateRuleBreach(
  rule: PilotAlertRule,
  currentValue: number,
  series: number[],
): { breached: boolean; trend: string; metricValue: number } {
  const safeSeries = series.filter((n) => Number.isFinite(n))
  const trailing = safeSeries.slice(0, Math.max(0, safeSeries.length - 1))
  const trailingAvg = trailing.length > 0 ? trailing.reduce((s, n) => s + n, 0) / trailing.length : currentValue

  if (rule.ruleType === 'inactivity') {
    return {
      breached: safeSeries.length === 0 || safeSeries.every((v) => v <= 0),
      trend: `activity=${currentValue}`,
      metricValue: currentValue,
    }
  }

  if (rule.ruleType === 'anomaly') {
    const lower = trailingAvg * (1 - rule.thresholdValue / 100)
    const upper = trailingAvg * (1 + rule.thresholdValue / 100)
    const breached = rule.operator === '<' ? currentValue < lower : currentValue > upper
    return {
      breached,
      trend: `current=${currentValue.toFixed(2)}, trailing_avg=${trailingAvg.toFixed(2)}`,
      metricValue: currentValue,
    }
  }

  if (rule.ruleType === 'rate') {
    const sustained = safeSeries.slice(-3)
    const thresholdCompare = (value: number): boolean => {
      if (rule.operator === '<') return value < rule.thresholdValue
      return value > rule.thresholdValue
    }
    return {
      breached: sustained.length >= 3 && sustained.every(thresholdCompare),
      trend: `recent=${sustained.join(',')}`,
      metricValue: currentValue,
    }
  }

  if (rule.operator === 'delta') {
    const delta = currentValue - trailingAvg
    return {
      breached: delta > rule.thresholdValue,
      trend: `delta=${delta.toFixed(2)} vs avg=${trailingAvg.toFixed(2)}`,
      metricValue: currentValue,
    }
  }

  if (rule.operator === 'ratio') {
    const denom = trailingAvg === 0 ? 1 : trailingAvg
    const ratio = currentValue / denom
    return {
      breached: ratio > rule.thresholdValue,
      trend: `ratio=${ratio.toFixed(2)} vs avg=${trailingAvg.toFixed(2)}`,
      metricValue: currentValue,
    }
  }

  if (rule.operator === '<') {
    return {
      breached: currentValue < rule.thresholdValue,
      trend: `${currentValue.toFixed(2)} < ${rule.thresholdValue.toFixed(2)}`,
      metricValue: currentValue,
    }
  }

  return {
    breached: currentValue > rule.thresholdValue,
    trend: `${currentValue.toFixed(2)} > ${rule.thresholdValue.toFixed(2)}`,
    metricValue: currentValue,
  }
}

async function auditAlertAction(
  orgId: string,
  alertId: string,
  action: string,
  context: AlertActionContext,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  if (!context.traceId) throw new Error(`${action} requires traceId`)
  if (!context.actorId && !context.systemActorId) throw new Error(`${action} requires actorId or systemActorId`)
  const actor = context.actorId ?? context.systemActorId!

  await platformDb.execute(sql`
    INSERT INTO audit_log (action, actor_id, entity_type, entity_id, org_id, metadata)
    VALUES (
      ${action},
      ${actor},
      'pilot_alert',
      ${alertId}::uuid,
      ${orgId}::uuid,
      ${JSON.stringify({ traceId: context.traceId, ...metadata })}::jsonb
    )
  `)
}

async function ensureDefaultAlertPolicies(pilot: PilotDefinition): Promise<void> {
  const rules = defaultRulesByPilotType[pilot.pilotType] ?? []
  for (const rule of rules) {
    await upsertPilotAlertRule(pilot.orgId, pilot.id, rule)
  }

  const existingEscalations = await listPilotAlertEscalations(pilot.orgId, pilot.id)
  if (existingEscalations.length === 0) {
    for (const escalation of defaultEscalations) {
      await upsertPilotAlertEscalation(pilot.orgId, pilot.id, escalation)
    }
  }
}

export async function listPilotAlertRules(orgId: string, pilotId: string): Promise<PilotAlertRule[]> {
  const rows = (await platformDb.execute(sql`
    SELECT
      id,
      org_id as "orgId",
      pilot_id as "pilotId",
      metric_name as "metricName",
      rule_type as "ruleType",
      operator,
      threshold_value as "thresholdValue",
      window_minutes as "windowMinutes",
      severity,
      enabled,
      cooldown_minutes as "cooldownMinutes",
      playbook_key as "playbookKey",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM pilot_alert_rules
    WHERE org_id = ${orgId}::uuid AND pilot_id = ${pilotId}::uuid
    ORDER BY metric_name, severity DESC
  `)) as unknown as Array<Record<string, unknown>>

  return rows.map((row) => PilotAlertRuleSchema.parse({
    ...row,
    thresholdValue: asNumber(row.thresholdValue),
    windowMinutes: asNumber(row.windowMinutes),
    enabled: Boolean(row.enabled),
    cooldownMinutes: asNumber(row.cooldownMinutes),
    severity: toAlertSeverity(String(row.severity ?? 'info')),
  }))
}

export async function upsertPilotAlertRule(orgId: string, pilotId: string, input: UpsertPilotAlertRuleInput): Promise<PilotAlertRule> {
  const id = crypto.randomUUID()
  const rows = (await platformDb.execute(sql`
    INSERT INTO pilot_alert_rules (
      id, org_id, pilot_id, metric_name, rule_type, operator,
      threshold_value, window_minutes, severity, enabled, cooldown_minutes, playbook_key,
      created_at, updated_at
    ) VALUES (
      ${id}::uuid,
      ${orgId}::uuid,
      ${pilotId}::uuid,
      ${input.metricName},
      ${input.ruleType},
      ${input.operator},
      ${input.thresholdValue},
      ${input.windowMinutes},
      ${input.severity},
      ${input.enabled},
      ${input.cooldownMinutes},
      ${input.playbookKey ?? null},
      NOW(), NOW()
    )
    ON CONFLICT (org_id, pilot_id, metric_name, rule_type, operator)
    DO UPDATE SET
      threshold_value = EXCLUDED.threshold_value,
      window_minutes = EXCLUDED.window_minutes,
      severity = EXCLUDED.severity,
      enabled = EXCLUDED.enabled,
      cooldown_minutes = EXCLUDED.cooldown_minutes,
      playbook_key = EXCLUDED.playbook_key,
      updated_at = NOW()
    RETURNING
      id,
      org_id as "orgId",
      pilot_id as "pilotId",
      metric_name as "metricName",
      rule_type as "ruleType",
      operator,
      threshold_value as "thresholdValue",
      window_minutes as "windowMinutes",
      severity,
      enabled,
      cooldown_minutes as "cooldownMinutes",
      playbook_key as "playbookKey",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `)) as unknown as Array<Record<string, unknown>>

  return PilotAlertRuleSchema.parse({
    ...rows[0],
    thresholdValue: asNumber(rows[0]?.thresholdValue),
    windowMinutes: asNumber(rows[0]?.windowMinutes),
    enabled: Boolean(rows[0]?.enabled),
    cooldownMinutes: asNumber(rows[0]?.cooldownMinutes),
    severity: toAlertSeverity(String(rows[0]?.severity ?? 'info')),
  })
}

export async function listPilotAlertEscalations(orgId: string, pilotId: string): Promise<PilotAlertEscalationPolicy[]> {
  const rows = (await platformDb.execute(sql`
    SELECT
      id,
      org_id as "orgId",
      pilot_id as "pilotId",
      severity,
      notify_after_minutes as "notifyAfterMinutes",
      escalation_channel as "escalationChannel",
      escalation_target as "escalationTarget",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM pilot_alert_escalations
    WHERE org_id = ${orgId}::uuid AND pilot_id = ${pilotId}::uuid
    ORDER BY notify_after_minutes ASC
  `)) as unknown as Array<Record<string, unknown>>

  return rows.map((row) => PilotAlertEscalationPolicySchema.parse({
    ...row,
    notifyAfterMinutes: asNumber(row.notifyAfterMinutes),
    severity: toAlertSeverity(String(row.severity ?? 'info')),
  }))
}

export async function upsertPilotAlertEscalation(orgId: string, pilotId: string, input: UpsertPilotAlertEscalationInput): Promise<PilotAlertEscalationPolicy> {
  const id = crypto.randomUUID()
  const rows = (await platformDb.execute(sql`
    INSERT INTO pilot_alert_escalations (
      id, org_id, pilot_id, severity, notify_after_minutes,
      escalation_channel, escalation_target, created_at, updated_at
    ) VALUES (
      ${id}::uuid,
      ${orgId}::uuid,
      ${pilotId}::uuid,
      ${input.severity},
      ${input.notifyAfterMinutes},
      ${input.escalationChannel},
      ${input.escalationTarget},
      NOW(), NOW()
    )
    ON CONFLICT DO NOTHING
    RETURNING
      id,
      org_id as "orgId",
      pilot_id as "pilotId",
      severity,
      notify_after_minutes as "notifyAfterMinutes",
      escalation_channel as "escalationChannel",
      escalation_target as "escalationTarget",
      created_at as "createdAt",
      updated_at as "updatedAt"
  `)) as unknown as Array<Record<string, unknown>>

  if (rows[0]) {
    return PilotAlertEscalationPolicySchema.parse({
      ...rows[0],
      notifyAfterMinutes: asNumber(rows[0].notifyAfterMinutes),
      severity: toAlertSeverity(String(rows[0].severity ?? 'info')),
    })
  }

  const [existing] = await listPilotAlertEscalations(orgId, pilotId).then((all) =>
    all.filter((row) => row.severity === input.severity && row.escalationChannel === input.escalationChannel && row.escalationTarget === input.escalationTarget),
  )
  if (existing) return existing
  throw new Error('Unable to upsert escalation policy')
}

const webhookNotifier: AlertNotifier = {
  channel: 'webhook',
  notify: async ({ alert, policy }) => {
    if (!policy.escalationTarget.startsWith('http://') && !policy.escalationTarget.startsWith('https://')) return
    await fetch(policy.escalationTarget, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        alertId: alert.id,
        pilotId: alert.pilotId,
        severity: alert.severity,
        metricName: alert.metricName,
        title: alert.title,
        message: alert.message,
        status: alert.status,
        playbookKey: alert.playbookKey,
      }),
    }).catch(() => {
      // No throw: escalation path must remain resilient.
    })
  },
}

const emailNotifier: AlertNotifier = {
  channel: 'email',
  notify: async () => Promise.resolve(),
}

const slackNotifier: AlertNotifier = {
  channel: 'slack',
  notify: async ({ alert, policy }) => {
    if (!policy.escalationTarget.startsWith('http://') && !policy.escalationTarget.startsWith('https://')) return
    await fetch(policy.escalationTarget, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `[Pilot Alert][${alert.severity}] ${alert.title} :: ${alert.message}` }),
    }).catch(() => {
      // Optional adapter path.
    })
  },
}

const notifierRegistry: AlertNotifier[] = [webhookNotifier, emailNotifier, slackNotifier]

function findNotifier(channel: string): AlertNotifier | null {
  return notifierRegistry.find((n) => n.channel === channel) ?? null
}

async function createOrUpdateAlertThread(params: {
  orgId: string
  pilotId: string
  rule: PilotAlertRule
  metricValue: number
  thresholdValue: number
  trend: string
  dedupKey: string
  correlationId: string
  windowStart: string
  windowEnd: string
  traceId: string
}): Promise<PilotAlert | null> {
  const existingRows = (await platformDb.execute(sql`
    SELECT
      id,
      org_id as "orgId",
      pilot_id as "pilotId",
      rule_id as "ruleId",
      alert_type as "alertType",
      severity,
      status,
      dedup_key as "dedupKey",
      correlation_id as "correlationId",
      title,
      message,
      what_happened as "whatHappened",
      why_it_matters as "whyItMatters",
      what_to_do_next as "whatToDoNext",
      playbook_key as "playbookKey",
      metric_value as "metricValue",
      threshold_value as "thresholdValue",
      window_start as "windowStart",
      window_end as "windowEnd",
      occurrence_count as "occurrenceCount",
      first_seen_at as "firstSeenAt",
      last_seen_at as "lastSeenAt",
      assignee_user_id as "assigneeUserId",
      acknowledged_by as "acknowledgedBy",
      acknowledged_at as "acknowledgedAt",
      resolved_by as "resolvedBy",
      resolution_notes as "resolutionNotes",
      escalated_at as "escalatedAt",
      metric_name as "metricName",
      detected_at as "detectedAt",
      resolved_at as "resolvedAt",
      metadata_json as "metadataJson"
    FROM pilot_alerts
    WHERE org_id = ${params.orgId}::uuid
      AND pilot_id = ${params.pilotId}::uuid
      AND dedup_key = ${params.dedupKey}
      AND status IN ('open', 'acknowledged', 'in_progress')
    ORDER BY detected_at DESC
    LIMIT 1
  `)) as unknown as Array<Record<string, unknown>>

  if (existingRows[0]) {
    const current = existingRows[0]
    const updatedRows = (await platformDb.execute(sql`
      UPDATE pilot_alerts
      SET
        occurrence_count = occurrence_count + 1,
        last_seen_at = NOW(),
        metric_value = ${params.metricValue},
        threshold_value = ${params.thresholdValue},
        correlation_id = ${params.correlationId},
        metadata_json = COALESCE(metadata_json, '{}'::jsonb) || ${JSON.stringify({ trend: params.trend, traceId: params.traceId })}::jsonb
      WHERE id = ${current.id}::uuid
      RETURNING
        id,
        org_id as "orgId",
        pilot_id as "pilotId",
        rule_id as "ruleId",
        alert_type as "alertType",
        severity,
        status,
        dedup_key as "dedupKey",
        correlation_id as "correlationId",
        title,
        message,
        what_happened as "whatHappened",
        why_it_matters as "whyItMatters",
        what_to_do_next as "whatToDoNext",
        playbook_key as "playbookKey",
        metric_value as "metricValue",
        threshold_value as "thresholdValue",
        window_start as "windowStart",
        window_end as "windowEnd",
        occurrence_count as "occurrenceCount",
        first_seen_at as "firstSeenAt",
        last_seen_at as "lastSeenAt",
        assignee_user_id as "assigneeUserId",
        acknowledged_by as "acknowledgedBy",
        acknowledged_at as "acknowledgedAt",
        resolved_by as "resolvedBy",
        resolution_notes as "resolutionNotes",
        escalated_at as "escalatedAt",
        metric_name as "metricName",
        detected_at as "detectedAt",
        resolved_at as "resolvedAt",
        metadata_json as "metadataJson"
    `)) as unknown as Array<Record<string, unknown>>

    await auditAlertAction(params.orgId, String(current.id), 'pilot.alert.updated', { systemActorId: 'system:pilot-alert-engine', traceId: params.traceId }, {
      dedupKey: params.dedupKey,
      correlationId: params.correlationId,
      metricName: params.rule.metricName,
    })

    return normalizeAlertRow(updatedRows[0])
  }

  const [latestRows] = (await platformDb.execute(sql`
    SELECT id, last_seen_at as "lastSeenAt"
    FROM pilot_alerts
    WHERE org_id = ${params.orgId}::uuid
      AND pilot_id = ${params.pilotId}::uuid
      AND rule_id = ${params.rule.id}::uuid
    ORDER BY last_seen_at DESC
    LIMIT 1
  `)) as unknown as Array<{ id: string; lastSeenAt: string }>

  if (latestRows?.lastSeenAt) {
    const elapsedMs = Date.now() - new Date(latestRows.lastSeenAt).getTime()
    if (elapsedMs < params.rule.cooldownMinutes * 60_000) {
      return null
    }
  }

  const playbook = alertPlaybooks[params.rule.playbookKey ?? '']
  const alertId = crypto.randomUUID()
  const insertedRows = (await platformDb.execute(sql`
    INSERT INTO pilot_alerts (
      id, org_id, pilot_id, rule_id, alert_type, severity, status,
      dedup_key, correlation_id, title, message,
      what_happened, why_it_matters, what_to_do_next,
      playbook_key, metric_name, metric_value, threshold_value,
      window_start, window_end,
      occurrence_count, first_seen_at, last_seen_at,
      detected_at, metadata_json
    ) VALUES (
      ${alertId}::uuid,
      ${params.orgId}::uuid,
      ${params.pilotId}::uuid,
      ${params.rule.id}::uuid,
      ${params.rule.ruleType},
      ${params.rule.severity},
      'open',
      ${params.dedupKey},
      ${params.correlationId},
      ${`[${params.rule.metricName}] ${params.rule.ruleType} alert`},
      ${`Metric ${params.rule.metricName} breached configured ${params.rule.ruleType} rule.`},
      ${playbook?.whatHappened ?? null},
      ${playbook?.whyItMatters ?? null},
      ${playbook?.whatToDoNext ?? null},
      ${params.rule.playbookKey ?? null},
      ${params.rule.metricName},
      ${params.metricValue},
      ${params.thresholdValue},
      ${params.windowStart}::timestamptz,
      ${params.windowEnd}::timestamptz,
      1,
      NOW(), NOW(),
      NOW(),
      ${JSON.stringify({ trend: params.trend, traceId: params.traceId })}::jsonb
    )
    RETURNING
      id,
      org_id as "orgId",
      pilot_id as "pilotId",
      rule_id as "ruleId",
      alert_type as "alertType",
      severity,
      status,
      dedup_key as "dedupKey",
      correlation_id as "correlationId",
      title,
      message,
      what_happened as "whatHappened",
      why_it_matters as "whyItMatters",
      what_to_do_next as "whatToDoNext",
      playbook_key as "playbookKey",
      metric_value as "metricValue",
      threshold_value as "thresholdValue",
      window_start as "windowStart",
      window_end as "windowEnd",
      occurrence_count as "occurrenceCount",
      first_seen_at as "firstSeenAt",
      last_seen_at as "lastSeenAt",
      assignee_user_id as "assigneeUserId",
      acknowledged_by as "acknowledgedBy",
      acknowledged_at as "acknowledgedAt",
      resolved_by as "resolvedBy",
      resolution_notes as "resolutionNotes",
      escalated_at as "escalatedAt",
      metric_name as "metricName",
      detected_at as "detectedAt",
      resolved_at as "resolvedAt",
      metadata_json as "metadataJson"
  `)) as unknown as Array<Record<string, unknown>>

  await auditAlertAction(params.orgId, alertId, 'pilot.alert.created', { systemActorId: 'system:pilot-alert-engine', traceId: params.traceId }, {
    dedupKey: params.dedupKey,
    correlationId: params.correlationId,
    metricName: params.rule.metricName,
    thresholdValue: params.thresholdValue,
    metricValue: params.metricValue,
  })

  return normalizeAlertRow(insertedRows[0])
}

function normalizeAlertRow(row: Record<string, unknown> | undefined): PilotAlert {
  if (!row) throw new Error('Missing alert row')
  return PilotAlertSchema.parse({
    ...row,
    severity: toAlertSeverity(String(row.severity ?? 'info')),
    status: toAlertState(String(row.status ?? 'open')),
    occurrenceCount: asNumber(row.occurrenceCount),
    metricValue: row.metricValue == null ? null : asNumber(row.metricValue),
    thresholdValue: row.thresholdValue == null ? null : asNumber(row.thresholdValue),
  })
}

async function autoResolveRecoveredAlerts(
  orgId: string,
  pilotId: string,
  activeRuleIds: Set<string>,
  traceId: string,
): Promise<void> {
  const openAlerts = await listPilotAlerts(orgId, pilotId, { status: ['open', 'acknowledged', 'in_progress'] })
  for (const alert of openAlerts) {
    if (alert.ruleId && !activeRuleIds.has(alert.ruleId)) {
      await autoResolveAlert(orgId, pilotId, alert.id, {
        systemActorId: 'system:pilot-alert-engine',
        traceId,
      }, 'Metric returned to normal')
    }
  }
}

async function evaluatePilotAlertRules(
  orgId: string,
  pilotId: string,
  metricValues: Record<string, number>,
  traceId: string,
): Promise<void> {
  const rules = await listPilotAlertRules(orgId, pilotId)
  if (rules.length === 0) return

  const breachedMetricNames = new Set<string>()
  const now = new Date()
  const activeRuleIds = new Set<string>()

  for (const rule of rules) {
    if (!rule.enabled) continue

    const windowStart = new Date(now.getTime() - rule.windowMinutes * 60_000).toISOString()
    const rollupRows = (await platformDb.execute(sql`
      SELECT value_numeric as "valueNumeric"
      FROM pilot_metric_rollups
      WHERE org_id = ${orgId}::uuid
        AND pilot_id = ${pilotId}::uuid
        AND metric_name = ${rule.metricName}
        AND computed_at >= ${windowStart}::timestamptz
      ORDER BY computed_at ASC
      LIMIT 32
    `)) as unknown as Array<{ valueNumeric: number | null }>

    const series = rollupRows.map((row) => asNumber(row.valueNumeric))
    const currentValue = Number.isFinite(metricValues[rule.metricName]) ? metricValues[rule.metricName] : (series[series.length - 1] ?? 0)
    const result = evaluateRuleBreach(rule, currentValue, series)

    if (!result.breached) continue

    breachedMetricNames.add(rule.metricName)
    activeRuleIds.add(rule.id)

    const bucket = dedupWindowBucket(now, rule.windowMinutes)
    const dedupKey = buildDedupKey(rule.metricName, bucket)
    const correlationId = computeCorrelationId(rule.metricName, bucket, breachedMetricNames)

    await createOrUpdateAlertThread({
      orgId,
      pilotId,
      rule,
      metricValue: result.metricValue,
      thresholdValue: rule.thresholdValue,
      trend: result.trend,
      dedupKey,
      correlationId,
      windowStart,
      windowEnd: now.toISOString(),
      traceId,
    })
  }

  await autoResolveRecoveredAlerts(orgId, pilotId, activeRuleIds, traceId)
}

export async function listPilotAlerts(
  orgId: string,
  pilotId: string,
  filters: { status?: Array<'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'auto_resolved'>; severity?: Array<'info' | 'warning' | 'critical'> } = {},
): Promise<PilotAlert[]> {
  const statusFilter = filters.status?.length ? filters.status : null
  const severityFilter = filters.severity?.length ? filters.severity : null

  const rows = (await platformDb.execute(sql`
    SELECT
      id,
      org_id as "orgId",
      pilot_id as "pilotId",
      rule_id as "ruleId",
      alert_type as "alertType",
      severity,
      status,
      dedup_key as "dedupKey",
      correlation_id as "correlationId",
      title,
      message,
      what_happened as "whatHappened",
      why_it_matters as "whyItMatters",
      what_to_do_next as "whatToDoNext",
      playbook_key as "playbookKey",
      metric_value as "metricValue",
      threshold_value as "thresholdValue",
      window_start as "windowStart",
      window_end as "windowEnd",
      occurrence_count as "occurrenceCount",
      first_seen_at as "firstSeenAt",
      last_seen_at as "lastSeenAt",
      assignee_user_id as "assigneeUserId",
      acknowledged_by as "acknowledgedBy",
      acknowledged_at as "acknowledgedAt",
      resolved_by as "resolvedBy",
      resolution_notes as "resolutionNotes",
      escalated_at as "escalatedAt",
      metric_name as "metricName",
      detected_at as "detectedAt",
      resolved_at as "resolvedAt",
      metadata_json as "metadataJson"
    FROM pilot_alerts
    WHERE org_id = ${orgId}::uuid
      AND pilot_id = ${pilotId}::uuid
      AND (${statusFilter}::text[] IS NULL OR status = ANY(${statusFilter}::text[]))
      AND (${severityFilter}::text[] IS NULL OR severity = ANY(${severityFilter}::text[]))
    ORDER BY last_seen_at DESC
    LIMIT 400
  `)) as unknown as Array<Record<string, unknown>>

  return rows.map(normalizeAlertRow)
}

export async function listAlertInbox(
  orgId: string,
  filters: { severity?: Array<'info' | 'warning' | 'critical'>; status?: Array<'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'auto_resolved'>; activeIncidentsOnly?: boolean } = {},
): Promise<PilotAlert[]> {
  const severityFilter = filters.severity?.length ? filters.severity : null
  const statusFilter = filters.status?.length
    ? filters.status
    : filters.activeIncidentsOnly
      ? ['open', 'acknowledged', 'in_progress']
      : null

  const rows = (await platformDb.execute(sql`
    SELECT
      id,
      org_id as "orgId",
      pilot_id as "pilotId",
      rule_id as "ruleId",
      alert_type as "alertType",
      severity,
      status,
      dedup_key as "dedupKey",
      correlation_id as "correlationId",
      title,
      message,
      what_happened as "whatHappened",
      why_it_matters as "whyItMatters",
      what_to_do_next as "whatToDoNext",
      playbook_key as "playbookKey",
      metric_value as "metricValue",
      threshold_value as "thresholdValue",
      window_start as "windowStart",
      window_end as "windowEnd",
      occurrence_count as "occurrenceCount",
      first_seen_at as "firstSeenAt",
      last_seen_at as "lastSeenAt",
      assignee_user_id as "assigneeUserId",
      acknowledged_by as "acknowledgedBy",
      acknowledged_at as "acknowledgedAt",
      resolved_by as "resolvedBy",
      resolution_notes as "resolutionNotes",
      escalated_at as "escalatedAt",
      metric_name as "metricName",
      detected_at as "detectedAt",
      resolved_at as "resolvedAt",
      metadata_json as "metadataJson"
    FROM pilot_alerts
    WHERE org_id = ${orgId}::uuid
      AND (${statusFilter}::text[] IS NULL OR status = ANY(${statusFilter}::text[]))
      AND (${severityFilter}::text[] IS NULL OR severity = ANY(${severityFilter}::text[]))
    ORDER BY last_seen_at DESC
    LIMIT 600
  `)) as unknown as Array<Record<string, unknown>>

  return rows.map(normalizeAlertRow)
}

async function updateAlertState(
  orgId: string,
  pilotId: string,
  alertId: string,
  nextState: 'acknowledged' | 'in_progress' | 'resolved' | 'auto_resolved',
  context: AlertActionContext,
  resolutionNotes?: string,
): Promise<PilotAlert> {
  const actor = context.actorId ?? context.systemActorId
  if (!actor) throw new Error('alert state change requires actorId or systemActorId')
  if (!context.traceId) throw new Error('alert state change requires traceId')

  const rows = (await platformDb.execute(sql`
    UPDATE pilot_alerts
    SET
      status = ${nextState},
      acknowledged_by = CASE WHEN ${nextState} = 'acknowledged' THEN ${actor} ELSE acknowledged_by END,
      acknowledged_at = CASE WHEN ${nextState} = 'acknowledged' THEN NOW() ELSE acknowledged_at END,
      resolved_by = CASE WHEN ${nextState} IN ('resolved', 'auto_resolved') THEN ${actor} ELSE resolved_by END,
      resolved_at = CASE WHEN ${nextState} IN ('resolved', 'auto_resolved') THEN NOW() ELSE resolved_at END,
      resolution_notes = COALESCE(${resolutionNotes ?? null}, resolution_notes),
      last_seen_at = NOW()
    WHERE id = ${alertId}::uuid
      AND org_id = ${orgId}::uuid
      AND pilot_id = ${pilotId}::uuid
    RETURNING
      id,
      org_id as "orgId",
      pilot_id as "pilotId",
      rule_id as "ruleId",
      alert_type as "alertType",
      severity,
      status,
      dedup_key as "dedupKey",
      correlation_id as "correlationId",
      title,
      message,
      what_happened as "whatHappened",
      why_it_matters as "whyItMatters",
      what_to_do_next as "whatToDoNext",
      playbook_key as "playbookKey",
      metric_value as "metricValue",
      threshold_value as "thresholdValue",
      window_start as "windowStart",
      window_end as "windowEnd",
      occurrence_count as "occurrenceCount",
      first_seen_at as "firstSeenAt",
      last_seen_at as "lastSeenAt",
      assignee_user_id as "assigneeUserId",
      acknowledged_by as "acknowledgedBy",
      acknowledged_at as "acknowledgedAt",
      resolved_by as "resolvedBy",
      resolution_notes as "resolutionNotes",
      escalated_at as "escalatedAt",
      metric_name as "metricName",
      detected_at as "detectedAt",
      resolved_at as "resolvedAt",
      metadata_json as "metadataJson"
  `)) as unknown as Array<Record<string, unknown>>

  if (!rows[0]) throw new Error('Alert not found')

  await auditAlertAction(orgId, alertId, `pilot.alert.${nextState}`, context, {
    pilotId,
    status: nextState,
  })

  return normalizeAlertRow(rows[0])
}

export async function acknowledgeAlert(orgId: string, pilotId: string, alertId: string, context: AlertActionContext): Promise<PilotAlert> {
  return updateAlertState(orgId, pilotId, alertId, 'acknowledged', context)
}

export async function resolveAlert(orgId: string, pilotId: string, alertId: string, context: AlertActionContext, resolutionNotes?: string): Promise<PilotAlert> {
  return updateAlertState(orgId, pilotId, alertId, 'resolved', context, resolutionNotes)
}

export async function autoResolveAlert(orgId: string, pilotId: string, alertId: string, context: AlertActionContext, resolutionNotes?: string): Promise<PilotAlert> {
  return updateAlertState(orgId, pilotId, alertId, 'auto_resolved', context, resolutionNotes)
}

export async function escalateAlert(orgId: string, pilotId: string, alertId: string, context: AlertActionContext, manual = true): Promise<PilotAlert> {
  const [alert] = await listPilotAlerts(orgId, pilotId).then((rows) => rows.filter((row) => row.id === alertId))
  if (!alert) throw new Error('Alert not found')

  const policies = await listPilotAlertEscalations(orgId, pilotId)
  const matching = policies.filter((policy) => policy.severity === alert.severity)
  for (const policy of matching) {
    const notifier = findNotifier(policy.escalationChannel)
    if (!notifier) continue
    await notifier.notify({ alert, policy, orgId, pilotId })
  }

  const rows = (await platformDb.execute(sql`
    UPDATE pilot_alerts
    SET escalated_at = NOW(), last_seen_at = NOW()
    WHERE id = ${alertId}::uuid
      AND org_id = ${orgId}::uuid
      AND pilot_id = ${pilotId}::uuid
    RETURNING
      id,
      org_id as "orgId",
      pilot_id as "pilotId",
      rule_id as "ruleId",
      alert_type as "alertType",
      severity,
      status,
      dedup_key as "dedupKey",
      correlation_id as "correlationId",
      title,
      message,
      what_happened as "whatHappened",
      why_it_matters as "whyItMatters",
      what_to_do_next as "whatToDoNext",
      playbook_key as "playbookKey",
      metric_value as "metricValue",
      threshold_value as "thresholdValue",
      window_start as "windowStart",
      window_end as "windowEnd",
      occurrence_count as "occurrenceCount",
      first_seen_at as "firstSeenAt",
      last_seen_at as "lastSeenAt",
      assignee_user_id as "assigneeUserId",
      acknowledged_by as "acknowledgedBy",
      acknowledged_at as "acknowledgedAt",
      resolved_by as "resolvedBy",
      resolution_notes as "resolutionNotes",
      escalated_at as "escalatedAt",
      metric_name as "metricName",
      detected_at as "detectedAt",
      resolved_at as "resolvedAt",
      metadata_json as "metadataJson"
  `)) as unknown as Array<Record<string, unknown>>

  await auditAlertAction(orgId, alertId, 'pilot.alert.escalated', context, {
    pilotId,
    manual,
    channels: matching.map((m) => m.escalationChannel),
  })

  return normalizeAlertRow(rows[0])
}

async function runEscalationSweep(orgId: string, pilotId: string, traceId: string): Promise<void> {
  const policies = await listPilotAlertEscalations(orgId, pilotId)
  if (policies.length === 0) return
  const openAlerts = await listPilotAlerts(orgId, pilotId, { status: ['open', 'acknowledged', 'in_progress'] })

  for (const alert of openAlerts) {
    const ageMinutes = (Date.now() - new Date(alert.firstSeenAt).getTime()) / 60_000
    const policyCandidates = policies.filter((policy) => policy.severity === alert.severity)
    for (const policy of policyCandidates) {
      if (ageMinutes < policy.notifyAfterMinutes && !(alert.severity === 'critical' && policy.notifyAfterMinutes === 0)) continue
      const alreadyEscalatedRecently = alert.escalatedAt
        ? (Date.now() - new Date(alert.escalatedAt).getTime()) < 10 * 60_000
        : false
      if (alreadyEscalatedRecently) continue

      await escalateAlert(orgId, pilotId, alert.id, {
        systemActorId: 'system:pilot-alert-escalation',
        traceId,
      }, false)
    }
  }
}

export async function computeAlertOpsMetrics(orgId: string, pilotId: string, windowDays = 30): Promise<PilotAlertOpsMetrics> {
  const start = new Date(Date.now() - windowDays * 86_400_000).toISOString()
  const rows = (await platformDb.execute(sql`
    SELECT
      severity,
      status,
      detected_at as "detectedAt",
      acknowledged_at as "acknowledgedAt",
      resolved_at as "resolvedAt"
    FROM pilot_alerts
    WHERE org_id = ${orgId}::uuid
      AND pilot_id = ${pilotId}::uuid
      AND detected_at >= ${start}::timestamptz
  `)) as unknown as Array<{
    severity: string
    status: string
    detectedAt: string
    acknowledgedAt: string | null
    resolvedAt: string | null
  }>

  const base: Record<string, { mttaList: number[]; mttrList: number[]; openCount: number; resolvedCount: number }> = {
    info: { mttaList: [], mttrList: [], openCount: 0, resolvedCount: 0 },
    warning: { mttaList: [], mttrList: [], openCount: 0, resolvedCount: 0 },
    critical: { mttaList: [], mttrList: [], openCount: 0, resolvedCount: 0 },
  }

  for (const row of rows) {
    const sev = toAlertSeverity(row.severity)
    const bucket = base[sev]
    if (row.status === 'open' || row.status === 'acknowledged' || row.status === 'in_progress') bucket.openCount += 1
    if (row.resolvedAt) bucket.resolvedCount += 1

    if (row.acknowledgedAt) {
      bucket.mttaList.push((new Date(row.acknowledgedAt).getTime() - new Date(row.detectedAt).getTime()) / 60_000)
    }
    if (row.resolvedAt) {
      bucket.mttrList.push((new Date(row.resolvedAt).getTime() - new Date(row.detectedAt).getTime()) / 60_000)
    }
  }

  const avg = (values: number[]): number => values.length ? values.reduce((s, n) => s + n, 0) / values.length : 0
  const bySeverity: PilotAlertOpsMetrics['bySeverity'] = {
    info: {
      mttaMinutes: avg(base.info.mttaList),
      mttrMinutes: avg(base.info.mttrList),
      openCount: base.info.openCount,
      resolvedCount: base.info.resolvedCount,
    },
    warning: {
      mttaMinutes: avg(base.warning.mttaList),
      mttrMinutes: avg(base.warning.mttrList),
      openCount: base.warning.openCount,
      resolvedCount: base.warning.resolvedCount,
    },
    critical: {
      mttaMinutes: avg(base.critical.mttaList),
      mttrMinutes: avg(base.critical.mttrList),
      openCount: base.critical.openCount,
      resolvedCount: base.critical.resolvedCount,
    },
  }

  const metrics = PilotAlertOpsMetricsSchema.parse({
    pilotId,
    orgId,
    windowDays,
    mttaMinutes: avg([...base.info.mttaList, ...base.warning.mttaList, ...base.critical.mttaList]),
    mttrMinutes: avg([...base.info.mttrList, ...base.warning.mttrList, ...base.critical.mttrList]),
    bySeverity,
  })

  return metrics
}

interface ScoringProfile {
  adoptionWeight: number
  operationsWeight: number
  reliabilityWeight: number
  revenueWeight: number
  workflowWeight: number
}

const scoringProfiles: Record<PilotType, ScoringProfile> = {
  'enterprise-workflow': {
    adoptionWeight: 0.2,
    operationsWeight: 0.3,
    reliabilityWeight: 0.2,
    revenueWeight: 0.1,
    workflowWeight: 0.2,
  },
  'event-creator': {
    adoptionWeight: 0.25,
    operationsWeight: 0.15,
    reliabilityWeight: 0.2,
    revenueWeight: 0.3,
    workflowWeight: 0.1,
  },
  enterprise: {
    adoptionWeight: 0.2,
    operationsWeight: 0.25,
    reliabilityWeight: 0.2,
    revenueWeight: 0.2,
    workflowWeight: 0.15,
  },
  internal: {
    adoptionWeight: 0.3,
    operationsWeight: 0.2,
    reliabilityWeight: 0.25,
    revenueWeight: 0.05,
    workflowWeight: 0.2,
  },
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function scoreFromMetric(values: Record<string, number>, positive: string[], negative: string[]): number {
  let score = 50
  for (const metric of positive) score += Math.min(values[metric] ?? 0, 50) * 0.5
  for (const metric of negative) score -= Math.min(values[metric] ?? 0, 50) * 0.5
  return clampScore(score)
}

export const __test__ = {
  clampScore,
  scoreFromMetric,
  buildWindow,
  aggregateMetricEvents,
  dedupWindowBucket,
  buildDedupKey,
  computeCorrelationId,
  evaluateRuleBreach,
  createOrUpdateAlertThread,
  runEscalationSweep,
}

export async function computePilotHealthScore(orgId: string, pilotId: string): Promise<PilotHealthScore> {
  const [pilot] = await listPilots(orgId).then((rows) => rows.filter((r) => r.id === pilotId))
  if (!pilot) throw new Error('Pilot not found')

  const rollups = await getPilotMetrics(orgId, pilotId)
  const metricValues: Record<string, number> = {}
  for (const rollup of rollups) {
    metricValues[rollup.metricName] = Number(rollup.valueNumeric ?? 0)
  }

  const adoption = scoreFromMetric(metricValues, ['daily_active_users', 'weekly_active_users', 'repeat_usage_rate', 'stream_starts', 'tickets_sold'], ['time_to_first_value'])
  const operations = scoreFromMetric(metricValues, ['cases_created', 'cases_acknowledged', 'assignment_efficiency', 'sla_compliance_rate'], ['sla_breach_count', 'overdue_case_count'])
  const reliability = scoreFromMetric(metricValues, ['uptime_percent', 'audit_event_coverage'], ['error_rate', 'critical_failures', 'dead_letter_count', 'integration_failures'])
  const revenue = scoreFromMetric(metricValues, ['gross_revenue', 'net_revenue', 'platform_fee_revenue', 'gross_ticket_revenue'], ['refund_count', 'failed_payment_count'])
  const workflow = scoreFromMetric(metricValues, ['workflow_transition_success_rate', 'outbound_events_delivered'], ['workflow_failures', 'mapping_failures'])

  const traceId = `pilot-health:${pilotId}:${Date.now()}`
  await ensureDefaultAlertPolicies(pilot)
  await evaluatePilotAlertRules(orgId, pilotId, metricValues, traceId)
  await runEscalationSweep(orgId, pilotId, traceId)

  const alertOps = await computeAlertOpsMetrics(orgId, pilotId, 30)
  const reliabilityPenalty = clampScore((alertOps.mttaMinutes / 30) + (alertOps.mttrMinutes / 60))
  const adjustedReliability = clampScore(reliability - reliabilityPenalty)

  const profile = scoringProfiles[pilot.pilotType]
  const total = clampScore(
    adoption * profile.adoptionWeight +
    operations * profile.operationsWeight +
    adjustedReliability * profile.reliabilityWeight +
    revenue * profile.revenueWeight +
    workflow * profile.workflowWeight,
  )

  const riskLevel: 'low' | 'medium' | 'high' = total >= 80 ? 'low' : total >= 60 ? 'medium' : 'high'

  const id = crypto.randomUUID()
  const rows = (await platformDb.execute(sql`
    INSERT INTO pilot_health_scores (
      id, org_id, pilot_id,
      score_total, score_adoption, score_operations, score_reliability, score_revenue, score_workflow,
      risk_level, computed_at, rationale_json
    ) VALUES (
      ${id}::uuid, ${orgId}::uuid, ${pilotId}::uuid,
      ${total}, ${adoption}, ${operations}, ${adjustedReliability}, ${revenue}, ${workflow},
      ${riskLevel}, NOW(),
      ${JSON.stringify({
        profile: pilot.pilotType,
        metricsUsed: Object.keys(metricValues).sort(),
        mttaMinutes: alertOps.mttaMinutes,
        mttrMinutes: alertOps.mttrMinutes,
      })}::jsonb
    )
    RETURNING
      id,
      org_id as "orgId",
      pilot_id as "pilotId",
      score_total as "scoreTotal",
      score_adoption as "scoreAdoption",
      score_operations as "scoreOperations",
      score_reliability as "scoreReliability",
      score_revenue as "scoreRevenue",
      score_workflow as "scoreWorkflow",
      risk_level as "riskLevel",
      computed_at as "computedAt",
      rationale_json as "rationaleJson"
  `)) as unknown as PilotHealthScore[]

  return rows[0]
}

export async function getPilotMetrics(orgId: string, pilotId: string): Promise<PilotMetricRollup[]> {
  return (await platformDb.execute(sql`
    SELECT
      id,
      org_id as "orgId",
      pilot_id as "pilotId",
      app_scope as "appScope",
      metric_name as "metricName",
      window_type as "windowType",
      window_start as "windowStart",
      window_end as "windowEnd",
      value_numeric as "valueNumeric",
      value_json as "valueJson",
      computed_at as "computedAt"
    FROM pilot_metric_rollups
    WHERE org_id = ${orgId}::uuid
      AND pilot_id = ${pilotId}::uuid
    ORDER BY window_start DESC, metric_name ASC
    LIMIT 500
  `)) as unknown as PilotMetricRollup[]
}

export async function getPilotHealthScore(orgId: string, pilotId: string): Promise<PilotHealthScore | null> {
  const rows = (await platformDb.execute(sql`
    SELECT
      id,
      org_id as "orgId",
      pilot_id as "pilotId",
      score_total as "scoreTotal",
      score_adoption as "scoreAdoption",
      score_operations as "scoreOperations",
      score_reliability as "scoreReliability",
      score_revenue as "scoreRevenue",
      score_workflow as "scoreWorkflow",
      risk_level as "riskLevel",
      computed_at as "computedAt",
      rationale_json as "rationaleJson"
    FROM pilot_health_scores
    WHERE org_id = ${orgId}::uuid
      AND pilot_id = ${pilotId}::uuid
    ORDER BY computed_at DESC
    LIMIT 1
  `)) as unknown as PilotHealthScore[]

  return rows[0] ?? null
}

export async function getPilotSummary(orgId: string, pilotId: string): Promise<{
  pilot: PilotDefinition
  metrics: PilotMetricRollup[]
  health: PilotHealthScore | null
  alerts: PilotAlert[]
}> {
  const pilots = await listPilots(orgId)
  const pilot = pilots.find((p) => p.id === pilotId)
  if (!pilot) throw new Error('Pilot not found')

  const [metrics, health, alerts] = await Promise.all([
    getPilotMetrics(orgId, pilotId),
    getPilotHealthScore(orgId, pilotId),
    listPilotAlerts(orgId, pilotId),
  ])

  return { pilot, metrics, health, alerts }
}

function csvEscape(v: string | number | null): string {
  if (v === null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replaceAll('"', '""')}"`
  return s
}

export async function exportPilotReport(orgId: string, pilotId: string, format: 'json' | 'csv' | 'markdown' = 'json'): Promise<{ contentType: string; fileName: string; body: string }> {
  const summary = await getPilotSummary(orgId, pilotId)
  const latestHealth = summary.health

  const kpis: Record<string, number> = {}
  for (const row of summary.metrics) {
    if (PilotMetricNameSchema.safeParse(row.metricName).success) {
      kpis[row.metricName] = Number(row.valueNumeric ?? 0)
    }
  }

  const report: PilotReport = {
    pilot: summary.pilot,
    generatedAt: new Date().toISOString(),
    kpis,
    health: latestHealth,
    alerts: summary.alerts,
    narrative: {
      whatHappened: `Pilot ${summary.pilot.pilotName} collected ${summary.metrics.length} rollup datapoints.`,
      whatImproved: `Operational/adoption indicators moved to adoption=${latestHealth?.scoreAdoption ?? 0} and operations=${latestHealth?.scoreOperations ?? 0}.`,
      revenueMoved: `Gross revenue=${kpis.gross_revenue ?? 0}, net revenue=${kpis.net_revenue ?? 0}, platform fee=${kpis.platform_fee_revenue ?? 0}.`,
      risksAppeared: summary.alerts.length > 0 ? `${summary.alerts.length} active/recorded alerts detected.` : 'No active alerts detected in current window.',
      recommendation: (latestHealth?.scoreTotal ?? 0) >= 75
        ? 'Pilot is healthy enough to expand cohort.'
        : 'Pilot requires remediation before expansion.',
    },
  }

  if (format === 'json') {
    return {
      contentType: 'application/json; charset=utf-8',
      fileName: `pilot-report-${pilotId}.json`,
      body: JSON.stringify(report, null, 2),
    }
  }

  if (format === 'csv') {
    const header = 'metric_name,window_type,window_start,window_end,value_numeric\n'
    const rows = summary.metrics
      .map((m) => [
        csvEscape(m.metricName),
        csvEscape(m.windowType),
        csvEscape(m.windowStart),
        csvEscape(m.windowEnd),
        csvEscape(m.valueNumeric ?? null),
      ].join(','))
      .join('\n')

    return {
      contentType: 'text/csv; charset=utf-8',
      fileName: `pilot-rollups-${pilotId}.csv`,
      body: `${header}${rows}\n`,
    }
  }

  const md = [
    `# Pilot Report: ${summary.pilot.pilotName}`,
    '',
    `- Org: ${summary.pilot.orgId}`,
    `- App scope: ${summary.pilot.appScope}`,
    `- Pilot type: ${summary.pilot.pilotType}`,
    `- Status: ${summary.pilot.status}`,
    `- Generated: ${report.generatedAt}`,
    '',
    '## Health',
    '',
    `- Total: ${latestHealth?.scoreTotal ?? 0}`,
    `- Adoption: ${latestHealth?.scoreAdoption ?? 0}`,
    `- Operations: ${latestHealth?.scoreOperations ?? 0}`,
    `- Reliability: ${latestHealth?.scoreReliability ?? 0}`,
    `- Revenue: ${latestHealth?.scoreRevenue ?? 0}`,
    `- Workflow: ${latestHealth?.scoreWorkflow ?? 0}`,
    `- Risk: ${latestHealth?.riskLevel ?? 'unknown'}`,
    '',
    '## Narrative',
    '',
    `- What happened: ${report.narrative.whatHappened}`,
    `- What improved: ${report.narrative.whatImproved}`,
    `- Revenue moved: ${report.narrative.revenueMoved}`,
    `- Risks: ${report.narrative.risksAppeared}`,
    `- Recommendation: ${report.narrative.recommendation}`,
    '',
    '## Alerts',
    '',
    ...(summary.alerts.length > 0
      ? summary.alerts.map((a) => `- [${a.severity}] ${a.title}: ${a.message}`)
      : ['- None']),
  ].join('\n')

  return {
    contentType: 'text/markdown; charset=utf-8',
    fileName: `pilot-report-${pilotId}.md`,
    body: md,
  }
}
