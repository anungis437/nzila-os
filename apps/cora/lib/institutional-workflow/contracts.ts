import { z } from 'zod'
import type { CoraAuthorizationContext } from '../resolve-org'
import type {
  GovernedEvidenceAssertion,
  InstitutionalUse,
  IssuerAuthorityPort,
} from '../evidence-reuse/contracts'
import type { ResolutionResult } from '../evidence-resolution/contracts'
import type { RightsSnapshot } from '../source-continuity/contracts'
import type { CrossInstitutionalEvidenceReuseEvent } from '../evidence-reuse/reuse'
import type { EvidenceMobilityFriction } from '../evidence-reuse/metrics'

const ref = z.string().min(1)
export const versionRefSchema = z.object({ id: ref, version: ref }).strict()
export const workflowRequestSchema = z
  .object({
    requirement: versionRefSchema,
    evidence: versionRefSchema,
    originatingRunId: ref.optional(),
  })
  .strict()
export const dispositionRequestSchema = z
  .object({
    runId: ref,
    externalDispositionRef: ref,
  })
  .strict()
export const workflowStateSchema = z.enum([
  'REQUESTED',
  'AUTHORIZED',
  'EVIDENCE_BOUND',
  'RESOLVED',
  'REUSE_EVALUATED',
  'AWAITING_RECIPIENT_DISPOSITION',
  'DISPOSITION_RECORDED',
  'SUPERSEDED',
  'REVOKED',
  'FAILED',
])
export type WorkflowState = z.infer<typeof workflowStateSchema>
export type VersionRef = z.infer<typeof versionRefSchema>
export type WorkflowRequest = z.infer<typeof workflowRequestSchema>
export const WORKFLOW_PERMISSION = 'cora:institutional-workflow:execute'
export const DISPOSITION_PERMISSION = 'cora:institutional-workflow:disposition'

export interface WorkflowEvidenceBinding {
  reference: VersionRef
  assertionSha256: string
  sourceProvenanceSha256: string
  capsuleRef: string
}
export interface WorkflowRequirementBinding {
  reference: VersionRef
  interpretation: VersionRef
  definitionSha256: string
}
export interface WorkflowDispositionReference {
  recipientId: string
  decisionAuthorityRef: string
  externalDispositionRef: string
  provenanceRef: string
  auditRef: string
  recordedAt: string
}
export interface WorkflowResolutionRecord {
  at: string
  auditRef: string
  result: ResolutionResult
}
export interface WorkflowReuseRecord {
  at: string
  auditRef: string
  originatingRunId: string
  event: CrossInstitutionalEvidenceReuseEvent
}
export interface InstitutionalWorkflow {
  workflowId: string
  idempotencyKey: string
  orgId: string
  actorId: string
  recipientInstitutionId: string
  recipientId: string
  purpose: string
  evidence: WorkflowEvidenceBinding
  requirement: WorkflowRequirementBinding
  authorizationRef: string
  authorizationContextSha256: string
}
export interface InstitutionalWorkflowRun extends InstitutionalWorkflow {
  runId: string
  requestedAt: string
  state: WorkflowState
  revision: number
  use: InstitutionalUse
  rightsSnapshot: RightsSnapshot
  originatingRunId?: string
  resolution?: WorkflowResolutionRecord
  reuse?: WorkflowReuseRecord
  disposition?: WorkflowDispositionReference
  supersedesRunId?: string
}
export interface WorkflowAuditEntry {
  auditId: string
  runId: string
  actorId: string
  orgId: string
  action: string
  evidence: VersionRef
  requirement: VersionRef
  authorizationRef: string
  rightsSnapshot: RightsSnapshot
  sourceRightsSnapshot: RightsSnapshot
  priorState: WorkflowState | null
  nextState: WorkflowState
  at: string
  reason: string
  previousSha256: string | null
  sha256: string
}
export type FrictionStep = keyof EvidenceMobilityFriction['events']
export interface WorkflowFrictionEvent {
  eventId: string
  runId: string
  orgId: string
  actorId: string
  at: string
  step: FrictionStep
  auditRef: string
}
export interface WorkflowStateData {
  runs: InstitutionalWorkflowRun[]
  history: InstitutionalWorkflowRun[]
  audit: WorkflowAuditEntry[]
  reuseLedger: WorkflowReuseRecord[]
  frictionLedger: WorkflowFrictionEvent[]
}
export interface WorkflowStoragePort {
  // Implementations must serialize per-org operations and commit all ledgers atomically.
  transaction<T>(orgId: string, operation: (data: WorkflowStateData) => Promise<T>): Promise<T>
}
export interface RequirementDefinition {
  orgId: string
  use: Omit<InstitutionalUse, 'assertion' | 'supplementalAssertions'>
  superseded: boolean
}
export interface EvidenceDefinition {
  orgId: string
  assertion: GovernedEvidenceAssertion
  supplementalAssertions?: GovernedEvidenceAssertion[]
  currentlyVerifiedAt?: string
}
export interface WorkflowPorts {
  resolveContext(permission: string): Promise<CoraAuthorizationContext>
  loadRequirement(orgId: string, reference: VersionRef): Promise<RequirementDefinition>
  loadEvidence(orgId: string, reference: VersionRef): Promise<EvidenceDefinition>
  authorize(
    context: CoraAuthorizationContext,
    use: InstitutionalUse,
    at: string,
  ): Promise<RightsSnapshot>
  authorizeSource(
    context: CoraAuthorizationContext,
    use: InstitutionalUse,
    at: string,
  ): Promise<RightsSnapshot>
  authorizeOperatorView?(
    context: CoraAuthorizationContext,
    run: InstitutionalWorkflowRun,
    at: string,
  ): Promise<{ allowed: boolean; authorizationRef: string; historical: boolean }>
  loadDisposition(
    context: CoraAuthorizationContext,
    run: InstitutionalWorkflowRun,
    ref: string,
  ): Promise<WorkflowDispositionReference>
  loadFrictionAction(
    context: CoraAuthorizationContext,
    run: InstitutionalWorkflowRun,
    eventRef: string,
  ): Promise<WorkflowFrictionEvent>
  recordDenial(context: CoraAuthorizationContext, reason: string): Promise<void>
  authority: IssuerAuthorityPort
  storage: WorkflowStoragePort
  now(): string
}

export class WorkflowDenied extends Error {
  readonly code = 'CORA_WORKFLOW_DENIED'
  constructor(message: string) {
    super(message)
    this.name = 'WorkflowDenied'
  }
}

const nextStates: Record<WorkflowState, readonly WorkflowState[]> = {
  REQUESTED: ['AUTHORIZED', 'REVOKED', 'FAILED', 'SUPERSEDED'],
  AUTHORIZED: ['EVIDENCE_BOUND', 'REVOKED', 'FAILED', 'SUPERSEDED'],
  EVIDENCE_BOUND: ['RESOLVED', 'REVOKED', 'FAILED', 'SUPERSEDED'],
  RESOLVED: ['REUSE_EVALUATED', 'REVOKED', 'FAILED', 'SUPERSEDED'],
  REUSE_EVALUATED: ['AWAITING_RECIPIENT_DISPOSITION', 'REVOKED', 'FAILED', 'SUPERSEDED'],
  AWAITING_RECIPIENT_DISPOSITION: ['DISPOSITION_RECORDED', 'REVOKED', 'FAILED', 'SUPERSEDED'],
  DISPOSITION_RECORDED: ['REVOKED', 'SUPERSEDED'],
  SUPERSEDED: [],
  REVOKED: [],
  FAILED: [],
}
export function assertWorkflowTransition(prior: WorkflowState, next: WorkflowState): void {
  if (!nextStates[prior].includes(next))
    throw new WorkflowDenied(`Invalid workflow transition ${prior} -> ${next}`)
}
