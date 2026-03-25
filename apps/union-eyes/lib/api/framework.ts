/**
 * Unified API Framework — barrel export
 *
 * Import everything a route handler needs from one place:
 *
 *   import { withApi, ApiError, z, zUUID, paginationSchema, RATE_LIMITS } from '@/lib/api/framework';
 *
 * @module lib/api/framework
 */

// ── The wrapper ──────────────────────────────────────────────────────────────
export { withApi } from './with-api';
export type { WithApiOptions, ApiContext } from './with-api';

// ── Errors ───────────────────────────────────────────────────────────────────
export { ApiError, ErrorCode } from './errors';

// ── Shared schemas ───────────────────────────────────────────────────────────
export {
  zUUID,
  zDateString,
  zDateTimeString,
  zNonEmpty,
  zPostalCode,
  zMoneyString,
  paginationSchema,
  paginationMeta,
  searchSchema,
  organizationIdSchema,
  dateRangeSchema,
  memberIdSchema,
} from './schemas';
export type { PaginationParams, PaginationMeta, SearchParams } from './schemas';

// ── OpenAPI auto-registration ────────────────────────────────────────────────
export { registerApiRoute } from './openapi-registry';

// ── Re-exports from existing modules (so routes don't need 5 imports) ────────
export { RATE_LIMITS } from '@/lib/rate-limiter';
export type { RateLimitConfig } from '@/lib/rate-limiter';
export { PLATFORM_MODULES } from '@/services/platform-economics/entitlement-guard';

// ── Re-export zod for inline schemas ─────────────────────────────────────────
export { z } from 'zod';
