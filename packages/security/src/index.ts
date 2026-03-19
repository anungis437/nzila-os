// Rate limiting
export {
  RateLimiter,
  InMemoryRateLimitStore,
  rateLimitKey,
} from "./rate-limit.js";
export type {
  RateLimitConfig,
  RateLimitResult,
  RateLimitStore,
} from "./rate-limit.js";

// Service auth
export {
  ServiceAuthVerifier,
  ServiceAuthError,
} from "./auth.js";
export type { ServiceCredential, ServiceAuthConfig } from "./auth.js";

// Secrets
export {
  EnvSecretsProvider,
  CachedSecretsProvider,
  requireSecret,
} from "./secrets.js";
export type { SecretsProvider } from "./secrets.js";

// Tenant isolation
export {
  assertTenantOwnership,
  withTenantScope,
  assertAllSameTenant,
  TenantIsolationError,
} from "./isolation.js";
export type { TenantContext } from "./isolation.js";

// Validation
export {
  validateInput,
  strictValidate,
  UUIDSchema,
  TenantIdSchema,
  PaginationSchema,
  SortSchema,
} from "./validation.js";
export type { ValidationResult, ValidationError } from "./validation.js";
