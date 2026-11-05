import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(join(__dirname, '..', '..', '..', relative), 'utf8')

describe('F07 object-level reads', () => {
  // DEF-0B5-COMMITTEE-READ-IGNORES-MEMBERSHIP
  it.each(['action-items', 'documents', 'meetings', 'meetings/[meetingId]', 'meetings/[meetingId]/attendance'])(
    'committees/[id]/%s reads only through the committee reader check',
    (route) => {
      const source = read(`app/api/committees/[id]/${route}/route.ts`)
      const get = source.slice(source.indexOf('export const GET ='), source.indexOf('export const POST =') > 0 ? source.indexOf('export const POST =') : source.indexOf('export const PATCH ='))
      expect(get).toContain('requireCommitteeReader(organizationId, committeeId, userId')
      expect(get).not.toContain('requireCommitteeScope(')
    },
  )

  // DEF-0B7-PLT-EVENT-ITEM-IGNORES-PRIVATE-VISIBILITY-AND-RETURNS-MEETING-PASSWORD
  it('the legacy event item delegates to the canonical route, which applies privacy and selects no meeting password', () => {
    expect(read('app/api/events/[id]/route.ts')).toContain("from '@/app/api/calendar/events/[id]/route'")
    const canonical = read('app/api/calendar/events/[id]/route.ts')
    expect(canonical).toContain('canSeeCalendarEvent(event, userId)')
    expect(canonical).not.toMatch(/[pP]assword|accessCode/)
  })

  // DEF-0B6-EDU-COMPLETIONS-ROUTE-NOT-FILTERED-TO-COMPLETED
  it('the completions list reads only completed registrations of the organization', () => {
    const source = read('app/api/education/completions/route.ts')
    const get = source.slice(source.indexOf('export const GET ='), source.indexOf('const completeSchema'))
    expect(get).toContain('eq(courseRegistrations.completed, true)')
    expect(get).toContain('eq(courseRegistrations.organizationId, organizationId)')
  })
})
