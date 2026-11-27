import { describe, expect, it } from 'vitest'
import { assertOwnedAuthUrl, openRuntimeSessionFactory } from './runtime-column-fixtures'
import pg from 'pg'
const operator = new pg.Client({
  host: '127.0.0.1',
  port: 5432,
  database: 'ue_v2_column_fixture',
  user: 'operator',
})
const owned = 'postgresql://restricted:synthetic-fixture-only@127.0.0.1:5432/ue_v2_column_fixture'
describe('disposable production-session factory protocol boundaries (no native proof)', () => {
  it('accepts only an exact owned loopback database endpoint', () => {
    expect(() => assertOwnedAuthUrl(owned, operator)).not.toThrow()
  })
  it.each([
    'postgresql://restricted:synthetic-fixture-only@staging.example.invalid:5432/ue_v2_column_fixture',
    'postgresql://restricted:synthetic-fixture-only@127.0.0.1:5433/ue_v2_column_fixture',
    'postgresql://restricted:synthetic-fixture-only@127.0.0.1:5432/ue_v2_other_fixture',
    'postgresql://restricted@127.0.0.1:5432/ue_v2_column_fixture',
    'https://restricted:synthetic-fixture-only@127.0.0.1:5432/ue_v2_column_fixture',
  ])('refuses mismatched or uncredentialed endpoint without connecting: %s', (url) => {
    expect(() => assertOwnedAuthUrl(url, operator)).toThrow()
  })
  it('refuses a non-owned database name even when endpoints agree', () => {
    const other = new pg.Client({
      host: '127.0.0.1',
      port: 5432,
      database: 'production',
      user: 'operator',
    })
    expect(() =>
      assertOwnedAuthUrl(owned.replace('ue_v2_column_fixture', 'production'), other),
    ).toThrow()
  })
  it.each([undefined, ''])(
    'refuses an absent owned database string (%s) before parsing/connecting',
    (database) => {
      expect(() => assertOwnedAuthUrl(owned, { host: '127.0.0.1', port: 5432, database })).toThrow(
        'OWNED_DATABASE_NAME_REQUIRED',
      )
    },
  )
  it('restores environment and prevents overlapping factories without issuing any session', async () => {
    const before = {
      auth: process.env.AUTH_DATABASE_URL,
      system: process.env.AUTH_SYSTEM_DATABASE_URL,
      mode: process.env.UE_CANONICAL_BOOTSTRAP_V2,
    }
    const factory = openRuntimeSessionFactory(operator, owned)
    try {
      expect(process.env.AUTH_DATABASE_URL).toBe(owned)
      expect(process.env.AUTH_SYSTEM_DATABASE_URL).toBeUndefined()
      expect(() => openRuntimeSessionFactory(operator, owned)).toThrow(
        'NESTED_RUNTIME_SESSION_FACTORY_FORBIDDEN',
      )
    } finally {
      await factory.dispose()
    }
    expect(process.env.AUTH_DATABASE_URL).toBe(before.auth)
    expect(process.env.AUTH_SYSTEM_DATABASE_URL).toBe(before.system)
    expect(process.env.UE_CANONICAL_BOOTSTRAP_V2).toBe(before.mode)
    await expect(
      factory.withActor('unissued', '11111111-1111-4111-8111-111111111111')(async () => undefined),
    ).rejects.toThrow('RUNTIME_SESSION_FACTORY_DISPOSED')
  })
  it('refuses reuse of ordinary credentials for auth-system before changing environment', () => {
    const before = process.env.AUTH_DATABASE_URL
    expect(() => openRuntimeSessionFactory(operator, owned, owned)).toThrow(
      'DISTINCT_AUTH_GATEWAYS_REQUIRED',
    )
    expect(process.env.AUTH_DATABASE_URL).toBe(before)
  })
})
