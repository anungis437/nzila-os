import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CBA_DATASET_AUTHORITY, reviewStatusFilter } from '@/lib/services/cba-intelligence/review-visibility'
import { clientAddress } from '@/lib/public-intake/guard'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B80: CBA review visibility, analytics honesty and organization binding', () => {
  it('shows a reader only approved extractions and lets only a curator name a status', () => {
    expect(reviewStatusFilter(false, undefined)).toBe('approved')
    expect(reviewStatusFilter(false, 'pending_review')).toBe('approved')
    expect(reviewStatusFilter(true, 'pending_review')).toBe('pending_review')
    expect(reviewStatusFilter(true, undefined)).toBeUndefined()
  })

  // DEF-0B4-CBA-INTEL-SHARED-DATASET-NO-TENANT-PREDICATE (F03-B): the review queue was decided by an organization steward floor, which is a role title in
  // one organization and no authority over a dataset every organization reads and the platform curates.
  it('applies the visibility rule to the list, the export and the agreement with its wages and clauses, decided by platform authority and never a role floor', () => {
    expect(src('app/api/cba-intelligence/agreements/route.ts')).toContain('reviewStatusFilter(await canReadUnreviewed(userId)')
    expect(src('app/api/cba-intelligence/agreements/export/route.ts')).toContain('reviewStatusFilter(await canReadUnreviewed(userId)')
    const item = src('app/api/cba-intelligence/agreements/[id]/route.ts')
    expect(item).toContain('(!curator && agreement.reviewStatus !== "approved")')
    expect(item).toContain('approvedOnly: !curator')
    for (const route of ['agreements', 'agreements/export', 'agreements/[id]', 'benchmark/[id]']) {
      expect(src(`app/api/cba-intelligence/${route}/route.ts`), route).not.toMatch(/hasMinRole\(\s*["']steward["']\s*\)/)
    }
  })

  it('states who curates the shared dataset and who may read it, and holds no organization\'s own data', () => {
    expect(CBA_DATASET_AUTHORITY).toMatchObject({
      scope: 'platform_shared',
      holdsTenantData: false,
      curator: 'platform_staff',
      unreviewedVisibleTo: 'platform_staff',
      readers: { entitlement: 'commercial_reporting', floor: 'member', sees: 'approved' },
      readerScopeApprovedBy: null,
    })
    expect(Object.isFrozen(CBA_DATASET_AUTHORITY)).toBe(true)
  })

  it('does not return who saved a benchmark snapshot', () => {
    expect(src('lib/services/cba-intelligence/benchmark-service.ts')).toContain('({ computedBy: _computedBy, ...snapshot })')
  })

  it('does not attach fixed recommendation sentences to a clause comparison', () => {
    const service = src('lib/services/clause-service.ts')
    expect(service).not.toContain('Consider standardizing clause language')
    expect(service).toContain("result.analysis = 'grouped_by_type_only'")
  })

  it('gives an organization officer only the cognition health status', () => {
    const route = src('app/api/cognition/health/route.ts')
    expect(route).toContain('if (!(await isSystemAdmin()))')
  })

  it('reads derived case metrics from the claims table and reports no SLA figure it cannot measure', () => {
    const route = src('app/api/analytics/operational/derived-case-metrics/route.ts')
    expect(route).toContain('FROM claims')
    expect(route).not.toContain('FROM pilot_events')
    expect(route).toContain('sla_compliance: null')
    expect(src('app/api/analytics/insights/weekly-summary/route.ts')).toContain('caseCreatedEvents:')
  })

  it('refuses a metrics action whose organization differs from the one the route authorized', () => {
    const actions = src('actions/analytics-actions.ts')
    expect(actions).toContain("throw new Error('Organization context changed during the request')")
    const route = src('app/api/analytics/metrics/route.ts')
    expect(route.match(/expectedOrganizationId: context\.organizationId/g)).toHaveLength(2)
  })

  it('verified: cross-committee synthesis stores nothing and answers 501; the survey responses route is bound to its path survey', () => {
    expect(src('app/api/committees/[id]/intelligence/route.ts')).toContain('ApiError.notImplemented')
    const responses = src('app/api/communications/surveys/[surveyId]/responses/route.ts')
    expect(responses).toContain("createPathBinding: { paramName: 'surveyId', field: 'surveyId' }")
    expect(responses).toContain('eq(surveyResponses.surveyId, surveyId)')
  })

  it('verified: the public contact form keys its limit on the trusted-hop address, not the first forwarded entry', () => {
    const request = (headers: Record<string, string>) => new Request('http://localhost/api/contact', { headers })
    expect(clientAddress(request({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' }))).toBe('203.0.113.9')
    expect(clientAddress(request({ 'cf-connecting-ip': '198.51.100.4', 'x-forwarded-for': '6.6.6.6' }))).toBe('198.51.100.4')
  })
})
