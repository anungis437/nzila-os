import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getCUPEVocabulary } from '@nzila/cupe-vocabulary'
import { deprecationSunset } from '@/lib/api/deprecation'
import { parseJurisdictionCode } from '@/app/api/jurisdiction-rules/route'
import { PgDialect } from 'drizzle-orm/pg-core'
import { listFilterConditions } from '@/lib/api/crud-factory'
import { workplaceIncidents } from '@/db/schema'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B66/S09: small platform fixes and row integrity', () => {
  it('reports a vocabulary revision that does not change with the time of the call', () => {
    const first = getCUPEVocabulary()
    const second = getCUPEVocabulary()
    expect(first.lastUpdated).toBe(second.lastUpdated)
    expect(first.contentDigest).toBe(second.contentDigest)
    expect(first.contentDigest).toMatch(/^[0-9a-f]{8}$/)
    expect(new Date(first.lastUpdated).getTime()).toBeLessThan(Date.now())
    // Changing any entry changes the digest, so a client can tell revisions of one version apart.
    expect(src('../../packages/cupe-vocabulary/src/vocabulary.ts')).toContain('JSON.stringify([CUPE_CASE_TYPES, CUPE_PRIORITIES, CUPE_SEVERITIES, CUPE_ROLES, CUPE_STATUSES])')
  })

  it('computes whether the sunset has passed from the clock rather than printing a stored answer', () => {
    expect(deprecationSunset(new Date('2026-01-01T00:00:00Z'))).toEqual({ sunset: '2026-07-07T00:00:00.000Z', sunsetPassed: false })
    expect(deprecationSunset(new Date('2026-07-07T00:00:00Z')).sunsetPassed).toBe(true)
    const route = src('app/api/deprecations/route.ts')
    expect(route).toContain('...deprecationSunset()')
    expect(route).not.toContain("sunset: '2026-07-07")
  })

  it('takes the triage designation id from the query string and keeps a bounded body fallback', () => {
    const route = src('app/api/triage-designations/route.ts')
    expect(route).toContain("searchParams.get('designationId')")
    expect(route).toContain('text.length > 1024')
    expect(route).not.toContain('body: revokeSchema')
  })

  it('refuses inherited and unknown jurisdiction codes', () => {
    expect(parseJurisdictionCode('CA-ON')).toBe('ON')
    for (const code of ['constructor', '__proto__', 'hasOwnProperty', 'CA-ZZ', '']) expect(parseJurisdictionCode(code)).toBeNull()
  })

  it('upserts the jurisdiction preference against the unique row and validates its flags', () => {
    const route = src('app/api/precedents/jurisdiction-preferences/route.ts')
    expect(route).toContain('.onConflictDoUpdate({')
    expect(route).toContain('must be a boolean')
    expect(src('db/schema/domains/member/jurisdiction-preferences.ts')).toContain("uniqueIndex('member_jurisdiction_preferences_user_org_uq')")
  })

  it('checks an employer parent against the caller organization on create and update', () => {
    const collection = src('app/api/employers/route.ts')
    const item = src('app/api/employers/[id]/route.ts')
    for (const route of [collection, item]) expect(route).toContain("field: 'parentCompanyId'")
    expect(collection).toContain('beforeCreate')
    expect(collection).toContain('mapCreateError: mapParentError')
    expect(item).toContain('beforeUpdate')
    expect(item).toContain('cannot be its own parent')
  })

  it('pins an external document download to the version its grant covers', () => {
    const download = src('app/api/external/documents/[id]/download/route.ts')
    expect(download).toContain('decision.documentVersionNo')
    expect(download).toContain('eq(documentVersions.versionNo, pinned)')
    expect(src('app/api/external/grievances/[id]/documents/upload/route.ts')).toContain('documentVersionNo: 1')
    expect(src('lib/services/external-resource-authorization-service.ts')).toContain('documentVersionNo:')
    expect(src('db/schema/representation-authority-schema.ts')).toContain("integer('document_version_no')")
  })

  it('reads the external grievance projection from the columns the table really has', () => {
    const route = src('app/api/external/grievances/[id]/route.ts')
    expect(route).toContain('caseNumber: grievances.grievanceNumber')
    // The description is internal union material and is no longer part of the external projection (commit 2e7905bb0).
    expect(route).not.toContain('summary: grievances.description')
    expect(route).not.toMatch(/\.select\(\)\s*\.from\(grievances\)/)
  })

  it('keeps what identified a deleted report and a retained precedent in the audit', () => {
    expect(src('app/api/reports/[id]/route.ts')).toContain("hardDeleteAuditColumns: ['name', 'reportType', 'category', 'isPublic', 'createdBy']")
    const factory = src('lib/api/crud-factory.ts')
    expect(factory).toContain('removed: describe(row)')
    const precedent = src('app/api/precedents/[id]/route.ts')
    expect(precedent).toContain('has citation history and is retained')
    expect(precedent).toContain('removedTagCount')
  })

  it('applies list filters to the incident and hazard lists and refuses a value outside an enum', () => {
    const dialect = new PgDialect()
    const filters = { equals: { status: 'status', severity: 'severity' }, search: ['incidentNumber', 'description'] }
    const built = listFilterConditions(filters, workplaceIncidents, new URLSearchParams('status=reported&severity=critical&search=50%25_off'))
    expect(built).toHaveLength(3)
    const sql = built.map((c) => dialect.sqlToQuery(c))
    expect(sql[0].sql).toContain('"status" = $1')
    expect(sql[0].params).toEqual(['reported'])
    expect(sql[2].params).toEqual(['%50\\%\\_off%', '%50\\%\\_off%'])
    expect(listFilterConditions(filters, workplaceIncidents, new URLSearchParams('status=all&severity='))).toEqual([])
    expect(() => listFilterConditions(filters, workplaceIncidents, new URLSearchParams('severity=galaxy'))).toThrow(/Invalid severity filter/)
    expect(() => listFilterConditions(filters, workplaceIncidents, new URLSearchParams('search=' + 'x'.repeat(101)))).toThrow(/at most 100/)
    expect(listFilterConditions(undefined, workplaceIncidents, new URLSearchParams('status=reported'))).toEqual([])
    expect(src('app/api/health-safety/incidents/route.ts')).toContain('listFilters')
    expect(src('app/api/health-safety/hazards/route.ts')).toContain("priority: 'hazardLevel'")
  })

  it('keeps archived and unscoped rows out of every health and safety read and aggregate', () => {
    for (const path of ['stats', 'inspections/stats', 'inspections/findings', 'incidents/stats', 'hazards/stats']) {
      const route = src('app/api/health-safety/' + path + '/route.ts')
      expect(route, path).toContain('Organization context required')
      expect(route, path).not.toMatch(/organizationId \? sql/)
    }
    for (const path of ['incidents', 'incidents/[id]', 'hazards', 'hazards/[id]']) {
      expect(src('app/api/health-safety/' + path + '/route.ts'), path).toMatch(/readCondition: ne\(\w+\.status, 'archived'\)/)
    }
    expect(src('app/api/health-safety/dashboard/route.ts')).toContain("status NOT IN ('resolved','closed','archived')")
  })
})
