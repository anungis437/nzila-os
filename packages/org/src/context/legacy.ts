/**
 * @nzila/org — Legacy Compatibility Adapters
 *
 * Maps legacy tenancy concepts (tenantId, workspaceId, organizationId)
 * to the canonical org_scope model (orgId).
 *
 * Usage: call these adapters at system boundaries to normalize
 * incoming legacy data before passing into org-scoped code.
 *
 * TODO(org-scope-migration): Remove these adapters once all consumers
 * have migrated to the canonical orgId field. Track progress in
 * docs/MIGRATION_NOTES.md.
 *
 * @module @nzila/org/legacy
 */

// ── Legacy Source Shapes ────────────────────────────────────────────────────

export interface LegacyTenantContext {
  tenantId?: string
  tenant_id?: string
}

export interface LegacyWorkspaceContext {
  workspaceId?: string
  workspace_id?: string
}

export interface LegacyOrganizationContext {
  organizationId?: string
  organization_id?: string
  orgId?: string
  org_id?: string
}

type LegacyContext = LegacyTenantContext & LegacyWorkspaceContext & LegacyOrganizationContext

// ── Adapter ─────────────────────────────────────────────────────────────────

/**
 * Extract orgId from any legacy context shape.
 * Checks fields in canonical → least-preferred order.
 *
 * @returns orgId string or undefined if not found
 *
 * @deprecated Use canonical orgId directly. This adapter exists for
 * migration compatibility only.
 */
export function extractOrgIdFromLegacy(
  ctx: LegacyContext,
): string | undefined {
  return (
    ctx.orgId ??
    ctx.org_id ??
    ctx.organizationId ??
    ctx.organization_id ??
    ctx.tenantId ??
    ctx.tenant_id ??
    ctx.workspaceId ??
    ctx.workspace_id ??
    undefined
  )
}

/**
 * Normalize a legacy context into canonical orgId.
 * Throws if no recognizable org identifier is present.
 *
 * @deprecated Migrate callers to use orgId directly.
 */
export function normalizeLegacyOrgId(ctx: LegacyContext): string {
  const orgId = extractOrgIdFromLegacy(ctx)
  if (!orgId) {
    throw new Error(
      'Cannot resolve orgId from legacy context. ' +
        'Expected one of: orgId, org_id, organizationId, organization_id, ' +
        'tenantId, tenant_id, workspaceId, workspace_id',
    )
  }
  return orgId
}

/**
 * Create a map of which legacy fields were present.
 * Useful for audit trails during migration.
 */
export function detectLegacyFields(ctx: LegacyContext): string[] {
  const detected: string[] = []
  if (ctx.orgId) detected.push('orgId')
  if (ctx.org_id) detected.push('org_id')
  if (ctx.organizationId) detected.push('organizationId')
  if (ctx.organization_id) detected.push('organization_id')
  if (ctx.tenantId) detected.push('tenantId')
  if (ctx.tenant_id) detected.push('tenant_id')
  if (ctx.workspaceId) detected.push('workspaceId')
  if (ctx.workspace_id) detected.push('workspace_id')
  return detected
}
