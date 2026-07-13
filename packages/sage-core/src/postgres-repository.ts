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
  SageDeliveryReceipt,
  SageDeliveryReceiptIntent,
  SageDeliveryRecipient,
  SageDeliveryRequest,
  SageDeliveryRevocationReasonCode,
} from './delivery-types'
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
  type SageBoundaryFlagRow,
  type SageDecisionRecordRow,
  type SageEvidenceAuthorizationRow,
  type SageEvidenceItemRow,
  type SageEvidenceSourceRow,
  type SageExportApprovalRow,
  type SageExportPackageRow,
  type SageExportRequestRow,
  type SageAuditOutboxRow,
  type SageReviewNoteRow,
  type SageRoleAssignmentRow,
  type SageWorkspaceMemberRow,
  type SageWorkspaceRow,
  type SageDeliveryRecipientRow,
  type SageDeliveryRequestRow,
  type SageDeliveryApprovalRow,
  type SageDeliveryGrantRow,
  type SageDeliveryReceiptRow,
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

  async issueDeliveryGrant(input: {
    grant: Omit<SageDeliveryGrant, 'id'>
    updatedAt: string
    auditEvent: SageAuditOutboxIntent
    receipt: SageDeliveryReceiptIntent
  }): Promise<{ grant: SageDeliveryGrant; created: boolean } | undefined> {
    const g = input.grant
    const rc = input.receipt
    // Atomic: flip approved request → issued, insert exactly one grant, enqueue
    // the invitation_issued receipt + audit. Loser (request not approved, or a
    // grant already exists) inserts nothing here.
    const { rows } = await this.sql.query<SageDeliveryGrantRow>(
      `with issued_req as (
         update sage_delivery_request
           set status = 'issued', updated_at = $19
         where id = $3 and workspace_id = $2 and org_id = $1 and status = 'approved'
             and not exists (select 1 from sage_delivery_grant where delivery_request_id = $3)
         returning id
       ),
       grant_row as (
         insert into sage_delivery_grant
           (org_id, workspace_id, delivery_request_id, export_package_id,
            recipient_id, status, invitation_token_hash, invitation_expires_at,
            access_expires_at, max_accesses, access_count, issued_by, issued_at, updated_at)
         select $1, $2, $3, $4, $5, 'issued', $6, $7, $8, $9, 0, $10, $11, $11 from issued_req
         on conflict (delivery_request_id) do nothing
         returning *
       ),
       outbox as (
         insert into sage_audit_outbox
           (event_id, org_id, workspace_id, actor_id, action, resource_type,
            resource_id, safe_payload_json, status, attempt_count, created_at)
         select $12, $1, $2, $13, $14, $15, grant_row.id, $16::jsonb, 'pending', 0, $11 from grant_row
         on conflict (event_id) do nothing
         returning event_id
       ),
       receipt as (
         insert into sage_delivery_receipt
           (event_id, org_id, workspace_id, delivery_request_id, grant_id,
            package_id, recipient_id, event_type, safe_reason_code, occurred_at, created_at)
         select $17, $1, $2, $3, grant_row.id, $4, $5, $18, $20, $11, $11 from grant_row
         on conflict (event_id) do nothing
         returning event_id
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
      ],
    )
    const row = firstOrUndefined(rows)
    if (row) return { grant: mapDeliveryGrant(row), created: true }
    // Either a grant already exists (idempotent) or the request was not approvable.
    const existing = await this.sql.query<SageDeliveryGrantRow>(
      `select * from sage_delivery_grant where delivery_request_id = $1`,
      [g.deliveryRequestId],
    )
    const existingRow = firstOrUndefined(existing.rows)
    if (existingRow) return { grant: mapDeliveryGrant(existingRow), created: false }
    return undefined
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
}
