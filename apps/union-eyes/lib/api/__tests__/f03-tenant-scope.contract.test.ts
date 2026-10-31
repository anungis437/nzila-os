import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(join(__dirname, '..', '..', '..', relative), 'utf8')

describe('F03 tenant scope of shared and child records', () => {
  // DEF-0B3-ARBITRATION-DECISIONS-NON-PUBLIC-READABLE-CROSS-TENANT
  it.each(['app/api/arbitration/precedents/route.ts', 'app/api/arbitration/precedents/[id]/route.ts'])(
    '%s never lists a decision marked not public or carrying an access restriction',
    (route) => {
      const source = read(route)
      expect(source).toContain('eq(arbitrationDecisions.isPublic, true)')
      expect(source).toContain('arbitrationDecisions.accessRestrictions')
      expect(source).toContain('readCondition:')
    },
  )

  // DEF-0B4-CBA-CHILD-RECORDS-READ-BY-AGREEMENT-ID-ONLY
  it('clauses and bargaining notes of an agreement are read under the caller\'s organization as well', () => {
    expect(read('lib/services/clause-service.ts')).toContain('eq(cbaClause.organizationId, organizationId)')
    expect(read('lib/services/bargaining-notes-service.ts')).toContain('eq(bargainingNotes.organizationId, organizationId)')
    const route = read('app/api/cbas/[id]/route.ts')
    expect(route).toContain('getClausesByCBAId(id, organizationId)')
    expect(route).toContain('getBargainingNotesByCBA(id, organizationId)')
  })

  // DEF-0B6-EDU-COMPLETIONS-POST-SKIPS-REGISTRATION-CHECKS
  it('a completion is a transition of an existing registration of the organization, never an insert', () => {
    const post = read('app/api/education/completions/route.ts')
    expect(post).not.toContain('.insert(')
    expect(post).toContain('eq(courseRegistrations.organizationId, organizationId)')
    expect(post).toContain('Attended and passed training evidence required')
  })

  // DEF-0B6-EMP-REMITTANCE-DETAIL-MEMBER-READ
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

  // DEF-0B6-EMP-REPLAY-NO-FINANCIAL-MANDATE
  it('a payroll replay needs a live financial view mandate before it reads any item', () => {
    const source = read('app/api/employer-execution/replay/[runId]/route.ts')
    const mandate = source.indexOf('requireLiveFinancialMandate(tx')
    expect(mandate).toBeGreaterThan(0)
    expect(mandate).toBeLessThan(source.indexOf('.from(employerPayrollRuns)'))
    expect(source).toContain('action: "finance:view"')
  })
})
