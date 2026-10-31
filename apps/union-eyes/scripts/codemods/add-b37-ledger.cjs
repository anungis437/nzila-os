const fs = require('fs')
const path = require('path')
fs.writeFileSync('lib/api/__tests__/f07-b37-object-access.contract.test.ts', `import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(join(__dirname, '..', '..', '..', relative), 'utf8')

describe('F07 object-level reads', () => {
  // DEF-0B5-COMMITTEE-READ-IGNORES-MEMBERSHIP
  it.each(['action-items', 'documents', 'meetings', 'meetings/[meetingId]', 'meetings/[meetingId]/attendance'])(
    'committees/[id]/%s reads only through the committee reader check',
    (route) => {
      const source = read(\`app/api/committees/[id]/\${route}/route.ts\`)
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
`)
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const ID = 'B37-F07-COMMITTEE-WORKING-RECORD-AND-VERIFIED-OBJECT-READS'
if (ledger.batches.some((b) => b.id === ID)) { console.log('B37 present'); process.exit(0) }
const A = 'apps/union-eyes/'
const C = A + 'lib/api/__tests__/f07-b37-object-access.contract.test.ts'
const F07 = A + 'lib/api/__tests__/f07-read-authority.contract.test.ts'
const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files, explanation, ...extra })
ledger.batches.push({
  id: ID,
  family: 'F07: a committee\'s working record is read by staff and its own members, and a read names only what the caller may see',
  evidenceCommit: null,
  items: [
    item('DEF-0B5-COMMITTEE-READ-IGNORES-MEMBERSHIP', [A + 'lib/services/committee-read-access.ts', A + 'lib/services/__tests__/committee-read-access.test.ts', A + 'app/api/committees/[id]/action-items/route.ts', A + 'app/api/committees/[id]/documents/route.ts', A + 'app/api/committees/[id]/meetings/route.ts', A + 'app/api/committees/[id]/meetings/[meetingId]/route.ts', A + 'app/api/committees/[id]/meetings/[meetingId]/attendance/route.ts', C],
      'The five committee read routes (meetings, meeting detail, attendance, action items, documents) require the committee to be the organization\'s and the reader to be staff or an active member of that committee; any other member gets the not-found answer. Tests cover staff, an active member, an outsider, no identity and another organization\'s committee.',
      { status: 'PARTIAL', remaining: 'The committee directory entry itself stays readable by every member (without notes), and the minutes read is steward-level but not checked against membership.' }),
    item('DEF-0B6-EDU-SESSION-READ-EXPOSES-ACCESS-CODE-AND-COSTS', [A + 'app/api/education/sessions/route.ts', F07],
      'A session read omits the virtual-meeting access code and the session budget and actual cost (existing implementation, pinned by the F07 contract test).'),
    item('DEF-0B8-HS-STATUS-AND-OUTCOME-FIELDS-WRITABLE-WITHOUT-WORKFLOW', [A + 'app/api/health-safety/incidents/[id]/route.ts', A + 'app/api/health-safety/hazards/[id]/route.ts', A + 'app/api/health-safety/inspections/[id]/route.ts', F07],
      'The incident, hazard and inspection item routes block a status or outcome PATCH (existing implementation, pinned by the F07 contract test).'),
    item('DEF-0B10-OPL-09', [A + 'app/api/organizations/switch/route.ts', F07],
      'A legacy organization switch needs an active, non-removed membership of an active organization (B21 implementation, pinned by the F07 contract test).'),
    item('DEF-0B6-EDU-COMPLETIONS-ROUTE-NOT-FILTERED-TO-COMPLETED', [A + 'app/api/education/completions/route.ts', C],
      'The completions list reads only completed registrations of the caller\'s organization.'),
    item('DEF-0B7-PLT-EVENT-ITEM-IGNORES-PRIVATE-VISIBILITY-AND-RETURNS-MEETING-PASSWORD', [A + 'app/api/events/[id]/route.ts', A + 'app/api/calendar/events/[id]/route.ts', A + 'lib/calendar/event-visibility.ts', A + 'lib/calendar/event-visibility.test.ts', C],
      'The legacy event item delegates to the canonical calendar route, which applies private and confidential visibility and selects no meeting password or access code.'),
  ],
})
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B37 added')
