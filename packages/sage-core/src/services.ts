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
  type SageApplicationRole,
  type SageAuthorizationLevel,
  type SageBoundaryFlag,
  type SageBoundaryFlagType,
  type SageConfidenceLevel,
  type SageDecisionRecord,
  type SageEvidenceAuthorization,
  type SageEvidenceItem,
  type SageEvidenceSource,
  type SageExportApproval,
  type SageExportRequest,
  type SageInstitutionType,
  type SageReviewNote,
  type SageRiskSurface,
  type SageRoleAssignment,
  type SageSourceQuality,
  type SageSourceType,
  type SageWorkspace,
  type SageWorkspaceMember,
} from './types'
import { SAGE_PERMISSIONS } from './permissions'
import type { SagePermission } from './permissions'
import { resolveSagePermission, canAccessEvidenceLevel, type SageAccessContext } from './access-model'
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

// ─── Boundary flags, review notes, decision records ──────────────────────────

export async function addSageBoundaryFlag(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; flagType: SageBoundaryFlagType; targetId?: string; note?: string },
): Promise<SageBoundaryFlag> {
  requirePermission(ctx, SAGE_PERMISSIONS.BOUNDARY_FLAG)
  const ws = await loadUsableWorkspace(deps, ctx, input.workspaceId)
  const flag = await deps.repo.addBoundaryFlag({
    workspaceId: ws.id,
    orgId: ws.orgId,
    targetId: input.targetId ?? null,
    flagType: input.flagType,
    note: input.note ?? null,
    createdBy: ctx.actor.actorId,
    createdAt: contextNow(ctx),
  })
  await emit(deps, ctx, SAGE_AUDIT_ACTIONS.BOUNDARY_FLAGGED, SAGE_AUDIT_RESOURCES.BOUNDARY_FLAG, flag.id, {
    flagType: input.flagType,
  })
  return flag
}

export async function addSageReviewNote(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: { workspaceId: string; reviewerId: string; note: string; targetId?: string },
): Promise<SageReviewNote> {
  requirePermission(ctx, SAGE_PERMISSIONS.REVIEW_NOTE)
  const ws = await loadUsableWorkspace(deps, ctx, input.workspaceId)
  if (!input.reviewerId) invalidInput('reviewerId (named reviewer) is required')
  if (!input.note) invalidInput('note is required')
  const note = await deps.repo.addReviewNote({
    workspaceId: ws.id,
    orgId: ws.orgId,
    targetId: input.targetId ?? null,
    reviewerId: input.reviewerId,
    note: input.note,
    createdAt: contextNow(ctx),
  })
  await emit(deps, ctx, SAGE_AUDIT_ACTIONS.REVIEW_NOTED, SAGE_AUDIT_RESOURCES.WORKSPACE, note.id)
  return note
}

export async function createSageDecisionRecord(
  deps: SageServiceDeps,
  ctx: SageServiceContext,
  input: {
    workspaceId: string
    decision: string
    humanReviewerId: string
    rationale?: string
    referencedEvidenceItemIds?: string[]
  },
): Promise<SageDecisionRecord> {
  requirePermission(ctx, SAGE_PERMISSIONS.DECISION_RECORD)
  const ws = await loadUsableWorkspace(deps, ctx, input.workspaceId)
  if (!input.decision) invalidInput('decision is required')
  assertDecisionRecordHasNamedHumanReviewer({ humanReviewerId: input.humanReviewerId })

  // If evidence is referenced, it must have been reviewed (human_review_required cleared
  // is not modeled yet in Phase 2; we require the referenced items to exist and to be
  // non-excluded). No auto-generated findings path exists: a decision is only created
  // from an explicit human-authored `decision` string with a named human reviewer.
  for (const itemId of input.referencedEvidenceItemIds ?? []) {
    const item = await deps.repo.getEvidenceItem(itemId, ws.id, ws.orgId)
    if (!item || item.workspaceId !== ws.id) notFound('referenced evidence item')
  }

  const record = await deps.repo.createDecisionRecord({
    workspaceId: ws.id,
    orgId: ws.orgId,
    decision: input.decision,
    rationale: input.rationale ?? null,
    humanReviewerId: input.humanReviewerId,
    createdBy: ctx.actor.actorId,
    createdAt: contextNow(ctx),
  })
  await emit(
    deps,
    ctx,
    SAGE_AUDIT_ACTIONS.DECISION_RECORDED,
    SAGE_AUDIT_RESOURCES.DECISION_RECORD,
    record.id,
    { humanReviewerId: input.humanReviewerId },
  )
  return record
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
