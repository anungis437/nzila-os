/**
 * Governance Contract — canonical interface for governance telemetry.
 *
 * Apps report governance-relevant events so the platform can
 * aggregate compliance posture across the fleet.
 */

export type GovernanceCheckResult = 'pass' | 'fail' | 'warn' | 'skip'

export interface GovernanceCheckEntry {
  check_id: string
  name: string
  result: GovernanceCheckResult
  message?: string
  evidence_ref?: string
  timestamp: string
}

export interface GovernanceTelemetry {
  app: string
  org_id: string
  checks: GovernanceCheckEntry[]
  overall_result: GovernanceCheckResult
  generated_at: string
}

export interface GovernanceContract {
  evaluate(orgId: string): Promise<GovernanceTelemetry>
}
