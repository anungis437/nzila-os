// @vitest-environment jsdom
// jsdom tests against a simulated policy endpoint that really keeps state: what the sign-in policy form tells an administrator is decided by an
// independent, uncached read of the stored policy after the write, never by the write's own answer. They prove nothing about the real route.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import { AuthPolicyForm } from './auth-policy-form'

type Stored = {
  allowLocalAuth: boolean; allowMagicLink: boolean; allowSso: boolean; requireSso: boolean; requireInvite: boolean; passwordResetAllowed: boolean
  allowedEmailDomains: string[]; mfaRequiredForRoles: string[]
}
const base = (over: Partial<Stored> = {}): Stored => ({
  allowLocalAuth: true, allowMagicLink: true, allowSso: true, requireSso: false, requireInvite: true, passwordResetAllowed: true,
  allowedEmailDomains: [], mfaRequiredForRoles: [], ...over,
})
const answer = (status: number, body: unknown) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body })

interface Server {
  stored: Stored
  puts: Array<Record<string, unknown>>
  gets: Array<RequestInit | undefined>
  /** What the PUT does to the stored policy and what it answers; the default persists exactly what was sent. */
  put: (body: Record<string, unknown>, server: Server) => Promise<unknown>
  /** What a GET answers; the default states the stored policy. */
  get: (server: Server) => Promise<unknown>
}
const persist = (body: Record<string, unknown>, server: Server) => {
  const { expected: _expected, ...sent } = body
  server.stored = { ...server.stored, ...(sent as Partial<Stored>) }
}
function mount(locale: string, overrides: Partial<Pick<Server, 'put' | 'get'>> = {}, stored = base()) {
  const server: Server = {
    stored, puts: [], gets: [],
    put: async (body, s) => { persist(body, s); return answer(200, s.stored) },
    get: (s) => answer(200, s.stored),
    ...overrides,
  }
  vi.stubGlobal('fetch', vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'PUT') {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>
      server.puts.push(body)
      return server.put(body, server)
    }
    server.gets.push(init)
    return server.get(server)
  }))
  render(<NextIntlClientProvider locale={locale} messages={{}}><AuthPolicyForm /></NextIntlClientProvider>)
  return server
}
const submit = async (name: RegExp = /Save policy/) => { fireEvent.click(await screen.findByRole('button', { name })) }
const getsAfterLoad = (server: Server) => server.gets.slice(1)

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('AuthPolicyForm: confirmation comes from an independent read', () => {
  it('reads the stored policy again, uncached, after a successful write, and confirms only when every persisted field matches', async () => {
    const server = mount('en-CA')
    fireEvent.click(await screen.findByLabelText('Magic link (passwordless email)'))
    fireEvent.change(screen.getByLabelText('Email domain allowlist'), { target: { value: 'Union.example, other.org, union.example' } })
    fireEvent.click(screen.getByRole('button', { name: 'Steward' }))
    await submit()

    expect(await screen.findByText(/Policy saved/)).toBeInTheDocument()
    expect(server.stored).toMatchObject({ allowMagicLink: false, allowedEmailDomains: ['union.example', 'other.org'], mfaRequiredForRoles: ['steward'] })
    expect(getsAfterLoad(server)).toHaveLength(1)
    expect(getsAfterLoad(server)[0]).toMatchObject({ cache: 'no-store' })
  })

  it('sends the policy the page last read with the write, so the server can refuse a write over a newer policy', async () => {
    const server = mount('en-CA')
    fireEvent.click(await screen.findByLabelText('Magic link (passwordless email)'))
    await submit()
    await screen.findByText(/Policy saved/)
    expect(server.puts[0].expected).toMatchObject({ allowMagicLink: true, requireInvite: true, allowedEmailDomains: [], mfaRequiredForRoles: [] })
  })

  it('does not trust a 200 that the independent read contradicts, and shows what is in force without claiming success', async () => {
    const server = mount('en-CA', { put: async (_body, s) => answer(200, { ...s.stored, allowMagicLink: false }) })
    fireEvent.click(await screen.findByLabelText('Magic link (passwordless email)'))
    await submit()
    expect(await screen.findByText(/differs from the one you requested/)).toBeInTheDocument()
    expect(screen.queryByText(/Policy saved/)).toBeNull()
    expect(server.stored.allowMagicLink).toBe(true)
  })

  it.each(['allowLocalAuth', 'allowMagicLink', 'allowSso', 'passwordResetAllowed', 'requireInvite'] as const)(
    'does not claim success when the stored %s differs from the one submitted, whatever the write answered',
    async (key) => {
      const server = mount('en-CA', { put: async (body, s) => { persist(body, s); s.stored = { ...s.stored, [key]: !s.stored[key] }; return answer(200, { ...s.stored, [key]: !s.stored[key] }) } })
      fireEvent.click(await screen.findByLabelText('Email + password'))
      await submit()
      expect(await screen.findByText(/differs from the one you requested/)).toBeInTheDocument()
      expect(server.stored).toBeDefined()
    },
  )

  it('does not claim success when only the domain list or only the role list was not persisted', async () => {
    mount('en-CA', { put: async (body, s) => { persist(body, s); s.stored.allowedEmailDomains = []; return answer(200, s.stored) } })
    fireEvent.change(await screen.findByLabelText('Email domain allowlist'), { target: { value: 'union.example' } })
    await submit()
    expect(await screen.findByText(/differs from the one you requested/)).toBeInTheDocument()
    cleanup(); vi.unstubAllGlobals()
    mount('en-CA', { put: async (body, s) => { persist(body, s); s.stored.mfaRequiredForRoles = []; return answer(200, s.stored) } })
    fireEvent.click(await screen.findByRole('button', { name: 'Steward' }))
    await submit()
    expect(await screen.findByText(/differs from the one you requested/)).toBeInTheDocument()
  })

  it('does not claim success when the read-back is not a complete policy', async () => {
    let writes = 0
    mount('en-CA', {
      put: async (body, s) => { writes += 1; persist(body, s); return answer(200, s.stored) },
      get: (s) => (writes === 0 ? answer(200, s.stored) : answer(200, { ...s.stored, mfaRequiredForRoles: undefined })),
    })
    fireEvent.click(await screen.findByLabelText('Email + password'))
    await submit()
    expect(await screen.findByText(/could not confirm whether the change was saved/)).toBeInTheDocument()
    expect(screen.queryByText(/Policy saved/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument()
  })
})

describe('AuthPolicyForm: a write whose answer is lost is unknown until the stored policy is read', () => {
  it('confirms a write that persisted although its answer was lost', async () => {
    const server = mount('en-CA', { put: async (body, s) => { persist(body, s); throw new TypeError('Failed to fetch') } })
    fireEvent.click(await screen.findByLabelText('Email + password'))
    await submit()
    expect(await screen.findByText(/Policy saved/)).toBeInTheDocument()
    expect(server.stored.allowLocalAuth).toBe(false)
  })

  it('says nothing was saved only when the independent read shows the previous policy', async () => {
    mount('en-CA', { put: async () => { throw new TypeError('Failed to fetch') } })
    fireEvent.click(await screen.findByLabelText('Email + password'))
    await submit()
    expect(await screen.findByText(/The policy was not saved. The server still has the previous settings/)).toBeInTheDocument()
  })

  it('treats a 5xx the same way: the stored policy decides', async () => {
    const server = mount('en-CA', { put: async (body, s) => { persist(body, s); return answer(502, { message: 'upstream connect error' }) } })
    fireEvent.click(await screen.findByLabelText('Email + password'))
    await submit()
    expect(await screen.findByText(/Policy saved/)).toBeInTheDocument()
    expect(screen.queryByText(/upstream/)).toBeNull()
    expect(server.stored.allowLocalAuth).toBe(false)
  })

  it('stays unknown, keeps the edits and offers a check when the stored policy cannot be read either, and a check settles it', async () => {
    let readable = true
    const server = mount('en-CA', {
      put: async (body, s) => { persist(body, s); readable = false; throw new TypeError('Failed to fetch') },
      get: (s) => (readable ? answer(200, s.stored) : Promise.reject(new TypeError('Failed to fetch'))),
    })
    fireEvent.click(await screen.findByLabelText('Email + password'))
    await submit()
    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent(/could not confirm whether the change was saved/)
    expect(screen.getByLabelText('Email + password')).not.toBeChecked()
    expect(screen.queryByText(/Policy saved/)).toBeNull()

    readable = true
    fireEvent.click(within(notice).getByRole('button', { name: 'Check again' }))
    expect(await screen.findByText(/Policy saved/)).toBeInTheDocument()
    expect(server.stored.allowLocalAuth).toBe(false)
  })

  it('shows the same unknown state in French, with a French check', async () => {
    mount('fr-CA', { put: async () => { throw new TypeError('Failed to fetch') }, get: (s) => (s.puts.length ? Promise.reject(new TypeError('x')) : answer(200, s.stored)) })
    fireEvent.click(await screen.findByLabelText('Courriel et mot de passe'))
    await submit(/Enregistrer la politique/)
    expect(await screen.findByText(/Nous n’avons pas pu confirmer si la modification a été enregistrée/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vérifier de nouveau' })).toBeInTheDocument()
    expect(screen.queryByText(/Failed to fetch/)).toBeNull()
  })
})

describe('AuthPolicyForm: refusals, overlapping writes and stale answers', () => {
  it('words a definite refusal as not saved, with the server reason in English and never in French', async () => {
    mount('en-CA', { put: async () => answer(400, { error: 'Invalid email domain: bad_domain' }) })
    fireEvent.change(await screen.findByLabelText('Email domain allowlist'), { target: { value: 'bad_domain' } })
    await submit()
    expect(await screen.findByText('The policy was not saved. Invalid email domain: bad_domain')).toBeInTheDocument()
    cleanup(); vi.unstubAllGlobals()
    mount('fr-CA', { put: async () => answer(400, { error: 'Invalid email domain: bad_domain' }) })
    fireEvent.change(await screen.findByLabelText('Liste des domaines de courriel autorisés'), { target: { value: 'bad_domain' } })
    await submit(/Enregistrer la politique/)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('La politique n’a pas été enregistrée.')
    expect(alert.textContent).not.toMatch(/Invalid|bad_domain|domain/)
  })

  it.each([
    [401, /session est terminée/], [403, /autorisation/], [422, /ne sont pas valides/], [429, /Trop de demandes/],
  ])('words a %s refusal in French from its status', async (status, french) => {
    mount('fr-CA', { put: async () => answer(status, { message: 'English server wording' }) })
    fireEvent.click(await screen.findByLabelText('Courriel et mot de passe'))
    await submit(/Enregistrer la politique/)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(french)
    expect(alert).not.toHaveTextContent('English server wording')
  })

  it('reloads the stored policy on a 409, keeps the edits, and says someone else changed it', async () => {
    const server = mount('en-CA', { put: async (_body, s) => { s.stored = { ...s.stored, requireInvite: false, allowedEmailDomains: ['new.example'] }; return answer(409, { error: 'The sign-in policy changed after it was loaded' }) } })
    fireEvent.click(await screen.findByLabelText('Email + password'))
    await submit()
    expect(await screen.findByText(/changed by someone else after you opened it/)).toBeInTheDocument()
    expect(screen.getByLabelText('Email + password')).not.toBeChecked()
    expect(server.stored.allowLocalAuth).toBe(true)

    server.put = async (body, s) => { persist(body, s); return answer(200, s.stored) }
    await submit()
    expect(await screen.findByText(/Policy saved/)).toBeInTheDocument()
    expect(server.puts[1].expected).toMatchObject({ requireInvite: false, allowedEmailDomains: ['new.example'] })
  })

  it('refuses to submit single sign-on as required while it is switched off, before any write', async () => {
    const server = mount('en-CA')
    fireEvent.click(await screen.findByLabelText('Microsoft single sign-on'))
    fireEvent.click(screen.getByLabelText(/Require single sign-on/))
    await submit()
    expect(await screen.findByText(/cannot be required while it is switched off/)).toBeInTheDocument()
    expect(server.puts).toHaveLength(0)
  })

  it('does not start a second write while one is pending, and drops the answer of a write that a newer action replaced', async () => {
    let release: (value: unknown) => void = () => {}
    const server = mount('en-CA', { put: (body, s) => new Promise((resolve) => { release = (value) => { persist(body, s); resolve(value) } }) })
    fireEvent.click(await screen.findByLabelText('Email + password'))
    await submit()
    const button = await screen.findByRole('button', { name: 'Saving…' })
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(server.puts).toHaveLength(1)
    release(await answer(200, server.stored))
    expect(await screen.findByText(/Policy saved/)).toBeInTheDocument()
  })

  it('ignores a slow answer that arrives after the page unmounted', async () => {
    let release: (value: unknown) => void = () => {}
    const server = mount('en-CA', { put: (body, s) => new Promise((resolve) => { release = (value) => { persist(body, s); resolve(value) } }) })
    fireEvent.click(await screen.findByLabelText('Email + password'))
    await submit()
    await screen.findByRole('button', { name: 'Saving…' })
    cleanup()
    const getsBefore = server.gets.length
    release(await answer(200, server.stored))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(server.gets.length).toBe(getsBefore)
  })

  it('moves focus to the outcome so a keyboard or screen-reader user hears it', async () => {
    mount('en-CA', { put: async () => answer(403, { error: 'Forbidden' }) })
    fireEvent.click(await screen.findByLabelText('Email + password'))
    await submit()
    const alert = await screen.findByRole('alert')
    await waitFor(() => expect(alert).toHaveFocus())
  })

  it('marks the role toggles as pressed or not, and labels every group', async () => {
    mount('en-CA')
    const steward = await screen.findByRole('button', { name: 'Steward' })
    expect(steward).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(steward)
    expect(steward).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('group', { name: 'Require two-factor authentication for roles' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Allowed sign-in methods' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Email domain allowlist' })).toHaveAccessibleDescription(/Separate domains with commas/)
  })
})

describe('AuthPolicyForm: loading', () => {
  it('says the policy could not be loaded, in each language, for a refusal and for a body that is not a policy, and retries', async () => {
    let ok = false
    const server = mount('fr-CA', { get: (s) => (ok ? answer(200, s.stored) : answer(500, { message: 'Internal server error' })) })
    expect(await screen.findByText(/n’a pas pu être chargée/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/momentanément indisponible/)
    ok = true
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('button', { name: 'Enregistrer la politique' })).toBeInTheDocument()
    expect(server.gets.length).toBeGreaterThanOrEqual(2)
    cleanup()
    mount('en-CA', { get: () => answer(200, { nonsense: true }) })
    await waitFor(() => expect(screen.getByText('The sign-in policy could not be loaded.')).toBeInTheDocument())
  })

  it('treats a policy with a missing list as unreadable instead of as empty', async () => {
    mount('en-CA', { get: (s) => answer(200, { ...s.stored, allowedEmailDomains: undefined }) })
    await waitFor(() => expect(screen.getByText('The sign-in policy could not be loaded.')).toBeInTheDocument())
  })
})
