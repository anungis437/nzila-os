/**
 * @nzila/zonga-control-plane — Barrel Export
 *
 * Central authority for the Zonga platform.
 * Orchestration, economic enforcement, governance, system invariants,
 * dispute resolution, payment recovery, AI control, offline sync,
 * and enterprise-grade observability.
 *
 * NON-NEGOTIABLE: No critical action bypasses this control plane.
 *
 * @module @nzila/zonga-control-plane
 */

// ── Types & Schemas ───────────────────────────────────────────────────────
export type {
  ControlPlaneContext,
  SystemEvent,
  WorkflowStep,
  WorkflowExecution,
  WorkflowDefinition,
  WorkflowStepDefinition,
  WorkflowStepResult,
  InvariantCheck,
  InvariantCheckResult,
  EconomicIntegrityResult,
  GovernancePolicyResult,
  GovernanceViolation,
  DisputeImpactAssessment,
  AuditQueryFilter,
  AuditQueryResult,
  AdminActionRequest,
  AdminActionResult,
  PaymentRecoveryResult,
  OfflineSyncResult,
  OfflineSyncItem,
  ObservabilityMetric,
  AIControlResult,
} from './types'

export {
  WorkflowId,
  WorkflowStepStatus,
  WorkflowExecutionStatus,
  SystemEventType,
  InvariantId,
  AuditSeverity,
  ControlPlaneContextSchema,
  ExecuteWorkflowSchema,
  AdminActionSchema,
  AuditQuerySchema,
} from './types'
export type { ExecuteWorkflowInput, AuditQueryInput } from './types'

// ── Orchestrator ──────────────────────────────────────────────────────────
export {
  registerWorkflow,
  getWorkflowDefinition,
  listRegisteredWorkflows,
  executeWorkflow,
  WorkflowNotFoundError,
  WorkflowBypassError,
} from './orchestrator'

// ── Economic Enforcer ─────────────────────────────────────────────────────
export {
  validateLedgerIntegrity,
  enforceEconomicIntegrity,
  reconcileAccounts,
  canExecutePayout,
  validateRevenueToLedgerMapping,
} from './economic-enforcer'
export type {
  LedgerEntry,
  LedgerTransaction,
  PayoutRecord,
  RevenueRecord,
  AccountBalance,
} from './economic-enforcer'

// ── Governance Enforcer ───────────────────────────────────────────────────
export {
  registerPolicy,
  listPolicies,
  validateGovernancePolicy,
  executeAdminAction,
  payoutPolicy,
  releasePolicy,
  eventPolicy,
} from './governance-enforcer'
export type { GovernancePolicy } from './governance-enforcer'

// ── Invariant Checker ─────────────────────────────────────────────────────
export {
  checkAllInvariants,
  checkInvariant,
} from './invariant-checker'
export type { InvariantInput } from './invariant-checker'

// ── System Events & Audit ─────────────────────────────────────────────────
export {
  onSystemEvent,
  emitSystemEvent,
  buildSystemEvent,
  queryAuditEvents,
  getEventCountByType,
  clearEventLog,
  getEventLog,
  getEventLogSize,
} from './system-events'

// ── Dispute Impact ────────────────────────────────────────────────────────
export {
  resolveDisputeImpact,
  resolveDisputeFreeze,
} from './dispute-impact'
export type { DisputeRecord, DisputeEvidence } from './dispute-impact'

// ── Payment Recovery ──────────────────────────────────────────────────────
export {
  planPaymentRecovery,
  validateRefundRequest,
  processRefund,
} from './payment-recovery'
export type {
  PaymentIntent,
  PaymentIntentStatus,
  RefundRequest,
  RefundResult,
} from './payment-recovery'

// ── Offline Sync ──────────────────────────────────────────────────────────
export {
  resolveConflicts,
  processSyncQueue,
  buildSyncState,
  needsSync,
} from './offline-sync'
export type { SyncQueue, SyncConflict, SyncState } from './offline-sync'

// ── Observability ─────────────────────────────────────────────────────────
export {
  MetricName,
  recordMetric,
  onMetric,
  getMetrics,
  clearMetrics,
  generateCorrelationId,
  emitLog,
  onLog,
} from './observability'
export type { StructuredLog } from './observability'

// ── AI Controller ─────────────────────────────────────────────────────────
export {
  setFeatureFlag,
  isFeatureEnabled,
  listFeatureFlags,
  AIFeatureFlag,
  executeControlledInference,
  runFraudCheck,
} from './ai-controller'
export type {
  AIInferenceRequest,
  FraudCheckRequest,
  FraudSignal,
  FraudCheckResult,
} from './ai-controller'
