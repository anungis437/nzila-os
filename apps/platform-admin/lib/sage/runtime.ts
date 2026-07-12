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
  return {
    actor: {
      actorId: scope.actorId,
      orgId: scope.orgId,
      permissions: mapSagePermissions(scope.orgRole),
    },
  }
}
