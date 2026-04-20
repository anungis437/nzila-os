/**
 * @nzila/os-core — barrel export
 */
export * from './types'
export { checkRateLimit, rateLimitHeaders } from './rateLimit'
export { auditedAction } from './audited-action'
export type {
  AuditedActionInput,
  AuditedActionContext,
  AuditedActionResult,
  AuditRecord,
} from './audited-action'
export { evaluateGovernanceRequirements } from './policy'
export { getResolutionTemplate, listAvailableTemplates } from './templates'
export { computeEntryHash, verifyChain } from './hash'
export * from './evidence'
export * from './policy/index'
export * from './telemetry/index'
export * from './retention/index'
// Disambiguate: retention/policies has the authoritative RetentionClass (superset of evidence's version)
export { RetentionClass } from './retention/policies'
export { assertBootInvariants } from './boot-assert'
export * from './resilience/index'
export {
  ApiError,
  ApiErrorCode,
  apiSuccess,
  apiError,
  type ApiSuccessResponse,
  type ApiErrorResponse,
  type ApiMeta,
  type ApiErrorDetail,
} from './api-response'
export { apiHandler, type ApiHandlerOptions, type HandlerContext } from './api-handler'
export {
  checkIdempotency,
  InMemoryIdempotencyCache,
  hashPayload,
  buildCacheKey,
  isStrictEnvironment,
  IDEMPOTENCY_HEADER,
  MUTATION_METHODS,
  getGlobalIdempotencyCache,
  requireIdempotencyKey,
  recordIdempotentResponse,
  resolveIdempotentReplay,
  isMutationApiRoute,
  isIdempotencyExempt,
  cleanupExpiredIdempotencyEntries,
  IDEMPOTENCY_EXEMPT_PATTERNS,
  type IdempotencyCache,
  type CachedIdempotencyEntry,
  type IdempotencyCheckOptions,
  type IdempotencyResult,
} from './idempotency'
export {
  normalizeHealthChecks,
  isReadyFromChecks,
  healthStatusFromChecks,
  getBuildMetadata,
  type HealthCheckState,
  type RawHealthCheck,
  type BuildMetadata,
} from './health'
