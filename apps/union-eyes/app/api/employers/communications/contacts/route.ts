/**
 * Employer Contacts API
 *
 * POST /api/employers/communications/contacts — Add employer contact
 * GET  /api/employers/communications/contacts — List contacts for employer
 */

import { z } from 'zod'
import { db } from '@/db/db'
import { employerContacts } from '@/db/schema/domains/communications/employer-communications'
import { employers } from '@/db/schema/union-structure-schema'
import { withOrganizationAuth } from '@/lib/organization-middleware'
import { hasMinRole } from '@/lib/api-auth-guard'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses'
import { eq, desc, and } from 'drizzle-orm'
import { isUniqueViolation } from '@/lib/db/unique-violation'

// ── Validation ──────────────────────────────────────────────────────────────

const createContactSchema = z.object({
  employerId: z.guid(),
  name: z.string().min(1).max(200),
  role: z.enum(['main', 'hr', 'labour_relations', 'legal', 'supervisor', 'other']),
  title: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  preferredMethod: z.enum(['email', 'phone', 'meeting', 'letter', 'other']).optional(),
  isPrimary: z.boolean().default(false),
  notes: z.string().max(2000).optional(),
})

// ── POST ────────────────────────────────────────────────────────────────────

export const POST = withOrganizationAuth(async (request, context) => {
  const { organizationId, userId } = context

  try {
    const canAccess = await hasMinRole('steward')
    if (!canAccess) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Requires steward role or above')
    }

    const body = await request.json()
    const parsed = createContactSchema.safeParse(body)
    if (!parsed.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid input',
        parsed.error.flatten(),
      )
    }

    const data = parsed.data

    // Verify the referenced employer belongs to this organization before
    // attaching a contact to it — employerId is client-supplied and has no
    // DB-level FK, so an unverified value could attach this org's contact
    // record to another organization's employer.
    const [employer] = await db
      .select({ id: employers.id })
      .from(employers)
      .where(and(eq(employers.id, data.employerId), eq(employers.organizationId, organizationId)))
    if (!employer) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Employer not found for this organization',
      )
    }

    // The contact and its audit record commit together.
    const contact = await withRLSContext({ organizationId }, async (tx) => {
      // An employer has one primary contact: naming a new one demotes the previous one in the same transaction.
      if (data.isPrimary) {
        await tx
          .update(employerContacts)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(and(eq(employerContacts.organizationId, organizationId), eq(employerContacts.employerId, data.employerId), eq(employerContacts.isPrimary, true)))
      }
      const [row] = await tx
        .insert(employerContacts)
        .values({
          organizationId,
          employerId: data.employerId,
          name: data.name,
          role: data.role,
          title: data.title ?? null,
          email: data.email ?? null,
          phone: data.phone ?? null,
          preferredMethod: data.preferredMethod ?? 'email',
          isPrimary: data.isPrimary,
          notes: data.notes ?? null,
          createdBy: userId,
        })
        .returning()

      await persistAtomicAudit(tx, {
        userId,
        organizationId,
        resourceType: 'employer_contacts',
        action: 'employer_contact.create',
        resourceId: row.id,
        details: { employerId: row.employerId, role: row.role },
      })
      return row
    })

    // The in-transaction audit record is the only one: the earlier second event carried the contact's name into the audit log after the commit.
    return standardSuccessResponse(contact)
  } catch (error) {
    // The unique index admits one active primary contact per employer; a concurrent create that lost the race is a conflict.
    if (isUniqueViolation(error)) return standardErrorResponse(ErrorCode.CONFLICT, 'This employer already has a primary contact')
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to add employer contact')
  }
})

// ── GET ─────────────────────────────────────────────────────────────────────

export const GET = withOrganizationAuth(async (request, context) => {
  const { organizationId } = context

  try {
    const canAccess = await hasMinRole('steward')
    if (!canAccess) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Requires steward role or above')
    }

    const { searchParams } = new URL(request.url)
    const employerId = searchParams.get('employerId')

    const conditions = [eq(employerContacts.organizationId, organizationId)]
    if (employerId) {
      conditions.push(eq(employerContacts.employerId, employerId))
    }

    const rows = await db
      .select()
      .from(employerContacts)
      .where(and(...conditions))
      .orderBy(desc(employerContacts.createdAt))

    return standardSuccessResponse(rows)
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to list employer contacts')
  }
})
