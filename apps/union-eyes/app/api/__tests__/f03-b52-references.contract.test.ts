import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('B52 references in a body name rows of the caller organization', () => {
  it('checks the course of a training session and keeps its figures out of the body (DEF-0B6-EDU-SESSION-COURSE-ID-NOT-VERIFIED-TO-ORGANIZATION)', () => {
    const route = read('app/api/education/sessions/route.ts')
    expect(route).toContain("{ field: 'courseId', value: values.courseId, table: trainingCourses }")
    const writable = route.slice(route.indexOf('writableFields:'), route.indexOf('beforeCreate'))
    for (const server of ['registrationCount', 'attendeesCount', 'completionsCount', 'averageRating', 'completionRate', 'actualCost', 'sessionStatus', 'organizationId']) {
      expect(writable, server).not.toContain(`'${server}'`)
    }
  })

  it('checks the employer, grievance, contact and template of a logged communication before any write (DEF-0B6-EMP-COMMUNICATION-REFERENCES-UNVERIFIED)', () => {
    const route = read('app/api/employers/communications/route.ts')
    const check = route.indexOf('await assertOrganizationOwns([')
    expect(check).toBeGreaterThan(0)
    expect(check).toBeLessThan(route.indexOf('withRLSContext({ organizationId }, async (tx) =>'))
    for (const field of ['employerId', 'grievanceId', 'recipientContactId', 'templateId']) {
      expect(route).toContain(`field: '${field}'`)
    }
    expect(route).toContain('.limit(200)')
  })
})
