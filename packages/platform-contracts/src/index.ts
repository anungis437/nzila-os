/**
 * @nzila/platform-contracts — Canonical platform contract interfaces.
 *
 * Every production-grade app in the Nzila OS monorepo should implement
 * the applicable contracts from this package to ensure the control plane
 * can aggregate health, metrics, governance, and evidence uniformly.
 *
 * See docs/PLATFORM_SURFACE_MODEL.md for the operating model.
 * See @nzila/platform-ai-contract for AI-specific output contracts.
 */

// ── App Registry (Control-Plane Authority) ──
export {
  governanceRequirementSchema,
  integrationDependencySchema,
  reportingBindingSchema,
  healthBindingSchema,
  deploymentMetadataSchema,
  appManifestSchema,
  validateAppManifest,
  validateAppRegistry,
  type GovernanceRequirement,
  type IntegrationDependency,
  type ReportingBinding,
  type HealthBinding,
  type DeploymentMetadata,
  type AppManifest,
  type AppRegistryEntry,
} from './app-registry.js'

// ── App Registry Data ──
export {
  APP_REGISTRY,
  getAppManifest,
  getAppsByTier,
  getAppsByDomain,
  getAppsWithCapability,
  getProductionApps,
  validateBuiltInRegistry,
} from './registry.js'

// ── Health ──
export type { HealthStatus, ComponentHealth, HealthResponse, HealthContract } from './health.js'

// ── Metrics ──
export type { MetricType, MetricEntry, MetricsSummary, MetricsContract } from './metrics.js'

// ── Governance ──
export type {
  GovernanceCheckResult,
  GovernanceCheckEntry,
  GovernanceTelemetry,
  GovernanceContract,
} from './governance.js'

// ── Evidence ──
export type { EvidenceFormat, EvidenceArtifact, EvidenceExport, EvidenceContract } from './evidence.js'

// ── Environment ──
export type {
  EnvironmentTier,
  EnvironmentVariable,
  EnvironmentDeclaration,
  EnvironmentContract,
} from './environment.js'

// ── Change Awareness ──
export type { ChangeType, ChangeRecord, ChangeContract } from './change.js'

// ── Validators ──
export {
  isValidHealthResponse,
  isValidMetricsSummary,
  isValidGovernanceTelemetry,
  isValidEvidenceExport,
} from './schemas.js'

// ── Identity ──
export {
  userIdentitySchema,
  sessionIdentitySchema,
  userDisplayProfileSchema,
  type UserIdentity,
  type SessionIdentity,
  type UserDisplayProfile,
} from './identity.js'

// ── Org Scope ──
export {
  orgScopeSchema,
  orgScopeMembershipSchema,
  orgScopeRoleAssignmentSchema,
  orgScopedActorContextSchema,
  orgScopedRequestContextSchema,
  orgScopeStatusValues,
  toOrgScopeId,
  type OrgScopeId,
  type OrgScope,
  type OrgScopeStatus,
  type OrgScopeMembership,
  type OrgScopeRoleAssignment,
  type OrgScopedActorContext,
  type OrgScopedRequestContext,
} from './org-scope.js'

// ── Role / Permission ──
export {
  roleDefinitionSchema,
  permissionCheckSchema,
  permissionResultSchema,
  platformRoleValues,
  meetsRoleRequirement,
  type PlatformRole,
  type RoleDefinition,
  type PermissionCheck,
  type PermissionResult,
} from './role.js'

// ── Module / App Registry ──
export {
  moduleRegistrationSchema,
  moduleManifestSchema,
  moduleTierValues,
  type ModuleRegistration,
  type ModuleManifest,
  type ModuleTier,
} from './module-registry.js'

// ── Error Envelope ──
export {
  platformErrorSchema,
  fieldErrorSchema,
  platformErrorCodeValues,
  createPlatformError,
  getHttpStatus,
  type PlatformError,
  type PlatformErrorCode,
  type FieldError,
} from './error.js'

// ── Pagination ──
export {
  paginationMetaSchema,
  cursorMetaSchema,
  paginatedListSchema,
  cursorListSchema,
  paginationInputSchema,
  buildPaginationMeta,
  type PaginationMeta,
  type CursorMeta,
  type PaginatedList,
  type CursorList,
  type PaginationInput,
} from './pagination.js'

// ── Mutation / Action Result ──
export {
  actionResultSchema,
  actionFailureSchema,
  partialSuccessSchema,
  ok,
  fail,
  type ActionResult,
  type ActionFailure,
  type ActionResponse,
  type PartialSuccess,
} from './mutation.js'

// ── Platform Event ──
export {
  platformEventSchema,
  platformEventTypeValues,
  orgScopeSelectedPayloadSchema,
  appLaunchedPayloadSchema,
  moduleEnabledPayloadSchema,
  roleAssignedPayloadSchema,
  entitlementChangedPayloadSchema,
  type PlatformEvent,
  type PlatformEventType,
} from './platform-event.js'

// ── Notification ──
export {
  notificationSchema,
  unreadCountSchema,
  notificationChannelValues,
  notificationPriorityValues,
  type Notification,
  type UnreadCount,
  type NotificationChannel,
  type NotificationPriority,
} from './notification.js'

// ── Entitlement / Subscription ──
export {
  entitlementSchema,
  subscriptionSchema,
  featureAccessSchema,
  featureGateSchema,
  featureGateManifestSchema,
  checkFeatureGate,
  planTierValues,
  subscriptionStatusValues,
  partnerTierValues,
  type Entitlement,
  type Subscription,
  type FeatureAccess,
  type FeatureGate,
  type FeatureGateManifest,
  type PlanTier,
  type PartnerTier,
  type SubscriptionStatus,
} from './entitlement.js'

// ── File Metadata ──
export {
  fileMetadataSchema,
  type FileMetadata,
} from './file-metadata.js'

// ── Audit Event (Platform) ──
export {
  platformAuditEventSchema,
  platformAuditInputSchema,
  type PlatformAuditEvent,
  type PlatformAuditInput,
} from './audit-event.js'
