import { describe, expect, it, vi } from 'vitest'
import {
  API_GROUP_LIMITS,
  IP_CEILING_MULTIPLIER,
  bucketId,
  decideApiLimit,
  isGuardExempt,
  presentedCredential,
  type GuardDeps,
} from './proxy-api-guard'

/** A shared store that behaves like Redis (a real count per key) or like an outage, and a memory store likewise. */
function stores(mode: 'up' | 'down' | 'throws') {
  const shared = new Map<string, number>()
  const memory = new Map<string, number>()
  const deps: GuardDeps = {
    shared: vi.fn(async (key, config) => {
      if (mode === 'throws') throw new Error('boom')
      if (mode === 'down') return { allowed: false, current: 0, limit: config.limit, remaining: 0, resetIn: config.window, error: 'Rate limiting service unavailable' }
      const k = `${config.identifier}:${key}`
      const n = (shared.get(k) ?? 0) + 1
      shared.set(k, n)
      return { allowed: n <= config.limit, current: n, limit: config.limit, remaining: Math.max(0, config.limit - n), resetIn: config.window }
    }) as GuardDeps['shared'],
    memory: vi.fn((key: string, options: { max: number; windowMs: number }) => {
      const n = (memory.get(key) ?? 0) + 1
      memory.set(key, n)
      return { allowed: n <= options.max, remaining: Math.max(0, options.max - n), resetAt: Date.now() + options.windowMs }
    }),
    onDegraded: vi.fn(),
  }
  return deps
}

const write = (credential: string | null, ip = '10.0.0.1') => ({ pathname: '/api/cases/intake', method: 'POST', credential, ip })

describe('API rate-limit guard', () => {
  it('limits a mutation by the credential presented, whatever headers the caller sends or omits', async () => {
    const deps = stores('up')
    const limit = API_GROUP_LIMITS.mutations.max
    let denied = 0
    for (let i = 0; i < limit + 10; i += 1) if (!(await decideApiLimit(write('cookie:alice'), deps)).allowed) denied += 1
    expect(denied).toBe(10)
  })

  it("one caller's traffic never consumes another caller's allowance, even from the same address", async () => {
    const deps = stores('up')
    for (let i = 0; i < API_GROUP_LIMITS.mutations.max + 20; i += 1) await decideApiLimit(write('cookie:attacker', '10.0.0.9'), deps)
    const victim = await decideApiLimit(write('cookie:victim', '10.0.0.9'), deps)
    expect(victim.allowed).toBe(true)
    expect(victim.scope).toBeDefined()
  })

  it('a caller without a credential is limited by address alone, at the ceiling', async () => {
    const deps = stores('up')
    const ceiling = API_GROUP_LIMITS.mutations.max * IP_CEILING_MULTIPLIER
    let denied = 0
    for (let i = 0; i < ceiling + 5; i += 1) if (!(await decideApiLimit(write(null, '10.9.9.9'), deps)).allowed) denied += 1
    expect(denied).toBe(5)
  })

  it('rotating credentials from one address cannot multiply the allowance past the address ceiling', async () => {
    const deps = stores('up')
    const ceiling = API_GROUP_LIMITS.mutations.max * IP_CEILING_MULTIPLIER
    let allowed = 0
    for (let i = 0; i < ceiling + 40; i += 1) if ((await decideApiLimit(write(`cookie:forged-${i}`, '10.7.7.7'), deps)).allowed) allowed += 1
    expect(allowed).toBe(ceiling)
  })

  it('applies the same limit from memory when the shared store is down, and says so', async () => {
    const deps = stores('down')
    const limit = API_GROUP_LIMITS.mutations.max
    const results = []
    for (let i = 0; i < limit + 3; i += 1) results.push(await decideApiLimit(write('cookie:bob'), deps))
    expect(results.slice(0, limit).every((r) => r.allowed)).toBe(true)
    expect(results.slice(limit).every((r) => !r.allowed)).toBe(true)
    expect(results.every((r) => r.mode === 'degraded')).toBe(true)
    expect(deps.onDegraded).toHaveBeenCalled()
  })

  it('does not reject the first requests of a caller because the shared store errored', async () => {
    const deps = stores('throws')
    const first = await decideApiLimit(write('cookie:carol'), deps)
    expect(first.allowed).toBe(true)
    expect(first.mode).toBe('degraded')
  })

  it('returns to the shared store, without a restart, once it answers again', async () => {
    const deps = stores('up')
    const first = await decideApiLimit(write('cookie:dave'), deps)
    expect(first.mode).toBe('shared')
    expect(deps.memory).not.toHaveBeenCalled()
  })

  it('uses a bucket name that does not contain the credential', () => {
    const id = bucketId('cookie:ue-seed-session-ue-qa-member-primary')
    expect(id).not.toContain('member')
    expect(bucketId('cookie:a')).not.toBe(bucketId('cookie:b'))
    expect(bucketId('cookie:a')).toBe(bucketId('cookie:a'))
  })

  it('reads the session cookie or bearer credential, and nothing a client names as an organization', () => {
    const headers = (entries: Record<string, string>) => ({ get: (name: string) => entries[name.toLowerCase()] ?? null })
    expect(presentedCredential(headers({ cookie: 'a=b; nzila_session=tok123; c=d' }))).toBe('cookie:tok123')
    expect(presentedCredential(headers({ authorization: 'Bearer xyz' }))).toBe('auth:Bearer xyz')
    expect(presentedCredential(headers({ 'x-org-id': 'someone-elses-org' }))).toBeNull()
  })

  it('leaves probes, signed callbacks, cron, auth and preflight to their own controls, and nothing else', () => {
    for (const path of ['/api/health', '/api/webhooks/stripe', '/api/cron/daily', '/api/auth/login', '/api/auth']) expect(isGuardExempt(path, 'POST'), path).toBe(true)
    expect(isGuardExempt('/api/cases', 'OPTIONS')).toBe(true)
    for (const path of ['/api/cases/intake', '/api/public/intake', '/api/export/all', '/api/authority/anything']) expect(isGuardExempt(path, 'POST'), path).toBe(false)
  })
})
