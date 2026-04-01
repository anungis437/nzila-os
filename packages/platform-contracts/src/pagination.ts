/**
 * @nzila/platform-contracts — Pagination & List Response Contracts
 *
 * Standard response shapes for paginated lists and cursor-based
 * navigation across all Nzila OS APIs.
 */
import { z } from 'zod'

// ── Pagination Meta ─────────────────────────────────────────────────────────

export const paginationMetaSchema = z.object({
  /** Current page (1-based). */
  page: z.number().int().positive(),
  /** Items per page. */
  pageSize: z.number().int().positive().max(500),
  /** Total items across all pages. */
  totalItems: z.number().int().nonnegative(),
  /** Total pages. */
  totalPages: z.number().int().nonnegative(),
  /** Whether there is a next page. */
  hasNextPage: z.boolean(),
  /** Whether there is a previous page. */
  hasPreviousPage: z.boolean(),
})

export type PaginationMeta = z.infer<typeof paginationMetaSchema>

// ── Cursor Meta ─────────────────────────────────────────────────────────────

export const cursorMetaSchema = z.object({
  /** Opaque cursor for the next page. */
  nextCursor: z.string().nullable(),
  /** Opaque cursor for the previous page. */
  previousCursor: z.string().nullable(),
  /** Whether there are more items. */
  hasMore: z.boolean(),
  /** Number of items in this batch. */
  count: z.number().int().nonnegative(),
})

export type CursorMeta = z.infer<typeof cursorMetaSchema>

// ── Paginated List Response ─────────────────────────────────────────────────

export const paginatedListSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    pagination: paginationMetaSchema,
  })

export interface PaginatedList<T> {
  items: T[]
  pagination: PaginationMeta
}

// ── Cursor List Response ────────────────────────────────────────────────────

export const cursorListSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    cursor: cursorMetaSchema,
  })

export interface CursorList<T> {
  items: T[]
  cursor: CursorMeta
}

// ── Pagination Input ────────────────────────────────────────────────────────

export const paginationInputSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(500).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export type PaginationInput = z.infer<typeof paginationInputSchema>

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build pagination meta from total count and input. */
export function buildPaginationMeta(
  totalItems: number,
  input: PaginationInput,
): PaginationMeta {
  const totalPages = Math.ceil(totalItems / input.pageSize)
  return {
    page: input.page,
    pageSize: input.pageSize,
    totalItems,
    totalPages,
    hasNextPage: input.page < totalPages,
    hasPreviousPage: input.page > 1,
  }
}
