import { describe, expect, it } from 'vitest'
import { isCalendarDate, mergeSettings, organizationPatchSchema } from '../profile-input'

describe('organizationPatchSchema', () => {
  it('takes the profile fields an organization administrator may change, each optional', () => {
    expect(organizationPatchSchema.safeParse({}).success).toBe(true)
    expect(
      organizationPatchSchema.safeParse({
        name: ' CUPE Local 1000 ',
        slug: 'cupe-local-1000',
        description: ' Public-sector local ',
        status: 'active',
        parent_id: null,
        settings: { sector: 'education' },
      }).success,
    ).toBe(true)
  })

  it('takes a description, trims it, bounds it, and lets it be cleared', () => {
    expect(organizationPatchSchema.parse({ description: '  Public-sector local  ' }).description).toBe('Public-sector local')
    expect(organizationPatchSchema.parse({ description: null }).description).toBeNull()
    expect(organizationPatchSchema.safeParse({ description: 'x'.repeat(2001) }).success).toBe(false)
    expect(organizationPatchSchema.safeParse({ description: 42 }).success).toBe(false)
  })

  it('takes a charter number and an affiliation date, which are columns of the organization, and refuses a day that does not exist', () => {
    expect(organizationPatchSchema.parse({ charter_number: ' C-77 ', affiliation_date: '2019-05-01' })).toMatchObject({ charter_number: 'C-77', affiliation_date: '2019-05-01' })
    expect(organizationPatchSchema.parse({ charter_number: null, affiliation_date: null })).toEqual({ charter_number: null, affiliation_date: null })
    for (const date of ['2020-02-31', '2020-13-01', '05/01/2019', '2019-5-1', '']) expect(organizationPatchSchema.safeParse({ affiliation_date: date }).success, date).toBe(false)
    expect(organizationPatchSchema.safeParse({ charter_number: 'x'.repeat(101) }).success).toBe(false)
    expect(isCalendarDate('2024-02-29')).toBe(true)
    expect(isCalendarDate('2023-02-29')).toBe(false)
  })

  it('refuses a key it does not list rather than dropping it, so a screen that sends one learns of it', () => {
    for (const body of [{ type: 'union' }, { organization_type: 'union' }, { organizationType: 'union' }, { id: '1' }]) {
      expect(organizationPatchSchema.safeParse(body).success, JSON.stringify(body)).toBe(false)
    }
  })

  it('refuses malformed values: a slug that is not lowercase words, a parent that is not a guid, a website that is not http(s)', () => {
    expect(organizationPatchSchema.safeParse({ slug: 'Not A Slug' }).success).toBe(false)
    expect(organizationPatchSchema.safeParse({ parent_id: 'abc' }).success).toBe(false)
    expect(organizationPatchSchema.safeParse({ website: 'ftp://example.test' }).success).toBe(false)
  })
})

describe('mergeSettings', () => {
  it('merges key by key so a patch naming one key does not erase the others', () => {
    expect(mergeSettings({ rate: 1, day: 5 }, { rate: 2 })).toEqual({ rate: 2, day: 5 })
    expect(mergeSettings(null, { a: 1 })).toEqual({ a: 1 })
    expect(mergeSettings([1], { a: 1 })).toEqual({ a: 1 })
  })
})
