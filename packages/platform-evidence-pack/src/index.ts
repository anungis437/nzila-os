/**
 * @nzila/platform-evidence-pack — barrel exports
 */

// types
export type {
  EvidencePackStatus,
  EvidenceArtifact,
  EvidencePackIndex,
  SealData,
  OrchestratorPorts,
  ExportFormat,
  ExportResult,
  ExporterPorts,
  VerificationResult,
  ArtifactVerification,
  VerifierPorts,
  RetentionClass,
  RetentionPolicy,
  RetentionResult,
  RetentionPorts,
} from './types'

export {
  evidenceArtifactSchema,
  evidencePackIndexSchema,
  retentionPolicySchema,
} from './types'

// orchestrator
export { EvidencePackOrchestrator } from './orchestrator'

// exporter
export { exportPack } from './exporter'

// verifier
export { verifyPack } from './verifier'

// retention
export { RetentionManager } from './retention'

export {
  generateMonthlyAIGovernanceEvidencePack,
  buildAIGovernanceTrendSummary,
  type MonthlyGovernanceInput,
  type MonthlyGovernanceArtifact,
  type MonthlyAIGovernanceEvidencePack,
  type MonthlyGovernancePoint,
  type AIGovernanceTrendSummary,
  type AIGovernanceTrendView,
} from './ai-governance-monthly'
