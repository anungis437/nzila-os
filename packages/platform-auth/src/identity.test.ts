import { describe, it, expect } from 'vitest'
import { getInitials, authenticatedIdentitySchema } from './identity'

describe('getInitials', () => {
  it('returns first letter of single name', () => {
    expect(getInitials('Alice')).toBe('A')
  })

  it('returns first letters of first two words', () => {
    expect(getInitials('John Doe')).toBe('JD')
  })

  it('caps at two initials for longer names', () => {
    expect(getInitials('Alice Bob Charlie')).toBe('AB')
  })

  it('uppercases letters', () => {
    expect(getInitials('jane doe')).toBe('JD')
  })

  it('handles multiple internal spaces', () => {
    expect(getInitials('Alice   Bob')).toBe('AB')
  })
})

describe('authenticatedIdentitySchema', () => {
  it('parses a minimal valid identity', () => {
    const result = authenticatedIdentitySchema.safeParse({ userId: 'user-1' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.userId).toBe('user-1')
      expect(result.data.isService).toBe(false)
    }
  })

  it('rejects empty userId', () => {
    const result = authenticatedIdentitySchema.safeParse({ userId: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing userId', () => {
    const result = authenticatedIdentitySchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = authenticatedIdentitySchema.safeParse({
      userId: 'user-1',
      email: 'not-an-email',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid optional email', () => {
    const result = authenticatedIdentitySchema.safeParse({
      userId: 'user-1',
      email: 'user@example.com',
    })
    expect(result.success).toBe(true)
  })

  it('parses full identity with all fields', () => {
    const input = {
      userId: 'user-42',
      email: 'admin@nzila.io',
      displayName: 'Admin User',
      activeOrgId: 'org-1',
      orgRole: 'org_admin',
      isService: true,
    }
    const result = authenticatedIdentitySchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.displayName).toBe('Admin User')
      expect(result.data.isService).toBe(true)
    }
  })
})
