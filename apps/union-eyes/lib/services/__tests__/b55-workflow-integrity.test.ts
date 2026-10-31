import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('B55 workflow integrity', () => {
  it('locks decisions, agenda and status once the minutes are approved (DEF-0B5-COMMITTEE-DECISIONS-EDITABLE-AFTER-APPROVAL)', () => {
    const service = read('lib/services/committee-workspace-service.ts')
    expect(service).toContain("(['decisions', 'agendaItems', 'agenda', 'status'] as const).some((key) => key in changes)")
    expect(service).toContain('touchesApprovedRecord ? isNull(committeeMeetings.minutesApprovedAt) : undefined')
    expect(service).toContain('cannot be changed')
  })

  it('does not let the last editor of the meeting record approve its minutes (DEF-0B5-COMMITTEE-MINUTES-NO-SEPARATION-OF-DUTIES)', () => {
    const route = read('app/api/committees/[id]/meetings/[meetingId]/minutes/route.ts')
    const guard = route.indexOf('recorder === userId')
    expect(guard).toBeGreaterThan(0)
    expect(guard).toBeLessThan(route.indexOf('approveMinutes(meetingId, organizationId, userId!)'))
  })

  it('verifies attendees, assignees and linked documents against the organization (DEF-0B5-COMMITTEE-REFERENCED-IDS-NOT-VERIFIED)', () => {
    expect(read('app/api/committees/[id]/meetings/[meetingId]/attendance/route.ts')).toContain('assertOrganizationMembers(body.attendees.map')
    expect(read('app/api/committees/[id]/action-items/route.ts')).toContain('assertOrganizationMembers([body.assignedTo], organizationId)')
    expect(read('app/api/committees/[id]/documents/route.ts')).toContain("field: 'documentId', value: body.documentId, table: documents")
  })

  it('does not let the last editor review an interview, nor attach documents once it is reviewed (DEF-0B7-EXC-SEPARATION-OF-DUTIES-ONLY-AGAINST-THE-CREATOR, DEF-0B7-EXC-DOCUMENTS-ATTACHABLE-AFTER-REVIEW)', () => {
    expect(read('app/api/exit-interviews/[id]/review/route.ts')).toContain('submitter === userId')
    expect(read('app/api/exit-interviews/[id]/documents/route.ts')).toContain("interview.status === 'reviewed'")
  })

  it('unsubscribes in one transaction and ends list subscriptions too (DEF-0B5-UNSUBSCRIBE-WRITES-NOT-ATOMIC, DEF-0B5-UNSUBSCRIBE-LEAVES-LIST-SUBSCRIPTIONS-ACTIVE)', () => {
    const route = read('app/api/communications/unsubscribe/[recipientId]/route.ts')
    expect(route).toContain('withSystemContext(async (tx) => {')
    const body = route.slice(route.indexOf('withSystemContext(async (tx)'), route.indexOf('return new NextResponse(confirmationHtml'))
    expect(body).not.toMatch(/await db[.\n]/)
    expect(body).toContain('update(newsletterListSubscribers)')
    expect(body).toContain("status: 'unsubscribed', unsubscribedAt")
  })
})
