import { requireBaseFinancialAuthority } from '@/lib/finance/base-release-boundary'
/**
 * GET  /api/finance/billing — Get billing account for the current org
 * POST /api/finance/billing — Create billing account
 */

import { z } from 'zod'
import { withApi } from '@/lib/api/framework'
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses'
import {
  createBillingAccount,
  getBillingAccount,
  updateBillingAccount,
} from '@/services/platform-economics'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  displayName: z.string().min(1).max(255),
  billingEmail: z.string().email(),
  billingContactName: z.string().max(255).optional(),
  billingPhone: z.string().max(50).optional(),
  billingAddress: z
    .object({
      line1: z.string(),
      line2: z.string().optional(),
      city: z.string(),
      province: z.string(),
      postalCode: z.string(),
      country: z.string(),
    })
    .optional(),
  taxId: z.string().max(50).optional(),
  netTermsDays: z.number().int().min(1).max(120).optional(),
})

// The billing account is the caller organization's own row: the handlers run in that organization's tenant transaction, so the
// ambient handle the billing service reads and writes through carries the organization row-level security applies to.
export const GET = withApi(
  {
    auth: { minRole: 'secretary_treasurer' },

    rlsOrgContext: false,
    registry: {
      audience: 'officer',
      productionStatus: 'active',
      evidenceRequired: true,
      orgScoping: 'caller-org',
    },
    openapi: { tags: ['Finance'], summary: 'Get the billing account of the current organization' },
  },
  async ({ organizationId }) => {
    requireBaseFinancialAuthority()

    try {
      const account = await getBillingAccount(organizationId!)
      if (!account) {
        return standardErrorResponse(ErrorCode.NOT_FOUND, 'No billing account found')
      }
      return standardSuccessResponse(account)
    } catch (error) {
      return standardErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        'Failed to fetch billing account',
        error,
      )
    }
  },
)

export const POST = withApi(
  {
    auth: { minRole: 'admin' },

    rlsOrgContext: false,
    registry: {
      audience: 'admin',
      productionStatus: 'active',
      evidenceRequired: true,
      orgScoping: 'caller-org',
    },
    openapi: {
      tags: ['Finance'],
      summary: 'Create the billing account of the current organization',
    },
  },
  async ({ request, organizationId, userId }) => {
    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid JSON')
    }

    const parsed = createSchema.safeParse(rawBody)
    if (!parsed.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid input', parsed.error)
    }

    requireBaseFinancialAuthority()

    try {
      const account = await createBillingAccount({
        organizationId: organizationId!,
        ...parsed.data,
        createdBy: userId!,
      })
      return standardSuccessResponse(account)
    } catch (error) {
      return standardErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        'Failed to create billing account',
        error,
      )
    }
  },
)

const updateSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  billingEmail: z.string().email().optional(),
  billingContactName: z.string().max(255).optional(),
  billingPhone: z.string().max(50).optional(),
  billingAddress: z
    .object({
      line1: z.string(),
      line2: z.string().optional(),
      city: z.string(),
      province: z.string(),
      postalCode: z.string(),
      country: z.string(),
    })
    .optional(),
  taxId: z.string().max(50).optional(),
  netTermsDays: z.number().int().min(1).max(120).optional(),
})

export const PATCH = withApi(
  {
    auth: { minRole: 'admin' },

    rlsOrgContext: false,
    registry: {
      audience: 'admin',
      productionStatus: 'active',
      evidenceRequired: true,
      orgScoping: 'caller-org',
    },
    openapi: {
      tags: ['Finance'],
      summary: 'Update the billing account of the current organization',
    },
  },
  async ({ request, organizationId, userId }) => {
    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid JSON')
    }

    const parsed = updateSchema.safeParse(rawBody)
    if (!parsed.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid input', parsed.error)
    }

    requireBaseFinancialAuthority()

    try {
      const updated = await updateBillingAccount(organizationId!, parsed.data, userId!)
      if (!updated) {
        return standardErrorResponse(ErrorCode.NOT_FOUND, 'No billing account found')
      }
      return standardSuccessResponse(updated)
    } catch (error) {
      return standardErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        'Failed to update billing account',
        error,
      )
    }
  },
)
