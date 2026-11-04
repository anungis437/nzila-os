// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import enCA from '../../../../../messages/en-CA.json'

import VotingPage from '../page'

const stamp = '2026-05-01T12:00:00.000Z'
const success = (data: unknown) => ({ success: true, data, timestamp: stamp })
const failure = (code: string, message: string) => ({ code, message, timestamp: stamp, traceId: 't-1' })
const reply = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

// A voting_sessions row as GET /api/voting/sessions answers it: the columns, plus the options and the participation count it adds.
const session = (overrides: Record<string, unknown> = {}) => ({
  id: 'sess-1',
  title: 'Ratification vote',
  description: 'Vote on the tentative agreement',
  type: 'ratification',
  status: 'active',
  meetingType: 'ratification',
  organizationId: 'org-1',
  createdBy: 'user-9',
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-01T10:00:00.000Z',
  startTime: '2026-04-02T10:00:00.000Z',
  endTime: '2099-12-31T10:00:00.000Z',
  scheduledEndTime: null,
  allowAnonymous: true,
  requiresQuorum: true,
  quorumThreshold: 50,
  totalEligibleVoters: 40,
  settings: {},
  metadata: {},
  options: [
    { id: 'opt-yes', text: 'Yes', description: null, orderIndex: 0 },
    { id: 'opt-no', text: 'No', description: null, orderIndex: 1 },
  ],
  totalVotes: 12,
  resultsWithheld: true,
  ...overrides,
})
const listBody = (sessions: unknown[], total = sessions.length) => success({ sessions, total, page: 1, limit: 50 })

type Init = { method?: string; body?: string }
type Handler = (url: string, init?: Init) => ReturnType<typeof reply> | Promise<ReturnType<typeof reply>>
function stubFetch(handler: Handler) {
  const fetchMock = vi.fn(async (url: string, init?: Init) => handler(url, init))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const isList = (url: string) => url.startsWith('/api/voting/sessions?')
const isVoteCheck = (url: string, init?: Init) => /\/api\/voting\/sessions\/[^/?]+\/vote$/.test(url) && (init?.method ?? 'GET') === 'GET'
const isVotePost = (url: string, init?: Init) => /\/api\/voting\/sessions\/[^/?]+\/vote$/.test(url) && init?.method === 'POST'

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en-CA" messages={enCA}>
      <VotingPage />
    </NextIntlClientProvider>,
  )
}

const openCard = (title: string) => fireEvent.click(screen.getByRole('button', { name: title }))

beforeEach(() => {
  vi.spyOn(window, 'alert').mockImplementation(() => undefined)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('voting page: what it shows', () => {
  it('shows an open ballot with the turnout its rows give, and no participation figure nothing measured', async () => {
    stubFetch((url, init) => {
      if (isList(url)) return reply(listBody([session()]))
      if (isVoteCheck(url, init)) return reply(success({ hasVoted: false }))
      throw new Error(`unexpected ${url}`)
    })
    renderPage()
    expect(await screen.findByText('Ratification vote')).toBeInTheDocument()
    expect(screen.getByText('12 of 40 voters (30%)')).toBeInTheDocument()
    expect(screen.getByText('Quorum: 50%')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '30')
    expect(screen.queryByText('85%')).not.toBeInTheDocument()
    const votesCastCard = screen.getByText('Votes Cast').closest('div')!.parentElement!
    expect(within(votesCastCard).getByText('12')).toBeInTheDocument()
  })

  it('shows no turnout when the session never recorded how many members may vote', async () => {
    stubFetch((url, init) => {
      if (isList(url)) return reply(listBody([session({ totalEligibleVoters: 0 })]))
      if (isVoteCheck(url, init)) return reply(success({ hasVoted: false }))
      throw new Error(`unexpected ${url}`)
    })
    renderPage()
    expect(await screen.findByText('12 votes cast')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/Quorum/)).not.toBeInTheDocument()
  })

  it('lists a draft as upcoming, a paused ballot as open without a way to vote, and a cancelled one as past', async () => {
    stubFetch((url) => {
      if (isList(url)) {
        return reply(
          listBody([
            session({ id: 'sess-draft', title: 'Draft ballot', status: 'draft', totalVotes: 0 }),
            session({ id: 'sess-paused', title: 'Paused ballot', status: 'paused' }),
            session({ id: 'sess-cancelled', title: 'Cancelled ballot', status: 'cancelled' }),
          ]),
        )
      }
      throw new Error(`unexpected ${url}`)
    })
    renderPage()
    expect(await screen.findByText('Paused ballot')).toBeInTheDocument()
    expect(screen.getByText('Paused')).toBeInTheDocument()
    openCard('Paused ballot')
    expect(screen.queryByText('Cast Your Vote')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: /Upcoming \(1\)/ }))
    expect(screen.getByText('Draft ballot')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Past Results \(1\)/ }))
    expect(screen.getByText('Cancelled ballot')).toBeInTheDocument()
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
  })

  it('says nothing of a closing date the session does not have, rather than "Invalid Date"', async () => {
    stubFetch((url) => {
      if (isList(url)) return reply(listBody([session({ status: 'closed', endTime: null })]))
      throw new Error(`unexpected ${url}`)
    })
    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: /Past Results \(1\)/ }))
    expect(await screen.findByText(/Ends: —/)).toBeInTheDocument()
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument()
  })

  it("tells a closed ballot's member that the tally is released by the election officer, and shows no percentage", async () => {
    stubFetch((url) => {
      if (isList(url)) return reply(listBody([session({ status: 'closed' })]))
      throw new Error(`unexpected ${url}`)
    })
    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: /Past Results \(1\)/ }))
    openCard('Ratification vote')
    expect(screen.getAllByText(enCA.voting.resultsWithheld).length).toBeGreaterThan(0)
    expect(screen.queryByText(/%\s*\(\d+\)/)).not.toBeInTheDocument()
  })

  it('does not promise reminders or live results nothing sends', async () => {
    stubFetch((url) => {
      if (isList(url)) return reply(listBody([]))
      throw new Error(`unexpected ${url}`)
    })
    renderPage()
    expect(await screen.findByText(enCA.voting.noActiveVotes)).toBeInTheDocument()
    expect(screen.queryByText(/reminders/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/after voting closes or you cast your vote/i)).not.toBeInTheDocument()
  })

  it('reads every page of the sessions the route reports in total', async () => {
    const fetchMock = stubFetch((url) => {
      if (url === '/api/voting/sessions?page=1&limit=50') {
        return reply(
          success({
            sessions: [session({ id: 'a', title: 'Ballot A', status: 'closed' }), session({ id: 'b', title: 'Ballot B', status: 'closed' })],
            total: 3,
            page: 1,
            limit: 50,
          }),
        )
      }
      if (url === '/api/voting/sessions?page=2&limit=50') {
        return reply(success({ sessions: [session({ id: 'c', title: 'Ballot C', status: 'closed' })], total: 3, page: 2, limit: 50 }))
      }
      throw new Error(`unexpected ${url}`)
    })
    renderPage()
    fireEvent.click(await screen.findByRole('tab', { name: /Past Results \(3\)/ }))
    expect(screen.getByText('Ballot A')).toBeInTheDocument()
    expect(screen.getByText('Ballot C')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('voting page: casting a vote', () => {
  it('selects an option without casting, and casts the one selected only when the ballot is submitted', async () => {
    let voted = false
    const fetchMock = stubFetch((url, init) => {
      if (isList(url)) return reply(listBody([session({ totalVotes: voted ? 13 : 12 })]))
      if (isVoteCheck(url, init)) return reply(success({ hasVoted: voted }))
      if (isVotePost(url, init)) {
        voted = true
        // The route's own answer: the receipt, whose receipt id is the votes row's (none is generated today).
        return reply(success({ vote: { id: 'vote-1', sessionId: 'sess-1', castAt: stamp }, receiptId: null }))
      }
      throw new Error(`unexpected ${url}`)
    })
    renderPage()
    await screen.findByText('Ratification vote')
    openCard('Ratification vote')
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    expect(fetchMock.mock.calls.some(([url, init]) => isVotePost(url, init))).toBe(false)
    expect(screen.getByText(enCA.voting.casting.reviewDescription)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: enCA.voting.casting.buttonSubmit }))
    expect(await screen.findByRole('status')).toHaveTextContent(enCA.voting.casting.toastSuccess)

    const posts = fetchMock.mock.calls.filter(([url, init]) => isVotePost(url, init))
    expect(posts).toHaveLength(1)
    expect(posts[0][0]).toBe('/api/voting/sessions/sess-1/vote')
    expect(JSON.parse(posts[0][1]!.body!)).toEqual({ optionId: 'opt-yes' })
    // The list was read again: the participation count and the "voted" state come from the server.
    expect(await screen.findByText('13 votes cast')).toBeInTheDocument()
    expect(screen.getByText(enCA.voting.youVoted)).toBeInTheDocument()
    expect(screen.queryByText('Cast Your Vote')).not.toBeInTheDocument()
  })

  it('states why a vote was refused, beside the ballot, and keeps the ballot open to vote', async () => {
    stubFetch((url, init) => {
      if (isList(url)) return reply(listBody([session()]))
      if (isVoteCheck(url, init)) return reply(success({ hasVoted: false }))
      if (isVotePost(url, init)) return reply(failure('FORBIDDEN', 'Voter is not eligible'), 403)
      throw new Error(`unexpected ${url}`)
    })
    renderPage()
    await screen.findByText('Ratification vote')
    openCard('Ratification vote')
    fireEvent.click(screen.getByRole('button', { name: 'No' }))
    fireEvent.click(screen.getByRole('button', { name: enCA.voting.casting.buttonSubmit }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Voter is not eligible')
    expect(window.alert).not.toHaveBeenCalled()
    expect(screen.queryByText(enCA.voting.youVoted)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument()
  })

  it('does not offer the ballot to a member who has voted', async () => {
    stubFetch((url, init) => {
      if (isList(url)) return reply(listBody([session()]))
      if (isVoteCheck(url, init)) return reply(success({ hasVoted: true }))
      throw new Error(`unexpected ${url}`)
    })
    renderPage()
    await screen.findByText('Ratification vote')
    expect(await screen.findByText(enCA.voting.youVoted)).toBeInTheDocument()
    openCard('Ratification vote')
    expect(screen.queryByText('Cast Your Vote')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument()
    expect(screen.getAllByText(enCA.voting.resultsWithheld).length).toBeGreaterThan(0)
  })

  it('does not offer the ballot when it could not be checked whether the member has voted, and checks again on request', async () => {
    let checks = 0
    stubFetch((url, init) => {
      if (isList(url)) return reply(listBody([session()]))
      if (isVoteCheck(url, init)) {
        checks += 1
        return checks === 1 ? reply(failure('INTERNAL_ERROR', 'An internal error occurred'), 500) : reply(success({ hasVoted: false }))
      }
      throw new Error(`unexpected ${url}`)
    })
    renderPage()
    await screen.findByText('Ratification vote')
    openCard('Ratification vote')
    expect(await screen.findByText(enCA.voting.voteStatusUnknown)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument()
    expect(screen.queryByText(enCA.voting.youVoted)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('button', { name: 'Yes' })).toBeInTheDocument()
    expect(screen.queryByText(enCA.voting.voteStatusUnknown)).not.toBeInTheDocument()
  })
})

describe('voting page: failures', () => {
  it("shows the server's message with a retry, and no empty state or zero counts, when the sessions cannot be listed", async () => {
    let attempts = 0
    stubFetch((url, init) => {
      if (isList(url)) {
        attempts += 1
        return attempts === 1 ? reply(failure('INTERNAL_ERROR', 'The voting service is down'), 500) : reply(listBody([session({ status: 'closed' })]))
      }
      if (isVoteCheck(url, init)) return reply(success({ hasVoted: false }))
      throw new Error(`unexpected ${url}`)
    })
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('The voting service is down')
    expect(screen.queryByText(enCA.voting.noActiveVotes)).not.toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3)
    expect(screen.queryByText('0')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    fireEvent.click(await screen.findByRole('tab', { name: /Past Results \(1\)/ }))
    expect(screen.getByText('Ratification vote')).toBeInTheDocument()
  })

  it("reports a response that is not the route's shape as a failure to load, not as an empty list", async () => {
    const withoutOptions: Record<string, unknown> = session()
    delete withoutOptions.options
    stubFetch((url) => {
      if (isList(url)) return reply(listBody([withoutOptions]))
      throw new Error(`unexpected ${url}`)
    })
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent(enCA.errors.loadingError)
    expect(screen.queryByText(enCA.voting.noActiveVotes)).not.toBeInTheDocument()
  })

  it('reports an unreachable network as a failure to load', async () => {
    stubFetch(() => {
      throw new TypeError('Failed to fetch')
    })
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent(enCA.errors.loadingError)
  })
})
