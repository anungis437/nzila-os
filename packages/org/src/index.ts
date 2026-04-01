/**
 * @nzila/org — Canonical organisation context, identity, & guards
 *
 * The single source of truth for org-scoped context shapes.
 * Every domain vertical must extend or implement these types.
 *
 * @module @nzila/org
 */

// ── Core Types & Guards ─────────────────────────────────────────────────────
export {
  type OrgContext,
  type DbContext,
  isOrgContext,
  isDbContext,
  toDbContext,
} from './context/types.js'

// ── Runtime Schemas ─────────────────────────────────────────────────────────
export {
  orgContextSchema,
  dbContextSchema,
  parseOrgContext,
  safeParseOrgContext,
  parseDbContext,
} from './context/schemas.js'

// ── Fail-Closed Guards ──────────────────────────────────────────────────────
export {
  requireOrgScope,
  requirePermission,
  requireRole,
  assertSameOrg,
  withOrgScope,
  OrgScopeRequiredError,
  OrgScopeInvalidError,
  OrgAccessDeniedError,
} from './context/guards.js'

// ── Legacy Compatibility ────────────────────────────────────────────────────
export {
  extractOrgIdFromLegacy,
  normalizeLegacyOrgId,
  detectLegacyFields,
  type LegacyTenantContext,
  type LegacyWorkspaceContext,
  type LegacyOrganizationContext,
} from './context/legacy.js'
