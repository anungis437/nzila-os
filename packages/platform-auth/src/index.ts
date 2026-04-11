/**
 * @nzila/platform-auth — Shared Auth / Identity / Authorization
 *
 * Single entry point for all platform auth primitives.
 * Apps import from this package instead of implementing
 * their own auth helpers.
 *
 * @module @nzila/platform-auth
 */

// ── Identity ────────────────────────────────────────────────────────────────
export {
  authenticatedIdentitySchema,
  getInitials,
  type AuthStatus,
  type AuthenticatedIdentity,
  type OrgMembership,
  type AuthSuccess,
  type AuthFailure,
  type AuthResult,
  type OrgScopedAuthSuccess,
  type OrgScopedAuthResult,
} from './identity'

// ── Authorization ───────────────────────────────────────────────────────────
export {
  hasPlatformRole,
  hasAnyPlatformRole,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  canAccessModule,
  isOrgMember,
  meetsOrgRoleRequirement,
  checkPrivilegedAction,
} from './authorization'

// ── Guards ──────────────────────────────────────────────────────────────────
export {
  requireAuth,
  requireOrgScopeGuard,
  requireOrgMembership,
  requirePlatformRoleGuard,
  buildOrgContext,
  type OrgAccessOptions,
  type GuardSuccess,
  type GuardFailure,
  type GuardResult,
} from './guards'

// ── Auth Adapter ─────────────────────────────────────────────────────────────
export {
  resolveIdentity,
  resolveIdentityFromClerk,
  resolveServiceIdentity,
  mapOrgRole,
  mapClerkOrgRole,
} from './clerk-adapter'

// ── Middleware Helpers ───────────────────────────────────────────────────────
export {
  createPublicRouteMatcher,
  COMMON_PUBLIC_ROUTES,
  resolveOrgFromHeader,
  resolveCorrelationId,
  createPlatformHeaders,
} from './middleware'

// ── Webhook Verification ────────────────────────────────────────────────────
export {
  verifySvixSignature,
  isSvixTimestampValid,
  extractSvixHeaders,
  verifyWebhook,
  verifyClerkWebhook,
  type SvixHeaders,
} from './clerk-webhook'
