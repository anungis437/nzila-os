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

export {
  createSourceDisclosureAuthority,
  preflightSourceDisclosureActivation,
  sourceDisclosurePolicySchema,
  sourceDisclosureFactContractSchema,
  sourceDisclosureFreshnessPolicySchema,
  sourceDisclosureEvidenceRecordSchema,
  sourceDisclosureProvenanceSchema,
  type SourceDisclosureAuditEvent,
  type SourceDisclosureAuthorityPorts,
  type SourceDisclosureDecision,
  type SourceDisclosureDecisionResult,
  type SourceDisclosureActivationPreflightResult,
  type SourceDisclosureEvaluationInput,
  type SourceDisclosureFactIdentity,
  type SourceDisclosureReason,
  type SourceDisclosurePolicy,
  type SourceDisclosureFactContract,
  type SourceDisclosureFreshnessPolicy,
  type SourceDisclosureEvidenceRecord,
  type SourceDisclosureProvenance,
  type SourceDisclosureRecipient,
} from './source-disclosure'

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

// ── UnionEyes Runtime Acceptance Auth ──────────────────────────────────────
export {
  ACCEPTANCE_AUTH_COOKIE,
  ACCEPTANCE_AUTH_HEADER,
  ACCEPTANCE_AUTH_VERSION,
  ACCEPTANCE_AUTH_ISSUER,
  ACCEPTANCE_AUTH_AUDIENCE,
  ACCEPTANCE_AUTH_MAX_TTL_SECONDS,
  ACCEPTANCE_AUTH_MAX_FUTURE_IAT_SECONDS,
  isAcceptanceAuthRuntimeEnabled,
  mintAcceptanceAuthToken,
  verifyAcceptanceAuthToken,
  resolveAcceptanceAuthUser,
  type AcceptanceAuthEnv,
  type AcceptanceAuthUser,
  type AcceptanceDb,
} from './acceptance-auth'

// ── Application-scoped local/test acceptance identity ────────────────────
export {
  mintAcceptanceIdentityToken,
  verifyAcceptanceIdentityToken,
  type AcceptanceTrustProfile,
  type AcceptanceIdentityClaims,
  type AcceptanceIdentityVerification,
} from './acceptance-trust'

export {
  CORA_ACCEPTANCE_APPLICATION,
  CORA_ACCEPTANCE_PROVIDER,
  CORA_ACCEPTANCE_ISSUER,
  CORA_ACCEPTANCE_AUDIENCE,
  CORA_ACCEPTANCE_TOKEN_VERSION,
  CORA_ACCEPTANCE_MAX_TTL_SECONDS,
  createCoraAcceptanceTrustProfile,
  verifyCoraAcceptanceIdentity,
  authenticateCoraAcceptanceIdentity,
  type CoraAcceptanceAuthEnv,
  type CoraAcceptanceIdentity,
} from './cora-acceptance-auth'
