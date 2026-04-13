// ─── @nzila/schema-core — Canonical Schema Authority ─────────────────────────
// This package is the SINGLE source of truth for cross-app entity definitions.
// Domain packages may extend these schemas; they must NOT shadow them.
// All Zod schemas here are runtime-validated and produce inferred TypeScript types.

export const SCHEMA_CORE_VERSION = '1.0.0' as const

// ── Entity Base ─────────────────────────────────────────────────────────────
export {
  canonicalEntityBaseSchema,
  type CanonicalEntityBase,
} from './entity'

// ── Actor / User ────────────────────────────────────────────────────────────
export {
  actorContextSchema,
  userIdentitySchema,
  userDisplayProfileSchema,
  sessionContextSchema,
  type ActorContext,
  type UserIdentity,
  type UserDisplayProfile,
  type SessionContext,
} from './actor'

// ── Org ─────────────────────────────────────────────────────────────────────
export {
  orgScopeSchema,
  orgMembershipSchema,
  orgRoleAssignmentSchema,
  orgScopedRequestContextSchema,
  ORG_STATUS_VALUES,
  ORG_TIER_VALUES,
  type OrgScope,
  type OrgMembership,
  type OrgRoleAssignment,
  type OrgScopedRequestContext,
  type OrgStatus,
  type OrgTier,
} from './org'

// ── Event ───────────────────────────────────────────────────────────────────
export {
  canonicalEventSchema,
  eventMetadataSchema,
  type CanonicalEvent,
  type EventMetadata,
} from './event'

// ── Audit ───────────────────────────────────────────────────────────────────
export {
  canonicalAuditRecordSchema,
  auditInputSchema,
  AUDIT_SEVERITY_VALUES,
  type CanonicalAuditRecord,
  type AuditInput,
  type AuditSeverity,
} from './audit'

// ── Evidence ────────────────────────────────────────────────────────────────
export {
  evidenceArtifactSchema,
  evidenceExportSchema,
  EVIDENCE_FORMAT_VALUES,
  type EvidenceArtifact,
  type EvidenceExport,
  type EvidenceFormat,
} from './evidence'

// ── Workflow / FSM ──────────────────────────────────────────────────────────
export {
  workflowStateSchema,
  workflowTransitionRecordSchema,
  type WorkflowState,
  type WorkflowTransitionRecord,
} from './workflow'

// ── Document / File ─────────────────────────────────────────────────────────
export {
  documentMetadataSchema,
  documentChainOfCustodySchema,
  DOCUMENT_ACCESS_LEVELS,
  type DocumentMetadata,
  type DocumentChainOfCustody,
  type DocumentAccessLevel,
} from './document'

// ── Correlation / Trace ─────────────────────────────────────────────────────
export {
  correlationContextSchema,
  type CorrelationContext,
} from './correlation'

// ── Module / Registry ───────────────────────────────────────────────────────
export {
  moduleRegistrationSchema,
  MODULE_TIER_VALUES,
  type ModuleRegistration,
  type ModuleTier,
} from './module'

// ── Financial ───────────────────────────────────────────────────────────────
export {
  financialRecordSchema,
  FINANCIAL_STATUS_VALUES,
  type FinancialRecord,
  type FinancialStatus,
} from './financial'

// ── Integration ─────────────────────────────────────────────────────────────
export {
  integrationRecordSchema,
  INTEGRATION_STATUS_VALUES,
  INTEGRATION_DIRECTION_VALUES,
  type IntegrationRecord,
  type IntegrationStatus,
  type IntegrationDirection,
} from './integration'

// ── Error ───────────────────────────────────────────────────────────────────
export {
  platformErrorSchema,
  fieldErrorSchema,
  PLATFORM_ERROR_CODES,
  createPlatformError,
  getHttpStatus,
  type PlatformError,
  type PlatformErrorCode,
  type FieldError,
} from './error'

// ── Action Result ───────────────────────────────────────────────────────────
export {
  ok,
  fail,
  type ActionResult,
  type ActionFailure,
  type ActionResponse,
} from './result'

// ── Guards ──────────────────────────────────────────────────────────────────
export {
  isCanonicalEntity,
  isCanonicalEvent,
  isCanonicalAuditRecord,
  hasOrgScope,
  hasCorrelation,
} from './guards'
