/**
 * Minimal contract a later CIVITAS rebase consumes.
 * This package does not open CIVITAS Phase 3.
 */
export const CIVITAS_PLATFORM_CONTRACT = {
  phase3: 'CLOSED',
  owner: 'platform',
  functions: [
    'classifyRecord',
    'putRestrictedRecord',
    'readRestrictedRecord',
    'grantRestrictedAccess',
    'redactObservabilityRecord',
    'evaluateRestrictedModelPath',
    'bodiesSafeForPersistence',
    'buildRestrictedAuditEvent',
    'exportPrincipalRecords',
    'stateRetention',
    'deleteRestrictedRecord',
    'placeLegalHold',
    'evaluateBreakGlassAccess',
    'rejectSecretIngestion',
  ],
  sequence: [
    'Merge platform controls through normal governance review.',
    'Rebase the CIVITAS branch onto that revision.',
    'Rerun the Phase 2.5 privacy evaluation.',
    'Record a new disposition.',
    'Open Phase 3 only if that gate permits it.',
  ],
} as const

export const CONTROL_EVIDENCE = [
  { id: 'classification_fail_closed', evidence: 'CODE_PROVEN' },
  { id: 'unlabelled_non_sensitive_stays_internal', evidence: 'CODE_PROVEN' },
  { id: 'principal_isolation_api', evidence: 'CODE_PROVEN' },
  { id: 'union_eyes_rls_remains_org_scoped', evidence: 'CONFIG_PROVEN' },
  { id: 'default_log_redaction', evidence: 'CODE_PROVEN' },
  { id: 'restricted_model_default_deny', evidence: 'CODE_PROVEN' },
  { id: 'provider_zero_retention', evidence: 'UNVERIFIED' },
  { id: 'restricted_audit_metadata', evidence: 'CODE_PROVEN' },
  { id: 'break_glass_scoped_expiry', evidence: 'CODE_PROVEN' },
  { id: 'secret_ingestion_high_confidence', evidence: 'CODE_PROVEN' },
  { id: 'residency_runtime', evidence: 'UNVERIFIED' },
  { id: 'cmk_runtime', evidence: 'UNVERIFIED' },
  { id: 'controlled_export', evidence: 'CODE_PROVEN' },
  { id: 'retention_expression', evidence: 'CODE_PROVEN' },
  { id: 'deletion_semantics', evidence: 'CODE_PROVEN' },
  { id: 'backup_propagation_runtime', evidence: 'UNVERIFIED' },
  { id: 'legal_hold', evidence: 'CODE_PROVEN' },
  { id: 'continuity_no_delegate_access', evidence: 'CODE_PROVEN' },
] as const
