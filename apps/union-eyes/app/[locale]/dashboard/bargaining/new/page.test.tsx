// @vitest-environment jsdom
/**
 * The new-negotiation form: it sends what POST /api/bargaining/negotiations takes and nothing it refuses (the status, the costing and the confidentiality label are not
 * writable through the generic interface, so no input for them is offered), goes to the negotiation the server created, whose id is in the framework's envelope around the
 * generic writer's own { data }, and says in the server's words why a request failed instead of walking to an empty address.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/messages/en-CA.json'
import { NEGOTIATION_WRITABLE_FIELDS } from '@/lib/bargaining/negotiation-route-rules'

const h = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn() }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push, back: h.back }) }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

import NewNegotiationPage from './page'

const fetchMock = vi.fn()

const created = (id?: string) => ({ ok: true, status: 201, json: async () => ({ success: true, data: { data: id ? { id } : {} }, timestamp: 'now' }) })
const refused = (message: string) => ({ ok: false, status: 400, json: async () => ({ code: 'BAD_REQUEST', message, timestamp: 'now', traceId: 't' }) })

const fill = (id: string, value: string) => fireEvent.change(document.getElementById(id) as HTMLElement, { target: { value } })

function submitFilledForm() {
  render(
    <NextIntlClientProvider locale="en-CA" messages={en}>
      <NewNegotiationPage />
    </NextIntlClientProvider>,
  )
  fill('title', 'Round 1')
  fill('unionName', 'CUPE')
  fill('employerName', 'City of Ottawa')
  fill('bargainingUnitSize', '120')
  fireEvent.click(screen.getByRole('button', { name: /Create Negotiation/ }))
}

beforeEach(() => {
  h.push.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('NewNegotiationPage: what it sends', () => {
  it('sends only fields the route takes, and offers no input for the ones it refuses', async () => {
    fetchMock.mockResolvedValueOnce(created('neg-1'))
    submitFilledForm()
    await waitFor(() => expect(h.push).toHaveBeenCalled())

    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; body: string }]
    expect(url).toBe('/api/bargaining/negotiations')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body) as Record<string, unknown>
    for (const key of Object.keys(body)) expect(NEGOTIATION_WRITABLE_FIELDS, key).toContain(key)
    expect(body).toMatchObject({ title: 'Round 1', unionName: 'CUPE', employerName: 'City of Ottawa', bargainingUnitSize: 120 })
    for (const refusedKey of ['status', 'estimatedCost', 'confidentialityLevel']) {
      expect(body, refusedKey).not.toHaveProperty(refusedKey)
      expect(document.getElementById(refusedKey), refusedKey).toBeNull()
    }
  })
})

describe('NewNegotiationPage: what happens next', () => {
  it('goes to the negotiation the server created, whose id is under data.data', async () => {
    fetchMock.mockResolvedValueOnce(created('neg-1'))
    submitFilledForm()

    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/en-CA/dashboard/bargaining/negotiations/neg-1'))
  })

  it("says, in the server's words, why it was refused, and stays on the form", async () => {
    fetchMock.mockResolvedValueOnce(refused('Fields not allowed on this resource: status'))
    submitFilledForm()

    expect(await screen.findByRole('alert')).toHaveTextContent('Fields not allowed on this resource: status')
    expect(h.push).not.toHaveBeenCalled()
  })

  it('does not walk to an empty address when the answer names no negotiation', async () => {
    fetchMock.mockResolvedValueOnce(created())
    submitFilledForm()

    expect(await screen.findByRole('alert')).toHaveTextContent('did not say which one')
    expect(h.push).not.toHaveBeenCalled()
  })
})
