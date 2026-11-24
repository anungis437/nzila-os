// @vitest-environment jsdom
// jsdom tests against a mocked fetch for what the sign-in policy form tells an administrator: its words in the language of the page, a refusal
// stated in that language, and a saved claim only when the server states the policy that is in force. They prove nothing about the real route.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import { AuthPolicyForm } from './auth-policy-form'

const policy = (over: Record<string, unknown> = {}) => ({
  allowLocalAuth: true, allowMagicLink: true, allowSso: true, requireSso: false, requireInvite: true, passwordResetAllowed: true,
  allowedEmailDomains: [], mfaRequiredForRoles: [], ...over,
})
const answer = (status: number, body: unknown) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body })

function mount(locale: string, put: () => Promise<unknown>, get: () => Promise<unknown> = () => answer(200, policy())) {
  vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => (init?.method === 'PUT' ? put() : get())))
  render(<NextIntlClientProvider locale={locale} messages={{}}><AuthPolicyForm /></NextIntlClientProvider>)
}
const submit = async (name: RegExp) => { fireEvent.click(await screen.findByRole('button', { name })); }

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('AuthPolicyForm', () => {
  it('is worded in French for a French page and never shows the server\'s English refusal there', async () => {
    mount('fr-CA', () => answer(400, { error: 'Invalid email domain: bad_domain' }))
    await submit(/Enregistrer la politique/)
    const alert = await screen.findByText(/n’a pas pu être confirmée/)
    expect(alert.textContent).not.toMatch(/Invalid|domain/)
    expect(screen.queryByText(/Policy|Allowed sign-in|Save policy/)).toBeNull()
  })

  it('shows the server\'s own reason in English', async () => {
    mount('en-CA', () => answer(400, { error: 'Invalid email domain: bad_domain' }))
    await submit(/Save policy/)
    expect(await screen.findByText('Invalid email domain: bad_domain')).toBeInTheDocument()
  })

  it('says a save failed in the page language when the request never got an answer', async () => {
    mount('fr-CA', () => Promise.reject(new TypeError('Failed to fetch')))
    await submit(/Enregistrer la politique/)
    expect(await screen.findByText(/n’a pas pu être confirmée/)).toBeInTheDocument()
    expect(screen.queryByText(/Failed to fetch/)).toBeNull()
  })

  it.each(['allowedEmailDomains', 'mfaRequiredForRoles'] as const)(
    'does not claim a saved policy when the response omits required %s',
    async (key) => {
      const incomplete: Record<string, unknown> = policy();
      delete incomplete[key];
      mount('en-CA', () => answer(200, incomplete))
      await submit(/Save policy/)
      expect(await screen.findByText(/did not confirm the requested policy change/)).toBeInTheDocument()
    },
  )

  it('does not say saved when the server answers 200 without stating the policy', async () => {
    mount('en-CA', () => answer(200, { ok: true }))
    await submit(/Save policy/)
    expect(await screen.findByText(/did not confirm the requested policy change/)).toBeInTheDocument()
    expect(screen.queryByText(/saved and confirmed/)).toBeNull()
  })

  it('does not say saved when the policy it states differs from the choices that were sent', async () => {
    mount('en-CA', () => answer(200, policy({ requireInvite: false })))
    await submit(/Save policy/)
    expect(await screen.findByText(/did not confirm the requested policy change/)).toBeInTheDocument()
  })

  it.each(['allowLocalAuth', 'allowMagicLink', 'allowSso', 'passwordResetAllowed'] as const)(
    'does not claim success when the persisted %s setting differs from the submitted setting',
    async (key) => {
      mount('en-CA', () => answer(200, policy({ [key]: false })))
      await submit(/Save policy/)
      expect(await screen.findByText(/did not confirm the requested policy change/)).toBeInTheDocument()
      expect(screen.queryByText(/saved and confirmed/)).toBeNull()
    },
  )

  it('says saved only when the server states the policy in force', async () => {
    mount('en-CA', () => answer(200, policy()))
    await submit(/Save policy/)
    expect(await screen.findByText(/saved and confirmed by the server/)).toBeInTheDocument()
  })

  it('says the policy could not be loaded, in French, for a refusal and for a body that is not a policy', async () => {
    mount('fr-CA', () => answer(200, policy()), () => answer(500, { message: 'Internal server error' }))
    expect(await screen.findByText(/momentanément indisponible/)).toBeInTheDocument()
    cleanup()
    mount('fr-CA', () => answer(200, policy()), () => answer(200, { nonsense: true }))
    await waitFor(() => expect(screen.getByText(/n’a pas pu être chargée/)).toBeInTheDocument())
  })
})
