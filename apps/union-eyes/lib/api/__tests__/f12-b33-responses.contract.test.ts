import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(join(__dirname, '..', '..', '..', relative), 'utf8')

describe('F12 responses that state only what was stored or may be shared', () => {
  // DEF-0B12-PLT-VOCABULARY-ROUTES-SET-A-PUBLIC-ONE-HOUR-CACHE-ON-A-SIGNED-IN-RESPONSE
  it.each(['', 'statuses/', 'severities/', 'roles/', 'priorities/', 'case-types/'])(
    'vocabulary/%sroute.ts never lets a shared cache keep a signed-in response',
    (segment) => {
      const source = read(`app/api/vocabulary/${segment}route.ts`)
      expect(source).toContain("'Cache-Control': 'private, max-age=3600'")
      expect(source).not.toMatch(/Cache-Control':\s*'public/)
    },
  )

  // DEF-0B12-PLT-ORGANIZATIONS-RESPONSE-FABRICATES-A-CREATION-TIME-FOR-A-ROW-WITHOUT-ONE
  it('a missing stored time is returned as null, never as the time of the call', () => {
    // The mapping every organization route shares: a date the row does not have is null, and the type is the row's own.
    const wire = read('lib/organizations/organization-wire.ts')
    expect(wire).not.toContain('?? new Date().toISOString()')
    expect(wire).not.toContain("?? 'union'")
    expect(wire).toContain('createdAt: row.createdAt?.toISOString() ?? null')
    expect(wire).toContain('updatedAt: row.updatedAt?.toISOString() ?? null')
    expect(wire).toContain('type: row.organizationType,')

    const source = read('app/api/users/me/organizations/route.ts')
    expect(source).not.toContain('?? new Date().toISOString()')
    expect(source).toContain('organizations: orgs.map(organizationWire)')
    expect(source).toContain('joinedAt: m.joinedAt?.toISOString() ?? m.createdAt?.toISOString() ?? null')

    // Every other place that sends an organization uses the same mapping, so none states a time it does not have or a type it does not know.
    for (const route of ['app/api/organizations/[id]/path/route.ts', 'app/api/organizations/tree/route.ts', 'app/api/organizations/switch/route.ts', 'lib/auth/canonical-organization-selection.ts']) {
      const text = read(route)
      expect(text, route).toContain('organizationWire(')
      expect(text, route).not.toContain('?? new Date().toISOString()')
      expect(text, route).not.toContain("?? 'union'")
    }
  })

  // DEF-0B12-PLT-QUEUE-STATUS-GIVES-ANY-SIGNED-IN-SESSION-THE-QUEUE-COUNTS
  it('queue status is for the control-plane key or a platform administrator, not a signed-in member', () => {
    const source = read('app/api/union-eyes/queue-status/route.ts')
    expect(source).toContain('requireSystemAdmin()')
    expect(source.indexOf('requireSystemAdmin()')).toBeLessThan(source.indexOf('getAllQueueStats()'))
  })

  // DEF-0B8-JUR-BC-TERMINATION-SCHEDULE-HAS-NO-TIER-ABOVE-EIGHT-YEARS, DEF-0B6-EDU-CRON-QUERIES-REFERENCE-COLUMNS-ABSENT-FROM-SCHEMA
  it('the education reminder route runs the schema-checked statements, not inline SQL', () => {
    const source = read('app/api/cron/education-reminders/route.ts')
    expect(source).toContain('sessionReminderQuery')
    expect(source).toContain('expiryWarningQuery')
    expect(source).not.toMatch(/FROM course_registrations/)
  })

  // DEF-0B8-HS-ARCHIVED-ROWS-STILL-READABLE-AND-COUNTED
  it.each([
    ['hazards/route.ts', 'hazardReports'],
    ['hazards/[id]/route.ts', 'hazardReports'],
    ['incidents/route.ts', 'workplaceIncidents'],
    ['incidents/[id]/route.ts', 'workplaceIncidents'],
  ])('health-safety/%s neither lists nor returns an archived record', (route, table) => {
    expect(read(`app/api/health-safety/${route}`)).toContain(`readCondition: ne(${table}.status, 'archived')`)
  })

  it.each(['hazards/stats', 'incidents/stats', 'incidents/trends', 'dashboard'])('health-safety/%s does not count an archived record', (route) => {
    expect(read(`app/api/health-safety/${route}/route.ts`)).toContain("'archived'")
  })

  // DEF-0B12-WBK-CHECKOUT-READS-THE-USER-OWNED-WORKBOOKS-TABLE-OUTSIDE-ANY-DATABASE-CONTEXT
  it('the workbook checkout reads through the system context, not the bare connection', () => {
    const source = read('app/api/workbook/checkout/route.ts')
    expect(source).toContain('withSystemContext(')
    expect(source).not.toContain("from '@/db';")
  })

  // DEF-0B11-PRP-PRECEDENT-SEARCH-USES-UNESCAPED-WILDCARD-LIKE
  it('the precedent search accepts only the filters it reads', () => {
    const source = read('app/api/precedents/search/route.ts')
    expect(source).toContain('.strict()')
    expect(source).toContain('INVALID_PRECEDENT_FILTER')
    expect(source).not.toContain('z.record(z.string(), z.unknown())')
  })
})
