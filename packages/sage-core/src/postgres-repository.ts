// ─── @nzila/sage-core — SQL-backed repository (PostgreSQL) ────────────────────
// Durable implementation of the SageRepository port (Phase 2) against the
// sage_* schema from migration 0032 (Phase 1).
//
// Invariants preserved from Phase 2:
//   * Parameterized SQL only — no interpolation of user-controlled values.
//   * Org/workspace boundary: every write persists org_id; every workspace-scoped
//     read filters by workspace_id (the tenant scope, FK to sage_workspace.org_id).
//     getWorkspace is tenant-scoped at query time (id AND org_id); the service layer
//     also performs an org-boundary check on the returned row (defense-in-depth).
//   * Membership is separate from role assignment (distinct tables/inserts).
//   * Revocation sets revoked_at; rows are never deleted. Active filtering is done
//     in the service layer (activeSageRoles / activeEvidenceAuthorizations).
//   * Export request defaults to a non-approved status; approve/deny update status
//     and insert an approval row.

import type { SageRepository } from './repository'
import type { SageSqlClient } from './sql-client'
import type {
  SageAuthorizationLevel,
  SageAuditOutboxEvent,
  SageAuditOutboxIntent,
  SageBoundaryFlag,
  SageDecisionRecord,
  SageEvidenceAuthorization,
  SageEvidenceItem,
  SageEvidenceSource,
  SageExportApproval,
  SageExportPackage,
  SageExportPackageObject,
  SageExportRequest,
  SageReviewNote,
  SageRoleAssignment,
  SageSourceQuality,
  SageWorkspace,
  SageWorkspaceMember,
} from './types'
import type {
  SageDeliveryApproval,
  SageDeliveryDecision,
  SageDeliveryGrant,
  SageDeliveryIssuance,
  SageDeliveryReceipt,
  SageDeliveryReceiptIntent,
  SageDeliveryRecipient,
  SageDeliveryRequest,
  SageDeliveryRevocationReasonCode,
  SageNotificationOutbox,
  SageNotificationOutboxIntent,
} from './delivery-types'
import type {
  SageDestructionDecision,
  SageExportDestructionApproval,
  SageExportDestructionAttempt,
  SageExportDestructionEvidence,
  SageExportDestructionRequest,
  SageExportLegalHold,
  SageExportRetentionAssignment,
  SageRetentionPolicy,
} from './records-types'
import {
  mapBoundaryFlag,
  mapDecisionRecord,
  mapEvidenceAuthorization,
  mapEvidenceItem,
  mapEvidenceSource,
  mapExportApproval,
  mapExportPackage,
  mapExportRequest,
  mapAuditOutbox,
  mapReviewNote,
  mapRoleAssignment,
  mapWorkspace,
  mapWorkspaceMember,
  mapDeliveryRecipient,
  mapDeliveryRequest,
  mapDeliveryApproval,
  mapDeliveryGrant,
  mapDeliveryReceipt,
  mapNotificationOutbox,
  mapRetentionPolicy,
  mapRetentionAssignment,
  mapLegalHold,
  mapDestructionRequest,
  mapDestructionApproval,
  mapDestructionEvidence,
  mapDestructionAttempt,
  type SageBoundaryFlagRow,
  type SageDecisionRecordRow,
  type SageEvidenceAuthorizationRow,
  type SageEvidenceItemRow,
  type SageEvidenceSourceRow,
  type SageExportApprovalRow,
  type SageExportPackageRow,
  type SageExportRequestRow,
  type SageAuditOutboxRow,
  type SageNotificationOutboxRow,
  type SageReviewNoteRow,
  type SageRoleAssignmentRow,
  type SageWorkspaceMemberRow,
  type SageWorkspaceRow,
  type SageDeliveryRecipientRow,
  type SageDeliveryRequestRow,
  type SageDeliveryApprovalRow,
  type SageDeliveryGrantRow,
  type SageDeliveryReceiptRow,
  type SageRetentionPolicyRow,
  type SageExportRetentionAssignmentRow,
  type SageExportLegalHoldRow,
  type SageExportDestructionRequestRow,
  type SageExportDestructionApprovalRow,
  type SageExportDestructionEvidenceRow,
  type SageExportDestructionAttemptRow,
} from './postgres-mappers'
import { conflict } from './service-errors'

type CountRow = { count: number | string }

function toCount(rows: readonly CountRow[]): number {
  if (rows.length === 0) return 0
  return Number(rows[0].count)
}

function firstOrUndefined<T>(rows: readonly T[]): T | undefined {
  return rows.length > 0 ? rows[0] : undefined
}

/**
 * SQL-backed SageRepository. Construct with any client that satisfies
 * SageSqlClient (e.g. a node-postgres Pool/Client or a transaction handle).
 */
export class PostgresSageRepository implements SageRepository {
  constructor(private readonly sql: SageSqlClient) {}

  // ─── Workspace ─────────────────────────────────────────────────────────────

  async createWorkspace(input: Omit<SageWorkspace, 'id'>): Promise<SageWorkspace> {
    const { rows } = await this.sql.query<SageWorkspaceRow>(
      `insert into sage_workspace
         (org_id, name, status, institution_type, risk_surface, boundary_profile,
          created_by, updated_by, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
       returning *`,
      [
        input.orgId,
        input.name,
        input.status,
        input.institutionType,
        input.riskSurface,
        JSON.stringify(input.boundaryProfile),
        input.createdBy,
        input.updatedBy ?? null,
        input.createdAt,
        input.updatedAt,
      ],
    )
    return mapWorkspace(rows[0])
  }

  async getWorkspace(workspaceId: string, orgId: string): Promise<SageWorkspace | undefined> {
    // Tenant-scoped at the SQL boundary: a cross-org id never returns a row,
    // preventing existence leakage across organizations.
    const { rows } = await this.sql.query<SageWorkspaceRow>(
      `select * from sage_workspace where id = $1 and org_id = $2`,
      [workspaceId, orgId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapWorkspace(row) : undefined
  }

  async listWorkspaces(orgId: string): Promise<SageWorkspace[]> {
    // Organization-scoped list; never returns another org's workspaces.
    const { rows } = await this.sql.query<SageWorkspaceRow>(
      `select * from sage_workspace where org_id = $1 order by updated_at desc, created_at desc`,
      [orgId],
    )
    return rows.map(mapWorkspace)
  }

  // ─── Membership (separate from role assignment) ─────────────────────────────

  async addWorkspaceMember(
    input: Omit<SageWorkspaceMember, 'id'>,
  ): Promise<SageWorkspaceMember> {
    // Membership is idempotent (unique (workspace_id, actor_id)); on conflict
    // return the existing row so membership never duplicates.
    const { rows } = await this.sql.query<SageWorkspaceMemberRow>(
      `insert into sage_workspace_member (workspace_id, org_id, actor_id, created_by, created_at)
       values ($1, $2, $3, $4, $5)
       on conflict (workspace_id, actor_id) do update set actor_id = excluded.actor_id
       returning *`,
      [input.workspaceId, input.orgId, input.actorId, input.createdBy, input.createdAt],
    )
    return mapWorkspaceMember(rows[0])
  }

  async getWorkspaceMember(
    workspaceId: string,
    actorId: string,
  ): Promise<SageWorkspaceMember | undefined> {
    const { rows } = await this.sql.query<SageWorkspaceMemberRow>(
      `select * from sage_workspace_member where workspace_id = $1 and actor_id = $2`,
      [workspaceId, actorId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapWorkspaceMember(row) : undefined
  }

  // ─── Role assignment ─────────────────────────────────────────────────────────

  async listRoleAssignments(
    workspaceId: string,
    actorId: string,
  ): Promise<SageRoleAssignment[]> {
    const { rows } = await this.sql.query<SageRoleAssignmentRow>(
      `select * from sage_role_assignment where workspace_id = $1 and actor_id = $2`,
      [workspaceId, actorId],
    )
    return rows.map(mapRoleAssignment)
  }

  async assignRole(input: Omit<SageRoleAssignment, 'id'>): Promise<SageRoleAssignment> {
    const { rows } = await this.sql.query<SageRoleAssignmentRow>(
      `insert into sage_role_assignment
         (workspace_id, org_id, actor_id, sage_application_role, workspace_scope,
          time_bound_access_expires_at, access_reason, approved_by, created_at, revoked_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning *`,
      [
        input.workspaceId,
        input.orgId,
        input.actorId,
        input.sageApplicationRole,
        input.workspaceScope ?? null,
        input.timeBoundAccessExpiresAt ?? null,
        input.accessReason ?? null,
        input.approvedBy ?? null,
        input.createdAt,
        input.revokedAt ?? null,
      ],
    )
    return mapRoleAssignment(rows[0])
  }

  async revokeRole(roleAssignmentId: string, revokedAt: string): Promise<void> {
    // Sets revoked_at; never deletes. Active filtering happens in the service layer.
    await this.sql.query(
      `update sage_role_assignment set revoked_at = $2 where id = $1`,
      [roleAssignmentId, revokedAt],
    )
  }

  // ─── Evidence authorization ──────────────────────────────────────────────────

  async listEvidenceAuthorizations(
    workspaceId: string,
    actorId: string,
  ): Promise<SageEvidenceAuthorization[]> {
    const { rows } = await this.sql.query<SageEvidenceAuthorizationRow>(
      `select * from sage_evidence_authorization where workspace_id = $1 and actor_id = $2`,
      [workspaceId, actorId],
    )
    return rows.map(mapEvidenceAuthorization)
  }

  async grantEvidenceAuthorization(
    input: Omit<SageEvidenceAuthorization, 'id'>,
  ): Promise<SageEvidenceAuthorization> {
    const { rows } = await this.sql.query<SageEvidenceAuthorizationRow>(
      `insert into sage_evidence_authorization
         (workspace_id, org_id, actor_id, evidence_authorization_level,
          access_reason, approved_by, created_at, revoked_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [
        input.workspaceId,
        input.orgId,
        input.actorId,
        input.evidenceAuthorizationLevel,
        input.accessReason ?? null,
        input.approvedBy ?? null,
        input.createdAt,
        input.revokedAt ?? null,
      ],
    )
    return mapEvidenceAuthorization(rows[0])
  }

  async revokeEvidenceAuthorization(authorizationId: string, revokedAt: string): Promise<void> {
    await this.sql.query(
      `update sage_evidence_authorization set revoked_at = $2 where id = $1`,
      [authorizationId, revokedAt],
    )
  }

  // ─── Evidence source + item lifecycle ────────────────────────────────────────

  async createEvidenceSource(
    input: Omit<SageEvidenceSource, 'id'>,
  ): Promise<SageEvidenceSource> {
    const { rows } = await this.sql.query<SageEvidenceSourceRow>(
      `insert into sage_evidence_source
         (workspace_id, org_id, source_type, source_quality, authorization_level,
          contains_personal_information, contains_sensitive_information, created_by, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning *`,
      [
        input.workspaceId,
        input.orgId,
        input.sourceType,
        input.sourceQuality ?? null,
        input.authorizationLevel,
        input.containsPersonalInformation,
        input.containsSensitiveInformation,
        input.createdBy,
        input.createdAt,
      ],
    )
    return mapEvidenceSource(rows[0])
  }

  async getEvidenceSource(
    sourceId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageEvidenceSource | undefined> {
    const { rows } = await this.sql.query<SageEvidenceSourceRow>(
      `select * from sage_evidence_source where id = $1 and workspace_id = $2 and org_id = $3`,
      [sourceId, workspaceId, orgId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapEvidenceSource(row) : undefined
  }

  async listEvidenceSources(
    workspaceId: string,
    orgId: string,
  ): Promise<SageEvidenceSource[]> {
    const { rows } = await this.sql.query<SageEvidenceSourceRow>(
      `select * from sage_evidence_source
       where workspace_id = $1 and org_id = $2
       order by created_at desc`,
      [workspaceId, orgId],
    )
    return rows.map(mapEvidenceSource)
  }

  async classifyEvidenceSource(
    sourceId: string,
    update: { sourceQuality: SageSourceQuality; authorizationLevel: SageAuthorizationLevel },
  ): Promise<SageEvidenceSource> {
    // Compare-and-set: "classified" is derived (source_quality is not null), so
    // the guard `source_quality is null` admits ONLY a not-yet-classified source.
    // Two concurrent classifications race on this predicate; exactly one matches
    // a row and the loser gets zero rows → a typed CONFLICT (never a silent
    // second overwrite).
    const { rows } = await this.sql.query<SageEvidenceSourceRow>(
      `update sage_evidence_source
         set source_quality = $2, authorization_level = $3
       where id = $1
         and source_quality is null
       returning *`,
      [sourceId, update.sourceQuality, update.authorizationLevel],
    )
    const row = firstOrUndefined(rows)
    if (!row) {
      conflict('evidence source is already classified or was concurrently modified')
    }
    return mapEvidenceSource(row)
  }

  async createEvidenceItem(input: Omit<SageEvidenceItem, 'id'>): Promise<SageEvidenceItem> {
    const { rows } = await this.sql.query<SageEvidenceItemRow>(
      `insert into sage_evidence_item
         (source_id, workspace_id, org_id, lifecycle_state, confidence_level,
          excluded_from_external_review, human_review_required, created_by, updated_by,
          created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       returning *`,
      [
        input.sourceId,
        input.workspaceId,
        input.orgId,
        input.lifecycleState,
        input.confidenceLevel ?? null,
        input.excludedFromExternalReview,
        input.humanReviewRequired,
        input.createdBy,
        input.updatedBy ?? null,
        input.createdAt,
        input.updatedAt,
      ],
    )
    return mapEvidenceItem(rows[0])
  }

  async getEvidenceItem(
    itemId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageEvidenceItem | undefined> {
    const { rows } = await this.sql.query<SageEvidenceItemRow>(
      `select * from sage_evidence_item where id = $1 and workspace_id = $2 and org_id = $3`,
      [itemId, workspaceId, orgId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapEvidenceItem(row) : undefined
  }

  async listEvidenceItems(
    workspaceId: string,
    orgId: string,
    sourceId?: string,
  ): Promise<SageEvidenceItem[]> {
    if (sourceId !== undefined) {
      const { rows } = await this.sql.query<SageEvidenceItemRow>(
        `select * from sage_evidence_item
         where workspace_id = $1 and org_id = $2 and source_id = $3
         order by updated_at desc, created_at desc`,
        [workspaceId, orgId, sourceId],
      )
      return rows.map(mapEvidenceItem)
    }
    const { rows } = await this.sql.query<SageEvidenceItemRow>(
      `select * from sage_evidence_item
       where workspace_id = $1 and org_id = $2
       order by updated_at desc, created_at desc`,
      [workspaceId, orgId],
    )
    return rows.map(mapEvidenceItem)
  }

  async linkEvidenceItem(itemId: string, linkedAt: string): Promise<SageEvidenceItem> {
    // Compare-and-set: only a 'registered' item may transition to 'linked'. Two
    // concurrent links race on `lifecycle_state = 'registered'`; exactly one
    // matches and the loser gets zero rows → a typed CONFLICT (never two
    // independent successful transitions from the same initial state).
    const { rows } = await this.sql.query<SageEvidenceItemRow>(
      `update sage_evidence_item
         set lifecycle_state = 'linked', updated_at = $2
       where id = $1
         and lifecycle_state = 'registered'
       returning *`,
      [itemId, linkedAt],
    )
    const row = firstOrUndefined(rows)
    if (!row) {
      conflict('evidence item is not in a linkable state or was concurrently modified')
    }
    return mapEvidenceItem(row)
  }

  // ─── Boundary flags / review notes / decision records ────────────────────────

  async addBoundaryFlag(input: Omit<SageBoundaryFlag, 'id'>): Promise<SageBoundaryFlag> {
    const { rows } = await this.sql.query<SageBoundaryFlagRow>(
      `insert into sage_boundary_flag
         (workspace_id, org_id, target_type, target_id, flag_type, note, status,
          authorization_level, authorization_basis,
          created_by, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
       returning *`,
      [
        input.workspaceId,
        input.orgId,
        input.targetType ?? null,
        input.targetId ?? null,
        input.flagType,
        input.note ?? null,
        input.status,
        input.authorizationLevel,
        input.authorizationBasis ?? null,
        input.createdBy,
        input.createdAt,
      ],
    )
    return mapBoundaryFlag(rows[0])
  }

  async getBoundaryFlag(
    flagId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageBoundaryFlag | undefined> {
    const { rows } = await this.sql.query<SageBoundaryFlagRow>(
      `select * from sage_boundary_flag where id = $1 and workspace_id = $2 and org_id = $3`,
      [flagId, workspaceId, orgId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapBoundaryFlag(row) : undefined
  }

  async listBoundaryFlags(
    workspaceId: string,
    orgId: string,
    filters?: { targetType?: string; targetId?: string; status?: string },
  ): Promise<SageBoundaryFlag[]> {
    const params: unknown[] = [workspaceId, orgId]
    let where = 'where workspace_id = $1 and org_id = $2'
    if (filters?.targetType !== undefined) {
      params.push(filters.targetType)
      where += ` and target_type = $${params.length}`
    }
    if (filters?.targetId !== undefined) {
      params.push(filters.targetId)
      where += ` and target_id = $${params.length}`
    }
    if (filters?.status !== undefined) {
      params.push(filters.status)
      where += ` and status = $${params.length}`
    }
    const { rows } = await this.sql.query<SageBoundaryFlagRow>(
      `select * from sage_boundary_flag ${where} order by created_at desc, id desc`,
      params,
    )
    return rows.map(mapBoundaryFlag)
  }

  async reviewBoundaryFlag(
    flagId: string,
    workspaceId: string,
    orgId: string,
    updatedAt: string,
  ): Promise<SageBoundaryFlag> {
    // Compare-and-set: only an 'open' flag may move to 'under_review'.
    const { rows } = await this.sql.query<SageBoundaryFlagRow>(
      `update sage_boundary_flag
         set status = 'under_review', updated_at = $4
       where id = $1 and workspace_id = $2 and org_id = $3 and status = 'open'
       returning *`,
      [flagId, workspaceId, orgId, updatedAt],
    )
    const row = firstOrUndefined(rows)
    if (!row) conflict('boundary flag is not open or was concurrently modified')
    return mapBoundaryFlag(row)
  }

  async resolveBoundaryFlag(
    flagId: string,
    workspaceId: string,
    orgId: string,
    update: {
      status: 'resolved' | 'retained'
      resolvedBy: string
      resolutionNote: string
      resolvedAt: string
      updatedAt: string
      authorizationLevel?: SageAuthorizationLevel
    },
  ): Promise<SageBoundaryFlag> {
    // Compare-and-set: only an open/under_review flag may be resolved/retained.
    // The status predicate makes two concurrent resolvers race for one row.
    // Authorization may only be raised (never lowered) by the resolver; when the
    // caller supplies no override the persisted level is preserved unchanged.
    const { rows } = await this.sql.query<SageBoundaryFlagRow>(
      `update sage_boundary_flag
         set status = $4, resolved_by = $5, resolution_note = $6,
             resolved_at = $7, updated_at = $8,
             authorization_level = coalesce($9, authorization_level)
       where id = $1 and workspace_id = $2 and org_id = $3
         and status in ('open', 'under_review')
       returning *`,
      [
        flagId,
        workspaceId,
        orgId,
        update.status,
        update.resolvedBy,
        update.resolutionNote,
        update.resolvedAt,
        update.updatedAt,
        update.authorizationLevel ?? null,
      ],
    )
    const row = firstOrUndefined(rows)
    if (!row) conflict('boundary flag is already resolved or was concurrently modified')
    return mapBoundaryFlag(row)
  }

  async addReviewNote(input: Omit<SageReviewNote, 'id'>): Promise<SageReviewNote> {
    const { rows } = await this.sql.query<SageReviewNoteRow>(
      `insert into sage_review_note
         (workspace_id, org_id, target_type, target_id, reviewer_id, note_type, note,
          authorization_level, authorization_basis, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning *`,
      [
        input.workspaceId,
        input.orgId,
        input.targetType ?? null,
        input.targetId ?? null,
        input.reviewerId,
        input.noteType,
        input.note,
        input.authorizationLevel,
        input.authorizationBasis ?? null,
        input.createdAt,
      ],
    )
    return mapReviewNote(rows[0])
  }

  async getReviewNote(
    reviewNoteId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageReviewNote | undefined> {
    const { rows } = await this.sql.query<SageReviewNoteRow>(
      `select * from sage_review_note where id = $1 and workspace_id = $2 and org_id = $3`,
      [reviewNoteId, workspaceId, orgId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapReviewNote(row) : undefined
  }

  async listReviewNotes(
    workspaceId: string,
    orgId: string,
    filters?: { targetType?: string; targetId?: string },
  ): Promise<SageReviewNote[]> {
    const params: unknown[] = [workspaceId, orgId]
    let where = 'where workspace_id = $1 and org_id = $2'
    if (filters?.targetType !== undefined) {
      params.push(filters.targetType)
      where += ` and target_type = $${params.length}`
    }
    if (filters?.targetId !== undefined) {
      params.push(filters.targetId)
      where += ` and target_id = $${params.length}`
    }
    const { rows } = await this.sql.query<SageReviewNoteRow>(
      `select * from sage_review_note ${where} order by created_at desc, id desc`,
      params,
    )
    return rows.map(mapReviewNote)
  }

  async createDecisionRecord(
    input: Omit<SageDecisionRecord, 'id'>,
  ): Promise<SageDecisionRecord> {
    const { rows } = await this.sql.query<SageDecisionRecordRow>(
      `insert into sage_decision_record
         (workspace_id, org_id, decision, rationale, uncertainty, human_reviewer_id,
          referenced_evidence_item_ids, referenced_boundary_flag_ids,
          authorization_level, authorization_basis, excluded_from_external_review,
          created_by, created_at)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12, $13)
       returning *`,
      [
        input.workspaceId,
        input.orgId,
        input.decision,
        input.rationale ?? null,
        input.uncertainty ?? null,
        input.humanReviewerId,
        JSON.stringify(input.referencedEvidenceItemIds ?? []),
        JSON.stringify(input.referencedBoundaryFlagIds ?? []),
        input.authorizationLevel,
        input.authorizationBasis ?? null,
        input.excludedFromExternalReview,
        input.createdBy,
        input.createdAt,
      ],
    )
    return mapDecisionRecord(rows[0])
  }

  async listDecisionRecords(
    workspaceId: string,
    orgId: string,
  ): Promise<SageDecisionRecord[]> {
    const { rows } = await this.sql.query<SageDecisionRecordRow>(
      `select * from sage_decision_record
       where workspace_id = $1 and org_id = $2
       order by created_at desc, id desc`,
      [workspaceId, orgId],
    )
    return rows.map(mapDecisionRecord)
  }

  async getDecisionRecord(
    decisionId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageDecisionRecord | undefined> {
    const { rows } = await this.sql.query<SageDecisionRecordRow>(
      `select * from sage_decision_record where id = $1 and workspace_id = $2 and org_id = $3`,
      [decisionId, workspaceId, orgId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapDecisionRecord(row) : undefined
  }

  // ─── Export workflow ─────────────────────────────────────────────────────────

  async createExportRequest(
    input: Omit<SageExportRequest, 'id'>,
  ): Promise<SageExportRequest> {
    const { rows } = await this.sql.query<SageExportRequestRow>(
      `insert into sage_export_request
         (workspace_id, org_id, requested_by, scope, purpose, package_type,
          requested_scope_json, requested_scope_hash, policy_version,
          status, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $11)
       returning *`,
      [
        input.workspaceId,
        input.orgId,
        input.requestedBy,
        input.scope ?? null,
        input.purpose ?? null,
        input.packageType,
        input.requestedScopeJson ?? null,
        input.requestedScopeHash ?? null,
        input.policyVersion ?? null,
        input.status,
        input.createdAt,
      ],
    )
    return mapExportRequest(rows[0])
  }

  async getExportRequest(
    exportRequestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportRequest | undefined> {
    const { rows } = await this.sql.query<SageExportRequestRow>(
      `select * from sage_export_request where id = $1 and workspace_id = $2 and org_id = $3`,
      [exportRequestId, workspaceId, orgId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapExportRequest(row) : undefined
  }

  async listExportRequests(workspaceId: string, orgId: string): Promise<SageExportRequest[]> {
    const { rows } = await this.sql.query<SageExportRequestRow>(
      `select * from sage_export_request
       where workspace_id = $1 and org_id = $2
       order by created_at desc, id desc`,
      [workspaceId, orgId],
    )
    return rows.map(mapExportRequest)
  }

  async listExportApprovals(
    exportRequestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportApproval[]> {
    // Tenant-fenced through a join on the parent request's workspace/org.
    const { rows } = await this.sql.query<SageExportApprovalRow>(
      `select a.* from sage_export_approval a
         join sage_export_request r on r.id = a.export_request_id
       where a.export_request_id = $1 and r.workspace_id = $2 and a.org_id = $3
       order by a.decision_at desc, a.id desc`,
      [exportRequestId, workspaceId, orgId],
    )
    return rows.map(mapExportApproval)
  }

  async decideExportRequest(input: {
    exportRequestId: string
    workspaceId: string
    orgId: string
    decision: 'approved' | 'denied'
    updatedAt: string
    approval: Omit<SageExportApproval, 'id'>
    auditEvent: SageAuditOutboxIntent
  }): Promise<{ request: SageExportRequest; approval: SageExportApproval } | undefined> {
    // Atomic compare-and-set in ONE statement: the approval INSERT and the
    // durable audit-outbox INSERT only run when the guarded UPDATE flips a
    // 'requested' row. Approval + status + audit intent commit together — an
    // approved status cannot exist without an approval and durable audit intent.
    const { rows } = await this.sql.query<SageExportApprovalRow>(
      `with decided as (
         update sage_export_request
           set status = $4, updated_at = $5
         where id = $1 and workspace_id = $2 and org_id = $3 and status = 'requested'
         returning id
       ),
       appr as (
         insert into sage_export_approval
           (export_request_id, org_id, export_authority_level, approver_id,
            decision, decision_at, reason, approved_scope_hash)
         select $1, $3, $6, $7, $8, $9, $10, $11 from decided
         returning *
       ),
       outbox as (
         insert into sage_audit_outbox
           (event_id, org_id, workspace_id, actor_id, action, resource_type,
            resource_id, safe_payload_json, status, attempt_count, created_at)
         select $12, $3, $2, $13, $14, $15, appr.id, $16::jsonb, 'pending', 0, $5 from appr
         on conflict (event_id) do nothing
         returning event_id
       )
       select * from appr`,
      [
        input.exportRequestId,
        input.workspaceId,
        input.orgId,
        input.decision,
        input.updatedAt,
        input.approval.exportAuthorityLevel,
        input.approval.approverId,
        input.approval.decision,
        input.approval.decisionAt,
        input.approval.reason ?? null,
        input.approval.approvedScopeHash ?? null,
        input.auditEvent.eventId,
        input.auditEvent.actorId,
        input.auditEvent.action,
        input.auditEvent.resourceType,
        JSON.stringify(input.auditEvent.safePayload),
      ],
    )
    const approvalRow = firstOrUndefined(rows)
    if (!approvalRow) return undefined
    const request = await this.getExportRequest(
      input.exportRequestId,
      input.workspaceId,
      input.orgId,
    )
    if (!request) return undefined
    return { request, approval: mapExportApproval(approvalRow) }
  }

  async commitExportPackage(input: {
    package: Omit<SageExportPackage, 'id'>
    object: SageExportPackageObject
    auditEvent: SageAuditOutboxIntent
  }): Promise<{ package: SageExportPackage; created: boolean }> {
    // ONE atomic statement, claim-gated so a loser produces NO side effects:
    //   • the object bytes are inserted ONLY when no package yet exists for this
    //     request (winning the generation claim), never merely because they share
    //     the statement;
    //   • the package row is inserted ONLY when a matching object is present
    //     (never points at absent bytes);
    //   • the audit-outbox intent is enqueued ONLY when the package row is
    //     inserted (never drops or duplicates evidence).
    // A request that loses the `export_request_id` claim inserts nothing.
    const contentText = new TextDecoder().decode(input.object.bytes)
    const { rows } = await this.sql.query<SageExportPackageRow>(
      `with existing_pkg as (
         select 1 from sage_export_package where export_request_id = $8
       ),
       obj as (
         insert into sage_export_package_object
           (storage_reference, media_type, content_hash, content_text, size_bytes)
         select $1, $2, $3, $4, $5
         where not exists (select 1 from existing_pkg)
         on conflict (storage_reference) do nothing
         returning storage_reference
       ),
       object_row as (
         select o.storage_reference
         from sage_export_package_object o
         where o.storage_reference = $1
           and o.content_hash = $3
           and o.size_bytes = $5
       ),
       pkg as (
         insert into sage_export_package
           (org_id, workspace_id, export_request_id, status, package_type,
            manifest_json, manifest_hash, content_hash, storage_reference,
            media_type, size_bytes, policy_version, item_count, excluded_count,
            generated_by, generated_at, created_at)
         select $6, $7, $8, 'generated', $9, $10::jsonb, $11, $3, $1, $2, $5,
                $12, $13, $14, $15, $16, $16
         from object_row
         on conflict (export_request_id) do nothing
         returning *
       ),
       outbox as (
         insert into sage_audit_outbox
           (event_id, org_id, workspace_id, actor_id, action, resource_type,
            resource_id, safe_payload_json, status, attempt_count, created_at)
         select $17, $6, $7, $18, $19, $20, pkg.id, $21::jsonb, 'pending', 0, $16 from pkg
         on conflict (event_id) do nothing
         returning event_id
       )
       select * from pkg`,
      [
        input.object.storageReference,
        input.object.mediaType,
        input.object.contentHash,
        contentText,
        input.object.sizeBytes,
        input.package.orgId,
        input.package.workspaceId,
        input.package.exportRequestId,
        input.package.packageType,
        input.package.manifestJson,
        input.package.manifestHash,
        input.package.policyVersion,
        input.package.itemCount,
        input.package.excludedCount,
        input.package.generatedBy,
        input.package.generatedAt,
        input.auditEvent.eventId,
        input.auditEvent.actorId,
        input.auditEvent.action,
        input.auditEvent.resourceType,
        JSON.stringify(input.auditEvent.safePayload),
      ],
    )
    const row = firstOrUndefined(rows)
    if (row) return { package: mapExportPackage(row), created: true }
    // Conflict: a package already exists for this request — return it.
    const existing = await this.getExportPackageByRequest(
      input.package.exportRequestId,
      input.package.workspaceId,
      input.package.orgId,
    )
    if (!existing) conflict('export package generation conflict')
    return { package: existing, created: false }
  }

  async getExportPackageObject(
    storageReference: string,
  ): Promise<SageExportPackageObject | undefined> {
    const { rows } = await this.sql.query<{
      storage_reference: string
      media_type: string
      content_hash: string
      content_text: string
      size_bytes: unknown
    }>(
      `select storage_reference, media_type, content_hash, content_text, size_bytes
       from sage_export_package_object where storage_reference = $1`,
      [storageReference],
    )
    const row = firstOrUndefined(rows)
    if (!row) return undefined
    return {
      storageReference: row.storage_reference,
      mediaType: row.media_type,
      contentHash: row.content_hash,
      bytes: new TextEncoder().encode(row.content_text),
      sizeBytes: Number(row.size_bytes ?? 0),
    }
  }

  async enqueueAuditOutbox(input: {
    intent: SageAuditOutboxIntent
    orgId: string
    workspaceId: string
    resourceId: string
    createdAt: string
  }): Promise<void> {
    await this.sql.query(
      `insert into sage_audit_outbox
         (event_id, org_id, workspace_id, actor_id, action, resource_type,
          resource_id, safe_payload_json, status, attempt_count, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'pending', 0, $9)
       on conflict (event_id) do nothing`,
      [
        input.intent.eventId,
        input.orgId,
        input.workspaceId,
        input.intent.actorId,
        input.intent.action,
        input.intent.resourceType,
        input.resourceId,
        JSON.stringify(input.intent.safePayload),
        input.createdAt,
      ],
    )
  }

  async listPendingAuditOutbox(limit: number): Promise<SageAuditOutboxEvent[]> {
    const { rows } = await this.sql.query<SageAuditOutboxRow>(
      `select * from sage_audit_outbox
       where status = 'pending'
       order by created_at asc, id asc
       limit $1`,
      [limit],
    )
    return rows.map(mapAuditOutbox)
  }

  async claimPendingAuditOutbox(input: {
    owner: string
    leaseExpiresAt: string
    limit: number
    now: string
  }): Promise<SageAuditOutboxEvent[]> {
    // Atomic leased claim: take pending events (or events whose lease has
    // expired) with FOR UPDATE SKIP LOCKED so concurrent dispatchers never grab
    // the same row. Delivery is at-least-once with a stable event_id.
    const { rows } = await this.sql.query<SageAuditOutboxRow>(
      `update sage_audit_outbox o
         set status = 'dispatching',
             dispatch_owner = $1,
             lease_expires_at = $2,
             attempt_count = o.attempt_count + 1
       where o.id in (
         select id from sage_audit_outbox
          where status = 'pending'
             or (status = 'dispatching' and lease_expires_at < $3)
          order by created_at asc, id asc
          for update skip locked
          limit $4
       )
       returning *`,
      [input.owner, input.leaseExpiresAt, input.now, input.limit],
    )
    return rows.map(mapAuditOutbox)
  }

  async claimAuditOutboxEvent(input: {
    eventId: string
    owner: string
    leaseExpiresAt: string
    now: string
  }): Promise<SageAuditOutboxEvent | undefined> {
    const { rows } = await this.sql.query<SageAuditOutboxRow>(
      `update sage_audit_outbox o
         set status = 'dispatching',
             dispatch_owner = $2,
             lease_expires_at = $3,
             attempt_count = o.attempt_count + 1
       where o.id in (
         select id from sage_audit_outbox
          where event_id = $1
            and (status = 'pending'
                 or (status = 'dispatching' and lease_expires_at < $4))
          for update skip locked
          limit 1
       )
       returning *`,
      [input.eventId, input.owner, input.leaseExpiresAt, input.now],
    )
    return firstOrUndefined(rows.map(mapAuditOutbox))
  }

  async markAuditOutboxDispatched(
    eventId: string,
    owner: string,
    dispatchedAt: string,
  ): Promise<boolean> {
    // Fenced: only the current lease owner may finalize the claim.
    const { rows } = await this.sql.query<{ event_id: string }>(
      `update sage_audit_outbox
         set status = 'dispatched', dispatched_at = $3,
             dispatch_owner = null, lease_expires_at = null, last_error_code = null
       where event_id = $1 and dispatch_owner = $2 and status = 'dispatching'
       returning event_id`,
      [eventId, owner, dispatchedAt],
    )
    return rows.length > 0
  }

  async releaseAuditOutbox(eventId: string, owner: string, errorCode: string): Promise<boolean> {
    // Fenced: only the current lease owner may release the claim back to pending.
    const { rows } = await this.sql.query<{ event_id: string }>(
      `update sage_audit_outbox
         set status = 'pending', dispatch_owner = null,
             lease_expires_at = null, last_error_code = $3
       where event_id = $1 and dispatch_owner = $2 and status = 'dispatching'
       returning event_id`,
      [eventId, owner, errorCode],
    )
    return rows.length > 0
  }

  async getExportPackageByRequest(
    exportRequestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportPackage | undefined> {
    const { rows } = await this.sql.query<SageExportPackageRow>(
      `select * from sage_export_package
       where export_request_id = $1 and workspace_id = $2 and org_id = $3`,
      [exportRequestId, workspaceId, orgId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapExportPackage(row) : undefined
  }

  async listExportPackages(workspaceId: string, orgId: string): Promise<SageExportPackage[]> {
    const { rows } = await this.sql.query<SageExportPackageRow>(
      `select * from sage_export_package
       where workspace_id = $1 and org_id = $2
       order by generated_at desc, id desc`,
      [workspaceId, orgId],
    )
    return rows.map(mapExportPackage)
  }

  async getExportPackage(
    packageId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportPackage | undefined> {
    const { rows } = await this.sql.query<SageExportPackageRow>(
      `select * from sage_export_package where id = $1 and workspace_id = $2 and org_id = $3`,
      [packageId, workspaceId, orgId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapExportPackage(row) : undefined
  }

  // ─── Read models for the workspace summary (counts only) ─────────────────────

  async countWorkspaceEvidenceSources(workspaceId: string): Promise<number> {
    const { rows } = await this.sql.query<CountRow>(
      `select count(*)::int as count from sage_evidence_source where workspace_id = $1`,
      [workspaceId],
    )
    return toCount(rows)
  }

  async countWorkspaceEvidenceItems(workspaceId: string): Promise<number> {
    const { rows } = await this.sql.query<CountRow>(
      `select count(*)::int as count from sage_evidence_item where workspace_id = $1`,
      [workspaceId],
    )
    return toCount(rows)
  }

  async countWorkspaceBoundaryFlags(workspaceId: string): Promise<number> {
    const { rows } = await this.sql.query<CountRow>(
      `select count(*)::int as count from sage_boundary_flag where workspace_id = $1`,
      [workspaceId],
    )
    return toCount(rows)
  }

  async countWorkspaceDecisionRecords(workspaceId: string): Promise<number> {
    const { rows } = await this.sql.query<CountRow>(
      `select count(*)::int as count from sage_decision_record where workspace_id = $1`,
      [workspaceId],
    )
    return toCount(rows)
  }

  async countWorkspaceOpenExportRequests(workspaceId: string): Promise<number> {
    const { rows } = await this.sql.query<CountRow>(
      `select count(*)::int as count from sage_export_request
       where workspace_id = $1 and status = 'requested'`,
      [workspaceId],
    )
    return toCount(rows)
  }

  // ── Phase 8A: secure recipient delivery ────────────────────────────────────

  async createDeliveryRecipient(
    input: Omit<SageDeliveryRecipient, 'id'>,
  ): Promise<SageDeliveryRecipient> {
    const { rows } = await this.sql.query<SageDeliveryRecipientRow>(
      `insert into sage_delivery_recipient
         (org_id, workspace_id, display_name, identity_provider, identity_subject,
          normalized_email_hash, verification_status, verified_at, created_by,
          created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       on conflict (workspace_id, identity_provider, identity_subject) do nothing
       returning *`,
      [
        input.orgId,
        input.workspaceId,
        input.displayName,
        input.identityProvider,
        input.identitySubject,
        input.normalizedEmailHash,
        input.verificationStatus,
        input.verifiedAt ?? null,
        input.createdBy,
        input.createdAt,
      ],
    )
    const row = firstOrUndefined(rows)
    if (!row) conflict('a recipient with this verified identity already exists')
    return mapDeliveryRecipient(row)
  }

  async getDeliveryRecipient(
    recipientId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageDeliveryRecipient | undefined> {
    const { rows } = await this.sql.query<SageDeliveryRecipientRow>(
      `select * from sage_delivery_recipient
       where id = $1 and workspace_id = $2 and org_id = $3`,
      [recipientId, workspaceId, orgId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapDeliveryRecipient(row) : undefined
  }

  async listDeliveryRecipients(
    workspaceId: string,
    orgId: string,
  ): Promise<SageDeliveryRecipient[]> {
    const { rows } = await this.sql.query<SageDeliveryRecipientRow>(
      `select * from sage_delivery_recipient
       where workspace_id = $1 and org_id = $2
       order by created_at asc, id asc`,
      [workspaceId, orgId],
    )
    return rows.map(mapDeliveryRecipient)
  }

  async createDeliveryRequest(input: {
    request: Omit<SageDeliveryRequest, 'id'>
    auditEvent: SageAuditOutboxIntent
    receipt?: SageDeliveryReceiptIntent
  }): Promise<SageDeliveryRequest> {
    const r = input.request
    const { rows } = await this.sql.query<SageDeliveryRequestRow>(
      `with req as (
         insert into sage_delivery_request
           (org_id, workspace_id, export_package_id, recipient_id, requested_by,
            purpose, status, package_content_hash, package_manifest_hash,
            recipient_identity_hash, policy_version, requested_access_expires_at,
            requested_max_accesses, requested_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, 'requested', $7, $8, $9, $10, $11, $12, $13, $13)
         returning *
       ),
       outbox as (
         insert into sage_audit_outbox
           (event_id, org_id, workspace_id, actor_id, action, resource_type,
            resource_id, safe_payload_json, status, attempt_count, created_at)
         select $14, $1, $2, $15, $16, $17, req.id, $18::jsonb, 'pending', 0, $13 from req
         on conflict (event_id) do nothing
         returning event_id
       )
       select * from req`,
      [
        r.orgId,
        r.workspaceId,
        r.exportPackageId,
        r.recipientId,
        r.requestedBy,
        r.purpose ?? null,
        r.packageContentHash,
        r.packageManifestHash,
        r.recipientIdentityHash,
        r.policyVersion,
        r.requestedAccessExpiresAt,
        r.requestedMaxAccesses,
        r.requestedAt,
        input.auditEvent.eventId,
        input.auditEvent.actorId,
        input.auditEvent.action,
        input.auditEvent.resourceType,
        JSON.stringify(input.auditEvent.safePayload),
      ],
    )
    return mapDeliveryRequest(rows[0])
  }

  async getDeliveryRequest(
    requestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageDeliveryRequest | undefined> {
    const { rows } = await this.sql.query<SageDeliveryRequestRow>(
      `select * from sage_delivery_request
       where id = $1 and workspace_id = $2 and org_id = $3`,
      [requestId, workspaceId, orgId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapDeliveryRequest(row) : undefined
  }

  async listDeliveryRequests(
    workspaceId: string,
    orgId: string,
  ): Promise<SageDeliveryRequest[]> {
    const { rows } = await this.sql.query<SageDeliveryRequestRow>(
      `select * from sage_delivery_request
       where workspace_id = $1 and org_id = $2
       order by requested_at desc, id desc`,
      [workspaceId, orgId],
    )
    return rows.map(mapDeliveryRequest)
  }

  async decideDeliveryRequest(input: {
    deliveryRequestId: string
    workspaceId: string
    orgId: string
    decision: SageDeliveryDecision
    updatedAt: string
    approval: Omit<SageDeliveryApproval, 'id'>
    auditEvent: SageAuditOutboxIntent
    receipt?: SageDeliveryReceiptIntent
  }): Promise<{ request: SageDeliveryRequest; approval: SageDeliveryApproval } | undefined> {
    const a = input.approval
    // Atomic CAS: approval INSERT + audit INSERT only run when the guarded
    // UPDATE flips a still-'requested' row in this tenant.
    const { rows } = await this.sql.query<SageDeliveryApprovalRow>(
      `with decided as (
         update sage_delivery_request
           set status = $4, updated_at = $5
         where id = $1 and workspace_id = $2 and org_id = $3 and status = 'requested'
         returning id
       ),
       appr as (
         insert into sage_delivery_approval
           (org_id, workspace_id, delivery_request_id, decision, approver_id,
            rationale, approved_package_content_hash, approved_manifest_hash,
            approved_recipient_identity_hash, approved_policy_version,
            approved_access_expires_at, approved_max_accesses, decided_at)
         select $3, $2, $1, $6, $7, $8, $9, $10, $11, $12, $13, $14, $5 from decided
         returning *
       ),
       outbox as (
         insert into sage_audit_outbox
           (event_id, org_id, workspace_id, actor_id, action, resource_type,
            resource_id, safe_payload_json, status, attempt_count, created_at)
         select $15, $3, $2, $16, $17, $18, appr.id, $19::jsonb, 'pending', 0, $5 from appr
         on conflict (event_id) do nothing
         returning event_id
       )
       select * from appr`,
      [
        input.deliveryRequestId,
        input.workspaceId,
        input.orgId,
        input.decision,
        input.updatedAt,
        a.decision,
        a.approverId,
        a.rationale ?? null,
        a.approvedPackageContentHash,
        a.approvedManifestHash,
        a.approvedRecipientIdentityHash,
        a.approvedPolicyVersion,
        a.approvedAccessExpiresAt,
        a.approvedMaxAccesses,
        input.auditEvent.eventId,
        input.auditEvent.actorId,
        input.auditEvent.action,
        input.auditEvent.resourceType,
        JSON.stringify(input.auditEvent.safePayload),
      ],
    )
    const approvalRow = firstOrUndefined(rows)
    if (!approvalRow) return undefined
    const request = await this.getDeliveryRequest(
      input.deliveryRequestId,
      input.workspaceId,
      input.orgId,
    )
    if (!request) return undefined
    return { request, approval: mapDeliveryApproval(approvalRow) }
  }

  async getDeliveryApproval(
    deliveryRequestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageDeliveryApproval | undefined> {
    const { rows } = await this.sql.query<SageDeliveryApprovalRow>(
      `select * from sage_delivery_approval
       where delivery_request_id = $1 and workspace_id = $2 and org_id = $3`,
      [deliveryRequestId, workspaceId, orgId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapDeliveryApproval(row) : undefined
  }

  async getDeliveryIssuanceByRequestId(input: {
    orgId: string
    workspaceId: string
    deliveryRequestId: string
  }): Promise<SageDeliveryIssuance | undefined> {
    const grants = await this.sql.query<SageDeliveryGrantRow>(
      `select * from sage_delivery_grant
       where delivery_request_id = $1 and workspace_id = $2 and org_id = $3`,
      [input.deliveryRequestId, input.workspaceId, input.orgId],
    )
    const notifications = await this.sql.query<SageNotificationOutboxRow>(
      `select * from sage_notification_outbox
       where delivery_request_id = $1 and workspace_id = $2 and org_id = $3`,
      [input.deliveryRequestId, input.workspaceId, input.orgId],
    )
    const grant = firstOrUndefined(grants.rows)
    const notification = firstOrUndefined(notifications.rows)
    if (!grant && !notification) return undefined
    if (!grant || !notification || String(notification.grant_id) !== String(grant.id)) {
      conflict('delivery issuance integrity failure: grant and notification must be committed together')
    }
    return { grant: mapDeliveryGrant(grant), notification: mapNotificationOutbox(notification) }
  }

  async issueDeliveryGrant(input: {
    grant: Omit<SageDeliveryGrant, 'id'> & { id?: string }
    updatedAt: string
    auditEvent: SageAuditOutboxIntent
    receipt: SageDeliveryReceiptIntent
    notification: SageNotificationOutboxIntent
  }): Promise<{ grant: SageDeliveryGrant; created: boolean } | undefined> {
    const g = input.grant
    const rc = input.receipt
    const n = input.notification
    if (g.id && n.grantId !== g.id) {
      conflict('delivery issuance integrity failure: notification grant binding does not match grant id')
    }
    // Atomic CTE (Pattern A): dependency chain ensures grant cannot exist without notification.
    // 1. issued_req: claim approved request (if not approved or grant exists, returns zero)
    // 2. notification: insert notification (fails transaction if message_id conflict)
    // 3. grant_row: insert grant, depends on notification succeeding
    // 4. outbox/receipt: depend on grant_row
    // Guarantee: grant + notification commit together or not at all. No grant without notification.
    const { rows } = await this.sql.query<SageDeliveryGrantRow>(
      `with issued_req as (
         update sage_delivery_request
           set status = 'issued', updated_at = $21
         where id = $3 and workspace_id = $2 and org_id = $1 and status = 'approved'
             and not exists (select 1 from sage_delivery_grant where delivery_request_id = $3)
         returning id
       ),
       notification as (
         insert into sage_notification_outbox
           (message_id, org_id, workspace_id, delivery_request_id,
            grant_id, recipient_id, provider, template, recipient_address_hash,
            encrypted_payload, encryption_key_reference, status,
            attempt_count, max_retries, created_at)
         select $22, $1, $2, $3, coalesce($27::uuid, gen_random_uuid()), $5, $23, $24, $25, $26, $28,
                'pending', 0, 5, $11
         from issued_req
         returning id, grant_id, delivery_request_id, provider, template, recipient_id
       ),
       grant_row as (
         insert into sage_delivery_grant
           (id, org_id, workspace_id, delivery_request_id, export_package_id,
            recipient_id, status, invitation_token_hash, invitation_expires_at,
            access_expires_at, max_accesses, access_count, issued_by, issued_at, updated_at)
         select notification.grant_id, $1, $2, notification.delivery_request_id, $4, notification.recipient_id,
                'issued', $6, $7, $8, $9, 0, $10, $11, $11
         from notification
         returning *
       ),
       outbox as (
         insert into sage_audit_outbox
           (event_id, org_id, workspace_id, actor_id, action, resource_type,
            resource_id, safe_payload_json, status, attempt_count, created_at)
         select $12, $1, $2, $13, $14, $15, grant_row.id, $16::jsonb, 'pending', 0, $11
         from grant_row
         on conflict (event_id) do nothing
         returning event_id
       ),
       receipt as (
         insert into sage_delivery_receipt
           (event_id, org_id, workspace_id, delivery_request_id, grant_id,
            package_id, recipient_id, event_type, safe_reason_code, occurred_at, created_at)
         select $17, $1, $2, $3, grant_row.id, $4, grant_row.recipient_id, $18, $20, $11, $11
         from grant_row
         on conflict (event_id) do nothing
         returning event_id
       ),
       verify_notification as (
         select id from notification
       )
       select * from grant_row`,
      [
        g.orgId,
        g.workspaceId,
        g.deliveryRequestId,
        g.exportPackageId,
        g.recipientId,
        g.invitationTokenHash,
        g.invitationExpiresAt,
        g.accessExpiresAt,
        g.maxAccesses,
        g.issuedBy,
        g.issuedAt,
        input.auditEvent.eventId,
        input.auditEvent.actorId,
        input.auditEvent.action,
        input.auditEvent.resourceType,
        JSON.stringify(input.auditEvent.safePayload),
        rc.eventId,
        rc.eventType,
        input.updatedAt,
        rc.safeReasonCode ?? null,
        input.updatedAt,
        n.messageId,
        n.provider,
        n.template,
        n.recipientAddressHash,
         n.encryptedPayload,
        g.id ?? null,
        n.encryptionKeyReference ?? 'sage-notification:v1',
      ],
    )
    const row = firstOrUndefined(rows)
    if (row) return { grant: mapDeliveryGrant(row), created: true }

    // REPLAY-SAFE FALLBACK: Transaction succeeded but response was lost.
    // Verify the existing grant and notification are COMPATIBLE with this request.
    // If incompatible, return CONFLICT instead of silently returning the wrong grant.

    const existing = await this.getDeliveryIssuanceByRequestId({
      deliveryRequestId: g.deliveryRequestId,
      workspaceId: g.workspaceId,
      orgId: g.orgId,
    })
    if (!existing) return undefined
    const existingGrant = existing.grant

    // Verify the existing grant is compatible with the requested parameters.
    // If any mismatch exists, return CONFLICT (not the wrong grant).
    const incompatibilities: string[] = []
    if (existingGrant.exportPackageId !== g.exportPackageId) {
      incompatibilities.push(`package mismatch: existing=${existingGrant.exportPackageId}, requested=${g.exportPackageId}`)
    }
    if (existingGrant.recipientId !== g.recipientId) {
      incompatibilities.push(`recipient mismatch: existing=${existingGrant.recipientId}, requested=${g.recipientId}`)
    }
    if (existingGrant.maxAccesses !== g.maxAccesses) {
      incompatibilities.push(`maxAccesses mismatch: existing=${existingGrant.maxAccesses}, requested=${g.maxAccesses}`)
    }

    // Compare expiry dates (allow small skew due to timing)
    const existingExpiry = new Date(existingGrant.accessExpiresAt).getTime()
    const requestedExpiry = new Date(g.accessExpiresAt).getTime()
    const expirySkewMs = 1000 // 1 second tolerance
    if (Math.abs(existingExpiry - requestedExpiry) > expirySkewMs) {
      incompatibilities.push(
        `expiry mismatch: existing=${existingGrant.accessExpiresAt}, requested=${g.accessExpiresAt}`,
      )
    }

    if (incompatibilities.length > 0) {
      // Incompatible replay: this is not an idempotent retry
      conflict(`replay safety: existing grant is incompatible:\n${incompatibilities.join('\n')}`)
    }

    // Compatible replay: return the existing grant
    if (existing.notification.messageId !== n.messageId || existing.notification.grantId !== existingGrant.id) {
      conflict('delivery issuance integrity failure: existing notification binding is incompatible')
    }
    return { grant: existingGrant, created: false }
  }

  async getDeliveryGrant(
    grantId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageDeliveryGrant | undefined> {
    const { rows } = await this.sql.query<SageDeliveryGrantRow>(
      `select * from sage_delivery_grant
       where id = $1 and workspace_id = $2 and org_id = $3`,
      [grantId, workspaceId, orgId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapDeliveryGrant(row) : undefined
  }

  async getDeliveryGrantByInvitationHash(
    invitationTokenHash: string,
  ): Promise<SageDeliveryGrant | undefined> {
    const { rows } = await this.sql.query<SageDeliveryGrantRow>(
      `select * from sage_delivery_grant where invitation_token_hash = $1`,
      [invitationTokenHash],
    )
    const row = firstOrUndefined(rows)
    return row ? mapDeliveryGrant(row) : undefined
  }

  async getDeliveryGrantById(grantId: string): Promise<SageDeliveryGrant | undefined> {
    const { rows } = await this.sql.query<SageDeliveryGrantRow>(
      `select * from sage_delivery_grant where id = $1`,
      [grantId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapDeliveryGrant(row) : undefined
  }

  async listDeliveryGrants(workspaceId: string, orgId: string): Promise<SageDeliveryGrant[]> {
    const { rows } = await this.sql.query<SageDeliveryGrantRow>(
      `select * from sage_delivery_grant
       where workspace_id = $1 and org_id = $2
       order by issued_at desc, id desc`,
      [workspaceId, orgId],
    )
    return rows.map(mapDeliveryGrant)
  }

  async claimDeliveryGrant(input: {
    grantId: string
    invitationTokenHash: string
    claimedIdentityProvider: string
    claimedIdentitySubject: string
    sessionTokenHash: string
    claimedAt: string
    now: string
    auditEvent: SageAuditOutboxIntent
    receipt: SageDeliveryReceiptIntent
  }): Promise<SageDeliveryGrant | undefined> {
    const rc = input.receipt
    // CAS: issued → active, binding identity + session, only if the invitation
    // hash matches and the invitation has not expired.
    const { rows } = await this.sql.query<SageDeliveryGrantRow>(
      `with claimed as (
         update sage_delivery_grant
           set status = 'active', claimed_identity_provider = $3,
               claimed_identity_subject = $4, session_token_hash = $5,
               claimed_at = $6, updated_at = $6
         where id = $1 and status = 'issued' and invitation_token_hash = $2
             and invitation_expires_at > $7
         returning *
       ),
       outbox as (
         insert into sage_audit_outbox
           (event_id, org_id, workspace_id, actor_id, action, resource_type,
            resource_id, safe_payload_json, status, attempt_count, created_at)
         select $8, claimed.org_id, claimed.workspace_id, $9, $10, $11, claimed.id, $12::jsonb, 'pending', 0, $6
           from claimed
         on conflict (event_id) do nothing
         returning event_id
       ),
       receipt as (
         insert into sage_delivery_receipt
           (event_id, org_id, workspace_id, delivery_request_id, grant_id,
            package_id, recipient_id, event_type, safe_reason_code, occurred_at, created_at)
         select $13, claimed.org_id, claimed.workspace_id, claimed.delivery_request_id,
                claimed.id, claimed.export_package_id, claimed.recipient_id, $14, $15, $6, $6
           from claimed
         on conflict (event_id) do nothing
         returning event_id
       )
       select * from claimed`,
      [
        input.grantId,
        input.invitationTokenHash,
        input.claimedIdentityProvider,
        input.claimedIdentitySubject,
        input.sessionTokenHash,
        input.claimedAt,
        input.now,
        input.auditEvent.eventId,
        input.auditEvent.actorId,
        input.auditEvent.action,
        input.auditEvent.resourceType,
        JSON.stringify(input.auditEvent.safePayload),
        rc.eventId,
        rc.eventType,
        rc.safeReasonCode ?? null,
      ],
    )
    const row = firstOrUndefined(rows)
    return row ? mapDeliveryGrant(row) : undefined
  }

  async authorizeDeliveryAccess(input: {
    grantId: string
    identitySubject: string
    now: string
    auditEvent: SageAuditOutboxIntent
    receipt: SageDeliveryReceiptIntent
  }): Promise<SageDeliveryGrant | undefined> {
    const rc = input.receipt
    // Atomic authorization: increment access_count ONLY on an active, in-window,
    // in-budget, identity-bound grant. The receipt + audit commit together.
    const { rows } = await this.sql.query<SageDeliveryGrantRow>(
      `with authed as (
         update sage_delivery_grant
           set access_count = access_count + 1, updated_at = $3
         where id = $1 and status = 'active' and access_expires_at > $3
             and access_count < max_accesses and claimed_identity_subject = $2
         returning *
       ),
       outbox as (
         insert into sage_audit_outbox
           (event_id, org_id, workspace_id, actor_id, action, resource_type,
            resource_id, safe_payload_json, status, attempt_count, created_at)
         select $4, authed.org_id, authed.workspace_id, $5, $6, $7, authed.id, $8::jsonb, 'pending', 0, $3
           from authed
         on conflict (event_id) do nothing
         returning event_id
       ),
       receipt as (
         insert into sage_delivery_receipt
           (event_id, org_id, workspace_id, delivery_request_id, grant_id,
            package_id, recipient_id, event_type, safe_reason_code, occurred_at, created_at)
         select $9, authed.org_id, authed.workspace_id, authed.delivery_request_id,
                authed.id, authed.export_package_id, authed.recipient_id, $10, $11, $3, $3
           from authed
         on conflict (event_id) do nothing
         returning event_id
       )
       select * from authed`,
      [
        input.grantId,
        input.identitySubject,
        input.now,
        input.auditEvent.eventId,
        input.auditEvent.actorId,
        input.auditEvent.action,
        input.auditEvent.resourceType,
        JSON.stringify(input.auditEvent.safePayload),
        rc.eventId,
        rc.eventType,
        rc.safeReasonCode ?? null,
      ],
    )
    const row = firstOrUndefined(rows)
    return row ? mapDeliveryGrant(row) : undefined
  }

  async revokeDeliveryGrant(input: {
    grantId: string
    workspaceId: string
    orgId: string
    revokedBy: string
    revocationReasonCode: SageDeliveryRevocationReasonCode
    revokedAt: string
    auditEvent: SageAuditOutboxIntent
    receipt: SageDeliveryReceiptIntent
  }): Promise<SageDeliveryGrant | undefined> {
    const rc = input.receipt
    const { rows } = await this.sql.query<SageDeliveryGrantRow>(
      `with revoked as (
         update sage_delivery_grant
           set status = 'revoked', revoked_by = $4, revocation_reason_code = $5,
               revoked_at = $6, updated_at = $6
         where id = $1 and workspace_id = $2 and org_id = $3
             and status in ('issued', 'active')
         returning *
       ),
       outbox as (
         insert into sage_audit_outbox
           (event_id, org_id, workspace_id, actor_id, action, resource_type,
            resource_id, safe_payload_json, status, attempt_count, created_at)
         select $7, revoked.org_id, revoked.workspace_id, $8, $9, $10, revoked.id, $11::jsonb, 'pending', 0, $6
           from revoked
         on conflict (event_id) do nothing
         returning event_id
       ),
       receipt as (
         insert into sage_delivery_receipt
           (event_id, org_id, workspace_id, delivery_request_id, grant_id,
            package_id, recipient_id, event_type, safe_reason_code, occurred_at, created_at)
         select $12, revoked.org_id, revoked.workspace_id, revoked.delivery_request_id,
                revoked.id, revoked.export_package_id, revoked.recipient_id, $13, $5, $6, $6
           from revoked
         on conflict (event_id) do nothing
         returning event_id
       )
       select * from revoked`,
      [
        input.grantId,
        input.workspaceId,
        input.orgId,
        input.revokedBy,
        input.revocationReasonCode,
        input.revokedAt,
        input.auditEvent.eventId,
        input.auditEvent.actorId,
        input.auditEvent.action,
        input.auditEvent.resourceType,
        JSON.stringify(input.auditEvent.safePayload),
        rc.eventId,
        rc.eventType,
      ],
    )
    const row = firstOrUndefined(rows)
    return row ? mapDeliveryGrant(row) : undefined
  }

  async expireDeliveryGrants(input: {
    now: string
    limit: number
    auditAction: string
    workspaceId?: string
    orgId?: string
  }): Promise<SageDeliveryGrant[]> {
    // Atomically flip claimable rows to 'expired' (one sweeper wins each row),
    // then append one grant_expired receipt + audit per row (unique event_id
    // makes concurrent sweepers idempotent).
    const { rows } = await this.sql.query<SageDeliveryGrantRow>(
      `update sage_delivery_grant g
         set status = 'expired', updated_at = $1
       where g.id in (
         select id from sage_delivery_grant
          where ((status = 'issued' and invitation_expires_at <= $1)
              or (status = 'active' and access_expires_at <= $1))
            and ($3::text is null or workspace_id = $3)
            and ($4::text is null or org_id = $4)
          order by issued_at asc, id asc
          for update skip locked
          limit $2
       )
       returning *`,
      [input.now, input.limit, input.workspaceId ?? null, input.orgId ?? null],
    )
    const grants = rows.map(mapDeliveryGrant)
    for (const grant of grants) {
      const eventId = `${grant.id}:grant_expired`
      await this.sql.query(
        `insert into sage_audit_outbox
           (event_id, org_id, workspace_id, actor_id, action, resource_type,
            resource_id, safe_payload_json, status, attempt_count, created_at)
         values ($1, $2, $3, 'system', $4, 'sage_delivery_grant', $5, $6::jsonb, 'pending', 0, $7)
         on conflict (event_id) do nothing`,
        [
          eventId,
          grant.orgId,
          grant.workspaceId,
          input.auditAction,
          grant.id,
          JSON.stringify({ grantId: grant.id, deliveryRequestId: grant.deliveryRequestId }),
          input.now,
        ],
      )
      await this.sql.query(
        `insert into sage_delivery_receipt
           (event_id, org_id, workspace_id, delivery_request_id, grant_id,
            package_id, recipient_id, event_type, safe_reason_code, occurred_at, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, 'grant_expired', 'expired', $8, $8)
         on conflict (event_id) do nothing`,
        [
          eventId,
          grant.orgId,
          grant.workspaceId,
          grant.deliveryRequestId,
          grant.id,
          grant.exportPackageId,
          grant.recipientId,
          input.now,
        ],
      )
    }
    return grants
  }

  async createDeliveryReceipt(input: {
    orgId: string
    workspaceId: string
    receipt: SageDeliveryReceiptIntent
  }): Promise<SageDeliveryReceipt | undefined> {
    const rc = input.receipt
    const { rows } = await this.sql.query<SageDeliveryReceiptRow>(
      `insert into sage_delivery_receipt
         (event_id, org_id, workspace_id, delivery_request_id, grant_id,
          package_id, recipient_id, event_type, safe_reason_code, occurred_at, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       on conflict (event_id) do nothing
       returning *`,
      [
        rc.eventId,
        input.orgId,
        input.workspaceId,
        rc.deliveryRequestId ?? null,
        rc.grantId ?? null,
        rc.packageId ?? null,
        rc.recipientId ?? null,
        rc.eventType,
        rc.safeReasonCode ?? null,
        rc.occurredAt,
      ],
    )
    const row = firstOrUndefined(rows)
    return row ? mapDeliveryReceipt(row) : undefined
  }

  async listDeliveryReceipts(
    grantId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageDeliveryReceipt[]> {
    const { rows } = await this.sql.query<SageDeliveryReceiptRow>(
      `select * from sage_delivery_receipt
       where grant_id = $1 and workspace_id = $2 and org_id = $3
       order by occurred_at asc, id asc`,
      [grantId, workspaceId, orgId],
    )
    return rows.map(mapDeliveryReceipt)
  }

  // ── Notification Outbox (Phase 8A.1) ──────────────────────────────────────
  // Durable queue for invitation delivery. Enables crash recovery: if the
  // process crashes after grant creation, the encrypted invitation payload can
  // be recovered and resent to the recipient.

  async enqueueNotificationOutbox(input: {
    intent: SageNotificationOutboxIntent
    orgId: string
    workspaceId: string
    recipientId: string
  }): Promise<SageNotificationOutbox | undefined> {
    const intent = input.intent
    const { rows } = await this.sql.query<SageNotificationOutboxRow>(
      `insert into sage_notification_outbox
         (message_id, org_id, workspace_id, delivery_request_id, grant_id,
          recipient_id, provider, template, recipient_address_hash,
          encrypted_payload, encryption_key_reference, status,
          attempt_count, max_retries, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', 0, 5, $12)
       on conflict (message_id) do nothing
       returning *`,
      [
        intent.messageId,
        input.orgId,
        input.workspaceId,
        intent.deliveryRequestId,
        intent.grantId,
        input.recipientId,
        intent.provider,
        intent.template,
        intent.recipientAddressHash,
        intent.encryptedPayload,
        'sage-notification:v1',
        intent.createdAt,
      ],
    )
    const row = firstOrUndefined(rows)
    if (row) return mapNotificationOutbox(row)

    // Already enqueued (idempotent)
    const existing = await this.getNotificationOutboxByMessageId(intent.messageId)
    return existing
  }

  async getNotificationOutboxByMessageId(messageId: string): Promise<SageNotificationOutbox | undefined> {
    const { rows } = await this.sql.query<SageNotificationOutboxRow>(
      `select * from sage_notification_outbox where message_id = $1`,
      [messageId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapNotificationOutbox(row) : undefined
  }

  async getNotificationOutboxById(id: string): Promise<SageNotificationOutbox | undefined> {
    const { rows } = await this.sql.query<SageNotificationOutboxRow>(
      `select * from sage_notification_outbox where id = $1`,
      [id],
    )
    const row = firstOrUndefined(rows)
    return row ? mapNotificationOutbox(row) : undefined
  }

  /**
   * Claim a pending notification message for dispatch.
   * Uses lease/fence pattern identical to Phase 7 audit-outbox.
   * Only one owner can hold a message at a time (checked at UPDATE time).
   */
  async claimPendingNotificationForDispatch(input: {
    maxAttempts?: number
    dispatchOwner: string
    leaseMs?: number
  }): Promise<SageNotificationOutbox | undefined> {
    const maxAttempts = input.maxAttempts ?? 1
    const leaseMs = input.leaseMs ?? 5 * 60 * 1000 // 5 minutes
    const now = new Date().toISOString()
    const leaseExpires = new Date(Date.parse(now) + leaseMs).toISOString()

    const { rows } = await this.sql.query<SageNotificationOutboxRow>(
      `update sage_notification_outbox
       set status = 'dispatching', dispatch_owner = $2, lease_expires_at = $3, attempt_count = attempt_count + 1
       where id = (
         select id from sage_notification_outbox
        where (status = 'pending' and (next_attempt_at is null or next_attempt_at <= now()))
          or (status = 'dispatching' and lease_expires_at < now())
           and attempt_count < $4
         order by created_at asc
         limit 1
         for update skip locked
       )
       returning *`,
      [null, input.dispatchOwner, leaseExpires, maxAttempts],
    )
    const row = firstOrUndefined(rows)
    return row ? mapNotificationOutbox(row) : undefined
  }

  /**
   * Mark a notification as dispatched (successfully sent by provider).
   * Validates that the claiming owner still holds the lease.
   */
  async markNotificationDispatched(input: {
    id: string
    dispatchOwner: string
    providerMessageId?: string
    providerRequestId?: string
  }): Promise<{ success: boolean }> {
    const now = new Date().toISOString()
    const { rows } = await this.sql.query<{ id: string }>(
      `update sage_notification_outbox
         set status = 'dispatched', dispatched_at = $2, provider_message_id = coalesce($3, provider_message_id),
           encrypted_payload = '', payload_destroyed_at = $2
      where id = $1 and dispatch_owner = $4 and status = 'dispatching'
       returning id`,
      [input.id, now, input.providerMessageId ?? null, input.dispatchOwner],
    )
    return { success: rows.length > 0 }
  }

  /**
   * Mark a notification as failed (provider rejected or unreachable).
   * Validates that the claiming owner still holds the lease.
   */
  async markNotificationDeadLetter(input: {
    id: string
    dispatchOwner: string
    errorCode?: string
    errorMessage?: string
  }): Promise<{ success: boolean }> {
    const { rows } = await this.sql.query<{ id: string }>(
      `update sage_notification_outbox
        set status = 'dead_letter', dead_lettered_at = now(), last_error_code = $3, last_error_message = $4,
          encrypted_payload = '', payload_destroyed_at = now()
      where id = $1 and dispatch_owner = $2 and status = 'dispatching'
       returning id`,
      [input.id, input.dispatchOwner, input.errorCode ?? null, input.errorMessage ?? null],
    )
    return { success: rows.length > 0 }
  }

  /**
   * Release a notification message back to pending (dispatcher crashed or lease expired).
   * Called when a dispatcher crashes and a stale lease is detected.
   */
  async releaseNotificationOutboxToPending(input: {
    id: string
    dispatchOwner: string
    nextAttemptAt: string
    errorCode?: string
  }): Promise<{ success: boolean }> {
    const { rows } = await this.sql.query<{ id: string }>(
      `update sage_notification_outbox
         set status = 'pending', dispatch_owner = null, lease_expires_at = null,
           next_attempt_at = $3, last_error_code = $4
         where id = $1 and status = 'dispatching' and dispatch_owner = $2
       returning id`,
        [input.id, input.dispatchOwner, input.nextAttemptAt, input.errorCode ?? null],
    )
    return { success: rows.length > 0 }
  }

  async listPendingNotificationOutbox(
    workspaceId: string,
    orgId: string,
  ): Promise<SageNotificationOutbox[]> {
    const { rows } = await this.sql.query<SageNotificationOutboxRow>(
      `select * from sage_notification_outbox
       where workspace_id = $1 and org_id = $2 and status = 'pending'
       order by created_at asc`,
      [workspaceId, orgId],
    )
    return rows.map(mapNotificationOutbox)
  }

  async listNotificationOutboxByGrant(
    grantId: string,
    orgId: string,
  ): Promise<SageNotificationOutbox[]> {
    const { rows } = await this.sql.query<SageNotificationOutboxRow>(
      `select * from sage_notification_outbox
       where grant_id = $1 and org_id = $2
       order by created_at asc`,
      [grantId, orgId],
    )
    return rows.map(mapNotificationOutbox)
  }

  // ── Phase 8B: records lifecycle ────────────────────────────────────────────
  private auditInsertParams(intent: SageAuditOutboxIntent) {
    return {
      eventId: intent.eventId,
      actorId: intent.actorId,
      action: intent.action,
      resourceType: intent.resourceType,
      safePayload: JSON.stringify(intent.safePayload),
    }
  }

  async createRetentionPolicy(
    input: Omit<SageRetentionPolicy, 'id'>,
  ): Promise<SageRetentionPolicy> {
    const { rows } = await this.sql.query<SageRetentionPolicyRow>(
      `insert into sage_retention_policy
         (org_id, policy_code, version, name, description, retention_basis,
          retention_duration_days, effective_from, effective_to, is_active, created_by, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       returning *`,
      [
        input.orgId,
        input.policyCode,
        input.version,
        input.name,
        input.description ?? null,
        input.retentionBasis,
        input.retentionDurationDays,
        input.effectiveFrom,
        input.effectiveTo ?? null,
        input.isActive,
        input.createdBy,
        input.createdAt,
      ],
    )
    const row = firstOrUndefined(rows)
    if (!row) conflict('a retention policy with this code and version already exists')
    return mapRetentionPolicy(row)
  }

  async getRetentionPolicy(id: string, orgId: string): Promise<SageRetentionPolicy | undefined> {
    const { rows } = await this.sql.query<SageRetentionPolicyRow>(
      `select * from sage_retention_policy where id = $1 and org_id = $2`,
      [id, orgId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapRetentionPolicy(row) : undefined
  }

  async getActiveRetentionPolicyByCode(
    orgId: string,
    policyCode: string,
  ): Promise<SageRetentionPolicy | undefined> {
    const { rows } = await this.sql.query<SageRetentionPolicyRow>(
      `select * from sage_retention_policy
       where org_id = $1 and policy_code = $2 and is_active = true
       order by version desc
       limit 1`,
      [orgId, policyCode],
    )
    const row = firstOrUndefined(rows)
    return row ? mapRetentionPolicy(row) : undefined
  }

  async listRetentionPolicies(orgId: string): Promise<SageRetentionPolicy[]> {
    const { rows } = await this.sql.query<SageRetentionPolicyRow>(
      `select * from sage_retention_policy where org_id = $1
       order by policy_code asc, version desc`,
      [orgId],
    )
    return rows.map(mapRetentionPolicy)
  }

  async assignRetentionPolicy(input: {
    assignment: Omit<SageExportRetentionAssignment, 'id'>
    auditEvent: SageAuditOutboxIntent
  }): Promise<{ assignment: SageExportRetentionAssignment; created: boolean }> {
    const a = input.assignment
    const ev = this.auditInsertParams(input.auditEvent)
    const { rows } = await this.sql.query<SageExportRetentionAssignmentRow>(
      `with inserted as (
         insert into sage_export_retention_assignment
           (org_id, workspace_id, export_package_id, retention_policy_id, policy_code,
            policy_version, retention_basis, retention_started_at, retain_until, assigned_by, assigned_at,
            retention_basis_source_type, retention_basis_source_id, retention_basis_source_timestamp)
         values ($1::text, $2::uuid, $3::uuid, $4::uuid, $5::text, $6::integer, $7::text, $8::timestamptz,
                 $9::timestamptz, $10::text, $11::timestamptz, $17::text, $18::text, $19::timestamptz)
         on conflict (export_package_id) do nothing
         returning *
       ),
       outbox as (
         insert into sage_audit_outbox
           (event_id, org_id, workspace_id, actor_id, action, resource_type,
            resource_id, safe_payload_json, status, attempt_count, created_at)
         select $12, $1, $2, $13, $14, $15, $3, $16::jsonb, 'pending', 0, $11
         from inserted
         on conflict (event_id) do nothing
         returning event_id
       )
       select * from inserted`,
      [
        a.orgId,
        a.workspaceId,
        a.exportPackageId,
        a.retentionPolicyId,
        a.policyCode,
        a.policyVersion,
        a.retentionBasis,
        a.retentionStartedAt,
        a.retainUntil,
        a.assignedBy,
        a.assignedAt,
        ev.eventId,
        ev.actorId,
        ev.action,
        ev.resourceType,
        ev.safePayload,
        a.retentionBasisSourceType,
        a.retentionBasisSourceId,
        a.retentionBasisSourceTimestamp,
      ],
    )
    const row = firstOrUndefined(rows)
    if (row) return { assignment: mapRetentionAssignment(row), created: true }
    const existing = await this.getRetentionAssignment(a.exportPackageId, a.workspaceId, a.orgId)
    if (!existing) conflict('retention assignment could not be created')
    return { assignment: existing, created: false }
  }

  async getRetentionAssignment(
    exportPackageId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportRetentionAssignment | undefined> {
    const { rows } = await this.sql.query<SageExportRetentionAssignmentRow>(
      `select * from sage_export_retention_assignment
       where export_package_id = $1 and workspace_id = $2 and org_id = $3`,
      [exportPackageId, workspaceId, orgId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapRetentionAssignment(row) : undefined
  }

  async placeLegalHold(input: {
    hold: Omit<SageExportLegalHold, 'id'>
    auditEvent: SageAuditOutboxIntent
  }): Promise<SageExportLegalHold> {
    const h = input.hold
    const ev = this.auditInsertParams(input.auditEvent)
    const { rows } = await this.sql.query<SageExportLegalHoldRow>(
      `with inserted as (
         insert into sage_export_legal_hold
           (org_id, workspace_id, export_package_id, hold_code, status, reason, placed_by, placed_at)
         select $1, $2, $3, $4, 'active', $5, $6, $7
         where not exists (
           select 1 from sage_export_destruction_request
           where export_package_id = $3
             and status in ('deletion_started', 'destroyed')
         )
         returning *
       ),
       outbox as (
         insert into sage_audit_outbox
           (event_id, org_id, workspace_id, actor_id, action, resource_type,
            resource_id, safe_payload_json, status, attempt_count, created_at)
         select $8, $1, $2, $9, $10, $11, $3, $12::jsonb, 'pending', 0, $7
         from inserted
         on conflict (event_id) do nothing
         returning event_id
       )
       select * from inserted`,
      [
        h.orgId,
        h.workspaceId,
        h.exportPackageId,
        h.holdCode,
        h.reason,
        h.placedBy,
        h.placedAt,
        ev.eventId,
        ev.actorId,
        ev.action,
        ev.resourceType,
        ev.safePayload,
      ],
    )
    const row = firstOrUndefined(rows)
    if (!row) conflict('legal hold could not be placed: destruction has begun for this package')
    return mapLegalHold(row)
  }

  async releaseLegalHold(input: {
    holdId: string
    workspaceId: string
    orgId: string
    releasedBy: string
    releasedAt: string
    releaseReason: string
    auditEvent: SageAuditOutboxIntent
  }): Promise<SageExportLegalHold | undefined> {
    const ev = this.auditInsertParams(input.auditEvent)
    const { rows } = await this.sql.query<SageExportLegalHoldRow>(
      `with released as (
         update sage_export_legal_hold
           set status = 'released', released_by = $4, released_at = $5, release_reason = $6
         where id = $1 and workspace_id = $2 and org_id = $3 and status = 'active'
         returning *
       ),
       outbox as (
         insert into sage_audit_outbox
           (event_id, org_id, workspace_id, actor_id, action, resource_type,
            resource_id, safe_payload_json, status, attempt_count, created_at)
         select $7, $3, $2, $8, $9, $10, released.export_package_id, $11::jsonb, 'pending', 0, $5
         from released
         on conflict (event_id) do nothing
         returning event_id
       )
       select * from released`,
      [
        input.holdId,
        input.workspaceId,
        input.orgId,
        input.releasedBy,
        input.releasedAt,
        input.releaseReason,
        ev.eventId,
        ev.actorId,
        ev.action,
        ev.resourceType,
        ev.safePayload,
      ],
    )
    const row = firstOrUndefined(rows)
    return row ? mapLegalHold(row) : undefined
  }

  async getLegalHold(
    holdId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportLegalHold | undefined> {
    const { rows } = await this.sql.query<SageExportLegalHoldRow>(
      `select * from sage_export_legal_hold where id = $1 and workspace_id = $2 and org_id = $3`,
      [holdId, workspaceId, orgId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapLegalHold(row) : undefined
  }

  async listLegalHolds(
    exportPackageId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportLegalHold[]> {
    const { rows } = await this.sql.query<SageExportLegalHoldRow>(
      `select * from sage_export_legal_hold
       where export_package_id = $1 and workspace_id = $2 and org_id = $3
       order by placed_at asc`,
      [exportPackageId, workspaceId, orgId],
    )
    return rows.map(mapLegalHold)
  }

  async countActiveLegalHolds(
    exportPackageId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<number> {
    const { rows } = await this.sql.query<CountRow>(
      `select count(*)::int as count from sage_export_legal_hold
       where export_package_id = $1 and workspace_id = $2 and org_id = $3 and status = 'active'`,
      [exportPackageId, workspaceId, orgId],
    )
    return toCount(rows)
  }

  async createDestructionRequest(input: {
    request: Omit<SageExportDestructionRequest, 'id'>
    auditEvent: SageAuditOutboxIntent
  }): Promise<SageExportDestructionRequest | undefined> {
    const r = input.request
    const ev = this.auditInsertParams(input.auditEvent)
    const { rows } = await this.sql.query<SageExportDestructionRequestRow>(
      `with inserted as (
         insert into sage_export_destruction_request
           (org_id, workspace_id, export_package_id, requested_by, reason, status,
            package_content_hash, package_manifest_hash, storage_reference_hash,
            retention_policy_code, retention_policy_version, retain_until, active_hold_count,
            active_hold_set_digest, requested_at, updated_at)
         select $1::text, $2::uuid, $3::uuid, $4::text, $5::text, 'requested', $6::text, $7::text, $8::text,
                $9::text, $10::integer, $11::timestamptz, $12::integer, $19::text, $13::timestamptz, $13::timestamptz
         where not exists (
           select 1 from sage_export_destruction_request
           where export_package_id = $3
             and status in ('requested', 'approved', 'executing', 'executing_preflight', 'deletion_started')
         )
         returning *
       ),
       outbox as (
         insert into sage_audit_outbox
           (event_id, org_id, workspace_id, actor_id, action, resource_type,
            resource_id, safe_payload_json, status, attempt_count, created_at)
         select $14, $1, $2, $15, $16, $17, inserted.id, $18::jsonb, 'pending', 0, $13
         from inserted
         on conflict (event_id) do nothing
         returning event_id
       )
       select * from inserted`,
      [
        r.orgId,
        r.workspaceId,
        r.exportPackageId,
        r.requestedBy,
        r.reason,
        r.packageContentHash,
        r.packageManifestHash,
        r.storageReferenceHash,
        r.retentionPolicyCode,
        r.retentionPolicyVersion,
        r.retainUntil,
        r.activeHoldCount,
        r.requestedAt,
        ev.eventId,
        ev.actorId,
        ev.action,
        ev.resourceType,
        ev.safePayload,
        r.activeHoldSetDigest ?? null,
      ],
    )
    const row = firstOrUndefined(rows)
    return row ? mapDestructionRequest(row) : undefined
  }

  async getDestructionRequest(
    requestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportDestructionRequest | undefined> {
    const { rows } = await this.sql.query<SageExportDestructionRequestRow>(
      `select * from sage_export_destruction_request
       where id = $1 and workspace_id = $2 and org_id = $3`,
      [requestId, workspaceId, orgId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapDestructionRequest(row) : undefined
  }

  async listDestructionRequests(
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportDestructionRequest[]> {
    const { rows } = await this.sql.query<SageExportDestructionRequestRow>(
      `select * from sage_export_destruction_request
       where workspace_id = $1 and org_id = $2
       order by requested_at desc`,
      [workspaceId, orgId],
    )
    return rows.map(mapDestructionRequest)
  }

  async decideDestructionRequest(input: {
    destructionRequestId: string
    workspaceId: string
    orgId: string
    decision: SageDestructionDecision
    updatedAt: string
    approval: Omit<SageExportDestructionApproval, 'id'>
    auditEvent: SageAuditOutboxIntent
  }): Promise<
    { request: SageExportDestructionRequest; approval: SageExportDestructionApproval } | undefined
  > {
    const ap = input.approval
    const ev = this.auditInsertParams(input.auditEvent)
    const nextStatus = input.decision === 'approved' ? 'approved' : 'denied'
    const { rows } = await this.sql.query<SageExportDestructionApprovalRow>(
      `with decided as (
         update sage_export_destruction_request
           set status = $4, updated_at = $5
         where id = $1 and workspace_id = $2 and org_id = $3 and status = 'requested'
         returning id
       ),
       approval as (
         insert into sage_export_destruction_approval
           (org_id, workspace_id, destruction_request_id, decision, approver_id, rationale,
            approved_package_content_hash, approved_manifest_hash, approved_storage_reference_hash,
            approved_retention_policy_code, approved_retention_policy_version,
            approved_retain_until, approved_active_hold_count, approved_active_hold_set_digest, decided_at)
         select $3::text, $2::uuid, decided.id, $6::text, $7::text, $8::text, $9::text, $10::text, $11::text,
                $12::text, $13::integer, $14::timestamptz, $15::integer, $22::text, $16::timestamptz
         from decided
         on conflict (destruction_request_id) do nothing
         returning *
       ),
       outbox as (
         insert into sage_audit_outbox
           (event_id, org_id, workspace_id, actor_id, action, resource_type,
            resource_id, safe_payload_json, status, attempt_count, created_at)
         select $17, $3, $2, $18, $19, $20, $1, $21::jsonb, 'pending', 0, $5
         from approval
         on conflict (event_id) do nothing
         returning event_id
       )
       select * from approval`,
      [
        input.destructionRequestId,
        input.workspaceId,
        input.orgId,
        nextStatus,
        input.updatedAt,
        ap.decision,
        ap.approverId,
        ap.rationale ?? null,
        ap.approvedPackageContentHash,
        ap.approvedManifestHash,
        ap.approvedStorageReferenceHash,
        ap.approvedRetentionPolicyCode,
        ap.approvedRetentionPolicyVersion,
        ap.approvedRetainUntil,
        ap.approvedActiveHoldCount,
        ap.decidedAt,
        ev.eventId,
        ev.actorId,
        ev.action,
        ev.resourceType,
        ev.safePayload,
        ap.approvedActiveHoldSetDigest ?? null,
      ],
    )
    const approvalRow = firstOrUndefined(rows)
    if (!approvalRow) return undefined
    const request = await this.getDestructionRequest(
      input.destructionRequestId,
      input.workspaceId,
      input.orgId,
    )
    if (!request) return undefined
    return { request, approval: mapDestructionApproval(approvalRow) }
  }

  async getDestructionApproval(
    destructionRequestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportDestructionApproval | undefined> {
    const { rows } = await this.sql.query<SageExportDestructionApprovalRow>(
      `select * from sage_export_destruction_approval
       where destruction_request_id = $1 and workspace_id = $2 and org_id = $3`,
      [destructionRequestId, workspaceId, orgId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapDestructionApproval(row) : undefined
  }

  async claimDestructionForExecution(input: {
    destructionRequestId: string
    workspaceId: string
    orgId: string
    executionOwner: string
    leaseMs: number
    now: string
  }): Promise<SageExportDestructionRequest | undefined> {
    const leaseExpiresAt = new Date(Date.parse(input.now) + input.leaseMs).toISOString()
    const { rows } = await this.sql.query<SageExportDestructionRequestRow>(
      `update sage_export_destruction_request
         set status = 'executing_preflight', execution_owner = $4, lease_expires_at = $5, updated_at = $6
       where id = $1 and workspace_id = $2 and org_id = $3
         and (status = 'approved'
              or (status = 'executing_preflight' and (lease_expires_at is null or lease_expires_at < $6)))
       returning *`,
      [
        input.destructionRequestId,
        input.workspaceId,
        input.orgId,
        input.executionOwner,
        leaseExpiresAt,
        input.now,
      ],
    )
    const row = firstOrUndefined(rows)
    return row ? mapDestructionRequest(row) : undefined
  }

  async getOpenDestructionRequestForPackage(
    exportPackageId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportDestructionRequest | undefined> {
    const { rows } = await this.sql.query<SageExportDestructionRequestRow>(
      `select * from sage_export_destruction_request
       where export_package_id = $1 and workspace_id = $2 and org_id = $3
         and status in ('requested', 'approved', 'executing', 'executing_preflight', 'deletion_started')
       order by requested_at desc
       limit 1`,
      [exportPackageId, workspaceId, orgId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapDestructionRequest(row) : undefined
  }

  async createDestructionAttempt(input: {
    attempt: Omit<SageExportDestructionAttempt, 'id'>
    executionOwner: string
    updatedAt: string
  }): Promise<SageExportDestructionAttempt | undefined> {
    const a = input.attempt
    const { rows } = await this.sql.query<SageExportDestructionAttemptRow>(
      `with req as (
         update sage_export_destruction_request
           set current_attempt_id = $1, updated_at = $10
         where id = $4 and workspace_id = $3 and org_id = $2
           and status = 'executing_preflight' and execution_owner = $7
         returning id
       ),
       inserted as (
         insert into sage_export_destruction_attempt
           (attempt_id, org_id, workspace_id, destruction_request_id, export_package_id, object_id,
            execution_owner, provider_idempotency_key, status, created_at, updated_at)
         select $1, $2, $3, $4, $5, $6, $7, $8, 'prepared', $9, $10
         from req
         on conflict (attempt_id) do nothing
         returning *
       )
       select * from inserted`,
      [
        a.attemptId,
        a.orgId,
        a.workspaceId,
        a.destructionRequestId,
        a.exportPackageId,
        a.objectId ?? null,
        input.executionOwner,
        a.providerIdempotencyKey,
        a.createdAt,
        input.updatedAt,
      ],
    )
    const row = firstOrUndefined(rows)
    return row ? mapDestructionAttempt(row) : undefined
  }

  async getDestructionAttemptById(
    attemptId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportDestructionAttempt | undefined> {
    const { rows } = await this.sql.query<SageExportDestructionAttemptRow>(
      `select * from sage_export_destruction_attempt
       where attempt_id = $1 and workspace_id = $2 and org_id = $3`,
      [attemptId, workspaceId, orgId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapDestructionAttempt(row) : undefined
  }

  async getLatestDestructionAttemptByRequest(
    destructionRequestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportDestructionAttempt | undefined> {
    const { rows } = await this.sql.query<SageExportDestructionAttemptRow>(
      `select * from sage_export_destruction_attempt
       where destruction_request_id = $1 and workspace_id = $2 and org_id = $3
       order by created_at desc
       limit 1`,
      [destructionRequestId, workspaceId, orgId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapDestructionAttempt(row) : undefined
  }

  async markAttemptPresenceVerified(input: {
    attemptId: string
    executionOwner: string
    present: boolean
    at: string
  }): Promise<{ success: boolean }> {
    const { rows } = await this.sql.query<{ attempt_id: string }>(
      `update sage_export_destruction_attempt
         set pre_delete_presence_verified = $3, pre_delete_verified_at = $4, updated_at = $4
       where attempt_id = $1 and execution_owner = $2 and status = 'prepared'
       returning attempt_id`,
      [input.attemptId, input.executionOwner, input.present, input.at],
    )
    return { success: rows.length > 0 }
  }

  async beginDeletion(input: {
    destructionRequestId: string
    attemptId: string
    workspaceId: string
    orgId: string
    exportPackageId: string
    executionOwner: string
    at: string
  }): Promise<
    { request: SageExportDestructionRequest; attempt: SageExportDestructionAttempt } | undefined
  > {
    // ATOMIC point of no return: the request → deletion_started transition and
    // the final "no active legal hold" check happen in a single statement.
    const { rows } = await this.sql.query<SageExportDestructionAttemptRow>(
      `with req as (
         update sage_export_destruction_request
           set status = 'deletion_started', deletion_started_at = $7, updated_at = $7
         where id = $1 and workspace_id = $3 and org_id = $4
           and status = 'executing_preflight' and execution_owner = $6
           and not exists (
             select 1 from sage_export_legal_hold
             where export_package_id = $5 and org_id = $4 and status = 'active'
           )
         returning id
       ),
       att as (
         update sage_export_destruction_attempt
           set status = 'deletion_started', delete_started_at = $7, updated_at = $7
         from req
         where sage_export_destruction_attempt.attempt_id = $2
           and sage_export_destruction_attempt.execution_owner = $6
           and sage_export_destruction_attempt.status = 'prepared'
         returning sage_export_destruction_attempt.*
       )
       select * from att`,
      [
        input.destructionRequestId,
        input.attemptId,
        input.workspaceId,
        input.orgId,
        input.exportPackageId,
        input.executionOwner,
        input.at,
      ],
    )
    const attemptRow = firstOrUndefined(rows)
    if (!attemptRow) return undefined
    const request = await this.getDestructionRequest(input.destructionRequestId, input.workspaceId, input.orgId)
    if (!request) return undefined
    return { request, attempt: mapDestructionAttempt(attemptRow) }
  }

  async recordAttemptProviderResult(input: {
    attemptId: string
    executionOwner: string
    providerResult: string
    providerRequestId?: string | null
    safeErrorCode?: string | null
    status: 'provider_accepted' | 'failed'
    at: string
  }): Promise<{ success: boolean }> {
    const { rows } = await this.sql.query<{ attempt_id: string }>(
      `update sage_export_destruction_attempt
         set provider_result = $3, provider_request_id = $4, safe_error_code = $5, status = $6, updated_at = $7
       where attempt_id = $1 and execution_owner = $2
       returning attempt_id`,
      [
        input.attemptId,
        input.executionOwner,
        input.providerResult,
        input.providerRequestId ?? null,
        input.safeErrorCode ?? null,
        input.status,
        input.at,
      ],
    )
    return { success: rows.length > 0 }
  }

  async recordAttemptAbsenceVerified(input: {
    attemptId: string
    executionOwner: string
    absent: boolean
    at: string
  }): Promise<{ success: boolean }> {
    const { rows } = await this.sql.query<{ attempt_id: string }>(
      `update sage_export_destruction_attempt
         set post_delete_absence_verified = $3, post_delete_verified_at = $4,
             status = case when $3 then 'absence_verified' else status end, updated_at = $4
       where attempt_id = $1 and execution_owner = $2
       returning attempt_id`,
      [input.attemptId, input.executionOwner, input.absent, input.at],
    )
    return { success: rows.length > 0 }
  }

  async completeDestruction(input: {
    destructionRequestId: string
    workspaceId: string
    orgId: string
    executionOwner: string
    attemptId: string
    exportPackageId: string
    destroyedBy: string
    updatedAt: string
    evidence: Omit<SageExportDestructionEvidence, 'id'>
    auditEvent: SageAuditOutboxIntent
  }): Promise<
    | {
        request: SageExportDestructionRequest
        evidence: SageExportDestructionEvidence
        package: SageExportPackage
      }
    | undefined
  > {
    const e = input.evidence
    const ev = this.auditInsertParams(input.auditEvent)
    const { rows } = await this.sql.query<SageExportDestructionEvidenceRow>(
      `with evidence as (
         insert into sage_export_destruction_evidence
           (event_id, org_id, workspace_id, destruction_request_id, export_package_id, object_id,
            storage_provider, storage_reference_hash, pre_destruction_content_hash,
            pre_destruction_manifest_hash, deletion_attempted_at, deletion_verified_at,
            verification_method, result, provider_request_id, safe_error_code, executed_by, created_at)
         select $7::text, $3::text, $2::uuid, $1::uuid, $8::uuid, $9::text, $10::text, $11::text, $12::text,
                $13::text, $14::timestamptz, $15::timestamptz, $16::text, $17::text, $18::text, $19::text, $20::text, $21::timestamptz
         where exists (
           select 1 from sage_export_destruction_request
           where id = $1 and workspace_id = $2 and org_id = $3
             and status = 'deletion_started' and execution_owner = $4
         )
         and exists (
           select 1 from sage_export_package
           where id = $8 and workspace_id = $2 and org_id = $3 and availability_status = 'available'
         )
         returning *
       ),
       req as (
         update sage_export_destruction_request
           set status = 'destroyed', destruction_evidence_id = evidence.id,
               execution_owner = null, lease_expires_at = null, updated_at = $5
         from evidence
         where sage_export_destruction_request.id = $1
         returning sage_export_destruction_request.id
       ),
       att as (
         update sage_export_destruction_attempt
           set status = 'completed', updated_at = $5
         from evidence
         where sage_export_destruction_attempt.attempt_id = $27
         returning sage_export_destruction_attempt.attempt_id
       ),
       pkg as (
         update sage_export_package
           set availability_status = 'destroyed', destroyed_at = $5, destroyed_by = $6,
               destruction_request_id = $1, destruction_evidence_id = evidence.id
         from evidence
         where sage_export_package.id = $8
         returning sage_export_package.id
       ),
       outbox as (
         insert into sage_audit_outbox
           (event_id, org_id, workspace_id, actor_id, action, resource_type,
            resource_id, safe_payload_json, status, attempt_count, created_at)
         select $22, $3, $2, $23, $24, $25, $1, $26::jsonb, 'pending', 0, $5
         from evidence
         on conflict (event_id) do nothing
         returning event_id
       )
       select * from evidence`,
      [
        input.destructionRequestId,
        input.workspaceId,
        input.orgId,
        input.executionOwner,
        input.updatedAt,
        input.destroyedBy,
        e.eventId,
        e.exportPackageId,
        e.objectId ?? null,
        e.storageProvider,
        e.storageReferenceHash,
        e.preDestructionContentHash,
        e.preDestructionManifestHash,
        e.deletionAttemptedAt ?? null,
        e.deletionVerifiedAt ?? null,
        e.verificationMethod ?? null,
        e.result,
        e.providerRequestId ?? null,
        e.safeErrorCode ?? null,
        e.executedBy,
        e.createdAt,
        ev.eventId,
        ev.actorId,
        ev.action,
        ev.resourceType,
        ev.safePayload,
        input.attemptId,
      ],
    )
    const evidenceRow = firstOrUndefined(rows)
    if (!evidenceRow) return undefined
    const request = await this.getDestructionRequest(
      input.destructionRequestId,
      input.workspaceId,
      input.orgId,
    )
    const pkg = await this.getExportPackage(input.exportPackageId, input.workspaceId, input.orgId)
    if (!request || !pkg) return undefined
    return { request, evidence: mapDestructionEvidence(evidenceRow), package: pkg }
  }

  async failDestruction(input: {
    destructionRequestId: string
    workspaceId: string
    orgId: string
    executionOwner: string
    attemptId?: string
    attemptStatus?: 'failed' | 'indeterminate'
    updatedAt: string
    evidence: Omit<SageExportDestructionEvidence, 'id'>
    auditEvent: SageAuditOutboxIntent
  }): Promise<
    { request: SageExportDestructionRequest; evidence: SageExportDestructionEvidence } | undefined
  > {
    const e = input.evidence
    const ev = this.auditInsertParams(input.auditEvent)
    const { rows } = await this.sql.query<SageExportDestructionEvidenceRow>(
      `with evidence as (
         insert into sage_export_destruction_evidence
           (event_id, org_id, workspace_id, destruction_request_id, export_package_id, object_id,
            storage_provider, storage_reference_hash, pre_destruction_content_hash,
            pre_destruction_manifest_hash, deletion_attempted_at, deletion_verified_at,
            verification_method, result, provider_request_id, safe_error_code, executed_by, created_at)
         select $6, $3, $2, $1, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
         where exists (
           select 1 from sage_export_destruction_request
           where id = $1 and workspace_id = $2 and org_id = $3
             and status in ('executing_preflight', 'deletion_started') and execution_owner = $4
         )
         returning *
       ),
       att as (
         update sage_export_destruction_attempt
           set status = $27, updated_at = $5
         from evidence
         where sage_export_destruction_attempt.attempt_id = $26
         returning sage_export_destruction_attempt.attempt_id
       ),
       req as (
         update sage_export_destruction_request
           set status = 'failed', destruction_evidence_id = evidence.id,
               execution_owner = null, lease_expires_at = null, updated_at = $5
         from evidence
         where sage_export_destruction_request.id = $1
         returning sage_export_destruction_request.id
       ),
       outbox as (
         insert into sage_audit_outbox
           (event_id, org_id, workspace_id, actor_id, action, resource_type,
            resource_id, safe_payload_json, status, attempt_count, created_at)
         select $21, $3, $2, $22, $23, $24, $1, $25::jsonb, 'pending', 0, $5
         from evidence
         on conflict (event_id) do nothing
         returning event_id
       )
       select * from evidence`,
      [
        input.destructionRequestId,
        input.workspaceId,
        input.orgId,
        input.executionOwner,
        input.updatedAt,
        e.eventId,
        e.exportPackageId,
        e.objectId ?? null,
        e.storageProvider,
        e.storageReferenceHash,
        e.preDestructionContentHash,
        e.preDestructionManifestHash,
        e.deletionAttemptedAt ?? null,
        e.deletionVerifiedAt ?? null,
        e.verificationMethod ?? null,
        e.result,
        e.providerRequestId ?? null,
        e.safeErrorCode ?? null,
        e.executedBy,
        e.createdAt,
        ev.eventId,
        ev.actorId,
        ev.action,
        ev.resourceType,
        ev.safePayload,
        input.attemptId ?? '',
        input.attemptStatus ?? 'failed',
      ],
    )
    const evidenceRow = firstOrUndefined(rows)
    if (!evidenceRow) return undefined
    const request = await this.getDestructionRequest(
      input.destructionRequestId,
      input.workspaceId,
      input.orgId,
    )
    if (!request) return undefined
    return { request, evidence: mapDestructionEvidence(evidenceRow) }
  }

  async getDestructionEvidenceByRequest(
    destructionRequestId: string,
    workspaceId: string,
    orgId: string,
  ): Promise<SageExportDestructionEvidence | undefined> {
    const { rows } = await this.sql.query<SageExportDestructionEvidenceRow>(
      `select * from sage_export_destruction_evidence
       where destruction_request_id = $1 and workspace_id = $2 and org_id = $3
       order by created_at desc
       limit 1`,
      [destructionRequestId, workspaceId, orgId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapDestructionEvidence(row) : undefined
  }
}
