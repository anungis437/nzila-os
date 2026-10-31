/**
 * Employer Communications API — Contacts & Communications
 *
 * POST /api/employers/communications/contacts   — Add employer contact
 * GET  /api/employers/communications/contacts   — List contacts for employer
 * POST /api/employers/communications             — Log a communication
 * GET  /api/employers/communications             — List communications for employer
 */

import { z } from 'zod'
import { db } from '@/db/db'
import { employerCommunications } from '@/db/schema/domains/communications/employer-communications'
import { withOrganizationAuth } from '@/lib/organization-middleware'
import { hasMinRole } from '@/lib/api-auth-guard'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { emitCapeAuditEvent, CAPE_AUDIT_EVENTS } from '@/lib/audit/cape-audit-events'
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses'
import { eq, desc, and } from 'drizzle-orm'
import { assertOrganizationOwns } from '@/lib/api/org-references'
import { ApiError } from '@/lib/api/errors'
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
  status: z.enum(['draft', 'sent', 'received', 'acknowledged']).default('draft'),
  templateId: z.guid().optional(),
})

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
          senderName: 'System',
          senderUserId: userId,
          templateId: data.templateId,
          sentAt: data.status === 'sent' ? new Date() : undefined,
          createdBy: userId,
        })
        .returning()

      await persistAtomicAudit(tx, {
        userId,
        organizationId,
        resourceType: 'employer_communications',
        action: 'employer_communication.create',
        resourceId: row.id,
        details: { employerId: row.employerId, type: row.type, status: row.status },
      })
      return row
    })

    const eventType =
      data.status === 'sent'
        ? CAPE_AUDIT_EVENTS.EMPLOYER_COMMUNICATION_SENT
        : CAPE_AUDIT_EVENTS.EMPLOYER_COMMUNICATION_LOGGED

    await emitCapeAuditEvent({
      eventType,
      userId,
      organizationId,
      resource: 'employer_communications',
      resourceId: communication.id,
      details: {
        employerId: data.employerId,
        type: data.type,
        subject: data.subject,
      },
    })

    return standardSuccessResponse(communication)
  } catch (error) {
    if (error instanceof ApiError) {
      return standardErrorResponse(error.code, error.message)
    }
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to log communication')
  }
})

// ── GET — List communications ───────────────────────────────────────────────

export const GET = withOrganizationAuth(async (request, context) => {
  const { organizationId } = context

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

    const rows = await db
      .select()
      .from(employerCommunications)
      .where(and(...conditions))
      .orderBy(desc(employerCommunications.createdAt))
      .limit(200)

    return standardSuccessResponse(rows)
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to list communications')
  }
})
