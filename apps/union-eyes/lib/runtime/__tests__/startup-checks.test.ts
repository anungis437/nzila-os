/**
 * SKIP_DB_STARTUP_CHECK is a developer's convenience (UE-CONV-H-024): start the server without the database check. It is honoured on a developer's machine or a
 * test run and ignored on every deployed runtime, so a stray flag cannot start a deployment that never checked its database.
 */
import { describe, expect, it } from 'vitest'
import { skipsDatabaseStartupCheck } from '../startup-checks'

const DEPLOYED: ReadonlyArray<Record<string, string>> = [
  { NODE_ENV: 'production' },
  { NODE_ENV: 'production', UE_ENVIRONMENT: 'production' },
  { NODE_ENV: 'development', UE_ENVIRONMENT: 'production' },
  { NODE_ENV: 'development', NEXT_PUBLIC_APP_ENV: 'production' },
  { NODE_ENV: 'development', UE_ENVIRONMENT: 'staging' },
  { NODE_ENV: 'development', UE_ENVIRONMENT: 'pilot' },
  { NODE_ENV: 'test', NZILA_MODE: 'production' },
]

describe('SKIP_DB_STARTUP_CHECK', () => {
  it('skips the check on a developer machine or a test run that asks for it, and only for true or 1', () => {
    expect(skipsDatabaseStartupCheck({ NODE_ENV: 'development', SKIP_DB_STARTUP_CHECK: 'true' })).toBe(true)
    expect(skipsDatabaseStartupCheck({ NODE_ENV: 'test', SKIP_DB_STARTUP_CHECK: '1' })).toBe(true)
    expect(skipsDatabaseStartupCheck({ NODE_ENV: 'development', UE_ENVIRONMENT: 'local', SKIP_DB_STARTUP_CHECK: 'true' })).toBe(true)
    for (const value of ['', 'false', '0', 'yes', 'TRUEISH']) expect(skipsDatabaseStartupCheck({ NODE_ENV: 'development', SKIP_DB_STARTUP_CHECK: value })).toBe(false)
    expect(skipsDatabaseStartupCheck({ NODE_ENV: 'development' })).toBe(false)
  })

  it.each(DEPLOYED)('is ignored on a deployed runtime: %o', (identity) => {
    expect(skipsDatabaseStartupCheck({ ...identity, SKIP_DB_STARTUP_CHECK: 'true' })).toBe(false)
    expect(skipsDatabaseStartupCheck({ ...identity, SKIP_DB_STARTUP_CHECK: '1' })).toBe(false)
  })

  it('is what the server start asks: instrumentation.ts does not read the variable itself', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const text = readFileSync(resolve(__dirname, '..', '..', '..', 'instrumentation.ts'), 'utf8')
    expect(text).toContain('skipsDatabaseStartupCheck')
    expect(text).not.toContain('process.env.SKIP_DB_STARTUP_CHECK')
  })
})
