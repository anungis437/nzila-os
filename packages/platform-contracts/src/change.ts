/**
 * Change Contract — canonical interface for change awareness.
 *
 * Apps declare their change surface so the platform can track
 * deployments, feature flag flips, and configuration changes.
 */

export type ChangeType = 'deployment' | 'config_change' | 'feature_flag' | 'data_migration'

export interface ChangeRecord {
  change_id: string
  type: ChangeType
  app: string
  description: string
  actor: string
  timestamp: string
  rollback_available: boolean
}

export interface ChangeContract {
  recordChange(change: Omit<ChangeRecord, 'change_id' | 'timestamp'>): Promise<ChangeRecord>
  getRecentChanges(limit: number): Promise<ChangeRecord[]>
}
