/**
 * @nzila/os-core — Evidence pack builder
 *
 * Pure-logic builder that constructs evidence pack metadata from governance
 * actions. Produces an EvidencePackRequest ready for the upload automation
 * (generate-evidence-index.ts --upload) or direct API consumption.
 *
 * This module is intentionally free of DB/Blob dependencies so it can run
 * in workers, edge functions, or CLI tools.
 */
import { randomUUID } from 'node:crypto'
import {
  type ArtifactDescriptor,
  type ControlFamily,
  type EvidenceEventType,
  type EvidencePackRequest,
  type GovernanceEvidenceMapping,
  type RetentionClass,
  type BlobContainer,
  GOVERNANCE_EVIDENCE_MAPPINGS,
} from './types'

// ── Public API ──────────────────────────────────────────────────────────────

export interface GovernanceActionContext {
  /** governance_actions.id */
  actionId: string
  /** governance_actions.action_type */
  actionType: string
  /** governance_actions.entity_id */
  entityId: string
  /** Clerk user who executed the action */
  executedBy: string
  /** The resolution document (PDF/Markdown) buffer, if available */
  resolutionDocument?: {
    filename: string
    buffer: Buffer
    contentType: string
  }
  /** Signed/executed artifact (e.g. share certificate PDF) */
  executedArtifact?: {
    filename: string
    buffer: Buffer
    contentType: string
  }
  /** Audit trail JSON export */
  auditTrail?: {
    buffer: Buffer
  }
  /** Any additional artifacts */
  additionalArtifacts?: ArtifactDescriptor[]
}

/**
 * Build an evidence pack request from a completed governance action.
 *
 * Call this when a governance action transitions to "executed" status.
 * The returned request can be passed to the upload pipeline.
 */
export function buildEvidencePackFromAction(
  ctx: GovernanceActionContext,
  overrides?: {
    controlFamily?: ControlFamily
    eventType?: EvidenceEventType
    controlsCovered?: string[]
    retentionClass?: RetentionClass
    blobContainer?: BlobContainer
  },
): EvidencePackRequest {
  const mapping: GovernanceEvidenceMapping | undefined =
    GOVERNANCE_EVIDENCE_MAPPINGS[ctx.actionType]

  const controlFamily = overrides?.controlFamily ?? mapping?.controlFamily ?? 'change-mgmt'
  const eventType = overrides?.eventType ?? mapping?.eventType ?? 'period-close'
  const controlsCovered = overrides?.controlsCovered ?? mapping?.controlsCovered ?? []
  const retentionClass = overrides?.retentionClass ?? mapping?.retentionClass ?? '7_YEARS'
  const blobContainer = overrides?.blobContainer ?? mapping?.blobContainer ?? 'minutebook'

  const packId = generatePackId(ctx.actionType, ctx.actionId)

  const artifacts: ArtifactDescriptor[] = []
  let idx = 0

  // Resolution document
  if (ctx.resolutionDocument) {
    artifacts.push({
      artifactId: `${packId}-resolution`,
      artifactType: 'resolution',
      filename: ctx.resolutionDocument.filename,
      buffer: ctx.resolutionDocument.buffer,
      contentType: ctx.resolutionDocument.contentType,
      retentionClass,
      classification: 'CONFIDENTIAL',
      description: `Board/shareholder resolution for ${ctx.actionType}`,
    })
    idx++
  }

  // Executed artifact (certificate, signed doc, etc.)
  if (ctx.executedArtifact) {
    artifacts.push({
      artifactId: `${packId}-artifact`,
      artifactType: 'executed-artifact',
      filename: ctx.executedArtifact.filename,
      buffer: ctx.executedArtifact.buffer,
      contentType: ctx.executedArtifact.contentType,
      retentionClass,
      classification: 'CONFIDENTIAL',
      description: `Executed artifact for ${ctx.actionType}`,
    })
    idx++
  }

  // Audit trail
  if (ctx.auditTrail) {
    artifacts.push({
      artifactId: `${packId}-audit-trail`,
      artifactType: 'audit-trail',
      filename: `${packId}-audit-trail.json`,
      buffer: ctx.auditTrail.buffer,
      contentType: 'application/json',
      retentionClass,
      classification: 'INTERNAL',
      description: `Audit events for governance action ${ctx.actionId}`,
    })
    idx++
  }

  // Additional artifacts
  if (ctx.additionalArtifacts) {
    artifacts.push(...ctx.additionalArtifacts)
  }

  // If no artifacts were provided, create a minimal metadata artifact
  if (artifacts.length === 0) {
    const metaBuffer = Buffer.from(
      JSON.stringify(
        {
          actionId: ctx.actionId,
          actionType: ctx.actionType,
          entityId: ctx.entityId,
          executedBy: ctx.executedBy,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
    )
    artifacts.push({
      artifactId: `${packId}-metadata`,
      artifactType: 'metadata',
      filename: `${packId}-metadata.json`,
      buffer: metaBuffer,
      contentType: 'application/json',
      retentionClass,
      classification: 'INTERNAL',
      description: `Action metadata for ${ctx.actionType}`,
    })
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')

  return {
    packId,
    entityId: ctx.entityId,
    controlFamily,
    eventType,
    eventId: ctx.actionId,
    blobContainer,
    summary: `Auto-generated evidence pack for ${ctx.actionType} (action ${ctx.actionId})`,
    controlsCovered,
    createdBy: ctx.executedBy,
    artifacts,
  }
}

/**
 * Compute the blob base path for an evidence pack.
 *
 * Convention: {entityId}/{controlFamily}/{year}/{month}/{packId}
 */
export function computeBasePath(
  entityId: string,
  controlFamily: ControlFamily,
  packId: string,
): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${entityId}/${controlFamily}/${year}/${month}/${packId}`
}

/**
 * List all governance action types that have evidence mappings configured.
 */
export function listMappedActionTypes(): string[] {
  return Object.keys(GOVERNANCE_EVIDENCE_MAPPINGS)
}

/**
 * Get the evidence mapping for a governance action type.
 */
export function getEvidenceMapping(
  actionType: string,
): GovernanceEvidenceMapping | undefined {
  return GOVERNANCE_EVIDENCE_MAPPINGS[actionType]
}

// ── Internals ───────────────────────────────────────────────────────────────

/**
 * Generate a deterministic pack ID from action type + action UUID.
 * Format: {PREFIX}-{shortUUID}  e.g. ISS-a1b2c3d4
 */
function generatePackId(actionType: string, actionId: string): string {
  const PREFIX_MAP: Record<string, string> = {
    issue_shares: 'ISS',
    transfer_shares: 'TRF',
    convert_shares: 'CNV',
    borrow_funds: 'BRW',
    amend_rights: 'AMR',
    create_class: 'CLS',
    repurchase_shares: 'REP',
    dividend: 'DIV',
    merger_acquisition: 'MA',
    elect_directors: 'DIR',
    amend_constitution: 'CON',
  }
  const prefix = PREFIX_MAP[actionType] ?? 'GOV'
  const shortId = actionId.replace(/-/g, '').slice(0, 8)
  return `${prefix}-${shortId}`
}
