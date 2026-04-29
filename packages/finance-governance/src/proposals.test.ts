import { describe, it, expect } from 'vitest'
import { submitProposal, tallyVotes, executeProposal } from './proposals.js'
import type { VoteRecord } from './types.js'

describe('submitProposal', () => {
  it('creates proposal in draft state', () => {
    const proposal = submitProposal({
      orgId: 'org-1',
      proposedBy: 'member-1',
      title: 'Community Garden Fund',
      description: 'Request for community garden supplies',
      requestedAmountCents: 500000,
      currency: 'ZAR',
      voteDeadline: '2024-12-31T00:00:00.000Z',
    })
    expect(proposal.status).toBe('draft')
    expect(proposal.orgId).toBe('org-1')
  })
})

describe('tallyVotes', () => {
  it('tallies votes correctly and detects quorum', () => {
    const proposal = submitProposal({
      orgId: 'org-1',
      proposedBy: 'member-1',
      title: 'Test Proposal',
      description: 'Test',
      requestedAmountCents: 100000,
      currency: 'ZAR',
      voteDeadline: '2024-12-31T00:00:00.000Z',
    })
    const votes: VoteRecord[] = [
      { id: 'v1', orgId: 'org-1', proposalId: proposal.id, voterId: 'u1', vote: 'for', votedAt: new Date().toISOString() },
      { id: 'v2', orgId: 'org-1', proposalId: proposal.id, voterId: 'u2', vote: 'for', votedAt: new Date().toISOString() },
      { id: 'v3', orgId: 'org-1', proposalId: proposal.id, voterId: 'u3', vote: 'against', votedAt: new Date().toISOString() },
    ]
    const tally = tallyVotes(proposal, votes)
    expect(tally.forVotes).toBe(2)
    expect(tally.againstVotes).toBe(1)
    expect(tally.quorumMet).toBe(true)
    expect(tally.passed).toBe(true)
  })

  it('proposal does not pass without quorum', () => {
    const proposal = submitProposal({
      orgId: 'org-1',
      proposedBy: 'member-1',
      title: 'Test',
      description: 'Test',
      requestedAmountCents: 100000,
      currency: 'ZAR',
      voteDeadline: '2024-12-31T00:00:00.000Z',
    })
    const votes: VoteRecord[] = [
      { id: 'v1', orgId: 'org-1', proposalId: proposal.id, voterId: 'u1', vote: 'for', votedAt: new Date().toISOString() },
    ]
    const tally = tallyVotes(proposal, votes)
    expect(tally.quorumMet).toBe(false)
    expect(tally.passed).toBe(false)
  })
})

describe('executeProposal', () => {
  it('executes an approved proposal', () => {
    const proposal = { ...submitProposal({
      orgId: 'org-1',
      proposedBy: 'member-1',
      title: 'Test',
      description: 'Test',
      requestedAmountCents: 100000,
      currency: 'ZAR',
      voteDeadline: '2024-12-31T00:00:00.000Z',
    }), status: 'approved' as const }
    const executed = executeProposal(proposal)
    expect(executed.status).toBe('executed')
    expect(executed.executedAt).toBeTruthy()
  })

  it('throws for non-approved proposals', () => {
    const proposal = submitProposal({
      orgId: 'org-1',
      proposedBy: 'member-1',
      title: 'Test',
      description: 'Test',
      requestedAmountCents: 100000,
      currency: 'ZAR',
      voteDeadline: '2024-12-31T00:00:00.000Z',
    })
    expect(() => executeProposal(proposal)).toThrow()
  })
})
