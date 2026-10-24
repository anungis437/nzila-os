/**
 * CRUD collection route for claims
 *
 * @deprecated Prefer `/api/cases` for new consumers. `/api/cases` has
 * full audit logging, evidence packs, and richer sub-routes (assign,
 * timeline, transition, notes, export). This endpoint remains for
 * portal and mobile backward compatibility.
 */
import { crudRoutes } from '@/lib/api/crud-factory'
import { withApi } from '@/lib/api/with-api'
import { ApiError } from '@/lib/api/errors'
import { claims } from '@/db/schema'
import { sql } from 'drizzle-orm'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { allocateClaimNumber } from '@/lib/claims/claim-number'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { z } from 'zod'

const claimCreateSchema = z
  .object({
    claimType: z
      .enum([
        'grievance_discipline',
        'grievance_schedule',
        'grievance_pay',
        'workplace_safety',
        'discrimination_age',
        'discrimination_gender',
        'discrimination_race',
        'discrimination_disability',
        'discrimination_other',
        'harassment_sexual',
        'harassment_workplace',
        'wage_dispute',
        'contract_dispute',
        'retaliation',
        'wrongful_termination',
        'other',
        'harassment_verbal',
        'harassment_physical',
      ])
      .optional(),
    description: z
      .string()
      .min(10, 'Description must be at least 10 characters')
      .max(10000)
      .optional(),
    incidentDate: z.string().optional().nullable(),
    location: z.string().max(500).optional().nullable(),
    desiredOutcome: z.string().max(5000).optional().nullable(),
    witnessesPresent: z.boolean().optional(),
    witnessDetails: z.string().max(5000).optional().nullable(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    isAnonymous: z.boolean().optional(),
    claimAmount: z.union([z.string(), z.number()]).optional().nullable(),
    status: z
      .enum([
        'submitted',
        'under_review',
        'assigned',
        'investigation',
        'pending_documentation',
        'resolved',
        'rejected',
        'closed',
      ])
      .optional(),
  })
  .passthrough()

export const dynamic = 'force-dynamic'

const handlers = crudRoutes({
  table: claims,
  pk: 'claimId',
  tags: ['Claims'],
  orgScoped: true,
  ownerColumn: 'memberId',
  readRole: 'member',
  writeRole: 'steward',
})

export const GET = handlers.GET

/**
 * Custom POST: auto-generates claimNumber (CLM-YYYYMMDD-XXXX)
 * and auto-sets memberId from the authenticated user.
 */
export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Claims'],
      summary: 'Create claim',
      description: 'Creates a new claim with auto-generated claim number.',
    },
  },
  async ({ body, organizationId, userId }) => {
    const parsed = claimCreateSchema.safeParse(body ?? {})
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.errors.map((e) => e.message).join('; '))
    }
    const validatedBody = parsed.data

    if (!organizationId) {
      throw ApiError.badRequest(
        'No active organization. Please select an organization and try again.',
      )
    }

    // Ordinary same-organization create uses the tenant runtime role.
    // System context is reserved for background, webhook, and maintenance work.
    return withRLSContext({ organizationId }, async (tx) => {
      const claimNumber = await allocateClaimNumber(tx, organizationId)

      // Extract incidentDate separately — Drizzle's PgTimestamp.mapToDriverValue
      // calls .toISOString() and requires a Date object, not a raw date string.
      const { incidentDate: rawIncidentDate, ...restBody } = validatedBody
      const values = {
        ...restBody,
        incidentDate: rawIncidentDate ? new Date(String(rawIncidentDate)) : undefined,
        claimNumber,
        organizationId,
        memberId: userId,
      } as typeof claims.$inferInsert

      const [row] = await tx.insert(claims).values(values).returning()
      // Mandatory canonical audit shares this transaction: an audit failure rolls the claim back.
      await persistAtomicAudit(tx, {
        organizationId,
        action: 'claim.create',
        resourceType: 'claims',
        resourceId: row.claimId,
        userId,
        details: {
          claimNumber,
          claimType: row.claimType,
          priority: row.priority,
          route: '/api/claims',
        },
      })
      return { data: row }
    })
  },
)
