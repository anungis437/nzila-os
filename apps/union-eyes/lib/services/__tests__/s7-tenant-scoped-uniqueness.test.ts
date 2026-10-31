import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('S7 tenant-scoped uniqueness (platform 0042)', () => {
  const declarations: Array<[string, string[]]> = [
    ['db/schema/collective-agreements-schema.ts', ['uq_collective_agreements_org_cba_number']],
    ['db/schema/domains/agreements/collective-agreements.ts', ['uq_collective_agreements_org_cba_number']],
    ['db/schema/domains/scheduling/training.ts', ['uq_training_courses_org_course_code', 'uq_course_sessions_org_session_code', 'uq_member_certifications_org_certification_number']],
    ['db/schema/education-training-schema.ts', ['uq_training_courses_org_course_code', 'uq_course_sessions_org_session_code', 'uq_member_certifications_org_certification_number']],
    ['db/schema/domains/health-safety/health-safety-schema.ts', ['uq_workplace_incidents_org_incident_number', 'uq_safety_inspections_org_inspection_number', 'uq_hazard_reports_org_report_number', 'uq_ppe_equipment_org_item_number']],
    ['db/schema/domains/infrastructure/organizing.ts', ['uq_organizing_campaigns_org_campaign_code']],
    ['db/schema/organizing-tools-schema.ts', ['uq_organizing_campaigns_org_campaign_code']],
  ]
  it.each(declarations)('%s declares the per-organization unique index and no global one', (file, names) => {
    const source = read(file)
    for (const name of names) expect(source).toContain(name)
    expect(source).not.toMatch(/(cbaNumber|campaignCode|incidentNumber|inspectionNumber|reportNumber|itemNumber): varchar\([^)]*\{[^}]*\}\)[^,]*\.unique\(\)/)
    expect(source).not.toMatch(/unique\("(training_courses_course_code_key|course_sessions_session_code_key|member_certifications_certification_number_key)"\)/)
  })

  it('names every table of the migration in its rollback and registers both', () => {
    const forward = read('db/migrations-platform/0042_tenant_scoped_uniqueness.sql')
    const rollback = read('db/migrations-platform/0042_tenant_scoped_uniqueness.rollback.sql')
    for (const table of ['collective_agreements', 'training_courses', 'course_sessions', 'member_certifications', 'workplace_incidents', 'safety_inspections', 'hazard_reports', 'ppe_equipment', 'organizing_campaigns']) {
      expect(forward).toContain(`'${table}'`)
      expect(rollback).toContain(`'${table}'`)
    }
    expect(read('db/migrations-platform/meta/_journal.json')).toContain('0042_tenant_scoped_uniqueness')
  })
})
