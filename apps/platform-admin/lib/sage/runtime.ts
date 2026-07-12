/**
 * Platform Admin — SAGE runtime composition (server-only)
 *
 * Composes the SAGE service dependencies (SQL-backed repository + NAR-sealed
 * audit sink) and derives the SAGE service context from the *authenticated,
 * server-verified* org scope. orgId and actorId always come from the session /
 * org-scope guard — never from a browser-supplied field.
 *
 * Server-only: must never be imported into a client bundle.
 */
import 'server-only'
import {
  PostgresSageRepository,
  SAGE_PERMISSIONS,
  type SageActorKind,
  type SageServiceContext,
  type SageServiceDeps,
} from '@nzila/sage-core'
import { canWrite } from '../org-scope-guard'
import { createSagePlatformSqlClient } from './sql-adapter'
import { createSagePlatformAuditSink } from './audit-adapter'

/**
 * Minimal server-verified actor scope. Satisfied by both the API `OrgScopeContext`
 * (`requireOrgScope`) and the page `PageOrgContext` (`getPageOrgContext`).
 */
export interface SageActorScope {
  actorId: string
  orgId: string
  orgRole: string
  /**
   * How the caller authenticated, derived SERVER-SIDE from the trusted session
   * — never supplied by the browser. This is the fail-closed input from which
   * the actor kind is resolved; an unknown/missing value is rejected (it is
   * never silently classified as human).
   */
  authenticationType?: SageAuthenticationType
  /**
   * Optional explicit actor kind. When present it is trusted as-is (server
   * origin only); when absent it is derived from `authenticationType`. It is
   * NEVER defaulted to a value — a scope carrying neither is rejected.
   */
  actorKind?: SageActorKind
}

/**
 * Trusted authentication classifications. Only the runtime (never the browser)
 * assigns these, and each maps to exactly one actor kind.
 */
export type SageAuthenticationType =
  | 'interactive_user' // a signed-in human operator session
  | 'service_principal' // a machine/service identity
  | 'internal_system' // internal platform execution (jobs, workers)

/** Explicit, total mapping from authentication type → actor kind. */
const AUTHENTICATION_ACTOR_KIND: Record<SageAuthenticationType, SageActorKind> = {
  interactive_user: 'human',
  service_principal: 'service',
  internal_system: 'system',
}

/**
 * Fail-closed resolution of the trusted actor kind. Both `actorKind` and
 * `authenticationType` are server-origin only (never browser-supplied), and:
 *   - authenticationType alone  → derived from the total trusted mapping
 *   - actorKind alone           → accepted (explicit trusted internal caller)
 *   - both present + agree       → accepted
 *   - both present + conflict    → REJECTED (no silent preference either way)
 *   - neither present            → REJECTED
 *   - unknown authenticationType → REJECTED
 * An unknown or missing classification is never converted into the most
 * privileged ('human') category.
 */
export function resolveSageActorKind(scope: SageActorScope): SageActorKind {
  const authType = scope.authenticationType
  if (authType && !(authType in AUTHENTICATION_ACTOR_KIND)) {
    throw new Error(
      'SAGE authenticated actor kind is required: authentication classification is missing or unknown',
    )
  }
  const derived = authType ? AUTHENTICATION_ACTOR_KIND[authType] : undefined

  // Conflicting trusted claims must never be silently reconciled.
  if (scope.actorKind && derived && scope.actorKind !== derived) {
    throw new Error(
      'SAGE actor kind conflicts with the authenticated identity type',
    )
  }

  const actorKind = derived ?? scope.actorKind
  if (!actorKind) {
    throw new Error(
      'SAGE authenticated actor kind is required: authentication classification is missing or unknown',
    )
  }
  return actorKind
}

// Org roles that receive explicit, read-only SAGE workspace oversight. This is a
// named, audited exception — not unrestricted access. Oversight never confers
// evidence access or export authority.
const SAGE_OVERSIGHT_ORG_ROLES = new Set(['admin', 'org_admin'])

/**
 * Map the platform-admin org role to SAGE *application-entry* permissions.
 *
 * Deliberately narrow: platform org roles govern entry + bootstrap only, and do
 * NOT translate into per-workspace evidence/export/role authority. Per-workspace
 * access is enforced by SAGE membership + role assignments
 * (`authorizeSageWorkspaceAccess`), not by this mapping.
 *
 *  - write roles  → WORKSPACE_CREATE (bootstrap: the creator becomes the
 *    workspace owner and thereby gains scoped access)
 *  - oversight roles → WORKSPACE_ADMIN (explicit, read-only org-wide workspace
 *    visibility; never confers evidence or export authority)
 */
export function mapSagePermissions(orgRole: string): string[] {
  const permissions: string[] = []
  if (canWrite(orgRole)) permissions.push(SAGE_PERMISSIONS.WORKSPACE_CREATE)
  if (SAGE_OVERSIGHT_ORG_ROLES.has(orgRole)) permissions.push(SAGE_PERMISSIONS.WORKSPACE_ADMIN)
  return permissions
}

/**
 * Compose the SAGE service dependencies bound to the platform runtime:
 * PostgresSageRepository over the platform DB + the NAR-sealed audit sink.
 */
export function createSageRuntime(scope: SageActorScope): SageServiceDeps {
  return {
    repo: new PostgresSageRepository(createSagePlatformSqlClient()),
    audit: createSagePlatformAuditSink(scope.orgRole),
  }
}

/**
 * Build the SAGE service context from a server-verified actor scope.
 * orgId/actorId derive from the session; permissions from the org role.
 */
export function createSageServiceContext(scope: SageActorScope): SageServiceContext {
  // Fail closed: the actor kind must resolve from a trusted classification.
  // A missing/unknown classification throws rather than defaulting to 'human'.
  const actorKind = resolveSageActorKind(scope)
  return {
    actor: {
      actorId: scope.actorId,
      orgId: scope.orgId,
      actorKind,
      permissions: mapSagePermissions(scope.orgRole),
    },
  }
}
