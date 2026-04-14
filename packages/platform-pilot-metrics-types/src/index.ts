import { z } from 'zod'

export const PilotPhaseSchema = z.enum(['planned', 'onboarding', 'active', 'paused', 'completed'])
export type PilotPhase = z.infer<typeof PilotPhaseSchema>

export const PilotTypeSchema = z.enum(['enterprise-workflow', 'event-creator', 'internal', 'enterprise'])
export type PilotType = z.infer<typeof PilotTypeSchema>

export const PilotMetricTypeSchema = z.enum([
  'platform',
  'adoption',
  'operations',
  'reliability',
  'revenue',
  'workflow',
  'integration',
])
export type PilotMetricType = z.infer<typeof PilotMetricTypeSchema>

export const PilotAppScopeSchema = z.enum(['union-eyes', 'zonga', 'flow', 'control-plane', 'platform'])
export type PilotAppScope = z.infer<typeof PilotAppScopeSchema>

export const PilotMetricNameSchema = z.enum([
  'active_users', 'sessions', 'api_latency_ms', 'error_rate', 'uptime_percent', 'p95_response_ms', 'critical_failures', 'audit_event_coverage', 'integration_failures', 'workflow_failures',
  'daily_active_users', 'weekly_active_users', 'actions_per_user', 'repeat_usage_rate', 'time_to_first_value', 'role_based_adoption', 'onboarding_completion_rate',
  'cases_created', 'cases_acknowledged', 'avg_time_to_first_response', 'avg_time_to_resolution', 'sla_compliance_rate', 'sla_breach_count', 'overdue_case_count', 'evidence_pack_exports', 'workflow_transition_success_rate', 'assignment_efficiency', 'per_rep_case_load',
  'events_created', 'tickets_sold', 'gross_ticket_revenue', 'platform_fee_revenue', 'attendee_checkins', 'stream_starts', 'stream_watch_minutes', 'avg_watch_time', 'creator_payouts', 'replay_views', 'event_conversion_rate', 'repeat_attendee_rate',
  'gross_revenue', 'net_revenue', 'payout_volume', 'subscription_revenue', 'transaction_count', 'refund_count', 'failed_payment_count',
  'inbound_events_processed', 'outbound_events_delivered', 'retry_count', 'dead_letter_count', 'mapping_failures', 'sync_latency_ms',
])
export type PilotMetricName = z.infer<typeof PilotMetricNameSchema>

export const PilotAlertSeveritySchema = z.enum(['info', 'warning', 'critical'])
export type PilotAlertSeverity = z.infer<typeof PilotAlertSeveritySchema>

export const PilotAlertStateSchema = z.enum(['open', 'acknowledged', 'in_progress', 'resolved', 'auto_resolved'])
export type PilotAlertState = z.infer<typeof PilotAlertStateSchema>

export const PilotAlertRuleTypeSchema = z.enum(['threshold', 'rate', 'anomaly', 'inactivity'])
export type PilotAlertRuleType = z.infer<typeof PilotAlertRuleTypeSchema>

export const PilotAlertOperatorSchema = z.enum(['>', '<', 'delta', 'ratio'])
export type PilotAlertOperator = z.infer<typeof PilotAlertOperatorSchema>

export const PilotEscalationChannelSchema = z.enum(['email', 'webhook', 'slack', 'sms'])
export type PilotEscalationChannel = z.infer<typeof PilotEscalationChannelSchema>

export const PilotDefinitionSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  appScope: PilotAppScopeSchema,
  pilotName: z.string().min(1),
  pilotType: PilotTypeSchema,
  status: PilotPhaseSchema,
  startedAt: z.string().datetime().nullable(),
  targetEndAt: z.string().datetime().nullable(),
  ownerUserId: z.string().min(1).nullable(),
  metadataJson: z.record(z.unknown()).default({}),
})
export type PilotDefinition = z.infer<typeof PilotDefinitionSchema>

export const PilotMetricDefinitionSchema = z.object({
  metricName: PilotMetricNameSchema,
  metricType: PilotMetricTypeSchema,
  description: z.string(),
  unit: z.string(),
  direction: z.enum(['higher_better', 'lower_better']),
})
export type PilotMetricDefinition = z.infer<typeof PilotMetricDefinitionSchema>

export const PilotMetricEventSchema = z.object({
  id: z.string().uuid().optional(),
  orgId: z.string().uuid(),
  pilotId: z.string().uuid(),
  appScope: PilotAppScopeSchema,
  metricType: PilotMetricTypeSchema,
  metricName: PilotMetricNameSchema,
  valueNumeric: z.number().optional(),
  valueJson: z.record(z.unknown()).optional(),
  entityId: z.string().optional(),
  entityType: z.string().optional(),
  traceId: z.string().optional(),
  occurredAt: z.string().datetime(),
})
export type PilotMetricEvent = z.infer<typeof PilotMetricEventSchema>

export const PilotMetricRollupSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  pilotId: z.string().uuid(),
  appScope: PilotAppScopeSchema,
  metricName: PilotMetricNameSchema,
  windowType: z.enum(['hour', 'day', 'week']),
  windowStart: z.string().datetime(),
  windowEnd: z.string().datetime(),
  valueNumeric: z.number().nullable(),
  valueJson: z.record(z.unknown()).nullable(),
  computedAt: z.string().datetime(),
})
export type PilotMetricRollup = z.infer<typeof PilotMetricRollupSchema>

export const PilotHealthScoreSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  pilotId: z.string().uuid(),
  scoreTotal: z.number(),
  scoreAdoption: z.number(),
  scoreOperations: z.number(),
  scoreReliability: z.number(),
  scoreRevenue: z.number(),
  scoreWorkflow: z.number(),
  riskLevel: z.enum(['low', 'medium', 'high']),
  computedAt: z.string().datetime(),
  rationaleJson: z.record(z.unknown()),
})
export type PilotHealthScore = z.infer<typeof PilotHealthScoreSchema>

export const PilotAlertSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  pilotId: z.string().uuid(),
  ruleId: z.string().uuid().nullable().optional(),
  alertType: z.string(),
  severity: PilotAlertSeveritySchema,
  status: PilotAlertStateSchema,
  dedupKey: z.string(),
  correlationId: z.string().nullable(),
  title: z.string(),
  message: z.string(),
  whatHappened: z.string().nullable().optional(),
  whyItMatters: z.string().nullable().optional(),
  whatToDoNext: z.string().nullable().optional(),
  playbookKey: z.string().nullable().optional(),
  metricValue: z.number().nullable().optional(),
  thresholdValue: z.number().nullable().optional(),
  windowStart: z.string().datetime().nullable().optional(),
  windowEnd: z.string().datetime().nullable().optional(),
  occurrenceCount: z.number().int().nonnegative(),
  firstSeenAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  assigneeUserId: z.string().nullable().optional(),
  acknowledgedBy: z.string().nullable().optional(),
  acknowledgedAt: z.string().datetime().nullable().optional(),
  resolvedBy: z.string().nullable().optional(),
  resolutionNotes: z.string().nullable().optional(),
  escalatedAt: z.string().datetime().nullable().optional(),
  metricName: z.string().nullable(),
  detectedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  metadataJson: z.record(z.unknown()).default({}),
})
export type PilotAlert = z.infer<typeof PilotAlertSchema>

export const PilotAlertRuleSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  pilotId: z.string().uuid(),
  metricName: PilotMetricNameSchema,
  ruleType: PilotAlertRuleTypeSchema,
  operator: PilotAlertOperatorSchema,
  thresholdValue: z.number(),
  windowMinutes: z.number().int().positive(),
  severity: PilotAlertSeveritySchema,
  enabled: z.boolean(),
  cooldownMinutes: z.number().int().nonnegative(),
  playbookKey: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type PilotAlertRule = z.infer<typeof PilotAlertRuleSchema>

export const PilotAlertEscalationPolicySchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  pilotId: z.string().uuid(),
  severity: PilotAlertSeveritySchema,
  notifyAfterMinutes: z.number().int().nonnegative(),
  escalationChannel: PilotEscalationChannelSchema,
  escalationTarget: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type PilotAlertEscalationPolicy = z.infer<typeof PilotAlertEscalationPolicySchema>

export const PilotAlertOpsMetricsSchema = z.object({
  pilotId: z.string().uuid(),
  orgId: z.string().uuid(),
  windowDays: z.number().int().positive(),
  mttaMinutes: z.number(),
  mttrMinutes: z.number(),
  bySeverity: z.record(z.object({
    mttaMinutes: z.number(),
    mttrMinutes: z.number(),
    openCount: z.number().int().nonnegative(),
    resolvedCount: z.number().int().nonnegative(),
  })),
})
export type PilotAlertOpsMetrics = z.infer<typeof PilotAlertOpsMetricsSchema>

export const PilotSnapshotSchema = z.object({
  pilot: PilotDefinitionSchema,
  health: PilotHealthScoreSchema.nullable(),
  rollups: z.array(PilotMetricRollupSchema),
  alerts: z.array(PilotAlertSchema),
})
export type PilotSnapshot = z.infer<typeof PilotSnapshotSchema>

export const PilotReportSchema = z.object({
  pilot: PilotDefinitionSchema,
  generatedAt: z.string().datetime(),
  kpis: z.record(z.number()),
  health: PilotHealthScoreSchema.nullable(),
  alerts: z.array(PilotAlertSchema),
  narrative: z.object({
    whatHappened: z.string(),
    whatImproved: z.string(),
    revenueMoved: z.string(),
    risksAppeared: z.string(),
    recommendation: z.string(),
  }),
})
export type PilotReport = z.infer<typeof PilotReportSchema>

export const PILOT_METRIC_TAXONOMY: PilotMetricDefinition[] = [
  { metricName: 'active_users', metricType: 'platform', description: 'Active users in pilot window', unit: 'count', direction: 'higher_better' },
  { metricName: 'sessions', metricType: 'platform', description: 'User sessions', unit: 'count', direction: 'higher_better' },
  { metricName: 'api_latency_ms', metricType: 'platform', description: 'Average API latency', unit: 'ms', direction: 'lower_better' },
  { metricName: 'error_rate', metricType: 'reliability', description: 'Error rate', unit: 'ratio', direction: 'lower_better' },
  { metricName: 'uptime_percent', metricType: 'reliability', description: 'Uptime percentage', unit: 'percent', direction: 'higher_better' },
  { metricName: 'p95_response_ms', metricType: 'reliability', description: 'P95 response latency', unit: 'ms', direction: 'lower_better' },
  { metricName: 'critical_failures', metricType: 'reliability', description: 'Critical failure count', unit: 'count', direction: 'lower_better' },
  { metricName: 'audit_event_coverage', metricType: 'workflow', description: 'Coverage of auditable actions', unit: 'percent', direction: 'higher_better' },
  { metricName: 'integration_failures', metricType: 'integration', description: 'Integration failures', unit: 'count', direction: 'lower_better' },
  { metricName: 'workflow_failures', metricType: 'workflow', description: 'Workflow failures', unit: 'count', direction: 'lower_better' },
  { metricName: 'daily_active_users', metricType: 'adoption', description: 'Daily active users', unit: 'count', direction: 'higher_better' },
  { metricName: 'weekly_active_users', metricType: 'adoption', description: 'Weekly active users', unit: 'count', direction: 'higher_better' },
  { metricName: 'actions_per_user', metricType: 'adoption', description: 'Actions per active user', unit: 'ratio', direction: 'higher_better' },
  { metricName: 'repeat_usage_rate', metricType: 'adoption', description: 'Repeat usage rate', unit: 'percent', direction: 'higher_better' },
  { metricName: 'time_to_first_value', metricType: 'adoption', description: 'Time to first value', unit: 'minutes', direction: 'lower_better' },
  { metricName: 'role_based_adoption', metricType: 'adoption', description: 'Adoption segmented by role', unit: 'count', direction: 'higher_better' },
  { metricName: 'onboarding_completion_rate', metricType: 'adoption', description: 'Onboarding completion rate', unit: 'percent', direction: 'higher_better' },
  { metricName: 'cases_created', metricType: 'operations', description: 'Cases created', unit: 'count', direction: 'higher_better' },
  { metricName: 'cases_acknowledged', metricType: 'operations', description: 'Cases acknowledged', unit: 'count', direction: 'higher_better' },
  { metricName: 'avg_time_to_first_response', metricType: 'operations', description: 'Average first response time', unit: 'minutes', direction: 'lower_better' },
  { metricName: 'avg_time_to_resolution', metricType: 'operations', description: 'Average resolution time', unit: 'hours', direction: 'lower_better' },
  { metricName: 'sla_compliance_rate', metricType: 'operations', description: 'SLA compliance rate', unit: 'percent', direction: 'higher_better' },
  { metricName: 'sla_breach_count', metricType: 'operations', description: 'SLA breach count', unit: 'count', direction: 'lower_better' },
  { metricName: 'overdue_case_count', metricType: 'operations', description: 'Overdue case count', unit: 'count', direction: 'lower_better' },
  { metricName: 'evidence_pack_exports', metricType: 'workflow', description: 'Evidence pack exports', unit: 'count', direction: 'higher_better' },
  { metricName: 'workflow_transition_success_rate', metricType: 'workflow', description: 'Workflow transition success rate', unit: 'percent', direction: 'higher_better' },
  { metricName: 'assignment_efficiency', metricType: 'operations', description: 'Assignment efficiency', unit: 'percent', direction: 'higher_better' },
  { metricName: 'per_rep_case_load', metricType: 'operations', description: 'Average case load per rep', unit: 'count', direction: 'lower_better' },
  { metricName: 'events_created', metricType: 'operations', description: 'Events created', unit: 'count', direction: 'higher_better' },
  { metricName: 'tickets_sold', metricType: 'revenue', description: 'Tickets sold', unit: 'count', direction: 'higher_better' },
  { metricName: 'gross_ticket_revenue', metricType: 'revenue', description: 'Gross ticket revenue', unit: 'currency', direction: 'higher_better' },
  { metricName: 'platform_fee_revenue', metricType: 'revenue', description: 'Platform fee revenue', unit: 'currency', direction: 'higher_better' },
  { metricName: 'attendee_checkins', metricType: 'operations', description: 'Attendee checkins', unit: 'count', direction: 'higher_better' },
  { metricName: 'stream_starts', metricType: 'adoption', description: 'Stream starts', unit: 'count', direction: 'higher_better' },
  { metricName: 'stream_watch_minutes', metricType: 'adoption', description: 'Stream watch minutes', unit: 'minutes', direction: 'higher_better' },
  { metricName: 'avg_watch_time', metricType: 'adoption', description: 'Average watch time', unit: 'minutes', direction: 'higher_better' },
  { metricName: 'creator_payouts', metricType: 'revenue', description: 'Creator payouts', unit: 'currency', direction: 'higher_better' },
  { metricName: 'replay_views', metricType: 'adoption', description: 'Replay views', unit: 'count', direction: 'higher_better' },
  { metricName: 'event_conversion_rate', metricType: 'adoption', description: 'Event conversion rate', unit: 'percent', direction: 'higher_better' },
  { metricName: 'repeat_attendee_rate', metricType: 'adoption', description: 'Repeat attendee rate', unit: 'percent', direction: 'higher_better' },
  { metricName: 'gross_revenue', metricType: 'revenue', description: 'Gross revenue', unit: 'currency', direction: 'higher_better' },
  { metricName: 'net_revenue', metricType: 'revenue', description: 'Net revenue', unit: 'currency', direction: 'higher_better' },
  { metricName: 'payout_volume', metricType: 'revenue', description: 'Payout volume', unit: 'currency', direction: 'higher_better' },
  { metricName: 'subscription_revenue', metricType: 'revenue', description: 'Subscription revenue', unit: 'currency', direction: 'higher_better' },
  { metricName: 'transaction_count', metricType: 'revenue', description: 'Transaction count', unit: 'count', direction: 'higher_better' },
  { metricName: 'refund_count', metricType: 'revenue', description: 'Refund count', unit: 'count', direction: 'lower_better' },
  { metricName: 'failed_payment_count', metricType: 'revenue', description: 'Failed payment count', unit: 'count', direction: 'lower_better' },
  { metricName: 'inbound_events_processed', metricType: 'integration', description: 'Inbound integration events processed', unit: 'count', direction: 'higher_better' },
  { metricName: 'outbound_events_delivered', metricType: 'integration', description: 'Outbound integration events delivered', unit: 'count', direction: 'higher_better' },
  { metricName: 'retry_count', metricType: 'integration', description: 'Integration retry count', unit: 'count', direction: 'lower_better' },
  { metricName: 'dead_letter_count', metricType: 'integration', description: 'Dead letter count', unit: 'count', direction: 'lower_better' },
  { metricName: 'mapping_failures', metricType: 'integration', description: 'Mapping failure count', unit: 'count', direction: 'lower_better' },
  { metricName: 'sync_latency_ms', metricType: 'integration', description: 'Synchronization latency', unit: 'ms', direction: 'lower_better' },
]
