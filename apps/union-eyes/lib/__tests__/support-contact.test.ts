import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SUPPORT_EMAIL, supportEmail } from '../support-contact'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('supportEmail', () => {
  it('is the mailbox the product owns, which is the reply-to of outgoing email and the one a person is told to write to', () => {
    vi.stubEnv('EMAIL_REPLY_TO', '')
    expect(supportEmail()).toBe(DEFAULT_SUPPORT_EMAIL)
    expect(DEFAULT_SUPPORT_EMAIL).toBe('support@unioneyes.app')
  })

  it('is the address the environment names when it names one', () => {
    vi.stubEnv('EMAIL_REPLY_TO', '  help@example.test ')
    expect(supportEmail()).toBe('help@example.test')
  })
})
