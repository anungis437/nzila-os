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
  SageBoundaryFlag,
  SageDecisionRecord,
  SageEvidenceAuthorization,
  SageEvidenceItem,
  SageEvidenceSource,
  SageExportApproval,
  SageExportRequest,
  SageReviewNote,
  SageRoleAssignment,
  SageSourceQuality,
  SageWorkspace,
  SageWorkspaceMember,
} from './types'
import {
  mapBoundaryFlag,
  mapDecisionRecord,
  mapEvidenceAuthorization,
  mapEvidenceItem,
  mapEvidenceSource,
  mapExportApproval,
  mapExportRequest,
  mapReviewNote,
  mapRoleAssignment,
  mapWorkspace,
  mapWorkspaceMember,
  type SageBoundaryFlagRow,
  type SageDecisionRecordRow,
  type SageEvidenceAuthorizationRow,
  type SageEvidenceItemRow,
  type SageEvidenceSourceRow,
  type SageExportApprovalRow,
  type SageExportRequestRow,
  type SageReviewNoteRow,
  type SageRoleAssignmentRow,
  type SageWorkspaceMemberRow,
  type SageWorkspaceRow,
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
         (workspace_id, org_id, requested_by, scope, status, created_at)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [
        input.workspaceId,
        input.orgId,
        input.requestedBy,
        input.scope ?? null,
        input.status,
        input.createdAt,
      ],
    )
    return mapExportRequest(rows[0])
  }

  async getExportRequest(exportRequestId: string): Promise<SageExportRequest | undefined> {
    const { rows } = await this.sql.query<SageExportRequestRow>(
      `select * from sage_export_request where id = $1`,
      [exportRequestId],
    )
    const row = firstOrUndefined(rows)
    return row ? mapExportRequest(row) : undefined
  }

  async setExportRequestStatus(
    exportRequestId: string,
    status: SageExportRequest['status'],
  ): Promise<void> {
    await this.sql.query(
      `update sage_export_request set status = $2 where id = $1`,
      [exportRequestId, status],
    )
  }

  async createExportApproval(
    input: Omit<SageExportApproval, 'id'>,
  ): Promise<SageExportApproval> {
    const { rows } = await this.sql.query<SageExportApprovalRow>(
      `insert into sage_export_approval
         (export_request_id, org_id, export_authority_level, approver_id, decision, decision_at, reason)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning *`,
      [
        input.exportRequestId,
        input.orgId,
        input.exportAuthorityLevel,
        input.approverId,
        input.decision,
        input.decisionAt,
        input.reason ?? null,
      ],
    )
    return mapExportApproval(rows[0])
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
}
