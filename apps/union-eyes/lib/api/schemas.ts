/**
 * Shared Zod Schemas for API Routes
 *
 * Common validation shapes that are reused across multiple routes.
 * Import these instead of re-defining the same patterns per-route.
 *
 * @module lib/api/schemas
 */

import { z } from 'zod';

// ─── Primitives ──────────────────────────────────────────────────────────────

/** UUID v4 string */
export const zUUID = z.guid('Must be a valid UUID');

/** ISO-8601 date string (YYYY-MM-DD) */
export const zDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be in YYYY-MM-DD format');

/** ISO-8601 datetime string */
export const zDateTimeString = z
  .string()
  .datetime({ message: 'Must be a valid ISO-8601 datetime' });

/** Non-empty trimmed string */
export const zNonEmpty = z.string().trim().min(1, 'Must not be empty');

/** Canadian postal code (e.g. K1A 0A6) */
export const zPostalCode = z
  .string()
  .regex(/^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/, 'Invalid Canadian postal code');

/** Currency amount as string with 2 decimal places */
export const zMoneyString = z
  .string()
  .regex(/^\d+\.\d{2}$/, 'Must be a decimal with 2 places (e.g. "100.00")');

// ─── Pagination ──────────────────────────────────────────────────────────────

/** Standard cursor-based pagination query params */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

/** Pagination metadata returned in success responses */
export const paginationMeta = z.object({
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
  hasMore: z.boolean(),
});

export type PaginationMeta = z.infer<typeof paginationMeta>;

// ─── Search / Filtering ──────────────────────────────────────────────────────

/** Generic search + filter params (extend per-domain) */
export const searchSchema = z.object({
  search: z.string().max(200).optional(),
  status: z.string().optional(),
  from: zDateString.optional(),
  to: zDateString.optional(),
});

export type SearchParams = z.infer<typeof searchSchema>;

// ─── Common Domain Objects ───────────────────────────────────────────────────

/** Organisation context passed by header or body */
export const organizationIdSchema = z.object({
  organizationId: zUUID,
});

/** Date range for period-based queries */
export const dateRangeSchema = z
  .object({
    periodStart: zDateString,
    periodEnd: zDateString,
  })
  .refine(
    (d) => new Date(d.periodStart) <= new Date(d.periodEnd),
    { message: 'periodStart must be on or before periodEnd' },
  );

/** Member identifier (body or path) */
export const memberIdSchema = z.object({
  memberId: zUUID,
});
