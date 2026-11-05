import { beforeEach, describe, expect, it, vi } from 'vitest'

// DEF-0B6-SYS-CONTACT-RATE-LIMIT-KEYED-ON-FORGEABLE-ADDRESS-NO-BOT-CHALLENGE, DEF-0B8-ICRA-PUBLIC-WRITES-HAVE-NO-BOT-CHALLENGE-AND-TURNSTILE-IS-OPTIONAL
const m = vi.hoisted(() => ({ verify: vi.fn(), rate: vi.fn() }))
vi.mock('@/lib/icra/turnstile', () => ({ verifyTurnstileToken: m.verify }))
vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: m.rate }))

import { requireBotChallenge } from '@/lib/public-intake/bot-challenge'
import { guardPublicIntake } from '@/lib/public-intake/guard'

const prod = { NODE_ENV: 'production', TURNSTILE_SECRET_KEY: 'secret-for-test' } as NodeJS.ProcessEnv

describe('bot challenge for public writes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.rate.mockResolvedValue({ allowed: true, remaining: 5, resetIn: 0 })
  })

  it('fails closed in production when no secret is configured', async () => {
    const verdict = await requireBotChallenge('t', '203.0.113.9', { NODE_ENV: 'production' } as NodeJS.ProcessEnv)
    expect(verdict).toMatchObject({ ok: false, status: 503, code: 'BOT_CHALLENGE_NOT_CONFIGURED' })
    expect(m.verify).not.toHaveBeenCalled()
  })

  it('is open outside production when no secret is configured', async () => {
    expect(await requireBotChallenge(null, null, { NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toEqual({ ok: true })
  })

  it('accepts a verified token, refuses a bad one (403) and an unreachable verifier (503)', async () => {
    m.verify.mockResolvedValueOnce({ success: true, notConfigured: false })
    expect(await requireBotChallenge('good', '1.1.1.1', prod)).toEqual({ ok: true })
    m.verify.mockResolvedValueOnce({ success: false, notConfigured: false, errorCodes: ['invalid-input-response'] })
    expect(await requireBotChallenge('bad', '1.1.1.1', prod)).toMatchObject({ ok: false, status: 403, code: 'BOT_CHALLENGE_FAILED' })
    m.verify.mockResolvedValueOnce({ success: false, notConfigured: false, errorCodes: ['network-error'] })
    expect(await requireBotChallenge('t', '1.1.1.1', prod)).toMatchObject({ ok: false, status: 503, code: 'BOT_CHALLENGE_UNAVAILABLE' })
  })

  describe('guardPublicIntake with challenge: true', () => {
    const post = (body: unknown, headers: Record<string, string> = {}) =>
      new Request('http://localhost/api/contact', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) })

    it('takes the token from the body, strips it from what the route sees and passes the client address', async () => {
      vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret-for-test')
      m.verify.mockResolvedValue({ success: true, notConfigured: false })
      const intake = await guardPublicIntake(post({ name: 'x', turnstileToken: 'tok' }, { 'cf-connecting-ip': '198.51.100.4' }), { bucket: 'write', challenge: true })
      expect(intake).toEqual({ ok: true, json: { name: 'x' } })
      expect(m.verify).toHaveBeenCalledWith('tok', '198.51.100.4')
      vi.unstubAllEnvs()
    })

    it('takes the token from the x-turnstile-token header and refuses a missing or failed one with the verdict status', async () => {
      vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret-for-test')
      m.verify.mockResolvedValue({ success: false, notConfigured: false, errorCodes: ['missing-token'] })
      const intake = await guardPublicIntake(post({ name: 'x' }, { 'x-turnstile-token': 'hdr' }), { bucket: 'write', challenge: true })
      expect(m.verify).toHaveBeenCalledWith('hdr', expect.any(String))
      expect(intake.ok).toBe(false)
      if (!intake.ok) expect(intake.response.status).toBe(403)
      vi.unstubAllEnvs()
    })

    it('does not challenge a route that did not ask for it', async () => {
      vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret-for-test')
      const intake = await guardPublicIntake(post({ name: 'x' }), { bucket: 'write' })
      expect(intake.ok).toBe(true)
      expect(m.verify).not.toHaveBeenCalled()
      vi.unstubAllEnvs()
    })
  })
})
