import { describe, expect, it } from 'vitest'
import { escapeLike, listPlatformUsers, maskEmail, MIN_SEARCH_LENGTH, normalizeSearch } from '../user-directory'

// DEF-0B2-PLATFORM-DIRECTORY-UNSCOPED-READ: the projections that keep a cross-organization read to the minimum necessary.
describe('maskEmail', () => {
  it.each([
    ['pat.morgan@example.org', 'p***@example.org'],
    ['a@b.co', 'a***@b.co'],
    ['first.last+tag@sub.example.org', 'f***@sub.example.org'],
  ])('masks %s as %s', (input, expected) => {
    expect(maskEmail(input)).toBe(expected)
  })

  it('never returns the local part, and gives a bare mask for something that is not an address', () => {
    expect(maskEmail('pat.morgan@example.org')).not.toContain('morgan')
    expect(maskEmail('not-an-address')).toBe('***')
    expect(maskEmail('@example.org')).toBe('***')
  })

  it('gives nothing for a missing address rather than inventing one', () => {
    expect(maskEmail(null)).toBeNull()
    expect(maskEmail(undefined)).toBeNull()
    expect(maskEmail('')).toBeNull()
  })
})

describe('search term handling', () => {
  it('takes the pattern characters of LIKE literally', () => {
    expect(escapeLike('100%')).toBe('100\\%')
    expect(escapeLike('a_b')).toBe('a\\_b')
    expect(escapeLike('back\\slash')).toBe('back\\\\slash')
    expect(escapeLike('plain')).toBe('plain')
  })

  it('bounds a term to 100 characters and trims it', () => {
    expect(normalizeSearch(`  ${'x'.repeat(150)}  `).term).toHaveLength(100)
    expect(normalizeSearch('  abc  ').term).toBe('abc')
  })

  it('treats a missing or empty term as no search, and a one- or two-character term as too short to be one', () => {
    expect(normalizeSearch(undefined)).toEqual({ term: '', tooShort: false })
    expect(normalizeSearch('   ')).toEqual({ term: '', tooShort: false })
    expect(normalizeSearch('ab')).toEqual({ term: 'ab', tooShort: true })
    expect(normalizeSearch('abc')).toEqual({ term: 'abc', tooShort: false })
    expect(MIN_SEARCH_LENGTH).toBe(3)
  })
})

// Issue #1116: a caller who administers no organization directly reads no membership at all.
describe('listPlatformUsers', () => {
  it('reads nothing when it is bounded to no organization', async () => {
    const tx = { select: () => { throw new Error('the membership table was read') } }
    await expect(listPlatformUsers(tx as never, { organizationIds: [] })).resolves.toEqual([])
  })

  it('has no unscoped call shape: a missing scope reads nothing rather than every organization', async () => {
    const tx = { select: () => { throw new Error('the membership table was read') } }
    await expect(listPlatformUsers(tx as never, {} as never)).resolves.toEqual([])
    await expect(listPlatformUsers(tx as never, { organizationIds: undefined } as never)).resolves.toEqual([])
  })
})
