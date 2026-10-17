import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  FirstAdminError,
  validateFirstAdminInput,
  type FirstAdminInput,
} from './first-admin-bootstrap'

const valid = (): FirstAdminInput => ({
  userId: 'ue-first-admin-1',
  email: 'owner@example.invalid',
  password: 'Correct-Horse-Battery-7!',
  organizationId: randomUUID(),
  organizationName: 'Synthetic Local',
  organizationSlug: 'synthetic-local',
  role: 'admin',
  platformAdmin: true,
  operator: 'aubert',
})

const rejects = (patch: Partial<FirstAdminInput>, pattern: RegExp) => {
  const input = { ...valid(), ...patch }
  expect(() => validateFirstAdminInput(input)).toThrow(FirstAdminError)
  expect(() => validateFirstAdminInput(input)).toThrow(pattern)
}

describe('first-admin input validation', () => {
  it('accepts a complete, owner-supplied input', () => {
    expect(() => validateFirstAdminInput(valid())).not.toThrow()
  })

  it('has no default identity or password', () => {
    rejects({ userId: '' }, /userId/)
    rejects({ password: '' }, /password/)
    rejects({ operator: '' }, /operator/)
  })

  it('rejects weak passwords', () => {
    rejects({ password: 'short' }, /password rejected/)
    rejects({ password: 'password1234567' }, /password rejected/)
  })

  it('rejects malformed identity, organization and role', () => {
    rejects({ email: 'not-an-email' }, /email/)
    rejects({ userId: 'has space' }, /userId/)
    rejects({ organizationId: 'not-a-uuid' }, /organizationId/)
    rejects({ organizationSlug: 'Bad Slug' }, /organizationSlug/)
    rejects({ organizationName: undefined }, /together/)
    rejects({ role: 'member' as never }, /role/)
  })

  it('allows an existing organization to be referenced without creating one', () => {
    expect(() =>
      validateFirstAdminInput({
        ...valid(),
        organizationName: undefined,
        organizationSlug: undefined,
      }),
    ).not.toThrow()
  })
})
