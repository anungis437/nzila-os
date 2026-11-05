import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { ApiError } from '@/lib/api/errors'
import { getRoleLevel, UserRole } from '@/lib/auth/roles'
import { collectiveAgreements } from '@/db/schema'
import { cbaClause } from '@/db/schema/domains/agreements/clauses'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { SHARING_LEVELS } from '@/lib/clause-library/sharing-authority'

/** Kept in step with SHARING_LEVELS in sharing-authority by the b45 contract test. */
export const CLAUSE_SHARING_LEVELS = ['private', 'federation', 'congress', 'public'] as const

const required = (max: number) => z.string().trim().min(1).max(max)
const optional = (max: number) => z.string().trim().max(max).nullable().optional()
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date as YYYY-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'must be a real date')
  .nullable()
  .optional()

const shape = {
  clauseTitle: required(500),
  clauseText: required(100_000),
  clauseType: required(100),
  clauseNumber: optional(50),
  sector: optional(100),
  province: z.string().trim().length(2).nullable().optional(),
  effectiveDate: day,
  expiryDate: day,
  isAnonymized: z.boolean().optional(),
  originalEmployerName: optional(255),
  anonymizedEmployerName: optional(255),
  sharingLevel: z.enum(CLAUSE_SHARING_LEVELS).optional(),
  sharedWithOrgIds: z.array(z.guid()).max(200).nullable().optional(),
}

const createSchema = z.object({ ...shape, sourceCbaId: z.guid().nullable().optional(), originalClauseId: z.guid().nullable().optional() })
const updateSchema = z.object(shape).partial()
const shareSchema = z.object(shape).pick({ sharingLevel: true, sharedWithOrgIds: true, isAnonymized: true, anonymizedEmployerName: true }).partial()

const SCHEMAS = { create: createSchema, update: updateSchema, share: shareSchema } as const

export type ClauseCreateBody = z.infer<typeof createSchema>
export type ClauseUpdateBody = z.infer<typeof updateSchema>

/**
 * A clause body is checked before any of it reaches the database or the sharing authority: text and names are bounded,
 * dates are real calendar dates, ids are ids, and fields the route does not own are dropped.
 */
export function parseClauseBody<M extends keyof typeof SCHEMAS>(raw: unknown, mode: M): z.infer<(typeof SCHEMAS)[M]> {
  const result = SCHEMAS[mode].safeParse(raw)
  if (!result.success) {
    const issue = result.error.issues[0]
    throw ApiError.badRequest(`Invalid clause${issue?.path.length ? ` (${issue.path.join('.')})` : ''}: ${issue?.message ?? 'malformed body'}`)
  }
  return result.data as z.infer<(typeof SCHEMAS)[M]>
}

/**
 * Public sharing puts collective-agreement text in front of every organization, so it is an officer decision, not a steward
 * one. A caller with no resolved role cannot publish. Narrower scopes stay with the steward who owns the clause.
 */
export function assertMayPublish(role: string | null | undefined, sharingLevel: unknown): void {
  if (sharingLevel !== 'public') return
  if (!role || getRoleLevel(role as UserRole) < getRoleLevel(UserRole.OFFICER)) {
    throw ApiError.forbidden('Sharing a clause with every organization requires an officer role')
  }
}
