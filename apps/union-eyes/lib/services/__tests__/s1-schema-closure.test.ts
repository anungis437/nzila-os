import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { computeKpiHealth, kpiLowerIsBetter } from '@/lib/kpi/health'
import { isUniqueViolation } from '@/lib/db/unique-violation'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('S1 schema closure of the partial Gate 0 fixes (migration 0038)', () => {
  it('lets a stored KPI direction decide, and reads thresholds only when none is stored', () => {
    expect(kpiLowerIsBetter(90, 70, 50, 'lower_is_better')).toBe(true)
    expect(kpiLowerIsBetter(5, 8, 12, 'higher_is_better')).toBe(false)
    expect(kpiLowerIsBetter(5, 8, 12, null)).toBe(true)
    expect(computeKpiHealth(20, 10, 15, 30, 'lower_is_better')).toBe('at_risk')
    expect(computeKpiHealth(20, 10, 15, 30, 'higher_is_better')).toBe('critical')
  })

  it('recognises a unique violation directly and through a wrapped cause', () => {
    expect(isUniqueViolation(Object.assign(new Error('x'), { code: '23505' }))).toBe(true)
    expect(isUniqueViolation({ cause: { code: '23505' } })).toBe(true)
    expect(isUniqueViolation(new Error('duplicate key value violates unique constraint "a"'))).toBe(true)
    expect(isUniqueViolation(new Error('boom'))).toBe(false)
  })

  it('declares every column and index the migration adds', () => {
    for (const file of ['db/schema/analytics.ts', 'db/schema/domains/analytics/analytics.ts']) expect(read(file)).toContain("direction: text('direction')")
    expect(read('db/schema/committee-workspace-schema.ts')).toContain("minutesRecordedBy: text('minutes_recorded_by')")
    expect(read('db/schema/domains/infrastructure/exit-interviews.ts')).toContain("submittedBy: text('submitted_by')")
    for (const file of ['db/schema/cms-website-schema.ts', 'db/schema/domains/infrastructure/cms.ts']) expect(read(file)).toContain("submittedBy: text('submitted_by')")
    expect(read('db/schema/domains/communications/employer-communications.ts')).toContain('employer_contacts_one_primary_per_employer_idx')
    const sso = read('db/schema/sso-scim-schema.ts')
    expect(sso).toContain('sso_providers_org_saml_entity_idx')
    expect(sso).toContain('sso_providers_org_oidc_issuer_client_idx')
  })

  it('records and checks the actual recorder, submitter and publisher, with the earlier fallback only for rows that predate the column', () => {
    expect(read('lib/services/committee-workspace-service.ts')).toContain('minutesRecordedBy: updatedBy')
    expect(read('app/api/committees/[id]/meetings/[meetingId]/minutes/route.ts')).toContain('meeting.minutesRecordedBy ?? meeting.updatedBy')
    expect(read('app/api/exit-interviews/[id]/submit/route.ts')).toContain('submittedBy: userId!')
    expect(read('app/api/exit-interviews/[id]/review/route.ts')).toContain('existing.submittedBy ?? existing.updatedBy')
    const content = read('app/api/content/templates/[id]/status/route.ts')
    expect(content).toContain('submitted_by = ${userId}')
    expect(content).toContain('current.submitted_by ?? current.updated_by')
  })

  it('archives templates and distribution lists with their is_active flag and lists only active ones (no schema change needed)', () => {
    const factory = read('lib/api/crud-factory.ts')
    expect(factory).toContain('archiveColumn?: string')
    expect(factory).toContain('[opts.archiveColumn as string]: false')
    for (const route of ['app/api/communications/templates/[id]/route.ts', 'app/api/messaging/templates/[id]/route.ts', 'app/api/communications/distribution-lists/[id]/route.ts']) {
      expect(read(route), route).toContain("archiveColumn: 'isActive'")
    }
    for (const route of ['app/api/communications/templates/route.ts', 'app/api/messaging/templates/route.ts', 'app/api/communications/distribution-lists/route.ts']) {
      expect(read(route), route).toContain('IS NOT FALSE')
    }
  })

  it('accepts a KPI direction on create, required groups on an SSO provider, and answers a lost race with 409', () => {
    expect(read('app/api/targets/route.ts')).toContain("direction: z.enum(['higher_is_better', 'lower_is_better'])")
    expect(read('app/api/targets/summary/route.ts')).toContain('cfg.direction')
    const sso = read('app/api/enterprise/sso/providers/route.ts')
    expect(sso).toContain('requireGroups must be a list of at most 50 group names')
    expect(sso).toContain('isUniqueViolation(error)')
    expect(read('app/api/employers/communications/contacts/route.ts')).toContain('This employer already has a primary contact')
  })
})
