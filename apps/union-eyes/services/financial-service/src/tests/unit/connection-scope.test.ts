import { describe, expect, it } from 'vitest'
import { financialConnectionString } from '../../db/connection-scope'

describe('dedicated financial connection selection', () => {
  const operational = 'postgresql://operational:private@127.0.0.1:54321/operational'
  const financial = 'postgresql://financial:private@127.0.0.1:54321/financial'

  it('requires an explicit financial URL rather than using DATABASE_URL', () => {
    expect(() => financialConnectionString({ DATABASE_URL: operational })).toThrow(
      'FINANCIAL_DATABASE_URL_REQUIRED',
    )
  })

  it.each(['DATABASE_URL', 'SYSTEM_DATABASE_URL', 'AUTH_DATABASE_URL', 'AUTH_SYSTEM_DATABASE_URL'])(
    'rejects the same endpoint/database identifier as %s even with different credentials',
    (key) => {
      expect(() => financialConnectionString({
        FINANCIAL_DATABASE_URL: 'postgres://financial:private@localhost:54321/operational?application_name=financial',
        [key]: operational,
      })).toThrow('FINANCIAL_DATABASE_SCOPE_COLLAPSE')
    },
  )

  it('requires a role distinct from the operational caller and forbids the default owner', () => {
    expect(() => financialConnectionString({
      DATABASE_URL: operational,
      FINANCIAL_DATABASE_URL: financial.replace('financial:private', 'operational:private'),
    })).toThrow('FINANCIAL_DATABASE_ROLE_REUSE')
    expect(() => financialConnectionString({
      FINANCIAL_DATABASE_URL: financial.replace('financial:private', 'postgres:private'),
    })).toThrow('FINANCIAL_DATABASE_OWNER_ROLE_FORBIDDEN')
  })

  it('selects a distinct financial database and role without rewriting credentials', () => {
    expect(financialConnectionString({
      DATABASE_URL: operational,
      AUTH_SYSTEM_DATABASE_URL: 'postgresql://auth:private@127.0.0.1:54321/auth',
      FINANCIAL_DATABASE_URL: financial,
    })).toBe(financial)
  })

  it.each([
    'https://financial.invalid/db',
    'postgresql://127.0.0.1:54321/financial',
    'postgresql://financial:private@127.0.0.1:54321/',
  ])('rejects invalid financial configuration without connecting: %s', (value) => {
    expect(() => financialConnectionString({ FINANCIAL_DATABASE_URL: value })).toThrow()
  })
})
