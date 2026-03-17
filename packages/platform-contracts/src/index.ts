/**
 * @nzila/platform-contracts — Canonical platform contract interfaces.
 *
 * Every production-grade app in the Nzila OS monorepo should implement
 * the applicable contracts from this package to ensure the control plane
 * can aggregate health, metrics, governance, and evidence uniformly.
 *
 * See docs/PLATFORM_SURFACE_MODEL.md for the operating model.
 * See @nzila/platform-ai-contract for AI-specific output contracts.
 */

// ── Health ──
export type { HealthStatus, ComponentHealth, HealthResponse, HealthContract } from './health.js'

// ── Metrics ──
export type { MetricType, MetricEntry, MetricsSummary, MetricsContract } from './metrics.js'

// ── Governance ──
export type {
  GovernanceCheckResult,
  GovernanceCheckEntry,
  GovernanceTelemetry,
  GovernanceContract,
} from './governance.js'

// ── Evidence ──
export type { EvidenceFormat, EvidenceArtifact, EvidenceExport, EvidenceContract } from './evidence.js'

// ── Environment ──
export type {
  EnvironmentTier,
  EnvironmentVariable,
  EnvironmentDeclaration,
  EnvironmentContract,
} from './environment.js'

// ── Change Awareness ──
export type { ChangeType, ChangeRecord, ChangeContract } from './change.js'

// ── Validators ──
export {
  isValidHealthResponse,
  isValidMetricsSummary,
  isValidGovernanceTelemetry,
  isValidEvidenceExport,
} from './schemas.js'
