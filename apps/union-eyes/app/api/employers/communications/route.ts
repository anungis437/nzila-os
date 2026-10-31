/**
 * Employer Communications API — Contacts & Communications
 *
 * POST /api/employers/communications/contacts   — Add employer contact
 * GET  /api/employers/communications/contacts   — List contacts for employer
 * POST /api/employers/communications             — Record a communication (nothing is delivered by the platform)
 * GET  /api/employers/communications             — List communications for employer
 */

import { z } from 'zod'
import { db } from '@/db/db'
import { employerCommunications } from '@/db/schema/domains/communications/employer-communications'
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
import { assertOrganizationOwns } from '@/lib/api/org-references'
import { ApiError } from '@/lib/api/errors'
import { kernelCaseAccess } from '@/lib/services/case-access-service'
import { employers } from '@/db/schema/union-structure-schema'
import { employerContacts } from '@/db/schema/domains/communications/employer-communications'
import { grievances } from '@/db/schema/domains/claims/grievances'
import { messageTemplates } from '@/db/schema/domains/communications/campaigns'

// ── Validation ──────────────────────────────────────────────────────────────

const createCommunicationSchema = z.object({
  employerId: z.guid(),
  grievanceId: z.guid().optional(),
  type: z.enum(['email', 'phone', 'meeting', 'letter', 'other']),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  recipientContactId: z.guid().optional(),
  recipientName: z.string().optional(),
  // A statement by the person recording it: the platform sends nothing, so 'sent' means they say it was sent elsewhere.
  status: z.enum(['draft', 'sent', 'received', 'acknowledged']).default('draft'),
  // When it was sent or received, as the recorder states it; never stamped by the server and never in the future.
  occurredAt: z.string().datetime().optional(),
  templateId: z.guid().optional(),
}).refine((value) => !value.occurredAt || new Date(value.occurredAt).getTime() <= Date.now() + 60_000, { message: 'occurredAt cannot be in the future', path: ['occurredAt'] })

// ── POST — Log communication ────────────────────────────────────────────────

export const POST = withOrganizationAuth(async (request, context) => {
  const { organizationId, userId } = context

  try {
    const canAccess = await hasMinRole('steward')
    if (!canAccess) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Requires steward role or above')
    }

    const body = await request.json()
    const parsed = createCommunicationSchema.safeParse(body)
    if (!parsed.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid input',
        parsed.error.flatten(),
      )
    }

    const data = parsed.data

    // Every id in the body must name a row of the caller's own organization.
    await assertOrganizationOwns([
      { field: 'employerId', value: data.employerId, table: employers },
      { field: 'grievanceId', value: data.grievanceId, table: grievances },
      { field: 'recipientContactId', value: data.recipientContactId, table: employerContacts },
      { field: 'templateId', value: data.templateId, table: messageTemplates },
    ], organizationId)

    // The communication record and its audit record commit together.
    const communication = await withRLSContext({ organizationId }, async (tx) => {
      const [row] = await tx
        .insert(employerCommunications)
        .values({
          organizationId,
          employerId: data.employerId,
          grievanceId: data.grievanceId,
          type: data.type,
          status: data.status,
          subject: data.subject,
          body: data.body,
          recipientContactId: data.recipientContactId,
          recipientName: data.recipientName ?? 'Unknown',
          senderName: 'Recorded by union staff',
          senderUserId: userId,
          templateId: data.templateId,
          sentAt: data.status === 'sent' && data.occurredAt ? new Date(data.occurredAt) : undefined,
          createdBy: userId,
        })
        .returning()

      await persistAtomicAudit(tx, {
        userId,
        organizationId,
        resourceType: 'employer_communications',
        action: 'employer_communication.create',
        resourceId: row.id,
        details: { employerId: row.employerId, type: row.type, status: row.status, delivery: 'recorded_only' },
      })
      return row
    })

    // The audit record above is the only one: a second event emitted after the commit could be lost or duplicated independently of the row.
    return standardSuccessResponse({ ...communication, delivery: 'recorded_only' })
  } catch (error) {
    if (error instanceof ApiError) {
      return standardErrorResponse(error.code, error.message)
    }
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to log communication')
  }
})

// ── GET — List communications ───────────────────────────────────────────────

const LIST_LIMIT = 200

export const GET = withOrganizationAuth(async (request, context) => {
  const { organizationId, userId } = context

  try {
    const canAccess = await hasMinRole('steward')
    if (!canAccess) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Requires steward role or above')
    }

    const { searchParams } = new URL(request.url)
    const employerId = searchParams.get('employerId')

    const conditions = [eq(employerCommunications.organizationId, organizationId)]
    if (employerId) {
      conditions.push(eq(employerCommunications.employerId, employerId))
    }

    // Correspondence linked to a grievance is readable only by someone the case authority lets see that case; the rest of
    // the organization's stewards see the unlinked records. The read is audited with what was withheld.
    const result = await withRLSContext({ organizationId }, async (tx) => {
      const rows = await tx
        .select()
        .from(employerCommunications)
        .where(and(...conditions))
        .orderBy(desc(employerCommunications.createdAt))
        .limit(LIST_LIMIT)

      const verdicts = new Map<string, boolean>()
      const visible = []
      for (const row of rows) {
        if (!row.grievanceId) { visible.push(row); continue }
        if (!verdicts.has(row.grievanceId)) {
          verdicts.set(row.grievanceId, (await kernelCaseAccess(tx, { organizationId, grievanceId: row.grievanceId, userId })).canViewCase)
        }
        if (verdicts.get(row.grievanceId)) visible.push(row)
      }

      await persistAtomicAudit(tx, {
        userId,
        organizationId,
        resourceType: 'employer_communications',
        action: 'employer_communication.list',
        resourceId: employerId ?? 'all',
        details: { returned: visible.length, withheldForCaseAuthority: rows.length - visible.length, truncated: rows.length === LIST_LIMIT },
      })
      return { visible, truncated: rows.length === LIST_LIMIT }
    })

    return standardSuccessResponse(result.visible, { pageSize: LIST_LIMIT, hasMore: result.truncated })
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to list communications')
  }
})
