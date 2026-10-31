import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mergeSettings, organizationPatchSchema } from '@/lib/organizations/profile-input'
import { agreementCreateSchema } from '@/lib/agreements/agreement-input'
import { SLA_MODEL_VERSION } from '@/lib/ml/sla-breach-score'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('S5 input validation and bounds', () => {
  describe('organization profile update (DEF-0B9-ORG-ITEM-PATCH-BODY-UNVALIDATED...)', () => {
    it('accepts a well-formed partial update', () => {
      expect(organizationPatchSchema.safeParse({ name: 'Local 7', slug: 'Local-7', email: 'a@b.ca', website: 'https://local7.example', sectors: ['health'] }).success).toBe(true)
    })
    it('lowercases the slug and refuses a malformed one', () => {
      expect(organizationPatchSchema.parse({ slug: 'Local-7' }).slug).toBe('local-7')
      for (const slug of ['a', 'has space', '-lead', 'trail-', 'dou--ble', 'x'.repeat(101)]) expect(organizationPatchSchema.safeParse({ slug }).success, slug).toBe(false)
    })
    it('refuses an invalid e-mail or website, a non-http address, unknown keys, and an oversized settings object', () => {
      expect(organizationPatchSchema.safeParse({ email: 'not-an-email' }).success).toBe(false)
      expect(organizationPatchSchema.safeParse({ website: 'javascript:alert(1)' }).success).toBe(false)
      expect(organizationPatchSchema.safeParse({ website: 'ftp://files.example' }).success).toBe(false)
      expect(organizationPatchSchema.safeParse({ memberCount: 5 }).success).toBe(false)
      expect(organizationPatchSchema.safeParse({ settings: { blob: 'x'.repeat(20_000) } }).success).toBe(false)
      expect(organizationPatchSchema.safeParse({ sectors: 'health' }).success).toBe(false)
    })
    it('merges settings key by key instead of replacing them', () => {
      expect(mergeSettings({ perCapitaRate: 2, remittanceDay: 15 }, { remittanceDay: 20 })).toEqual({ perCapitaRate: 2, remittanceDay: 20 })
      expect(mergeSettings(null, { a: 1 })).toEqual({ a: 1 })
      expect(mergeSettings([1, 2], { a: 1 })).toEqual({ a: 1 })
    })
    it('answers a taken slug as a conflict and malformed JSON as a bad request', () => {
      const route = read('app/api/organizations/[id]/route.ts')
      expect(route).toContain("'slug-taken'")
      expect(route).toContain('isUniqueViolation(error)')
      expect(route).toContain('Request body must be valid JSON')
    })
  })

  describe('agreement creation (DEF-0B2-AGREEMENTS-BODY-UNVALIDATED)', () => {
    const valid = { cbaNumber: 'C-1', title: 'CBA', jurisdiction: 'ontario', employerName: 'Acme', unionName: 'Local 7', effectiveDate: '2026-01-01', expiryDate: '2028-01-01', industrySector: 'mfg' }
    it('accepts a complete agreement and fills the defaults', () => {
      const parsed = agreementCreateSchema.parse(valid)
      expect(parsed).toMatchObject({ language: 'en', status: 'active', signedDate: null, documentUrl: null })
    })
    it('refuses a missing required field, a bad enum, inverted dates and a non-https document', () => {
      expect(agreementCreateSchema.safeParse({ ...valid, title: undefined }).success).toBe(false)
      expect(agreementCreateSchema.safeParse({ ...valid, jurisdiction: 'mars' }).success).toBe(false)
      expect(agreementCreateSchema.safeParse({ ...valid, expiryDate: '2025-01-01' }).success).toBe(false)
      expect(agreementCreateSchema.safeParse({ ...valid, documentUrl: 'http://insecure.example/a.pdf' }).success).toBe(false)
    })
    it('does not read organization, publication or authorship from the body', () => {
      const parsed = agreementCreateSchema.parse({ ...valid, organizationId: 'x', isPublic: true, createdBy: 'y' }) as Record<string, unknown>
      expect(parsed).not.toHaveProperty('organizationId')
      expect(parsed).not.toHaveProperty('isPublic')
      expect(parsed).not.toHaveProperty('createdBy')
    })
  })

  it('bounds the committee meeting and intelligence lists, the content lists and the pension-style pages through listPage', () => {
    expect(read('app/api/committees/[id]/meetings/route.ts')).toContain('listPage(request, 200, 50)')
    expect(read('app/api/committees/[id]/intelligence/route.ts')).toContain('listPage(request, 100, 20)')
    expect(read('app/api/content/training/route.ts')).toContain('LIMIT ${page.limit} OFFSET ${page.offset}')
    expect(read('app/api/content/templates/route.ts')).toContain('LIMIT ${page.limit} OFFSET ${page.offset}')
    expect(read('app/api/content/templates/route.ts')).not.toContain("Number(url.searchParams.get('limit'))")
  })

  it('rate-limits the three anonymous ICRA reads with the capability bucket before any lookup', () => {
    for (const route of ['app/api/icra/start/route.ts', 'app/api/icra/[assessmentId]/profile/route.ts', 'app/api/icra/report/[assessmentId]/route.ts']) {
      const source = read(route)
      expect(source, route).toContain("bucket: 'capability', readBody: false")
      expect(source.indexOf('guardPublicIntake(request'), route).toBeLessThan(source.indexOf('withSystemContext('))
    }
  })

  it('validates the geofence body: typed coordinates, bounded radius, known type, no unverifiable strike id', () => {
    const route = read('app/api/location/geofence/route.ts')
    expect(route).toContain('locationGeofenceSchema.safeParse(raw)')
    expect(route).toContain("z.enum(['strike_line', 'union_hall', 'safety_zone'])")
    expect(route).toContain('MAX_RADIUS_METERS')
    expect(route).toContain('strikeId is not accepted')
    expect(route).not.toContain('const body = await req.json()')
  })

  it('lets only the version the scorer implements be named, so no model row is created for a typed string', () => {
    expect(SLA_MODEL_VERSION).toBe('sla-risk-v1')
    const route = read('app/api/ml/predictions/sla-breach-risk/route.ts')
    expect(route).toContain('z.literal(SLA_MODEL_VERSION)')
    expect(route).toContain('const selectedVersion = SLA_MODEL_VERSION')
  })

  it('serves administrator-only CLC analytics with a private, uncacheable response (DEF-0B1-CLC-PUBLIC-CACHE-CONTROL, verified existing implementation)', () => {
    for (const name of ['trends', 'multi-year-trends', 'annual-report', 'forecast']) {
      const source = read(`app/api/admin/clc/analytics/${name}/route.ts`)
      expect(source, name).toContain("'Cache-Control': 'private, no-store'")
      expect(source, name).not.toMatch(/Cache-Control'?:\s*'public/)
    }
  })

  it('answers the dues payment history as payments only, paged, without the processor reference', () => {
    const route = read('app/api/portal/dues/pay/route.ts')
    expect(route).toContain("eq(memberDuesLedger.transactionType, 'payment')")
    expect(route).toContain('listPage(req, 100, 20)')
    expect(route.slice(route.indexOf('export async function GET'), route.indexOf('export async function POST'))).not.toContain('paymentReference')
  })
})
