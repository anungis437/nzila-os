import { afterEach, describe, expect, it, vi } from 'vitest'

describe('isAllowedBillingRedirect', () => {
  const originalAllowlist = process.env.BILLING_REDIRECT_ALLOWLIST

  afterEach(() => {
    if (originalAllowlist === undefined) {
      delete process.env.BILLING_REDIRECT_ALLOWLIST
    } else {
      process.env.BILLING_REDIRECT_ALLOWLIST = originalAllowlist
    }
    vi.resetModules()
  })

  it('allows same-origin redirects', async () => {
    const { isAllowedBillingRedirect } = await import('../server-redirects')
    expect(
      isAllowedBillingRedirect(
        'https://console.nzila.local/settings/billing/success',
        'https://console.nzila.local',
      ),
    ).toBe(true)
  })

  it('allows external redirects that are explicitly allowlisted', async () => {
    process.env.BILLING_REDIRECT_ALLOWLIST = 'billing.stripe.com,checkout.stripe.com'
    const { isAllowedBillingRedirect } = await import('../server-redirects')
    expect(
      isAllowedBillingRedirect('https://billing.stripe.com/p/session/test', 'https://console.nzila.local'),
    ).toBe(true)
  })

  it('denies external redirects that are not allowlisted', async () => {
    process.env.BILLING_REDIRECT_ALLOWLIST = 'billing.stripe.com'
    const { isAllowedBillingRedirect } = await import('../server-redirects')
    expect(
      isAllowedBillingRedirect('https://evil.example.com/phish', 'https://console.nzila.local'),
    ).toBe(false)
  })

  it('denies malformed redirect URLs', async () => {
    const { isAllowedBillingRedirect } = await import('../server-redirects')
    expect(isAllowedBillingRedirect('not-a-url', 'https://console.nzila.local')).toBe(false)
  })
})
