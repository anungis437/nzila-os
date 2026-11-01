import { describe, expect, it } from 'vitest'
import { cronSecretMatches, expectedCronSecret, presentedCronSecret } from '../cron-secret'

// One rule for withApi, the edge check in proxy.ts and the rewards route (Gate 0 F01a,
// DEF-0B6-SYS-CRON-EDGE-SECRET-CHECK-DIFFERS-FROM-ROUTE-CHECK / DEF-0B11-PRP-REWARDS-CRON-ACCEPTS-THE-SECRET-IN-TWO-HEADERS).
const headers = (init: Record<string, string>) => new Headers(init)

describe('cron secret rule', () => {
  it('reads x-cron-secret first, then a bearer token (any case), and nothing else', () => {
    expect(presentedCronSecret(headers({ 'x-cron-secret': 'a' }))).toBe('a')
    expect(presentedCronSecret(headers({ authorization: 'Bearer b' }))).toBe('b')
    expect(presentedCronSecret(headers({ authorization: 'bearer  c ' }))).toBe('c')
    expect(presentedCronSecret(headers({ 'x-cron-secret': 'a', authorization: 'Bearer b' }))).toBe('a')
    expect(presentedCronSecret(headers({ authorization: 'Basic abc' }))).toBe('')
    expect(presentedCronSecret(headers({}))).toBe('')
  })

  it('prefers CRON_SECRET_KEY, falls back to CRON_SECRET, and treats an empty value as unset', () => {
    expect(expectedCronSecret({ CRON_SECRET_KEY: 'k', CRON_SECRET: 's' })).toBe('k')
    expect(expectedCronSecret({ CRON_SECRET: 's' })).toBe('s')
    expect(expectedCronSecret({ CRON_SECRET_KEY: '', CRON_SECRET: 's' })).toBe('s')
    expect(expectedCronSecret({})).toBe('')
  })

  it('matches only the configured secret, by either header', async () => {
    const env = { CRON_SECRET: 'correct-secret' }
    expect(await cronSecretMatches(headers({ 'x-cron-secret': 'correct-secret' }), env)).toBe(true)
    expect(await cronSecretMatches(headers({ authorization: 'Bearer correct-secret' }), env)).toBe(true)
    expect(await cronSecretMatches(headers({ 'x-cron-secret': 'wrong' }), env)).toBe(false)
    expect(await cronSecretMatches(headers({ 'x-cron-secret': 'correct-secret-extra' }), env)).toBe(false)
    expect(await cronSecretMatches(headers({}), env)).toBe(false)
  })

  it('never matches when no secret is configured, even against an empty presented secret', async () => {
    expect(await cronSecretMatches(headers({}), {})).toBe(false)
    expect(await cronSecretMatches(headers({ 'x-cron-secret': '' }), { CRON_SECRET: '' })).toBe(false)
    expect(await cronSecretMatches(headers({ 'x-cron-secret': 'anything' }), {})).toBe(false)
  })
})
