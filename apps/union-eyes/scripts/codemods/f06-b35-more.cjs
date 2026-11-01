const fs = require('fs')
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`${f}: missing ${a.slice(0, 70)}`)
    s = s.split(a).join(b)
  }
  fs.writeFileSync(f, s)
}
edit('app/api/clauses/[id]/route.ts', [
  [`      // Fetch clause
      const clause = await getClauseForOrganization(organizationId, id, { countView: true });`, `      // A GET is a read: it no longer increments the clause's view counter.
      const clause = await getClauseForOrganization(organizationId, id, { countView: false });`],
])
edit('app/api/__tests__/clauses-id.route.test.ts', [
  [`toHaveBeenCalledWith('org-1', 'k1', { countView: true });`, `toHaveBeenCalledWith('org-1', 'k1', { countView: false });`],
])
fs.writeFileSync('lib/api/__tests__/f06-b35-records.contract.test.ts', `import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(join(__dirname, '..', '..', '..', relative), 'utf8')

describe('F06 audit reads, aliases and read-only GETs', () => {
  // DEF-0B6-CMP-AUDIT-LOG-FULL-ROW-READ-BY-OFFICER
  it('the organization audit-log list names its columns and serves none of the captured values or network details', () => {
    const source = read('app/api/compliance/audit-logs/route.ts')
    const get = source.slice(source.indexOf('export const GET ='), source.indexOf('export const POST ='))
    expect(get).toContain('auditId: auditLogs.auditId')
    expect(get).not.toMatch(/\\.select\\(\\)/)
    for (const column of ['ipAddress', 'userAgent', 'oldValues', 'newValues', 'sessionId', 'correlationId', 'metadata', 'errorMessage', 'archivedPath']) {
      expect(get, column).not.toContain(\`auditLogs.\${column}\`)
    }
  })

  // DEF-0B8-JUR-INVESTIGATIONS-PATH-IS-THE-CASE-COLLECTION-NO-INVESTIGATION-RECORD,
  // DEF-0B8-JUR-INVESTIGATIONS-AUDIT-PATH-RETURNS-THE-WHOLE-ORGANIZATION-AUDIT-LOG, DEF-0B8-JUR-ALIAS-WRAPPERS-CARRY-AN-ALWAYS-TRUE-ORG-GUARD
  it.each(['investigations', 'investigations/audit'])('%s answers 501 and no longer delegates to another route', (route) => {
    const source = read(\`app/api/\${route}/route.ts\`)
    expect(source).toContain('ApiError.notImplemented(')
    expect(source).not.toContain('requireOrgAccess')
    expect(source).not.toMatch(/Delegate(GET|POST)/)
  })

  // DEF-0B4-CLAUSES-ITEM-GET-WRITES-VIEW-COUNT
  it('reading a clause by id writes nothing', () => {
    expect(read('app/api/clauses/[id]/route.ts')).toContain('{ countView: false }')
    expect(read('app/api/clauses/[id]/route.ts')).not.toContain('countView: true')
  })

  // DEF-0B8-JUR-LOCATION-TRACK-WRITES-ARE-UNAUDITED-AND-REFUSALS-ANSWER-500
  it('a tracked position is written through the caller\\'s transaction together with its audit record', () => {
    const source = read('app/api/location/track/route.ts')
    expect(source).toContain('trackLocation({')
    expect(source.indexOf('persistAtomicAudit(tx')).toBeGreaterThan(source.indexOf('trackLocation({'))
    expect(read('services/geofence-privacy-service.ts')).toContain('static async trackLocation(tracking: LocationTrackingRequest, tx: RLSTx = db)')
  })
})
`)
console.log('ok')
