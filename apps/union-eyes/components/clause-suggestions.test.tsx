// @vitest-environment jsdom
/**
 * The clause suggestions panel talks to POST /api/grievances/[id]/suggest-clauses. What is proved here is the request it sends (the keys the route reads, `description`
 * to search and `clauseId` to link) and what the person sees when the route answers, refuses or cannot be reached: a link that did not happen is never shown as linked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import enCA from '@/messages/en-CA.json'
import frCA from '@/messages/fr-CA.json'
import { ClauseSuggestions } from './clause-suggestions'

const GRIEVANCE = '22222222-2222-4222-8222-222222222222'
const CLAUSE = '11111111-1111-4111-8111-111111111111'
const clause = { id: CLAUSE, title: 'Vacation scheduling', content: 'Vacation is scheduled by seniority.', articleNumber: '14', sectionNumber: '3', similarity: 0.8123 }

const fetchMock = vi.fn()

function renderPanel(props: Partial<React.ComponentProps<typeof ClauseSuggestions>> = {}, locale: 'en-CA' | 'fr-CA' = 'en-CA') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-CA' ? enCA : frCA}>
      <ClauseSuggestions grievanceId={GRIEVANCE} description="Vacation was refused" {...props} />
    </NextIntlClientProvider>,
  )
}

const answer = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => body })
const bodyOf = (call: number) => JSON.parse((fetchMock.mock.calls[call][1] as { body: string }).body) as Record<string, unknown>

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('ClauseSuggestions', () => {
  it('searches with the text in the box, to the route of the grievance, and shows what came back', async () => {
    fetchMock.mockResolvedValueOnce(answer({ data: [clause] }))
    renderPanel()
    expect(screen.getByText(/select “Find Clauses”/)).toBeInTheDocument()

    await userEvent.clear(screen.getByRole('textbox'))
    await userEvent.type(screen.getByRole('textbox'), '  overtime at straight time  ')
    await userEvent.click(screen.getByRole('button', { name: 'Find Clauses' }))

    expect(await screen.findByText('Vacation scheduling')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(`/api/grievances/${GRIEVANCE}/suggest-clauses`, expect.objectContaining({ method: 'POST' }))
    expect(bodyOf(0)).toEqual({ description: 'overtime at straight time' })
    expect(screen.getByText('Art. 14 § 3')).toBeInTheDocument()
    expect(screen.getByText('Relevance: 81%')).toBeInTheDocument()
  })

  it('says so when no clause matched, and does not claim the search has not run', async () => {
    fetchMock.mockResolvedValueOnce(answer({ data: [] }))
    renderPanel()
    await userEvent.click(screen.getByRole('button', { name: 'Find Clauses' }))
    expect(await screen.findByText('No clause matched. Try describing the issue differently.')).toBeInTheDocument()
    expect(screen.queryByText(/select “Find Clauses”/)).not.toBeInTheDocument()
  })

  it('does not search for nothing', async () => {
    renderPanel({ description: '' })
    expect(screen.getByRole('button', { name: 'Find Clauses' })).toBeDisabled()
    await userEvent.type(screen.getByRole('textbox'), '   ')
    expect(screen.getByRole('button', { name: 'Find Clauses' })).toBeDisabled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('links with the key the route reads, then shows the clause as linked and tells the caller', async () => {
    const onLink = vi.fn()
    fetchMock.mockResolvedValueOnce(answer({ data: [clause] })).mockResolvedValueOnce(answer({ data: { linked: true } }))
    renderPanel({ onLink })
    await userEvent.click(screen.getByRole('button', { name: 'Find Clauses' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Link' }))

    await waitFor(() => expect(screen.getByText('Linked')).toBeInTheDocument())
    expect(Object.keys(bodyOf(1))).toEqual(['clauseId'])
    expect(bodyOf(1)).toEqual({ clauseId: CLAUSE })
    expect(onLink).toHaveBeenCalledWith(CLAUSE)
    expect(screen.queryByRole('button', { name: 'Link' })).not.toBeInTheDocument()
  })

  it('never shows a clause as linked when the route refused, and says what failed', async () => {
    const onLink = vi.fn()
    fetchMock.mockResolvedValueOnce(answer({ data: [clause] })).mockResolvedValueOnce(answer({ error: { message: 'nope' } }, false))
    renderPanel({ onLink })
    await userEvent.click(screen.getByRole('button', { name: 'Find Clauses' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The clause could not be linked to the grievance. Try again.')
    expect(screen.queryByText('Linked')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Link' })).toBeEnabled()
    expect(onLink).not.toHaveBeenCalled()
  })

  it('says what failed when the search is refused or the network is down', async () => {
    fetchMock.mockResolvedValueOnce(answer({ error: { message: 'nope' } }, false)).mockRejectedValueOnce(new Error('offline'))
    renderPanel()
    await userEvent.click(screen.getByRole('button', { name: 'Find Clauses' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The clauses could not be searched. Try again.')
    await userEvent.click(screen.getByRole('button', { name: 'Find Clauses' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('alert')).toHaveTextContent('The clauses could not be searched. Try again.')
  })

  it('speaks French in the French locale', async () => {
    fetchMock.mockResolvedValueOnce(answer({ data: [clause] }))
    renderPanel({}, 'fr-CA')
    expect(screen.getByText('Intelligence des clauses de la convention')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Trouver des clauses' }))
    expect(await screen.findByText('art. 14 § 3')).toBeInTheDocument()
    expect(screen.getByText('Pertinence : 81 %')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lier' })).toBeInTheDocument()
  })
})
