import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// DEF-0B8-ICRA-CLAIM-TOKEN-HAS-NO-ICRA-ISSUER-SO-CLAIM-CANNOT-SUCCEED: the buyer is sent the claim link; nothing is sent, and no success
// is reported, when the buyer, the public address or the sender is missing. The e-mail sender is mocked: no message leaves the test.
const m = vi.hoisted(() => ({ sendEmail: vi.fn() }))
vi.mock('@/lib/email-service', () => ({ sendEmail: m.sendEmail }))

import { claimLinkBase, deliverIcraClaimCredential, icraClaimLink } from '../claim-delivery'

const ID = '00000000-0000-4000-8000-000000000099'
const TOKEN = 'tok_abcdefghijklmnopqrstuvwxyz0123456789'

describe('ICRA claim credential delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.org/')
    m.sendEmail.mockResolvedValue({ success: true })
  })
  afterEach(() => vi.unstubAllEnvs())

  it('e-mails the buyer the claim page link for this assessment and token', async () => {
    await expect(deliverIcraClaimCredential({ assessmentId: ID, claimToken: TOKEN, buyerEmail: 'buyer@example.org', locale: 'fr' })).resolves.toEqual({ delivered: true })
    expect(m.sendEmail).toHaveBeenCalledTimes(1)
    const sent = m.sendEmail.mock.calls[0][0] as { to: Array<{ email: string }>; html: string; subject: string }
    expect(sent.to).toEqual([{ email: 'buyer@example.org', name: 'buyer@example.org' }])
    expect(sent.html).toContain(`https://app.example.org/fr-CA/continuity-assessment/claim?assessmentId=${ID}&amp;token=${TOKEN}`)
    expect(sent.subject).toBe('Récupérez votre rapport de continuité')
  })

  it.each([undefined, null, '', 'not-an-email'])('sends nothing without a usable buyer e-mail (%j)', async (buyerEmail) => {
    await expect(deliverIcraClaimCredential({ assessmentId: ID, claimToken: TOKEN, buyerEmail })).resolves.toEqual({ delivered: false, reason: 'NO_BUYER_EMAIL' })
    expect(m.sendEmail).not.toHaveBeenCalled()
  })

  it('sends nothing without a configured public address', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    await expect(deliverIcraClaimCredential({ assessmentId: ID, claimToken: TOKEN, buyerEmail: 'buyer@example.org' })).resolves.toEqual({ delivered: false, reason: 'APP_URL_NOT_CONFIGURED' })
    expect(m.sendEmail).not.toHaveBeenCalled()
  })

  it('refuses a plain-http public address in production', () => {
    expect(claimLinkBase({ NEXT_PUBLIC_APP_URL: 'http://app.example.org', NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBeNull()
    expect(claimLinkBase({ NEXT_PUBLIC_APP_URL: 'http://localhost:3000', NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBeNull()
    expect(claimLinkBase({ NEXT_PUBLIC_APP_URL: 'http://localhost:3000', NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe('http://localhost:3000')
  })

  it('reports a failed or unconfigured sender as not delivered', async () => {
    m.sendEmail.mockResolvedValue({ success: false, error: 'RESEND_API_KEY not configured' })
    await expect(deliverIcraClaimCredential({ assessmentId: ID, claimToken: TOKEN, buyerEmail: 'buyer@example.org' })).resolves.toEqual({ delivered: false, reason: 'SEND_FAILED' })
  })

  it('refuses an id that is not an assessment id', async () => {
    await expect(deliverIcraClaimCredential({ assessmentId: '../x', claimToken: TOKEN, buyerEmail: 'buyer@example.org' })).resolves.toEqual({ delivered: false, reason: 'INVALID_ASSESSMENT' })
    expect(m.sendEmail).not.toHaveBeenCalled()
  })

  it('builds an English link by default', () => {
    expect(icraClaimLink('https://a.example', 'en-CA', ID, 'x y')).toBe(`https://a.example/en-CA/continuity-assessment/claim?assessmentId=${ID}&token=x+y`)
  })
})
