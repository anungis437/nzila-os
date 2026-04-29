import { createHash } from 'node:crypto'
import type { TreasuryProposal, VoteRecord } from './types.js'

function generateId(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, 32)
}

export interface SubmitProposalInput {
  orgId: string
  proposedBy: string
  title: string
  description: string
  requestedAmountCents: number
  currency: string
  voteDeadline: string
}

export interface TallyResult {
  forVotes: number
  againstVotes: number
  abstainVotes: number
  quorumMet: boolean
  passed: boolean
}

const MIN_QUORUM_VOTES = 3

export function submitProposal(input: SubmitProposalInput): TreasuryProposal {
  const now = new Date().toISOString()
  return {
    id: generateId(`proposal:${input.orgId}:${input.proposedBy}:${now}`),
    orgId: input.orgId,
    proposedBy: input.proposedBy,
    title: input.title,
    description: input.description,
    requestedAmountCents: input.requestedAmountCents,
    currency: input.currency,
    status: 'draft',
    voteDeadline: input.voteDeadline,
    createdAt: now,
  }
}

export function castVote(proposal: TreasuryProposal, _vote: VoteRecord): TreasuryProposal {
  if (proposal.status !== 'voting') {
    throw new Error(`Cannot vote on proposal with status: ${proposal.status}`)
  }
  return proposal
}

export function tallyVotes(proposal: TreasuryProposal, votes: VoteRecord[]): TallyResult {
  const forVotes = votes.filter((v) => v.vote === 'for').length
  const againstVotes = votes.filter((v) => v.vote === 'against').length
  const abstainVotes = votes.filter((v) => v.vote === 'abstain').length
  const totalVotes = votes.length
  const quorumMet = totalVotes >= MIN_QUORUM_VOTES
  const passed = quorumMet && forVotes > againstVotes
  return { forVotes, againstVotes, abstainVotes, quorumMet, passed }
}

export function executeProposal(proposal: TreasuryProposal): TreasuryProposal {
  if (proposal.status !== 'approved') {
    throw new Error(`Cannot execute a proposal with status: ${proposal.status}`)
  }
  return {
    ...proposal,
    status: 'executed',
    executedAt: new Date().toISOString(),
  }
}
