const fs = require('fs')
const f = 'lib/api/__tests__/f03-tenant-scope.contract.test.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const tail = `  // DEF-0B6-EMP-REPLAY-NO-FINANCIAL-MANDATE`
if (!s.includes(tail)) throw new Error('anchor')
s = s.replace(tail, `  // DEF-0B6-EMP-REMITTANCE-DETAIL-MEMBER-READ
  it('a remittance run detail needs a live financial view mandate and never returns the stored CSV or JSON', () => {
    const source = read('app/api/employer-execution/remittance-runs/[id]/route.ts')
    expect(source).toContain('FINANCIAL_MEMBER_DATA_ROLES')
    expect(source).toContain("action: 'finance:view'")
    expect(source).toContain("eq(employerExecutionArtifacts.artifactType, 'evidence_manifest')")
    expect(source).not.toContain('remittance_csv')
  })

  // DEF-0B2-PLATFORM-DIRECTORY-UNSCOPED-READ
  it.each(['app/api/admin/users/route.ts', 'app/api/admin/stats/activity/route.ts'])(
    '%s records the cross-organization read before running it',
    (route) => {
      const source = read(route)
      expect(source).toContain('performAuditedPlatformRead(')
      expect(source.indexOf('performAuditedPlatformRead(')).toBeLessThan(source.indexOf('.from(organizationMembers)'))
    },
  )

` + tail)
fs.writeFileSync(f, s)
console.log('ok')
