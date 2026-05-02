export type PipelineAlertSeverity = 'info' | 'warning' | 'critical'

export type PipelineAlertChannel = 'console_log' | 'webhook' | 'email' | 'slack'

export type PipelineAlertTrigger =
  | 'freshness_sla_warning'
  | 'freshness_sla_breach'
  | 'latest_run_failed'
  | 'checkpoint_not_advanced'
  | 'aggregate_verification_failed'
  | 'repeated_retry_failures'
  | 'missing_database_url'
  | 'suspicious_record_drop'
  | 'cross_org_anomaly'
  | 'nar_chain_mismatch'

export interface PipelineAlert {
  pipelineName: string
  severity: PipelineAlertSeverity
  trigger: PipelineAlertTrigger
  organizationId?: string
  message: string
  runId?: string
  freshnessLagMs?: number
  createdAt: Date
  metadata?: Record<string, unknown>
}

export interface PipelineAlertResult {
  delivered: boolean
  channels: PipelineAlertChannel[]
  error?: string
}

export interface PipelineAlertEvaluationInput {
  pipelineName: string
  freshnessLagMs?: number
  freshnessStatus?: 'ok' | 'warning' | 'breached'
  lastRunStatus?: 'success' | 'failure' | 'partial' | 'running'
  integrityValid?: boolean
  integritySeverity?: 'healthy' | 'warning' | 'critical'
  retryAttempt?: number
  maxAttempts?: number
  organizationId?: string
  runId?: string
}
