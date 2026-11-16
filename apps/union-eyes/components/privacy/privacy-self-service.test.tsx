// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import { PrivacySelfService } from './privacy-self-service'

const context = vi.hoisted(() => ({ organizationId: '11111111-1111-4111-8111-111111111111' as string | null }))
vi.mock('@/contexts/organization-context', () => ({ useOrganizationId: () => context.organizationId }))
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const threadId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const request = {
  id: requestId, threadId, requestType: 'access', scopes: ['account_profile'], description: 'Please provide my account information.',
  status: 'pending', stage: 'received', requestedAt: '2026-11-16T10:00:00.000Z', responseTargetAt: '2026-12-16T10:00:00.000Z',
  completedAt: null, handlerAssigned: false, identityReviewed: false, responses: [], messages: [], latestResponseId: null,
  canExport: false, requiresExportReceipt: false, canAcknowledge: false, canCancel: true,
}
const answer = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } })
const view = (locale = 'en-CA') => <NextIntlClientProvider locale={locale} messages={{}}><PrivacySelfService /></NextIntlClientProvider>
beforeEach(() => { context.organizationId = '11111111-1111-4111-8111-111111111111' })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('privacy self-service screens', () => {
  it('shows a failed load instead of an empty or successful request history', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })))
    render(view())
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be completed')
    expect(screen.queryByText('You have no privacy requests on file.')).not.toBeInTheDocument()
  })

  it('persists through the API and reloads the receipt without offering acknowledgement prematurely', async () => {
    let saved = false
    const fetcher = vi.fn().mockImplementation(async (path, options) => {
      if (options.method === 'POST') { saved = true; return answer({ request, duplicate: false }, 201) }
      if (path === `/api/privacy/dsar/${requestId}`) return answer({ request })
      return answer({ requests: saved ? [request] : [] })
    })
    vi.stubGlobal('fetch', fetcher)
    render(view())
    await screen.findByText('You have no privacy requests on file.')
    fireEvent.change(screen.getByLabelText('Describe your request'), { target: { value: request.description } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }))
    expect(await screen.findByTestId('privacy-request-detail')).toHaveTextContent('Identity review pending')
    expect(screen.queryByRole('button', { name: 'Acknowledge this response' })).not.toBeInTheDocument()
    const [, options] = fetcher.mock.calls.find(([, init]) => init.method === 'POST')!
    expect(options.headers.get('x-ue-expected-organization')).toBe(context.organizationId)
    expect(JSON.parse(options.body)).toMatchObject({ requestType: 'access', scopes: ['account_profile'], description: request.description })
  })

  it('reuses the same submission nonce after an unknown network outcome', async () => {
    const inputs: Array<{clientRequestId:string}> = []
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_path, options) => {
      if (options.method === 'POST') { inputs.push(JSON.parse(options.body)); throw new TypeError('Connection lost') }
      return answer({ requests: [] })
    }))
    render(view())
    await screen.findByText('You have no privacy requests on file.')
    fireEvent.change(screen.getByLabelText('Describe your request'), { target: { value: request.description } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Submit request' }))
    await waitFor(() => expect(inputs).toHaveLength(2))
    expect(inputs[1].clientRequestId).toBe(inputs[0].clientRequestId)
    expect(screen.queryByText('Request received and saved.')).not.toBeInTheDocument()
  })

  it('discards old private information and ignores an old response after an organization switch', async () => {
    let release!: (response: Response) => void
    const old = new Promise<Response>(resolve => { release = resolve })
    const fetcher = vi.fn().mockImplementation(async (_path, options) =>
      options.headers.get('x-ue-expected-organization') === context.organizationId && context.organizationId?.startsWith('1111') ? old : answer({ requests: [] }))
    vi.stubGlobal('fetch', fetcher)
    const rendered = render(view())
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    context.organizationId = '22222222-2222-4222-8222-222222222222'
    rendered.rerender(view())
    await screen.findByText('You have no privacy requests on file.')
    release(answer({ requests: [request] }))
    await waitFor(() => expect(screen.queryByText(request.description)).not.toBeInTheDocument())
    expect(screen.queryByTestId('privacy-request-detail')).not.toBeInTheDocument()
  })

  it('uses French request controls and refuses to operate with no active organization', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(answer({ requests: [] })))
    const rendered = render(view('fr-CA'))
    await screen.findByText('Aucune demande enregistrée.')
    expect(screen.getByLabelText('Type de demande')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Soumettre' })).toBeInTheDocument()
    context.organizationId = null
    rendered.rerender(view('fr-CA'))
    expect(screen.getByRole('status')).toHaveTextContent('Sélectionnez une organisation active')
    expect(screen.queryByRole('button', { name: 'Soumettre' })).not.toBeInTheDocument()
  })
})
