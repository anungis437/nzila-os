// ─── @nzila/sage-core — service layer ────────────────────────────────────────
// Executable SAGE flows built on Phase 1 modules. Each service:
//  - accepts explicit service context
//  - requires the appropriate SAGE_PERMISSIONS constant
//  - enforces org/workspace boundary
//  - enforces the relevant implementation-blocking invariants
//  - calls repository operations
//  - emits a SAGE audit payload for material actions
//  - returns typed results; throws typed SageServiceError on forbidden/invalid states

import {
  SAGE_APPLICATION_ROLES,
  SAGE_AUTHORIZATION_LEVELS,
  SAGE_BOUNDARY_RESOLUTIONS,
  SAGE_REVIEW_NOTE_TYPES,
  type SageApplicationRole,
  type SageAuthorizationLevel,
  type SageBoundaryFlag,
  type SageBoundaryFlagType,
  type SageBoundaryResolution,
  type SageConfidenceLevel,
  type SageDecisionRecord,
  type SageEvidenceAuthorization,
  type SageEvidenceItem,
  type SageEvidenceSource,
  type SageExportApproval,
  type SageExportRequest,
  type SageGovernanceAuthorizationBasis,
  type SageGovernanceTargetType,
  type SageInstitutionType,
  type SageReviewNote,
  type SageReviewNoteType,
  type SageRiskSurface,
  type SageRoleAssignment,
  type SageSourceQuality,
  type SageSourceType,
  type SageWorkspace,
  type SageWorkspaceMember,
} from './types'
import { SAGE_PERMISSIONS } from './permissions'
import type { SagePermission } from './permissions'
import {
  resolveSagePermission,
  canAccessEvidenceLevel,
  authorizationLevelRank,
  mostRestrictiveAuthorization,
  isAuthorizationDowngrade,
  SAGE_GOVERNANCE_AUTHORIZATION_FLOOR,
  type SageAccessContext,
} from './access-model'
import {
  SAGE_AUDIT_ACTIONS,
  SAGE_AUDIT_RESOURCES,
  buildSageAuditPayload,
  type SageAuditAction,
  type SageAuditResource,
} from './audit-events'
import { deriveSageBoundaryProfile } from './boundary-profile'
import {
  assertDecisionRecordHasNamedHumanReviewer,
  assertEvidenceLinkRequiresClassifiedSource,
  assertExcludedEvidenceCannotBeExternallyExported,
  assertExternalReviewerHasNoExportAuthority,
  assertRequesterCannotApproveOwnExport,
  assertRoleAssignmentRequiresMembership,
  assertWorkspaceUsable,
} from './invariants'
import type { SageRepository } from './repository'
import type { SageAuditSink } from './audit-sink'
import { contextNow, type SageServiceContext } from './service-context'
import { forbidden, invalidInput, notFound, orgBoundary, permissionDenied } from './service-errors'

export type SageServiceDeps = {
  repo: SageRepository
  audit: SageAuditSink
}

function requirePermission(ctx: SageServiceContext, permission: string): void {
  if (!ctx.actor.permissions.includes(permission)) permissionDenied(permission)
}

function requireSameOrg(ctx: SageServiceContext, orgId: string): void {
  if (ctx.actor.orgId !== orgId) orgBoundary()
}

/**
 * A role assignment is active when it is not revoked and (if time-bound) not
 * yet expired. ISO-8601 timestamps compare lexicographically in chronological
 * order, so a string comparison is correct here.
 */
function isAssignmentActive(r: SageRoleAssignment, nowIso: string): boolean {
  if (r.revokedAt) return false
  if (r.timeBoundAccessExpiresAt && r.timeBoundAccessExpiresAt <= nowIso) return false
  return true
}

// Permissions an explicit oversight admin (WORKSPACE_ADMIN) may exercise without
// a per-workspace role. Deliberately read-only: never evidence or export.
const OVERSIGHT_PERMISSIONS: readonly SagePermission[] = [SAGE_PERMISSIONS.WORKSPACE_READ]

async function loadUsableWorkspace(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  workspaceId: string,
): Promise<SageWorkspace> {
  // Primary tenant boundary: the repository query is scoped to the actor's org,
  // so a cross-org workspace is never returned (non-disclosure — NOT_FOUND).
  const ws = await deps.repo.getWorkspace(workspaceId, ctx.actor.orgId)
  if (!ws) notFound('workspace')
  // Defense-in-depth: re-assert org boundary on the returned row.
  requireSameOrg(ctx, ws.orgId)
  assertWorkspaceUsable(ws)
  return ws
}

async function emit(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  action: SageAuditAction,
  resource: SageAuditResource,
  resourceId: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await deps.audit.record(
    buildSageAuditPayload({
      actorId: ctx.actor.actorId,
      orgId: ctx.actor.orgId,
      action,
      resource,
      resourceId,
      payload,
    }),
  )
}

// ─── Workspace ───────────────────────────────────────────────────────────────

export async function createSageWorkspace(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: {
    name: string
    institutionType: SageInstitutionType
    riskSurface: SageRiskSurface
  },
): Promise<SageWorkspace> {
  requirePermission(ctx, SAGE_PERMISSIONS.WORKSPACE_CREATE)
  if (!ctx.actor.orgId) invalidInput('orgId is required')
  if (!input.name) invalidInput('name is required')
  if (!input.institutionType) invalidInput('institutionType is required')
  if (!input.riskSurface) invalidInput('riskSurface is required')

  const boundaryProfile = deriveSageBoundaryProfile(input.institutionType, input.riskSurface)
  const ts = contextNow(ctx)
  const ws = await deps.repo.createWorkspace({
    orgId: ctx.actor.orgId,
    name: input.name,
    status: 'draft',
    institutionType: input.institutionType,
    riskSurface: input.riskSurface,
    boundaryProfile,
    createdBy: ctx.actor.actorId,
    updatedBy: ctx.actor.actorId,
    createdAt: ts,
    updatedAt: ts,
  })
  assertWorkspaceUsable(ws)

  // Bootstrap (the single documented exception where creation grants SAGE
  // workspace access): the creator becomes a member and workspace_owner so they
  // can immediately view/administer the workspace. All other workspace access
  // requires an explicit membership + active role assignment.
  await deps.repo.addWorkspaceMember({
    workspaceId: ws.id,
    orgId: ws.orgId,
    actorId: ctx.actor.actorId,
    createdBy: ctx.actor.actorId,
    createdAt: ts,
  })
  await deps.repo.assignRole({
    workspaceId: ws.id,
    orgId: ws.orgId,
    actorId: ctx.actor.actorId,
    sageApplicationRole: 'workspace_owner',
    workspaceScope: ws.id,
    accessReason: 'workspace creation bootstrap',
    approvedBy: ctx.actor.actorId,
    createdAt: ts,
    revokedAt: null,
  })

  await emit(deps, ctx, SAGE_AUDIT_ACTIONS.WORKSPACE_CREATED, SAGE_AUDIT_RESOURCES.WORKSPACE, ws.id, {
    institutionType: ws.institutionType,
    riskSurface: ws.riskSurface,
    bootstrappedOwner: ctx.actor.actorId,
  })
  return ws
}

/**
 * Authorize workspace-scoped access. Access requires EITHER an explicit, named
 * oversight permission (WORKSPACE_ADMIN) in the service context, OR an active
 * workspace membership plus an active SAGE role assignment that grants the
 * required permission. Membership alone is never sufficient; revoked and
 * time-expired assignments are ignored. Cross-org/missing throws NOT_FOUND
 * (non-disclosure); same-org but unauthorized throws FORBIDDEN.
 */
export async function authorizeSageWorkspaceAccess(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; requiredPermission: SagePermission },
): Promise<SageWorkspace> {
  const ws = await deps.repo.getWorkspace(input.workspaceId, ctx.actor.orgId)
  if (!ws) notFound('workspace')
  assertWorkspaceUsable(ws)

  // Explicit oversight is READ-ONLY: an administrator (WORKSPACE_ADMIN) may view
  // any workspace in their org, but oversight never confers evidence access or
  // export authority — those still require explicit grants/roles.
  if (
    OVERSIGHT_PERMISSIONS.includes(input.requiredPermission) &&
    ctx.actor.permissions.includes(SAGE_PERMISSIONS.WORKSPACE_ADMIN)
  ) {
    return ws
  }

  const nowIso = contextNow(ctx)
  const membership = await deps.repo.getWorkspaceMember(ws.id, ctx.actor.actorId)
  const assignments = await deps.repo.listRoleAssignments(ws.id, ctx.actor.actorId)
  const access: SageAccessContext = {
    hasMembership: Boolean(membership),
    activeRoles: assignments
      .filter((r) => isAssignmentActive(r, nowIso))
      .map((r) => r.sageApplicationRole),
    evidenceAuthorizations: [],
  }
  if (!resolveSagePermission(access, input.requiredPermission)) {
    forbidden('SAGE workspace access requires an active membership and role assignment')
  }
  return ws
}

/**
 * List the SAGE workspaces the actor is authorized to see. Oversight admins
 * (explicit WORKSPACE_ADMIN permission) see all org workspaces; everyone else
 * sees only workspaces where they hold an active membership + read-granting
 * role. Never exposes another organization's workspaces.
 */
export async function listSageWorkspaces(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
): Promise<SageWorkspace[]> {
  const all = await deps.repo.listWorkspaces(ctx.actor.orgId)
  if (ctx.actor.permissions.includes(SAGE_PERMISSIONS.WORKSPACE_ADMIN)) return all

  // Per-workspace membership + role check. A future indexed query can replace
  // this loop for large organizations.
  const nowIso = contextNow(ctx)
  const accessible: SageWorkspace[] = []
  for (const ws of all) {
    const membership = await deps.repo.getWorkspaceMember(ws.id, ctx.actor.actorId)
    if (!membership) continue
    const assignments = await deps.repo.listRoleAssignments(ws.id, ctx.actor.actorId)
    const access: SageAccessContext = {
      hasMembership: true,
      activeRoles: assignments
        .filter((r) => isAssignmentActive(r, nowIso))
        .map((r) => r.sageApplicationRole),
      evidenceAuthorizations: [],
    }
    if (resolveSagePermission(access, SAGE_PERMISSIONS.WORKSPACE_READ)) accessible.push(ws)
  }
  return accessible
}

/**
 * Load a single workspace the actor is authorized to read. Requires membership +
 * active role (or explicit oversight). Cross-org/missing throws NOT_FOUND.
 */
export async function getSageWorkspace(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string },
): Promise<SageWorkspace> {
  return authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.WORKSPACE_READ,
  })
}

// ─── Membership + role assignment ────────────────────────────────────────────

export async function addSageWorkspaceMember(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; actorId: string },
): Promise<SageWorkspaceMember> {
  requirePermission(ctx, SAGE_PERMISSIONS.MEMBER_MANAGE)
  const ws = await loadUsableWorkspace(deps, ctx, input.workspaceId)
  const member = await deps.repo.addWorkspaceMember({
    workspaceId: ws.id,
    orgId: ws.orgId,
    actorId: input.actorId,
    createdBy: ctx.actor.actorId,
    createdAt: contextNow(ctx),
  })
  await emit(
    deps,
    ctx,
    SAGE_AUDIT_ACTIONS.MEMBER_ADDED,
    SAGE_AUDIT_RESOURCES.WORKSPACE_MEMBER,
    member.id,
    { actorId: input.actorId },
  )
  return member
}

export async function assignSageRole(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: {
    workspaceId: string
    actorId: string
    role: SageApplicationRole
    accessReason: string
    approvedBy: string
  },
): Promise<SageRoleAssignment> {
  requirePermission(ctx, SAGE_PERMISSIONS.ROLE_ASSIGN)
  const ws = await loadUsableWorkspace(deps, ctx, input.workspaceId)
  if (!SAGE_APPLICATION_ROLES.includes(input.role)) invalidInput('invalid SAGE application role')
  if (!input.accessReason) invalidInput('accessReason is required')
  if (!input.approvedBy) invalidInput('approvedBy is required')

  const membership = await deps.repo.getWorkspaceMember(ws.id, input.actorId)
  assertRoleAssignmentRequiresMembership({ hasMembership: Boolean(membership) })

  const role = await deps.repo.assignRole({
    workspaceId: ws.id,
    orgId: ws.orgId,
    actorId: input.actorId,
    sageApplicationRole: input.role,
    workspaceScope: ws.id,
    accessReason: input.accessReason,
    approvedBy: input.approvedBy,
    createdAt: contextNow(ctx),
    revokedAt: null,
  })
  await emit(
    deps,
    ctx,
    SAGE_AUDIT_ACTIONS.ROLE_ASSIGNED,
    SAGE_AUDIT_RESOURCES.ROLE_ASSIGNMENT,
    role.id,
    { actorId: input.actorId, role: input.role },
  )
  return role
}

export async function revokeSageRole(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; roleAssignmentId: string; reason: string },
): Promise<void> {
  requirePermission(ctx, SAGE_PERMISSIONS.ROLE_REVOKE)
  await loadUsableWorkspace(deps, ctx, input.workspaceId)
  if (!input.reason) invalidInput('reason is required')
  await deps.repo.revokeRole(input.roleAssignmentId, contextNow(ctx))
  await emit(
    deps,
    ctx,
    SAGE_AUDIT_ACTIONS.ROLE_REVOKED,
    SAGE_AUDIT_RESOURCES.ROLE_ASSIGNMENT,
    input.roleAssignmentId,
    { reason: input.reason },
  )
}

/** Active (non-revoked, non-expired) roles for an actor in a workspace. */
export async function activeSageRoles(
  deps: SageServiceDeps,
  workspaceId: string,
  actorId: string,
): Promise<SageApplicationRole[]> {
  const nowIso = new Date().toISOString()
  const roles = await deps.repo.listRoleAssignments(workspaceId, actorId)
  return roles.filter((r) => isAssignmentActive(r, nowIso)).map((r) => r.sageApplicationRole)
}

// ─── Evidence authorization ──────────────────────────────────────────────────

export async function grantSageEvidenceAuthorization(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: {
    workspaceId: string
    actorId: string
    level: SageAuthorizationLevel
    accessReason: string
    approvedBy: string
  },
): Promise<SageEvidenceAuthorization> {
  requirePermission(ctx, SAGE_PERMISSIONS.EVIDENCE_AUTHORIZATION_GRANT)
  const ws = await loadUsableWorkspace(deps, ctx, input.workspaceId)
  if (!SAGE_AUTHORIZATION_LEVELS.includes(input.level)) invalidInput('invalid authorization level')
  if (!input.accessReason) invalidInput('accessReason is required')
  if (!input.approvedBy) invalidInput('approvedBy is required')

  const membership = await deps.repo.getWorkspaceMember(ws.id, input.actorId)
  if (!membership) forbidden('evidence authorization requires workspace membership')

  const grant = await deps.repo.grantEvidenceAuthorization({
    workspaceId: ws.id,
    orgId: ws.orgId,
    actorId: input.actorId,
    evidenceAuthorizationLevel: input.level,
    accessReason: input.accessReason,
    approvedBy: input.approvedBy,
    createdAt: contextNow(ctx),
    revokedAt: null,
  })
  await emit(
    deps,
    ctx,
    SAGE_AUDIT_ACTIONS.EVIDENCE_AUTHORIZATION_GRANTED,
    SAGE_AUDIT_RESOURCES.EVIDENCE_AUTHORIZATION,
    grant.id,
    { actorId: input.actorId, level: input.level },
  )
  return grant
}

export async function revokeSageEvidenceAuthorization(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; authorizationId: string; reason: string },
): Promise<void> {
  requirePermission(ctx, SAGE_PERMISSIONS.EVIDENCE_AUTHORIZATION_REVOKE)
  await loadUsableWorkspace(deps, ctx, input.workspaceId)
  if (!input.reason) invalidInput('reason is required')
  await deps.repo.revokeEvidenceAuthorization(input.authorizationId, contextNow(ctx))
  await emit(
    deps,
    ctx,
    SAGE_AUDIT_ACTIONS.EVIDENCE_AUTHORIZATION_REVOKED,
    SAGE_AUDIT_RESOURCES.EVIDENCE_AUTHORIZATION,
    input.authorizationId,
    { reason: input.reason },
  )
}

async function activeEvidenceAuthorizations(
  deps: SageServiceDeps,
  workspaceId: string,
  actorId: string,
): Promise<SageAuthorizationLevel[]> {
  const grants = await deps.repo.listEvidenceAuthorizations(workspaceId, actorId)
  return grants.filter((g) => !g.revokedAt).map((g) => g.evidenceAuthorizationLevel)
}

// ─── Evidence source + item lifecycle ────────────────────────────────────────

export async function createSageEvidenceSource(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: {
    workspaceId: string
    sourceType: SageSourceType
    containsPersonalInformation?: boolean
    containsSensitiveInformation?: boolean
  },
): Promise<SageEvidenceSource> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EVIDENCE_CREATE,
  })
  const src = await deps.repo.createEvidenceSource({
    workspaceId: ws.id,
    orgId: ws.orgId,
    sourceType: input.sourceType,
    sourceQuality: null,
    authorizationLevel: 'internal',
    containsPersonalInformation: input.containsPersonalInformation ?? false,
    containsSensitiveInformation: input.containsSensitiveInformation ?? false,
    classified: false,
    createdBy: ctx.actor.actorId,
    createdAt: contextNow(ctx),
  })
  await emit(
    deps,
    ctx,
    SAGE_AUDIT_ACTIONS.EVIDENCE_SOURCE_CREATED,
    SAGE_AUDIT_RESOURCES.EVIDENCE_SOURCE,
    src.id,
    { sourceType: input.sourceType },
  )
  return src
}

export async function classifySageEvidenceSource(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: {
    workspaceId: string
    sourceId: string
    sourceQuality: SageSourceQuality
    authorizationLevel: SageAuthorizationLevel
  },
): Promise<SageEvidenceSource> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EVIDENCE_CLASSIFY,
  })
  const src = await deps.repo.getEvidenceSource(input.sourceId, ws.id, ws.orgId)
  if (!src || src.workspaceId !== ws.id) notFound('evidence source')
  const classified = await deps.repo.classifyEvidenceSource(input.sourceId, {
    sourceQuality: input.sourceQuality,
    authorizationLevel: input.authorizationLevel,
  })
  await emit(
    deps,
    ctx,
    SAGE_AUDIT_ACTIONS.SOURCE_CLASSIFIED,
    SAGE_AUDIT_RESOURCES.EVIDENCE_SOURCE,
    classified.id,
    { authorizationLevel: input.authorizationLevel },
  )
  return classified
}

export async function createSageEvidenceItem(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; sourceId: string; confidenceLevel: SageConfidenceLevel },
): Promise<SageEvidenceItem> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EVIDENCE_CREATE,
  })
  const src = await deps.repo.getEvidenceSource(input.sourceId, ws.id, ws.orgId)
  if (!src || src.workspaceId !== ws.id) notFound('evidence source')
  assertEvidenceLinkRequiresClassifiedSource({ sourceClassified: src.classified })
  if (!input.confidenceLevel) invalidInput('confidenceLevel is required')

  const ts = contextNow(ctx)
  const item = await deps.repo.createEvidenceItem({
    sourceId: src.id,
    workspaceId: ws.id,
    orgId: ws.orgId,
    lifecycleState: 'registered',
    confidenceLevel: input.confidenceLevel,
    excludedFromExternalReview: src.authorizationLevel === 'excluded',
    humanReviewRequired: true,
    createdBy: ctx.actor.actorId,
    updatedBy: ctx.actor.actorId,
    createdAt: ts,
    updatedAt: ts,
  })
  await emit(
    deps,
    ctx,
    SAGE_AUDIT_ACTIONS.EVIDENCE_ITEM_CREATED,
    SAGE_AUDIT_RESOURCES.EVIDENCE_ITEM,
    item.id,
    { sourceId: src.id },
  )
  return item
}

export async function linkSageEvidenceItem(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; itemId: string },
): Promise<SageEvidenceItem> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.EVIDENCE_LINK,
  })
  const item = await deps.repo.getEvidenceItem(input.itemId, ws.id, ws.orgId)
  if (!item || item.workspaceId !== ws.id) notFound('evidence item')
  const src = await deps.repo.getEvidenceSource(item.sourceId, ws.id, ws.orgId)
  if (!src) notFound('evidence source')

  assertEvidenceLinkRequiresClassifiedSource({ sourceClassified: src.classified })
  // Restricted authorization levels require an EXPLICIT, active evidence-
  // authorization grant at that exact level. The EVIDENCE_LINK role permission
  // authorizes the *operation*; it does not grant access to restricted evidence.
  // Workspace/org/oversight admin status never substitutes for the grant, and
  // revoked grants are ignored (see `activeEvidenceAuthorizations`).
  if (src.authorizationLevel === 'authorized_only' || src.authorizationLevel === 'sensitive') {
    const grants = await activeEvidenceAuthorizations(deps, ws.id, ctx.actor.actorId)
    if (!grants.includes(src.authorizationLevel)) {
      forbidden(`${src.authorizationLevel} evidence is linked without explicit authorization`)
    }
  }

  const linked = await deps.repo.linkEvidenceItem(item.id, contextNow(ctx))
  await emit(deps, ctx, SAGE_AUDIT_ACTIONS.EVIDENCE_LINKED, SAGE_AUDIT_RESOURCES.EVIDENCE_ITEM, linked.id)
  return linked
}

// ─── Evidence read models (authorization-filtered) ───────────────────────────

/**
 * Build the actor's evidence access context for a workspace: membership,
 * active (non-revoked, non-expired) role assignments, and active evidence
 * authorization grants. Used to filter which evidence the actor may see.
 */
async function loadSageAccessContext(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  workspaceId: string,
): Promise<SageAccessContext> {
  const nowIso = contextNow(ctx)
  const membership = await deps.repo.getWorkspaceMember(workspaceId, ctx.actor.actorId)
  const assignments = await deps.repo.listRoleAssignments(workspaceId, ctx.actor.actorId)
  const grants = await deps.repo.listEvidenceAuthorizations(workspaceId, ctx.actor.actorId)
  return {
    hasMembership: Boolean(membership),
    activeRoles: assignments
      .filter((r) => isAssignmentActive(r, nowIso))
      .map((r) => r.sageApplicationRole),
    evidenceAuthorizations: grants.filter((g) => !g.revokedAt).map((g) => g.evidenceAuthorizationLevel),
  }
}

/**
 * List evidence sources the actor is authorized to see. Requires workspace
 * read access; each source is additionally filtered by its authorization level
 * (authorized_only / sensitive / excluded require an explicit active grant).
 */
export async function listSageEvidenceSources(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string },
): Promise<SageEvidenceSource[]> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.WORKSPACE_READ,
  })
  const access = await loadSageAccessContext(deps, ctx, ws.id)
  const sources = await deps.repo.listEvidenceSources(ws.id, ws.orgId)
  return sources.filter((s) => canAccessEvidenceLevel(access, s.authorizationLevel))
}

/**
 * List evidence items whose source the actor is authorized to see. Items inherit
 * their authorization from their source, so an item is visible only when its
 * source is accessible.
 */
export async function listSageEvidenceItems(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; sourceId?: string },
): Promise<SageEvidenceItem[]> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.WORKSPACE_READ,
  })
  const access = await loadSageAccessContext(deps, ctx, ws.id)
  const sources = await deps.repo.listEvidenceSources(ws.id, ws.orgId)
  const accessibleSourceIds = new Set(
    sources.filter((s) => canAccessEvidenceLevel(access, s.authorizationLevel)).map((s) => s.id),
  )
  const items = await deps.repo.listEvidenceItems(ws.id, ws.orgId, input.sourceId)
  return items.filter((i) => accessibleSourceIds.has(i.sourceId))
}

/** Load a single evidence source if accessible; NOT_FOUND otherwise (non-disclosure). */
export async function getSageEvidenceSource(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; sourceId: string },
): Promise<SageEvidenceSource> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.WORKSPACE_READ,
  })
  const src = await deps.repo.getEvidenceSource(input.sourceId, ws.id, ws.orgId)
  if (!src) notFound('evidence source')
  const access = await loadSageAccessContext(deps, ctx, ws.id)
  if (!canAccessEvidenceLevel(access, src.authorizationLevel)) notFound('evidence source')
  return src
}

/** Load a single evidence item if its source is accessible; NOT_FOUND otherwise. */
export async function getSageEvidenceItem(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; itemId: string },
): Promise<SageEvidenceItem> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.WORKSPACE_READ,
  })
  const item = await deps.repo.getEvidenceItem(input.itemId, ws.id, ws.orgId)
  if (!item) notFound('evidence item')
  const src = await deps.repo.getEvidenceSource(item.sourceId, ws.id, ws.orgId)
  if (!src) notFound('evidence item')
  const access = await loadSageAccessContext(deps, ctx, ws.id)
  if (!canAccessEvidenceLevel(access, src.authorizationLevel)) notFound('evidence item')
  return item
}

// ─── Boundary flags, review notes, decision records (Phase 6 human governance) ─

/** Synthetic / non-human reviewer identities that may never author a decision. */
const NON_HUMAN_REVIEWER_IDS = new Set([
  'system',
  'ai',
  'automation',
  'automated',
  'bot',
  'service',
  'anonymous',
  'unknown',
])

function assertNamedHumanReviewer(reviewerId: string): void {
  const normalized = reviewerId.trim().toLowerCase()
  if (!normalized) invalidInput('a named human reviewer is required')
  if (NON_HUMAN_REVIEWER_IDS.has(normalized)) {
    forbidden('a decision record requires a named human reviewer (no system/automated identity)')
  }
}

/**
 * Assert the actor is an authenticated human. The actor kind is derived
 * server-side from the trusted session (never supplied by the browser); a
 * service principal carrying an ordinary UUID is still rejected here because it
 * is not marked 'human'. Absent/unknown kinds fail closed.
 */
function assertActorIsHuman(ctx: SageServiceContext): void {
  if (ctx.actor.actorKind !== 'human') {
    forbidden('this action requires an authenticated human actor')
  }
}

/**
 * Whether the actor may see a governance record given the record's OWN
 * authorization envelope. This is the primary non-disclosure gate for derived
 * governance narratives: a record is filtered on its stored authorization
 * level, not merely on redaction of its referenced identifiers.
 */
function canAccessGovernanceRecord(
  access: SageAccessContext,
  record: { authorizationLevel: SageAuthorizationLevel },
): boolean {
  return canAccessEvidenceLevel(access, record.authorizationLevel)
}

/**
 * Derive the authorization envelope for a boundary flag / review note. The
 * effective level is the MOST RESTRICTIVE of the governance floor ('internal')
 * and the target evidence's authorization level. A reviewer may request a
 * STRICTER level (raising it), but never a weaker one (a downgrade is rejected).
 * The browser cannot set the final level directly — the server floors it here.
 */
async function deriveTargetAuthorization(
  deps: SageServiceDeps,
  ws: SageWorkspace,
  targetType: SageGovernanceTargetType,
  targetId: string | null | undefined,
  requested: SageAuthorizationLevel | undefined,
): Promise<{
  authorizationLevel: SageAuthorizationLevel
  authorizationBasis: SageGovernanceAuthorizationBasis
}> {
  let floor: SageAuthorizationLevel = SAGE_GOVERNANCE_AUTHORIZATION_FLOOR
  let basis: SageGovernanceAuthorizationBasis = 'workspace_default'

  if (targetType === 'evidence_source' && targetId) {
    const src = await deps.repo.getEvidenceSource(targetId, ws.id, ws.orgId)
    if (src) {
      floor = mostRestrictiveAuthorization(floor, src.authorizationLevel)
      basis = 'target_inherited'
    }
  } else if (targetType === 'evidence_item' && targetId) {
    const item = await deps.repo.getEvidenceItem(targetId, ws.id, ws.orgId)
    const src = item
      ? await deps.repo.getEvidenceSource(item.sourceId, ws.id, ws.orgId)
      : undefined
    if (src) {
      floor = mostRestrictiveAuthorization(floor, src.authorizationLevel)
      basis = 'target_inherited'
    }
  }

  return applyRequestedAuthorization(floor, basis, requested)
}

/**
 * Apply a caller-requested authorization level to a derived floor. Requests may
 * only RAISE restriction; a downgrade below the floor is forbidden.
 */
function applyRequestedAuthorization(
  floor: SageAuthorizationLevel,
  floorBasis: SageGovernanceAuthorizationBasis,
  requested: SageAuthorizationLevel | undefined,
): {
  authorizationLevel: SageAuthorizationLevel
  authorizationBasis: SageGovernanceAuthorizationBasis
} {
  if (!requested) return { authorizationLevel: floor, authorizationBasis: floorBasis }
  if (!SAGE_AUTHORIZATION_LEVELS.includes(requested)) {
    invalidInput('invalid authorization level')
  }
  if (isAuthorizationDowngrade(requested, floor)) {
    forbidden('cannot lower the derived authorization level of a governance record')
  }
  if (authorizationLevelRank(requested) > authorizationLevelRank(floor)) {
    return { authorizationLevel: requested, authorizationBasis: 'reviewer_restricted' }
  }
  return { authorizationLevel: floor, authorizationBasis: floorBasis }
}

/**
 * Whether the actor may see a governance record attached to the given target.
 * Workspace-level targets are visible to any workspace reader; evidence targets
 * inherit the evidence authorization rules, so a flag/note about a source or
 * item the actor cannot access is hidden (non-disclosure).
 */
async function isGovernanceTargetAccessible(
  deps: SageServiceDeps,
  ws: SageWorkspace,
  access: SageAccessContext,
  targetType: SageGovernanceTargetType | null | undefined,
  targetId: string | null | undefined,
): Promise<boolean> {
  if (targetType === 'evidence_source') {
    if (!targetId) return false
    const src = await deps.repo.getEvidenceSource(targetId, ws.id, ws.orgId)
    return Boolean(src) && canAccessEvidenceLevel(access, src!.authorizationLevel)
  }
  if (targetType === 'evidence_item') {
    if (!targetId) return false
    const item = await deps.repo.getEvidenceItem(targetId, ws.id, ws.orgId)
    if (!item) return false
    const src = await deps.repo.getEvidenceSource(item.sourceId, ws.id, ws.orgId)
    return Boolean(src) && canAccessEvidenceLevel(access, src!.authorizationLevel)
  }
  // 'workspace' (or unspecified) → workspace-level, visible to any reader.
  return true
}

/**
 * Validate that a mutation's target belongs to the workspace AND is accessible
 * to the actor. Evidence targets that are missing or inaccessible resolve to
 * NOT_FOUND (never leak existence); a workspace target must carry no targetId.
 */
async function assertGovernanceTargetUsable(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  ws: SageWorkspace,
  targetType: SageGovernanceTargetType,
  targetId: string | null | undefined,
): Promise<void> {
  if (targetType === 'workspace') {
    if (targetId) invalidInput('a workspace-level target must not reference a specific id')
    return
  }
  if (!targetId) invalidInput('targetId is required for an evidence target')
  const access = await loadSageAccessContext(deps, ctx, ws.id)
  const accessible = await isGovernanceTargetAccessible(deps, ws, access, targetType, targetId)
  if (!accessible) notFound(targetType === 'evidence_source' ? 'evidence source' : 'evidence item')
}

export async function addSageBoundaryFlag(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: {
    workspaceId: string
    flagType: SageBoundaryFlagType
    targetType: SageGovernanceTargetType
    targetId?: string
    note?: string
    requestedAuthorizationLevel?: SageAuthorizationLevel
  },
): Promise<SageBoundaryFlag> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.BOUNDARY_FLAG,
  })
  await assertGovernanceTargetUsable(deps, ctx, ws, input.targetType, input.targetId)
  // Derive the authorization envelope server-side so the flag narrative can
  // never be less protected than the evidence it concerns.
  const { authorizationLevel, authorizationBasis } = await deriveTargetAuthorization(
    deps,
    ws,
    input.targetType,
    input.targetId,
    input.requestedAuthorizationLevel,
  )
  const ts = contextNow(ctx)
  const flag = await deps.repo.addBoundaryFlag({
    workspaceId: ws.id,
    orgId: ws.orgId,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    flagType: input.flagType,
    note: input.note ?? null,
    status: 'open',
    authorizationLevel,
    authorizationBasis,
    resolvedAt: null,
    resolvedBy: null,
    resolutionNote: null,
    createdBy: ctx.actor.actorId,
    createdAt: ts,
    updatedAt: ts,
  })
  await emit(deps, ctx, SAGE_AUDIT_ACTIONS.BOUNDARY_FLAGGED, SAGE_AUDIT_RESOURCES.BOUNDARY_FLAG, flag.id, {
    flagType: input.flagType,
    targetType: input.targetType,
    status: flag.status,
    authorizationLevel: flag.authorizationLevel,
  })
  return flag
}

/** Acknowledge a flag for review: compare-and-set 'open' → 'under_review'. */
export async function reviewSageBoundaryFlag(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; flagId: string },
): Promise<SageBoundaryFlag> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.BOUNDARY_FLAG,
  })
  const existing = await deps.repo.getBoundaryFlag(input.flagId, ws.id, ws.orgId)
  if (!existing) notFound('boundary flag')
  const reviewed = await deps.repo.reviewBoundaryFlag(input.flagId, ws.id, ws.orgId, contextNow(ctx))
  await emit(
    deps,
    ctx,
    SAGE_AUDIT_ACTIONS.BOUNDARY_REVIEWED,
    SAGE_AUDIT_RESOURCES.BOUNDARY_FLAG,
    reviewed.id,
    { status: reviewed.status },
  )
  return reviewed
}

/** Resolve or retain a boundary flag: compare-and-set, requires a human note. */
export async function resolveSageBoundaryFlag(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: {
    workspaceId: string
    flagId: string
    resolution: SageBoundaryResolution
    resolutionNote: string
    requestedAuthorizationLevel?: SageAuthorizationLevel
  },
): Promise<SageBoundaryFlag> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.BOUNDARY_FLAG,
  })
  // Resolving a boundary is a named-human governance act.
  assertActorIsHuman(ctx)
  if (!SAGE_BOUNDARY_RESOLUTIONS.includes(input.resolution)) {
    invalidInput('invalid boundary resolution')
  }
  if (!input.resolutionNote || !input.resolutionNote.trim()) {
    invalidInput('a human resolution note is required')
  }
  const existing = await deps.repo.getBoundaryFlag(input.flagId, ws.id, ws.orgId)
  if (!existing) notFound('boundary flag')
  // The resolution narrative must remain at least as restricted as the flag it
  // resolves. The resolver may raise the level (e.g. if the note references
  // stricter evidence) but can never downgrade it.
  const { authorizationLevel } = applyRequestedAuthorization(
    existing.authorizationLevel,
    existing.authorizationBasis ?? 'workspace_default',
    input.requestedAuthorizationLevel,
  )
  const ts = contextNow(ctx)
  const resolved = await deps.repo.resolveBoundaryFlag(input.flagId, ws.id, ws.orgId, {
    status: input.resolution,
    resolvedBy: ctx.actor.actorId,
    resolutionNote: input.resolutionNote,
    resolvedAt: ts,
    updatedAt: ts,
    authorizationLevel,
  })
  await emit(
    deps,
    ctx,
    SAGE_AUDIT_ACTIONS.BOUNDARY_RESOLVED,
    SAGE_AUDIT_RESOURCES.BOUNDARY_FLAG,
    resolved.id,
    { resolution: input.resolution, status: resolved.status, authorizationLevel: resolved.authorizationLevel },
  )
  return resolved
}

export async function addSageReviewNote(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: {
    workspaceId: string
    note: string
    noteType: SageReviewNoteType
    targetType: SageGovernanceTargetType
    targetId?: string
    requestedAuthorizationLevel?: SageAuthorizationLevel
  },
): Promise<SageReviewNote> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.REVIEW_NOTE,
  })
  // A review note is a named-human governance act.
  assertActorIsHuman(ctx)
  if (!input.note || !input.note.trim()) invalidInput('note is required')
  if (!SAGE_REVIEW_NOTE_TYPES.includes(input.noteType)) invalidInput('invalid review note type')
  await assertGovernanceTargetUsable(deps, ctx, ws, input.targetType, input.targetId)
  // Derive the authorization envelope so the note narrative cannot be less
  // protected than the evidence it annotates.
  const { authorizationLevel, authorizationBasis } = await deriveTargetAuthorization(
    deps,
    ws,
    input.targetType,
    input.targetId,
    input.requestedAuthorizationLevel,
  )
  // reviewerId is the AUTHENTICATED actor — never a browser-supplied identity.
  const note = await deps.repo.addReviewNote({
    workspaceId: ws.id,
    orgId: ws.orgId,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    reviewerId: ctx.actor.actorId,
    noteType: input.noteType,
    note: input.note,
    authorizationLevel,
    authorizationBasis,
    createdAt: contextNow(ctx),
  })
  await emit(deps, ctx, SAGE_AUDIT_ACTIONS.REVIEW_NOTED, SAGE_AUDIT_RESOURCES.REVIEW_NOTE, note.id, {
    noteType: input.noteType,
    targetType: input.targetType,
    authorizationLevel: note.authorizationLevel,
  })
  return note
}

export async function createSageDecisionRecord(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: {
    workspaceId: string
    decision: string
    rationale?: string
    uncertainty: string
    referencedEvidenceItemIds?: string[]
    referencedBoundaryFlagIds?: string[]
    requestedAuthorizationLevel?: SageAuthorizationLevel
  },
): Promise<SageDecisionRecord> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.DECISION_RECORD,
  })
  if (!input.decision || !input.decision.trim()) invalidInput('a decision statement is required')
  if (!input.uncertainty || !input.uncertainty.trim()) {
    invalidInput('an uncertainty / limitations statement is required')
  }

  // A decision record is a named-human governance act. The actor kind is
  // derived server-side; a service principal with an ordinary UUID is rejected.
  assertActorIsHuman(ctx)

  // The named human reviewer IS the authenticated actor — derived server-side,
  // never accepted from the browser. Admin/oversight status cannot substitute:
  // DECISION_RECORD authority was already checked via membership + active role.
  const humanReviewerId = ctx.actor.actorId
  assertDecisionRecordHasNamedHumanReviewer({ humanReviewerId })
  assertNamedHumanReviewer(humanReviewerId)

  const access = await loadSageAccessContext(deps, ctx, ws.id)

  // Referenced evidence must belong to the workspace AND be accessible to the
  // reviewer. As we validate, we also derive the decision's authorization
  // envelope: it inherits the MOST RESTRICTIVE level among referenced evidence,
  // and any excluded evidence forces the decision out of external review.
  const evidenceRefs = input.referencedEvidenceItemIds ?? []
  let floor: SageAuthorizationLevel = SAGE_GOVERNANCE_AUTHORIZATION_FLOOR
  let excludedFromExternalReview = false
  for (const itemId of evidenceRefs) {
    const item = await deps.repo.getEvidenceItem(itemId, ws.id, ws.orgId)
    if (!item) notFound('referenced evidence item')
    const src = await deps.repo.getEvidenceSource(item.sourceId, ws.id, ws.orgId)
    if (!src || !canAccessEvidenceLevel(access, src.authorizationLevel)) {
      forbidden('referenced evidence is not accessible to the reviewer')
    }
    floor = mostRestrictiveAuthorization(floor, src.authorizationLevel)
    if (item.excludedFromExternalReview || src.authorizationLevel === 'excluded') {
      excludedFromExternalReview = true
    }
  }

  // Referenced boundary flags must belong to the workspace, and their own
  // authorization envelope also raises the decision floor.
  const flagRefs = input.referencedBoundaryFlagIds ?? []
  for (const flagId of flagRefs) {
    const flag = await deps.repo.getBoundaryFlag(flagId, ws.id, ws.orgId)
    if (!flag) notFound('referenced boundary flag')
    floor = mostRestrictiveAuthorization(floor, flag.authorizationLevel)
  }

  const floorBasis: SageGovernanceAuthorizationBasis =
    evidenceRefs.length > 0 || flagRefs.length > 0 ? 'evidence_inherited' : 'workspace_default'
  const { authorizationLevel, authorizationBasis } = applyRequestedAuthorization(
    floor,
    floorBasis,
    input.requestedAuthorizationLevel,
  )

  const record = await deps.repo.createDecisionRecord({
    workspaceId: ws.id,
    orgId: ws.orgId,
    decision: input.decision,
    rationale: input.rationale ?? null,
    uncertainty: input.uncertainty,
    humanReviewerId,
    referencedEvidenceItemIds: [...evidenceRefs],
    referencedBoundaryFlagIds: [...flagRefs],
    authorizationLevel,
    authorizationBasis,
    excludedFromExternalReview,
    createdBy: ctx.actor.actorId,
    createdAt: contextNow(ctx),
  })
  await emit(
    deps,
    ctx,
    SAGE_AUDIT_ACTIONS.DECISION_RECORDED,
    SAGE_AUDIT_RESOURCES.DECISION_RECORD,
    record.id,
    {
      humanReviewerId,
      actorKind: ctx.actor.actorKind,
      authorizationLevel: record.authorizationLevel,
      excludedFromExternalReview: record.excludedFromExternalReview,
      evidenceReferenceCount: evidenceRefs.length,
      boundaryFlagReferenceCount: flagRefs.length,
    },
  )
  return record
}

// ─── Governance read models (authorization-filtered) ─────────────────────────

/** List boundary flags the actor may see (evidence-target flags are redacted). */
export async function listSageBoundaryFlags(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; filters?: { status?: string } },
): Promise<SageBoundaryFlag[]> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.WORKSPACE_READ,
  })
  const access = await loadSageAccessContext(deps, ctx, ws.id)
  const flags = await deps.repo.listBoundaryFlags(ws.id, ws.orgId, input.filters)
  const visible: SageBoundaryFlag[] = []
  for (const f of flags) {
    // Filter on the record's OWN authorization envelope AND the target's
    // accessibility (defense in depth for legacy rows predating the envelope).
    if (
      canAccessGovernanceRecord(access, f) &&
      (await isGovernanceTargetAccessible(deps, ws, access, f.targetType, f.targetId))
    ) {
      visible.push(f)
    }
  }
  return visible
}

/** List review notes the actor may see (evidence-target notes are redacted). */
export async function listSageReviewNotes(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; filters?: { targetType?: string; targetId?: string } },
): Promise<SageReviewNote[]> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.WORKSPACE_READ,
  })
  const access = await loadSageAccessContext(deps, ctx, ws.id)
  const notes = await deps.repo.listReviewNotes(ws.id, ws.orgId, input.filters)
  const visible: SageReviewNote[] = []
  for (const n of notes) {
    if (
      canAccessGovernanceRecord(access, n) &&
      (await isGovernanceTargetAccessible(deps, ws, access, n.targetType, n.targetId))
    ) {
      visible.push(n)
    }
  }
  return visible
}

/** Redact a decision's evidence references down to those the actor can access. */
async function redactDecisionReferences(
  deps: SageServiceDeps,
  ws: SageWorkspace,
  access: SageAccessContext,
  record: SageDecisionRecord,
): Promise<SageDecisionRecord> {
  const accessibleEvidence: string[] = []
  for (const itemId of record.referencedEvidenceItemIds) {
    const item = await deps.repo.getEvidenceItem(itemId, ws.id, ws.orgId)
    if (!item) continue
    const src = await deps.repo.getEvidenceSource(item.sourceId, ws.id, ws.orgId)
    if (src && canAccessEvidenceLevel(access, src.authorizationLevel)) accessibleEvidence.push(itemId)
  }
  return { ...record, referencedEvidenceItemIds: accessibleEvidence }
}

export async function listSageDecisionRecords(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string },
): Promise<SageDecisionRecord[]> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.WORKSPACE_READ,
  })
  const access = await loadSageAccessContext(deps, ctx, ws.id)
  const records = await deps.repo.listDecisionRecords(ws.id, ws.orgId)
  const out: SageDecisionRecord[] = []
  for (const record of records) {
    // A decision narrative is disclosed only when the actor can access the
    // record's own authorization level; otherwise the record is omitted whole.
    if (!canAccessGovernanceRecord(access, record)) continue
    out.push(await redactDecisionReferences(deps, ws, access, record))
  }
  return out
}

export async function getSageDecisionRecord(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; decisionId: string },
): Promise<SageDecisionRecord> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.WORKSPACE_READ,
  })
  const record = await deps.repo.getDecisionRecord(input.decisionId, ws.id, ws.orgId)
  if (!record) notFound('decision record')
  const access = await loadSageAccessContext(deps, ctx, ws.id)
  // Non-disclosure: an inaccessible decision resolves to NOT_FOUND rather than
  // leaking its existence or narrative.
  if (!canAccessGovernanceRecord(access, record)) notFound('decision record')
  return redactDecisionReferences(deps, ws, access, record)
}

// ─── Export workflow ─────────────────────────────────────────────────────────

type ExportScope = { description?: string; evidenceItemIds: string[] }

export async function requestSageExport(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; description?: string; evidenceItemIds?: string[] },
): Promise<SageExportRequest> {
  requirePermission(ctx, SAGE_PERMISSIONS.EXPORT_REQUEST)
  const ws = await loadUsableWorkspace(deps, ctx, input.workspaceId)
  const scope: ExportScope = {
    description: input.description,
    evidenceItemIds: input.evidenceItemIds ?? [],
  }
  const req = await deps.repo.createExportRequest({
    workspaceId: ws.id,
    orgId: ws.orgId,
    requestedBy: ctx.actor.actorId,
    scope: JSON.stringify(scope),
    status: 'requested', // default is NOT approved
    createdAt: contextNow(ctx),
  })
  await emit(deps, ctx, SAGE_AUDIT_ACTIONS.EXPORT_REQUESTED, SAGE_AUDIT_RESOURCES.EXPORT_REQUEST, req.id)
  return req
}

export async function approveSageExport(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; exportRequestId: string },
): Promise<SageExportApproval> {
  // No automatic approve authority: the actor must hold the explicit permission.
  requirePermission(ctx, SAGE_PERMISSIONS.EXPORT_APPROVE)
  const ws = await loadUsableWorkspace(deps, ctx, input.workspaceId)
  const req = await deps.repo.getExportRequest(input.exportRequestId)
  if (!req || req.workspaceId !== ws.id) notFound('export request')

  assertRequesterCannotApproveOwnExport({
    requestedBy: req.requestedBy,
    approverId: ctx.actor.actorId,
  })

  // External reviewer can never approve an export.
  for (const role of await activeSageRoles(deps, ws.id, ctx.actor.actorId)) {
    assertExternalReviewerHasNoExportAuthority({ approverRole: role })
  }

  // Excluded evidence cannot be exported.
  const scope = JSON.parse(req.scope ?? '{"evidenceItemIds":[]}') as ExportScope
  for (const itemId of scope.evidenceItemIds ?? []) {
    const item = await deps.repo.getEvidenceItem(itemId, ws.id, ws.orgId)
    if (item) {
      assertExcludedEvidenceCannotBeExternallyExported({
        level: item.excludedFromExternalReview ? 'excluded' : 'internal',
        excludedFromExternalReview: item.excludedFromExternalReview,
        inExternalReviewOutput: true,
      })
    }
  }

  await deps.repo.setExportRequestStatus(req.id, 'approved')
  const approval = await deps.repo.createExportApproval({
    exportRequestId: req.id,
    orgId: ws.orgId,
    exportAuthorityLevel: 'approve',
    approverId: ctx.actor.actorId,
    decision: 'approved',
    decisionAt: contextNow(ctx),
    reason: null,
  })
  await emit(
    deps,
    ctx,
    SAGE_AUDIT_ACTIONS.EXPORT_APPROVED,
    SAGE_AUDIT_RESOURCES.EXPORT_APPROVAL,
    approval.id,
    { exportRequestId: req.id },
  )
  return approval
}

export async function denySageExport(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; exportRequestId: string; reason: string },
): Promise<SageExportApproval> {
  requirePermission(ctx, SAGE_PERMISSIONS.EXPORT_APPROVE)
  const ws = await loadUsableWorkspace(deps, ctx, input.workspaceId)
  const req = await deps.repo.getExportRequest(input.exportRequestId)
  if (!req || req.workspaceId !== ws.id) notFound('export request')
  if (!input.reason) invalidInput('reason is required to deny an export')

  await deps.repo.setExportRequestStatus(req.id, 'denied')
  const approval = await deps.repo.createExportApproval({
    exportRequestId: req.id,
    orgId: ws.orgId,
    exportAuthorityLevel: 'deny',
    approverId: ctx.actor.actorId,
    decision: 'denied',
    decisionAt: contextNow(ctx),
    reason: input.reason,
  })
  await emit(
    deps,
    ctx,
    SAGE_AUDIT_ACTIONS.EXPORT_DENIED,
    SAGE_AUDIT_RESOURCES.EXPORT_APPROVAL,
    approval.id,
    { exportRequestId: req.id, reason: input.reason },
  )
  return approval
}

// ─── Workspace summary (counts/status only; no scores/ranks/certification) ───

export type SageWorkspaceSummary = {
  workspaceId: string
  orgId: string
  name: string
  status: SageWorkspace['status']
  institutionType: SageInstitutionType
  riskSurface: SageRiskSurface
  boundaryProfilePresent: boolean
  counts: {
    evidenceSources: number
    evidenceItems: number
    boundaryFlags: number
    decisionRecords: number
    openExportRequests: number
  }
}

export async function getSageWorkspaceSummary(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string },
): Promise<SageWorkspaceSummary> {
  const ws = await authorizeSageWorkspaceAccess(deps, ctx, {
    workspaceId: input.workspaceId,
    requiredPermission: SAGE_PERMISSIONS.WORKSPACE_READ,
  })
  return {
    workspaceId: ws.id,
    orgId: ws.orgId,
    name: ws.name,
    status: ws.status,
    institutionType: ws.institutionType,
    riskSurface: ws.riskSurface,
    boundaryProfilePresent: Boolean(ws.boundaryProfile),
    counts: {
      evidenceSources: await deps.repo.countWorkspaceEvidenceSources(ws.id),
      evidenceItems: await deps.repo.countWorkspaceEvidenceItems(ws.id),
      boundaryFlags: await deps.repo.countWorkspaceBoundaryFlags(ws.id),
      decisionRecords: await deps.repo.countWorkspaceDecisionRecords(ws.id),
      openExportRequests: await deps.repo.countWorkspaceOpenExportRequests(ws.id),
    },
  }
}
